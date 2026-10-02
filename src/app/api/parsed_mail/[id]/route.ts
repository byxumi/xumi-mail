import { NextRequest } from "next/server";
import { json, text, ApiError } from "@/lib/server";
import { requireAddress } from "@/lib/server";
import { commonParseMail } from "@/lib/email/parse";
import { resolveRawEmailRow } from "@/lib/gzip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { env, payload } = await requireAddress(req);
    const { id } = await params;
    const row = await env.DB.prepare(`SELECT * FROM raw_mails where id = ? and address = ?`)
      .bind(id, payload.address)
      .first();
    if (!row) return json(null);
    const resolved = (await resolveRawEmailRow(row as any)) as Record<string, unknown>;
    const parsed = await commonParseMail(typeof resolved.raw === "string" ? resolved.raw : "");
    const { raw: _raw, ...rest } = resolved;
    return json({
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
        contentId: a.contentId,
      })),
    });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}