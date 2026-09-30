// 垃圾邮件检测入口
import { Env } from "@/types";
import { getBooleanValue, getStringArray } from "../config";
import { commonParseMail } from "./parse";
import { isJunkMailByHeaders } from "./junk_mail_policy";

export const check_if_junk_mail = async (
  env: Env,
  address: string,
  parsedEmailContext: { rawEmail: string },
  message_id: string | null
): Promise<boolean> => {
  if (!getBooleanValue(env.ENABLE_CHECK_JUNK_MAIL)) return false;
  const parsedEmail = await commonParseMail(parsedEmailContext.rawEmail);
  if (!parsedEmail?.headers) return false;
  const checkListWhenExist = getStringArray(env.JUNK_MAIL_CHECK_LIST);
  const forcePassList = getStringArray(env.JUNK_MAIL_FORCE_PASS_LIST);
  return isJunkMailByHeaders(parsedEmail.headers, checkListWhenExist, forcePassList);
};