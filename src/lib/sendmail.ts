// 发送邮件：Resend / SMTP / SEND_MAIL binding
import { Env, SendMailRequest } from "@/types";
import {
  getBooleanValue,
  getDomainMapValue,
  getDomains,
  getIntValue,
  getJsonObjectValue,
  getMailDomain,
  getStringValue,
  includesDomain,
  isSendMailBindingEnabled,
} from "./config";
import { getJsonSetting, updateAddressUpdatedAt } from "./db";
import { CONSTANTS } from "./constants";

export interface SendMailContext {
  env: Env;
  q: {
    get(name: string): string | null;
  };
}

const getResendToken = (env: Env, mailDomain: string): string => {
  const domainKey = `RESEND_TOKEN_${mailDomain.replace(/\./g, "_").toUpperCase()}`;
  const envRecord = env as unknown as Record<string, unknown>;
  return getStringValue(envRecord[domainKey]) || getStringValue(env.RESEND_TOKEN);
};

export const sendMailByResend = async (
  env: Env,
  address: string,
  reqJson: SendMailRequest
): Promise<void> => {
  const mailDomain = getMailDomain(address);
  const token = getResendToken(env, mailDomain);
  const { Resend } = await import("resend");
  const resend = new Resend(token);
  const { data, error } = await resend.emails.send({
    from: reqJson.from_name ? `${reqJson.from_name} <${address}>` : address,
    to: reqJson.to_name ? `${reqJson.to_name} <${reqJson.to_mail}>` : reqJson.to_mail,
    subject: reqJson.subject,
    ...(reqJson.is_html ? { html: reqJson.content } : { text: reqJson.content }),
  });
  if (error) {
    throw new Error(`Resend error: ${error.name} ${error.message}`);
  }
  console.log(`Resend success: ${JSON.stringify(data)}`);
};

export const sendMailBySmtp = async (
  env: Env,
  address: string,
  reqJson: SendMailRequest,
  smtpOptions: Record<string, unknown>
): Promise<void> => {
  const { WorkerMailer } = await import("worker-mailer");
  await WorkerMailer.send(smtpOptions as any, {
    from: { name: reqJson.from_name, email: address },
    to: { name: reqJson.to_name, email: reqJson.to_mail },
    subject: reqJson.subject,
    text: reqJson.is_html ? undefined : reqJson.content,
    html: reqJson.is_html ? reqJson.content : undefined,
  });
};

export const sendMailByBinding = async (
  env: Env,
  address: string,
  reqJson: SendMailRequest
): Promise<void> => {
  await env.SEND_MAIL.send({
    from: reqJson.from_name ? { email: address, name: reqJson.from_name } : address,
    to: reqJson.to_name ? [`${reqJson.to_name} <${reqJson.to_mail}>`] : [reqJson.to_mail],
    subject: reqJson.subject,
    ...(reqJson.is_html ? { html: reqJson.content } : { text: reqJson.content }),
  });
};

export const getSendBalanceState = async (
  env: Env,
  address: string,
  options?: { isAdmin?: boolean; initializeDefaultBalance?: boolean }
): Promise<{ isNoLimitSender: boolean; needCheckBalance: boolean; balance: number | null }> => {
  const noLimitSendAddressList =
    (await getJsonSetting<string[]>(env, CONSTANTS.NO_LIMIT_SEND_ADDRESS_LIST_KEY)) || [];
  const isNoLimitSender = noLimitSendAddressList.includes(address);
  const needCheckBalance = !options?.isAdmin && !isNoLimitSender;
  if (needCheckBalance && options?.initializeDefaultBalance !== false) {
    const default_balance = getIntValue(env.DEFAULT_SEND_BALANCE, 0);
    if (default_balance > 0) {
      await env.DB.prepare(
        `INSERT INTO address_sender (address, balance, enabled) VALUES (?, ?, ?)
         ON CONFLICT(address) DO NOTHING`
      )
        .bind(address, default_balance, 1)
        .run();
    }
  }
  if (isNoLimitSender) {
    return { isNoLimitSender: true, needCheckBalance: false, balance: 99999 };
  }
  const balance = needCheckBalance
    ? await env.DB.prepare(
        `SELECT balance FROM address_sender where address = ? and enabled = 1`
      )
        .bind(address)
        .first<number>("balance")
    : null;
  return { isNoLimitSender: false, needCheckBalance, balance };
};

export const sendMail = async (
  env: Env,
  address: string,
  reqJson: SendMailRequest,
  options?: { isAdmin?: boolean; sourceIp?: string }
): Promise<void> => {
  if (!address) throw new Error("地址不存在");
  const mailDomain = getMailDomain(address);
  const domains = getDomains(env);
  if (!includesDomain(domains, mailDomain)) {
    throw new Error(`无效域名: ${mailDomain}`);
  }
  const sendBalanceState = await getSendBalanceState(env, address, { isAdmin: options?.isAdmin });
  if (sendBalanceState.needCheckBalance) {
    if (!sendBalanceState.balance || sendBalanceState.balance <= 0) {
      throw new Error("余额不足");
    }
  }
  const { to_mail, subject, content } = reqJson;
  if (!to_mail) throw new Error("收件人不能为空");
  const sendBlockList = (await getJsonSetting<string[]>(env, CONSTANTS.SEND_BLOCK_LIST_KEY)) || [];
  if (sendBlockList.some((item) => to_mail.includes(item))) {
    throw new Error("收件人被屏蔽");
  }
  if (!subject) throw new Error("主题不能为空");
  if (!content) throw new Error("内容不能为空");

  const resendEnabled = !!getResendToken(env, mailDomain);
  const smtpConfigMap = getJsonObjectValue<Record<string, Record<string, unknown>>>(env.SMTP_CONFIG);
  const smtpConfig = getDomainMapValue(smtpConfigMap, mailDomain);
  const sendMailBindingEnabled = isSendMailBindingEnabled(env, mailDomain);

  let sendByVerifiedAddressList = false;
  if (env.SEND_MAIL) {
    const verifiedAddressList =
      (await getJsonSetting<string[]>(env, CONSTANTS.VERIFIED_ADDRESS_LIST_KEY)) || [];
    if (verifiedAddressList.includes(to_mail)) {
      const { createMimeMessage } = await import("mimetext");
      const msg = createMimeMessage();
      msg.setSender(reqJson.from_name ? { name: reqJson.from_name, addr: address } : address);
      msg.setRecipient(reqJson.to_name ? { name: reqJson.to_name, addr: to_mail } : to_mail);
      msg.setSubject(subject);
      msg.addMessage({
        contentType: reqJson.is_html ? "text/html" : "text/plain",
        data: content,
      });
      // 用变量形式动态 import，避免 esbuild 静态解析 cloudflare: 运行时模块
      const cfEmailModuleName = "cloudflare:email";
      const { EmailMessage } = await import(cfEmailModuleName);
      const message = new EmailMessage(address, to_mail, msg.asRaw());
      await env.SEND_MAIL.send(message);
      sendByVerifiedAddressList = true;
    }
  }

  if (!sendByVerifiedAddressList) {
    if (resendEnabled) {
      await sendMailByResend(env, address, reqJson);
    } else if (smtpConfig) {
      await sendMailBySmtp(env, address, reqJson, smtpConfig);
    } else if (sendMailBindingEnabled) {
      await sendMailByBinding(env, address, reqJson);
    } else {
      throw new Error(`请先为此域名启用 resend、smtp 或 SEND_MAIL (${mailDomain})`);
    }
  }

  // 扣减余额
  if (!sendByVerifiedAddressList && sendBalanceState.needCheckBalance) {
    try {
      await env.DB.prepare(`UPDATE address_sender SET balance = balance - 1 where address = ?`)
        .bind(address)
        .run();
    } catch (e) {
      console.warn(`Failed to update balance for ${address}`, e);
    }
  }
  updateAddressUpdatedAt(env, address);

  // 保存到发件箱
  try {
    const body = { version: "v2", ...reqJson, sourceIp: options?.sourceIp || "" };
    await env.DB.prepare(`INSERT INTO sendbox (address, raw) VALUES (?, ?)`)
      .bind(address, JSON.stringify(body))
      .run();
  } catch (e) {
    console.warn(`Failed to save to sendbox for ${address}`, e);
  }
};

export const getSendbox = async (
  env: Env,
  address: string,
  limit: string | null,
  offset: string | null
): Promise<{ results: any[]; count: number }> => {
  const { handleListQuery } = await import("./db");
  const result = await handleListQuery(
    env,
    `SELECT * FROM sendbox where address = ?`,
    `SELECT count(*) as count FROM sendbox where address = ?`,
    [address],
    limit || "20",
    offset || "0"
  );
  if ("error" in result) throw new Error(result.error);
  return result;
};