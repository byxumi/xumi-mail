import { NextRequest } from "next/server";
import { json, text, ApiError } from "@/lib/server";
import { requireAddress } from "@/lib/server";
import { getBooleanValue } from "@/lib/config";
import { getSendBalanceState } from "@/lib/sendmail";
import { updateAddressUpdatedAt } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { env, payload } = await requireAddress(req);
    updateAddressUpdatedAt(env, payload.address);
    const { balance } = await getSendBalanceState(env, payload.address);
    // 对齐上游 /api/settings 语义：附带 auto_reply 字段（前端 getSettings 期望）
    let autoReply: any = null;
    if (getBooleanValue(env.ENABLE_AUTO_REPLY)) {
      autoReply = await env.DB.prepare(
        `SELECT source_prefix, name, subject, message, enabled FROM auto_reply_mails where address = ?`
      )
        .bind(payload.address)
        .first<any>();
    }
    return json({
      address: payload.address,
      send_balance: balance || 0,
      auto_reply: autoReply || null,
    });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}