import { NextRequest } from "next/server";
import { json, text, ApiError } from "@/lib/server";
import { requireAddress } from "@/lib/server";
import { getBooleanValue, getJsonObjectValue } from "@/lib/config";
import { getJsonSetting, getSetting, handleListQuery } from "@/lib/db";
import { commonParseMail } from "@/lib/email/parse";
import { resolveRawEmailRow } from "@/lib/gzip";
import { CONSTANTS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const toParsedMailRow = async (row: Record<string, unknown>) => {
  const raw = typeof row.raw === "string" ? row.raw : "";
  const parsed = raw ? await commonParseMail(raw) : undefined;
  const { raw: _raw, ...rest } = row;
  return {
    ...rest,
    sender: parsed?.sender?.trim() ?? "",
    subject: parsed?.subject ?? "",
    text: parsed?.text ?? "",
    html: parsed?.html ?? "",
    attachments: (parsed?.attachments ?? []).map((a) => ({
      filename: a.filename,
      mimeType: a.mimeType,
      disposition: a.disposition,
      size: a.content?.length ?? 0,
    })),
  };
};

export async function GET(req: NextRequest) {
  try {
    const { env, payload } = await requireAddress(req);
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") || "20";
    const offset = searchParams.get("offset") || "0";
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
    const parsed = await Promise.all(
      (results as Record<string, unknown>[]).map(toParsedMailRow)
    );
    return json({ results: parsed, count });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}