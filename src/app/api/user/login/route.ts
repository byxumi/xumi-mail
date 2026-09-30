import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, clientIp } from "@/lib/server";
import { signUserJwt } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 用户登录：明文密码与数据库中存储的哈希比对（简单哈希，生产建议加盐） */
async function hashPassword(plain: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    const body = (await req.json().catch(() => ({}))) as { user_email?: string; password?: string };
    const { user_email, password } = body;
    if (!user_email || !password) return text("用户名和密码不能为空", 400);

    const userEmail = String(user_email).trim().toLowerCase();
    const user = await env.DB.prepare(`SELECT * FROM users where user_email = ?`)
      .bind(userEmail)
      .first();
    if (!user) return text("用户名或密码错误", 401);
    const hashed = await hashPassword(String(password));
    if ((user as any).password !== hashed) return text("用户名或密码错误", 401);

    // 记录登录信息
    const userInfo = JSON.parse((user as any).user_info || "{}");
    userInfo.last_login_ip = clientIp(req);
    userInfo.last_login_at = new Date().toISOString();
    await env.DB.prepare(`UPDATE users SET user_info = ? WHERE id = ?`)
      .bind(JSON.stringify(userInfo), (user as any).id)
      .run();

    const jwt = await signUserJwt(env, {
      user_id: (user as any).id,
      user_email: userEmail,
    });
    return json({ jwt, user_id: (user as any).id, user_email: userEmail });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}