import { NextRequest } from "next/server";
import { json, text, ApiError } from "@/lib/server";
import { requireAddress } from "@/lib/server";
import { sendMail } from "@/lib/sendmail";
import { SendMailRequest } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { env, payload } = await requireAddress(req);
    const body = (await req.json().catch(() => ({}))) as SendMailRequest;
    try {
      await sendMail(env, payload.address, body, {
        sourceIp:
          req.headers.get("cf-connecting-ip") ||
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "",
      });
    } catch (e) {
      return text(`发送失败: ${(e as Error).message}`, 400);
    }
    return json({ status: "ok" });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}