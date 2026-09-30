import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError } from "@/lib/server";
import { requireAddress } from "@/lib/server";
import { getBooleanValue } from "@/lib/config";
import { handleListQuery, updateAddressUpdatedAt } from "@/lib/db";
import { resolveRawEmailList } from "@/lib/gzip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { env, payload } = await requireAddress(req);
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") || "20";
    const offset = searchParams.get("offset") || "0";
    if (Number.parseInt(offset) <= 0) updateAddressUpdatedAt(env, payload.address);
    const result = await handleListQuery(
      env,
      `SELECT * FROM raw_mails where address = ?`,
      `SELECT count(*) as count FROM raw_mails where address = ?`,
      [payload.address],
      limit,
      offset
    );
    if ("error" in result) return text(result.error, result.status);
    const { results, count } = result;
    const resolved = await resolveRawEmailList(results as any[]);
    return json({ results: resolved, count });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}