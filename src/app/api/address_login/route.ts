import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError } from "@/lib/server";
import { requireAddress } from "@/lib/server";
import { getBooleanValue } from "@/lib/config";
import { signAddressJwt } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 地址密码登录（前端传入 SHA-256 哈希后的密码） */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    if (!getBooleanValue(env.ENABLE_ADDRESS_PASSWORD)) {
      return text("未启用地址密码", 403);
    }
    const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
    const { email, password } = body;
    if (!email || !password) return text("邮箱和密码不能为空", 400);

    const address = await env.DB.prepare(`SELECT * FROM address WHERE name = ?`).bind(email).first();
    if (!address) return text("地址不存在", 404);
    if ((address as any).password !== password) return text("邮箱或密码错误", 401);

    const jwt = await signAddressJwt(env, { address: (address as any).name, address_id: (address as any).id });
    return json({ jwt, address: (address as any).name });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}