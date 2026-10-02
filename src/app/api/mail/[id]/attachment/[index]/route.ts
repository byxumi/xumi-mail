import { NextRequest } from "next/server";
import { text, ApiError } from "@/lib/server";
import { requireAddress } from "@/lib/server";
import { commonParseMail } from "@/lib/email/parse";
import { resolveRawEmailRow } from "@/lib/gzip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 附件下载 / 内联显示。
 * GET /api/mail/:id/attachment/:index
 *   - 默认 Content-Disposition: attachment（下载）
 *   - ?inline=1 → inline（浏览器直接渲染，用于 cid: 内联图片）
 * 认证：Authorization Bearer / x-address-token / ?jwt=（GET 直链场景）
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; index: string }> }) {
  try {
    const { env, payload } = await requireAddress(req);
    const { id, index } = await params;
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0) return text("附件索引无效", 400);

    const row = await env.DB.prepare(`SELECT * FROM raw_mails where id = ? and address = ?`)
      .bind(id, payload.address)
      .first();
    if (!row) return text("邮件不存在", 404);
    const resolved = (await resolveRawEmailRow(row as any)) as Record<string, unknown>;
    const parsed = await commonParseMail(typeof resolved.raw === "string" ? resolved.raw : "");
    const att = (parsed?.attachments ?? [])[idx];
    if (!att) return text("附件不存在", 404);

    const isInline = new URL(req.url).searchParams.get("inline") === "1";
    const filename = att.filename || `attachment-${idx + 1}`;
    const content = att.content || new Uint8Array(0);

    return new Response(content as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": att.mimeType || "application/octet-stream",
        "Content-Disposition": `${isInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}
