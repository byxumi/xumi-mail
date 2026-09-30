// 服务端 API 辅助函数
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Env } from "@/types";
import { verifyAddressJwtWithDb, verifyUserJwt } from "./auth";
import { getAdminPasswords, getStringValue } from "./config";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function getEnv(): Promise<Env> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as Env;
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const text = (data: string, status = 200) =>
  new Response(data, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function readJson<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "无效的 JSON 请求体");
  }
}

/** 解析地址 JWT（Bearer 或 x-address-token 头） */
export async function requireAddress(req: Request) {
  const env = await getEnv();
  const token =
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ||
    req.headers.get("x-address-token");
  const payload = await verifyAddressJwtWithDb(env, token);
  if (!payload) throw new ApiError(401, "地址凭证无效或已过期，请重新创建地址");
  return { env, payload };
}

/** 解析用户 JWT */
export async function requireUser(req: Request) {
  const env = await getEnv();
  const token = req.headers.get("x-user-token");
  const payload = await verifyUserJwt(env, token);
  if (!payload) throw new ApiError(401, "用户登录已过期，请重新登录");
  return { env, payload };
}

/** 管理员校验：x-admin-auth 头匹配 ADMIN_PASSWORDS */
export function isAdmin(env: Env, req: Request): boolean {
  const adminPasswords = getAdminPasswords(env);
  if (adminPasswords.length === 0) return true; // 未配置则默认放开（与上游一致）
  const auth = req.headers.get("x-admin-auth");
  return !!auth && adminPasswords.includes(auth);
}

export function requireAdmin(env: Env, req: Request) {
  if (!isAdmin(env, req)) {
    throw new ApiError(401, "管理员凭证无效");
  }
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "web:unknown"
  );
}

export { getStringValue };