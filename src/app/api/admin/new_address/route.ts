import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin, clientIp } from "@/lib/server";
import { newAddress } from "@/lib/address";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 管理：创建地址（CreateAccount.vue 调用）
 * body: { enablePrefix, enableRandomSubdomain, name, domain }
 */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const body = (await req.json().catch(() => ({}))) as {
      enablePrefix?: boolean;
      enableRandomSubdomain?: boolean;
      name?: string;
      domain?: string;
    };
    const { enablePrefix, enableRandomSubdomain, name, domain } = body;
    const res = await newAddress(env, {
      name: String(name || ""),
      domain: domain || null,
      enablePrefix: enablePrefix === true,
      enableRandomSubdomain: enableRandomSubdomain === true,
      enableCheckNameRegex: false,
      sourceMeta: `admin:${clientIp(req)}`,
    });
    return json(res);
  } catch (e) {
    return text(`创建失败: ${(e as Error).message}`, 400);
  }
}