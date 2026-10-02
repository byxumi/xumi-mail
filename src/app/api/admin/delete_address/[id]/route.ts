import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { deleteAddressWithData } from "@/lib/address";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** DELETE /api/admin/delete_address/:id —— 删除地址（Account.vue） */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) return text("无效的地址 ID", 400);
    const success = await deleteAddressWithData(env, null, id);
    return json({ success });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}