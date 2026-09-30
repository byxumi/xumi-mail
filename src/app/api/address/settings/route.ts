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
    return json({
      address: payload.address,
      send_balance: balance || 0,
    });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}