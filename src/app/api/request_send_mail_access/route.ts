import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError } from "@/lib/server";
import { requireAddress } from "@/lib/server";
import { getIntValue, isAnySendMailEnabled } from "@/lib/config";
import { getSendBalanceState } from "@/lib/sendmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { env, payload } = await requireAddress(req);
    if (!payload.address) return text("地址不存在", 400);
    if (!isAnySendMailEnabled(env)) return text("发送邮件未启用", 403);

    const default_balance = getIntValue(env.DEFAULT_SEND_BALANCE, 0);
    let status: "ok" | "already_requested" | "operation_failed";

    if (default_balance > 0) {
      // 有默认余额：保证地址行存在，然后检查余额是否可用
      await env.DB.prepare(
        `INSERT INTO address_sender (address, balance, enabled) VALUES (?, ?, ?)
         ON CONFLICT(address) DO NOTHING`
      )
        .bind(payload.address, default_balance, 1)
        .run();
      const { balance } = await getSendBalanceState(env, payload.address, {
        initializeDefaultBalance: false,
      });
      status = balance !== null && balance > 0 ? "ok" : "already_requested";
    } else {
      // 无默认余额：插入一条余额为 0 的记录表示「已申请」，UNIQUE 冲突 = 重复申请
      try {
        const { success } = await env.DB.prepare(
          `INSERT INTO address_sender (address, balance, enabled) VALUES (?, ?, ?)`
        )
          .bind(payload.address, default_balance, default_balance > 0 ? 1 : 0)
          .run();
        status = success ? "ok" : "operation_failed";
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes("UNIQUE")) {
          status = "already_requested";
        } else {
          status = "operation_failed";
        }
      }
    }

    if (status === "ok") return json({ status: "ok" });
    if (status === "already_requested") return text("已提交过申请", 400);
    return text("操作失败", 500);
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}