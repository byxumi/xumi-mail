// 兑换码核心逻辑（适配本仓库架构）
// 支持三类兑换：role(用户角色) / send_balance(发信余额) / address_prefix_once(地址前缀)

import { Env } from "@/types";
import {
  getBooleanValue,
  getIntValue,
  getJsonObjectValue,
  getStringValue,
  getUserRoles,
  trimLower,
} from "./config";
import { ApiError } from "./server";
import { generateRandomName, newAddress } from "./address";

export enum RedeemType {
  Role = "role",
  SendBalance = "send_balance",
  AddressPrefixOnce = "address_prefix_once",
}

export type RedeemValue =
  | { type: RedeemType.Role; role: string }
  | { type: RedeemType.SendBalance; amount: number }
  | { type: RedeemType.AddressPrefixOnce; prefix: string };

export type RedeemCodeRow = {
  id: number;
  code: string;
  redeem_type: string;
  value: string;
  redeemed: 0 | 1;
  result: string | null;
};

export type RoleRedeemResult = {
  type: RedeemType.Role;
  user_id: number;
  user_email: string;
  role: string;
};

export type SendBalanceRedeemResult = {
  type: RedeemType.SendBalance;
  address: string;
  amount: number;
};

export type AddressRedeemResult = {
  type: RedeemType.AddressPrefixOnce;
  address: string;
  address_id: number;
  jwt: string;
  password?: string | null;
};

export const isRedeemType = (value: unknown): value is RedeemType =>
  typeof value === "string" && Object.values(RedeemType).some((t) => t === value);

const RESULT_ENCRYPTION_PREFIX = "enc:v1:";

const encodeBase64Url = (value: Uint8Array): string => {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const decodeBase64Url = (value: string): Uint8Array => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

let cachedResultKey: { secret: string; key: Promise<CryptoKey> } | null = null;

const getResultEncryptionKey = async (env: Env): Promise<CryptoKey> => {
  if (cachedResultKey?.secret === env.JWT_SECRET) return await cachedResultKey.key;
  const key = crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(`redeem-result:${env.JWT_SECRET}`))
    .then((keyBytes) =>
      crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"])
    );
  cachedResultKey = { secret: env.JWT_SECRET, key };
  return await key;
};

const getResultAdditionalData = (rowId: number): Uint8Array =>
  new TextEncoder().encode(`redeem-result:${rowId}`);

export const encryptRedeemResult = async (
  env: Env,
  rowId: number,
  value: string
): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as unknown as BufferSource,
      additionalData: getResultAdditionalData(rowId) as unknown as BufferSource,
    },
    await getResultEncryptionKey(env),
    new TextEncoder().encode(value)
  );
  return `${RESULT_ENCRYPTION_PREFIX}${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(encrypted))}`;
};

export const decryptRedeemResult = async (
  env: Env,
  rowId: number,
  value: string | null
): Promise<string | null> => {
  if (!value) return value;
  try {
    if (!value.startsWith(RESULT_ENCRYPTION_PREFIX)) return null;
    const [ivValue, encryptedValue, ...extra] = value
      .slice(RESULT_ENCRYPTION_PREFIX.length)
      .split(".");
    if (!ivValue || !encryptedValue || extra.length) return null;
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64Url(ivValue) as unknown as BufferSource,
        additionalData: getResultAdditionalData(rowId) as unknown as BufferSource,
      },
      await getResultEncryptionKey(env),
      decodeBase64Url(encryptedValue) as unknown as BufferSource
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.warn(`Failed to decrypt redemption result ${rowId}`, e);
    return null;
  }
};

export const parseRedeemValue = (
  env: Env,
  redeemType: RedeemType,
  value: string
): RedeemValue | null => {
  const normalizedValue =
    redeemType === RedeemType.AddressPrefixOnce ? trimLower(value) : value.trim();
  if (
    redeemType === RedeemType.Role &&
    normalizedValue &&
    normalizedValue !== getStringValue(env.ADMIN_USER_ROLE) &&
    getUserRoles(env).some((item) => item.role === normalizedValue)
  ) {
    return { type: RedeemType.Role, role: normalizedValue };
  }
  if (redeemType === RedeemType.SendBalance && /^\d+$/.test(normalizedValue)) {
    const amount = Number(normalizedValue);
    if (amount > 0 && amount <= 1_000_000_000) {
      return { type: RedeemType.SendBalance, amount };
    }
  }
  if (redeemType === RedeemType.AddressPrefixOnce) {
    const maxAddressLength = Math.max(getIntValue(env.MAX_ADDRESS_LEN, 30), 1);
    if (normalizedValue.length < maxAddressLength && /^[a-z0-9]*$/.test(normalizedValue)) {
      return { type: RedeemType.AddressPrefixOnce, prefix: normalizedValue };
    }
  }
  return null;
};

export const stringifyRedeemValue = (value: RedeemValue): string => {
  if (value.type === RedeemType.Role) return value.role;
  if (value.type === RedeemType.SendBalance) return String(value.amount);
  return value.prefix;
};

export const normalizeRedeemCode = (code: unknown): string | null => {
  if (typeof code !== "string") return null;
  const normalizedCode = code.trim();
  return normalizedCode && normalizedCode.length <= 256 ? normalizedCode : null;
};

export const getRedeemCodeForRedemption = async (
  env: Env,
  code: unknown
): Promise<{ row: RedeemCodeRow; redeemValue: RedeemValue } | null> => {
  const normalizedCode = normalizeRedeemCode(code);
  if (!normalizedCode) return null;
  const row = await env.DB.prepare(
    `SELECT id, code, redeem_type, value, redeemed, result
     FROM redeem_codes
     WHERE code = ? AND enabled = 1
     AND datetime(expires_at) > datetime('now')`
  )
    .bind(normalizedCode)
    .first<RedeemCodeRow>();
  if (!row || !isRedeemType(row.redeem_type)) return null;
  const redeemValue = parseRedeemValue(env, row.redeem_type, row.value);
  if (!redeemValue) return null;
  if (row.redeemed && redeemValue.type !== RedeemType.AddressPrefixOnce) return null;
  return { row, redeemValue };
};

export const requireRedeemCodeEnabled = (env: Env): void => {
  if (!getBooleanValue(env.ENABLE_REDEEM_CODE)) {
    throw new ApiError(404, "兑换码功能未开启");
  }
};

// ---------------- 三类兑换 ----------------

const redeemRole = async (
  env: Env,
  userEmail: unknown,
  row: RedeemCodeRow,
  redeemValue: Extract<RedeemValue, { type: RedeemType.Role }>
) => {
  if (typeof userEmail !== "string" || !userEmail.trim()) {
    throw new ApiError(400, "用户不存在");
  }
  const user = await env.DB.prepare(
    `SELECT id, user_email FROM users WHERE user_email = ? COLLATE NOCASE`
  )
    .bind(userEmail.trim())
    .first<{ id: number; user_email: string }>();
  if (!user) throw new ApiError(400, "用户不存在");

  const currentRole = await env.DB.prepare(
    `SELECT role_text FROM user_roles WHERE user_id = ?`
  )
    .bind(user.id)
    .first<string>("role_text");
  const defaultRole = getStringValue(env.USER_DEFAULT_ROLE);
  if (currentRole && currentRole !== redeemValue.role && currentRole !== defaultRole) {
    throw new ApiError(409, "已绑定其他角色，无法兑换");
  }

  const redemptionResult: RoleRedeemResult = {
    type: redeemValue.type,
    user_id: user.id,
    user_email: user.user_email,
    role: redeemValue.role,
  };
  const encryptedResult = await encryptRedeemResult(env, row.id, JSON.stringify(redemptionResult));
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE redeem_codes
       SET result = ?
       WHERE id = ? AND code = ? AND redeem_type = ? AND value = ?
       AND enabled = 1 AND redeemed = 0
       AND datetime(expires_at) > datetime('now')`
    ).bind(encryptedResult, row.id, row.code, row.redeem_type, row.value),
    env.DB.prepare(
      `INSERT INTO user_roles(user_id, role_text)
       SELECT ?, ? WHERE changes() = 1
       ON CONFLICT(user_id) DO UPDATE SET
       role_text = excluded.role_text, updated_at = datetime('now')
       WHERE user_roles.role_text IS NULL OR user_roles.role_text = ''
       OR user_roles.role_text = excluded.role_text OR user_roles.role_text = ?`
    ).bind(user.id, redeemValue.role, defaultRole),
    env.DB.prepare(
      `UPDATE redeem_codes
       SET redeemed = 1, redeemed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND result = ? AND redeemed = 0 AND changes() = 1`
    ).bind(row.id, encryptedResult),
    env.DB.prepare(
      `UPDATE redeem_codes SET result = NULL
       WHERE id = ? AND result = ? AND redeemed = 0`
    ).bind(row.id, encryptedResult),
  ]);
  if ((results[2].meta.changes ?? 0) !== 1) {
    throw new ApiError(409, "兑换码不可用");
  }
  return { success: true, type: redeemValue.type, role: redeemValue.role, user_email: user.user_email };
};

const redeemSendBalance = async (
  env: Env,
  rawAddress: unknown,
  row: RedeemCodeRow,
  redeemValue: Extract<RedeemValue, { type: RedeemType.SendBalance }>
) => {
  const address = trimLower(rawAddress);
  if (!address) throw new ApiError(400, "地址不存在");
  const addressExists = await env.DB.prepare(`SELECT id FROM address WHERE name = ?`)
    .bind(address)
    .first<number>("id");
  if (!addressExists) throw new ApiError(400, "地址不存在");

  const redemptionResult: SendBalanceRedeemResult = {
    type: redeemValue.type,
    address,
    amount: redeemValue.amount,
  };
  const encryptedResult = await encryptRedeemResult(env, row.id, JSON.stringify(redemptionResult));
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE redeem_codes
       SET redeemed = 1, redeemed_at = datetime('now'), result = ?, updated_at = datetime('now')
       WHERE id = ? AND code = ? AND redeem_type = ? AND value = ?
       AND enabled = 1 AND redeemed = 0
       AND datetime(expires_at) > datetime('now')`
    ).bind(encryptedResult, row.id, row.code, row.redeem_type, row.value),
    env.DB.prepare(
      `INSERT INTO address_sender(address, balance, enabled)
       SELECT ?, ?, 1 WHERE changes() = 1
       ON CONFLICT(address) DO UPDATE SET
       balance = COALESCE(address_sender.balance, 0) + excluded.balance`
    ).bind(address, redeemValue.amount),
  ]);
  if ((results[0].meta.changes ?? 0) !== 1 || (results[1].meta.changes ?? 0) !== 1) {
    throw new ApiError(409, "兑换码不可用");
  }
  const balance = await env.DB.prepare(
    `SELECT balance FROM address_sender WHERE address = ?`
  )
    .bind(address)
    .first<number>("balance");
  return {
    success: true,
    type: redeemValue.type,
    address,
    amount: redeemValue.amount,
    balance,
  };
};

const getRedeemedAddress = async (
  env: Env,
  row: Pick<RedeemCodeRow, "id" | "result">
): Promise<AddressRedeemResult | null> => {
  const result = await decryptRedeemResult(env, row.id, row.result);
  const context = getJsonObjectValue<AddressRedeemResult>(result);
  if (
    context?.type !== RedeemType.AddressPrefixOnce ||
    typeof context.address !== "string" ||
    typeof context.address_id !== "number" ||
    typeof context.jwt !== "string" ||
    (context.password !== undefined && context.password !== null && typeof context.password !== "string")
  )
    return null;
  const addressId = await env.DB.prepare(
    `SELECT id FROM address WHERE id = ? AND name = ?`
  )
    .bind(context.address_id, context.address)
    .first<number>("id");
  if (!addressId) return null;
  return context;
};

const redeemAddress = async (
  env: Env,
  body: { name?: string; domain?: string; enableRandomSubdomain?: boolean },
  row: RedeemCodeRow,
  redeemValue: Extract<RedeemValue, { type: RedeemType.AddressPrefixOnce }>
) => {
  if (row.redeemed) {
    const result = await getRedeemedAddress(env, row);
    return result ?? (() => { throw new ApiError(400, "兑换码不可用"); })();
  }
  const maxNameLength = Math.max(
    getIntValue(env.MAX_ADDRESS_LEN, 30) - redeemValue.prefix.length,
    1
  );
  const name = !body.name || getBooleanValue(env.DISABLE_CUSTOM_ADDRESS_NAME)
    ? generateRandomName(env).slice(0, maxNameLength)
    : body.name;
  const sourceMeta = `redeem:${row.id}`;
  let created: Awaited<ReturnType<typeof newAddress>>;
  try {
    created = await newAddress(env, {
      name,
      domain: body.domain,
      enablePrefix: false,
      addressPrefix: redeemValue.prefix,
      enableRandomSubdomain: getBooleanValue(body.enableRandomSubdomain),
      checkLengthByConfig: true,
      sourceMeta,
    });
  } catch (error) {
    const latest = await getRedeemCodeForRedemption(env, row.code);
    if (latest) {
      const concurrentAddress = await getRedeemedAddress(env, latest.row);
      if (concurrentAddress) return concurrentAddress;
    }
    throw new ApiError(400, `创建地址失败: ${(error as Error).message}`);
  }
  const result: AddressRedeemResult = {
    type: redeemValue.type,
    address: created.address,
    address_id: created.address_id,
    jwt: created.jwt,
    password: created.password,
  };
  const encryptedResult = await encryptRedeemResult(env, row.id, JSON.stringify(result));
  await env.DB.prepare(
    `UPDATE redeem_codes
     SET redeemed = 1, redeemed_at = datetime('now'), result = ?, updated_at = datetime('now')
     WHERE id = ? AND code = ? AND redeem_type = ? AND value = ?
     AND enabled = 1 AND redeemed = 0
     AND datetime(expires_at) > datetime('now')`
  )
    .bind(encryptedResult, row.id, row.code, row.redeem_type, row.value)
    .run();
  return result;
};

/** 兑换入口 */
export const redeemCode = async (
  env: Env,
  body: { code?: unknown; user_email?: unknown; address?: unknown; name?: string; domain?: string; enableRandomSubdomain?: boolean | string }
) => {
  requireRedeemCodeEnabled(env);
  const redeemed = await getRedeemCodeForRedemption(env, body.code);
  if (!redeemed) throw new ApiError(400, "兑换码不可用或已过期");
  const { row, redeemValue } = redeemed;

  if (redeemValue.type === RedeemType.Role) {
    return redeemRole(env, body.user_email, row, redeemValue);
  }
  if (redeemValue.type === RedeemType.SendBalance) {
    return redeemSendBalance(env, body.address, row, redeemValue);
  }
  return redeemAddress(env, body as any, row, redeemValue);
};

type QueryRedeemCodeRow = {
  redeem_type: string;
  value: string;
  redeemed: 0 | 1;
  expires_at: string;
};

/** 查询兑换码状态（上游 /redeem_api/query 语义） */
export const queryRedeemCode = async (env: Env, code: unknown) => {
  requireRedeemCodeEnabled(env);
  const normalizedCode = normalizeRedeemCode(code);
  if (!normalizedCode) throw new ApiError(400, "兑换码不可用");
  const row = await env.DB.prepare(
    `SELECT redeem_type, value, redeemed, expires_at
     FROM redeem_codes WHERE code = ? AND enabled = 1`
  )
    .bind(normalizedCode)
    .first<QueryRedeemCodeRow>();
  if (!row || !isRedeemType(row.redeem_type)) {
    throw new ApiError(400, "兑换码不可用");
  }
  const expiresAt = Date.parse(row.expires_at);
  const status = !Number.isFinite(expiresAt) || expiresAt <= Date.now()
    ? "expired"
    : row.redeemed === 1
      ? "redeemed"
      : "unused";
  return { redeem_type: row.redeem_type, value: row.value, status };
};

type RedeemResultRow = {
  id: number;
  redeem_type: string;
  result: string;
};

/** 查询兑换结果（上游 /redeem_api/result 语义） */
export const queryRedeemResult = async (env: Env, code: unknown) => {
  requireRedeemCodeEnabled(env);
  const normalizedCode = normalizeRedeemCode(code);
  if (!normalizedCode) throw new ApiError(400, "兑换码不可用");
  const row = await env.DB.prepare(
    `SELECT id, redeem_type, result
     FROM redeem_codes
     WHERE code = ? AND enabled = 1 AND redeemed = 1 AND result IS NOT NULL
     AND datetime(expires_at) > datetime('now')`
  )
    .bind(normalizedCode)
    .first<RedeemResultRow>();
  if (!row) throw new ApiError(400, "兑换码不可用");

  if (row.redeem_type === RedeemType.AddressPrefixOnce) {
    const result = await getRedeemedAddress(env, row);
    if (!result) throw new ApiError(400, "兑换码不可用");
    return {
      type: result.type,
      address: result.address,
      jwt: result.jwt,
      ...(typeof result.password === "string" ? { password: result.password } : {}),
    };
  }
  const decrypted = await decryptRedeemResult(env, row.id, row.result);
  const result = getJsonObjectValue<any>(decrypted);
  if (!result || result.type !== row.redeem_type) {
    throw new ApiError(400, "兑换码不可用");
  }
  if (result.type === RedeemType.Role) {
    if (typeof result.user_email !== "string" || typeof result.role !== "string") {
      throw new ApiError(400, "兑换码不可用");
    }
    return { type: result.type, user_email: result.user_email, role: result.role };
  }
  if (result.type === RedeemType.SendBalance) {
    if (typeof result.address !== "string" || typeof result.amount !== "number") {
      throw new ApiError(400, "兑换码不可用");
    }
    return { type: result.type, address: result.address, amount: result.amount };
  }
  throw new ApiError(400, "兑换码不可用");
};

// ---------------- Admin 管理 ----------------

const parsePositiveId = (value: string | null): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const validateValue = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 10_000;

const normalizeExpiresAt = (expiresAt: unknown): string | undefined => {
  if (typeof expiresAt !== "string" || !expiresAt.trim()) return undefined;
  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp > Date.now()
    ? new Date(timestamp).toISOString()
    : undefined;
};

export const listRedeemCodes = async (
  env: Env,
  query: URLSearchParams
): Promise<{ results: any[]; count: number }> => {
  const redeem_type = query.get("redeem_type");
  const rawLimit = query.get("limit");
  const rawOffset = query.get("offset");
  const search = query.get("query")?.trim();
  if (!isRedeemType(redeem_type)) throw new ApiError(400, "无效的兑换码类型");
  const limit = /^\d+$/.test(rawLimit || "")
    ? Math.min(Math.max(Number(rawLimit), 1), 100)
    : 20;
  const offset = /^\d+$/.test(rawOffset || "") ? Math.max(Number(rawOffset), 0) : 0;
  const where = ` WHERE redeem_type = ?${search ? ` AND code LIKE ?` : ""}`;
  const params = search ? [redeem_type, `%${search}%`] : [redeem_type];
  const rows = await env.DB.prepare(
    `SELECT id, code, redeem_type, value, result, enabled, redeemed,
            expires_at, redeemed_at, created_at, updated_at
     FROM redeem_codes${where}
     ORDER BY id DESC LIMIT ? OFFSET ?`
  )
    .bind(...params, limit, offset)
    .all<any>();
  const count = (await env.DB.prepare(`SELECT count(*) AS count FROM redeem_codes${where}`)
    .bind(...params)
    .first<number>("count")) ?? 0;
  const results = await Promise.all(
    rows.results.map(async (row) => ({
      ...row,
      redeemed: row.redeemed === 1,
      result: await decryptRedeemResult(env, row.id, row.result),
    }))
  );
  return { results, count };
};

export const createRedeemCodes = async (
  env: Env,
  body: { count?: unknown; redeem_type?: unknown; value?: unknown; enabled?: unknown; expires_at?: unknown }
): Promise<{ success: boolean; created: number; codes: string[] }> => {
  const { count, redeem_type, value, enabled, expires_at } = body;
  if (
    typeof count !== "number" ||
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 500 ||
    !isRedeemType(redeem_type) ||
    typeof enabled !== "boolean" ||
    !validateValue(value)
  ) {
    throw new ApiError(400, "无效的兑换码数据");
  }
  const redeemValue = parseRedeemValue(env, redeem_type, value);
  if (!redeemValue) throw new ApiError(400, "无效的兑换码数据");
  const expiresAt = normalizeExpiresAt(expires_at);
  if (expiresAt === undefined) throw new ApiError(400, "无效的过期时间");
  const normalizedValue = stringifyRedeemValue(redeemValue);
  const codes = Array.from({ length: count }, () => crypto.randomUUID());
  for (let index = 0; index < codes.length; index += 100) {
    await env.DB.batch(
      codes.slice(index, index + 100).map((code) =>
        env.DB.prepare(
          `INSERT INTO redeem_codes(code, redeem_type, value, enabled, expires_at)
           VALUES(?, ?, ?, ?, ?)`
        ).bind(code, redeem_type, normalizedValue, enabled ? 1 : 0, expiresAt)
      )
    );
  }
  return { success: true, created: codes.length, codes };
};

export const deleteRedeemCode = async (
  env: Env,
  rawId: string | null
): Promise<boolean> => {
  const id = parsePositiveId(rawId);
  if (!id) throw new ApiError(400, "无效的兑换码 ID");
  const result = await env.DB.prepare(`DELETE FROM redeem_codes WHERE id = ?`).bind(id).run();
  if ((result.meta.changes ?? 0) !== 1) throw new ApiError(404, "兑换码不存在");
  return true;
};
