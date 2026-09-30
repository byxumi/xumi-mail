// JWT 签发与校验（jose，HS256，兼容原项目的 token 语义）
import { SignJWT, jwtVerify } from "jose";
import { AddressPayload, Env, UserPayload } from "@/types";
import { getStringValue } from "./config";

const secretOf = (env: Env) => new TextEncoder().encode(getStringValue(env.JWT_SECRET));

export const signAddressJwt = async (
  env: Env,
  payload: { address: string; address_id: number }
): Promise<string> => {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretOf(env));
};

export const verifyAddressJwt = async (
  env: Env,
  token: string | null | undefined
): Promise<AddressPayload | null> => {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretOf(env), { algorithms: ["HS256"] });
    const address = payload.address;
    const addressId = Number(payload.address_id);
    if (typeof address !== "string" || !address) return null;
    if (!Number.isSafeInteger(addressId) || addressId <= 0) return null;
    return { address, address_id: addressId };
  } catch {
    return null;
  }
};

export const verifyAddressJwtWithDb = async (
  env: Env,
  token: string | null | undefined
): Promise<AddressPayload | null> => {
  const payload = await verifyAddressJwt(env, token);
  if (!payload) return null;
  // 校验地址在数据库中仍然存在
  const exists = await env.DB.prepare(`SELECT id FROM address WHERE id = ? AND name = ?`)
    .bind(payload.address_id, payload.address)
    .first<number>("id");
  return exists ? payload : null;
};

export const signUserJwt = async (env: Env, payload: UserPayload): Promise<string> => {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretOf(env));
};

export const verifyUserJwt = async (
  env: Env,
  token: string | null | undefined
): Promise<UserPayload | null> => {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretOf(env), { algorithms: ["HS256"] });
    const userId = Number(payload.user_id);
    if (!Number.isSafeInteger(userId) || userId <= 0) return null;
    return { user_id: userId, user_email: (payload.user_email as string) || undefined };
  } catch {
    return null;
  }
};