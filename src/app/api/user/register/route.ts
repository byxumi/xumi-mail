import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, clientIp } from "@/lib/server";
import { getBooleanValue } from "@/lib/config";
import { signUserJwt } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 用户注册（普通账号，非邮箱注册；受 ENABLE_USER_REGISTER 控制，默认关闭） */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    if (!getBooleanValue(env.ENABLE_USER_REGISTER)) return text("注册功能未开启", 403);

    const body = (await req.json().catch(() => ({}))) as { user_email?: string; password?: string };
    const { user_email, password } = body;
    if (!user_email || !password) return text("用户名和密码不能为空", 400);
    if (String(password).length < 6) return text("密码至少 6 位", 400);

    const userEmail = String(user_email).trim().toLowerCase();
    const existing = await env.DB.prepare(`SELECT id FROM users where user_email = ?`)
      .bind(userEmail)
      .first();
    if (existing) return text("用户名已存在", 400);

    const hashed = await hashPassword(String(password));
    const result = await env.DB.prepare(
      `INSERT INTO users (user_email, password, user_info) VALUES (?, ?, ?)`
    )
      .bind(
        userEmail,
        hashed,
        JSON.stringify({ source: "web", ip: clientIp(req), created_at: new Date().toISOString() })
      )
      .run();
    if (!result.success) return text("注册失败", 500);

    const user_id = result.meta?.last_row_id as number;
    const jwt = await signUserJwt(env, { user_id, user_email: userEmail });
    return json({ jwt, user_id, user_email: userEmail });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

async function hashPassword(plain: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}