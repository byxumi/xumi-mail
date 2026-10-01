import { NextRequest } from "next/server";
import { getEnv, json, verifySha256AgainstList } from "@/lib/server";
import { getPasswords, getBooleanValue } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /open_api/site_login —— 站点访问密码验证（compat 上游语义）
 * body: { password: string (前端 SHA-256 hex), cf_token? }
 */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    const body = (await req.json().catch(() => ({}))) as { password?: string; cf_token?: string };
    const passwords = getPasswords(env);
    const ok = await verifySha256AgainstList(body.password || "", passwords);
    if (!ok) {
      return json(
        { code: "AUTH_SITE_PASSWORD_INVALID", message: "站点访问密码错误" },
        401
      );
    }
    return json({ success: true });
  } catch (e) {
    console.error("site_login error:", e);
    return json({ code: "INTERNAL_SERVER_ERROR", message: "服务器错误" }, 500);
  }
}