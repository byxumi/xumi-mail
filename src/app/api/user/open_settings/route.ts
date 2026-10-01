import { NextRequest } from "next/server";
import { getEnv, json } from "@/lib/server";
import { getBooleanValue, getJsonObjectValue } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/user/open_settings —— 用户开放设置（上游 /user_api/open_settings 重写目标） */
export async function GET(req: NextRequest) {
  const env = await getEnv();
  const oauth2Config = getJsonObjectValue<Array<{ clientID: string; name: string; icon?: string }>>(
    env.OAUTH2_CLIENT_CONFIG
  );
  return json({
    enable: getBooleanValue(env.ENABLE_USER_REGISTER),
    enableMailVerify: getBooleanValue(env.ENABLE_MAIL_VERIFY),
    oauth2ClientIDs: Array.isArray(oauth2Config) ? oauth2Config : [],
  });
}