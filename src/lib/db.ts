// D1 数据库访问帮助函数

import { Env } from "@/types";

export const getSetting = async (env: Env, key: string): Promise<string | null> => {
  try {
    return await env.DB.prepare(`SELECT value FROM settings where key = ?`)
      .bind(key)
      .first<string>("value");
  } catch (e) {
    console.error(`GetSetting: Failed to get ${key}`, e);
    return null;
  }
};

export const getJsonSetting = async <T = any>(env: Env, key: string): Promise<T | null> => {
  const value = await getSetting(env, key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const saveSetting = async (env: Env, key: string, value: string): Promise<boolean> => {
  try {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`
    )
      .bind(key, value, value)
      .run();
    return true;
  } catch (e) {
    console.error(`saveSetting failed: ${key}`, e);
    return false;
  }
};

export const deleteSetting = async (env: Env, key: string): Promise<boolean> => {
  try {
    await env.DB.prepare(`DELETE FROM settings WHERE key = ?`).bind(key).run();
    return true;
  } catch {
    return false;
  }
};

export const updateAddressUpdatedAt = (env: Env, address: string | null | undefined): void => {
  if (!address) return;
  if (env.DISABLE_ADDRESS_UPDATED_AT === "true") return;
  env.DB.prepare(
    `UPDATE address SET updated_at = datetime('now') WHERE name = ?
     AND (updated_at IS NULL OR updated_at < datetime('now', '-1 day'))`
  )
    .bind(address)
    .run()
    .catch((e) => console.warn("[updateAddressUpdatedAt] failed:", e));
};

export const updateUserAddressesUpdatedAt = (
  env: Env,
  userId: number | string | null | undefined
): void => {
  if (!userId) return;
  if (env.DISABLE_ADDRESS_UPDATED_AT === "true") return;
  env.DB.prepare(
    `UPDATE address SET updated_at = datetime('now')
     WHERE id IN (SELECT address_id FROM users_address WHERE user_id = ?)
     AND (updated_at IS NULL OR updated_at < datetime('now', '-1 day'))`
  )
    .bind(userId)
    .run()
    .catch((e) => console.warn("[updateUserAddressesUpdatedAt] failed:", e));
};

/** 通用分页查询（仅允许内部白名单 orderBy） */
export const handleListQuery = async <T = unknown>(
  env: Env,
  query: string,
  countQuery: string,
  params: unknown[],
  limit: string | number | undefined | null,
  offset: string | number | undefined | null,
  orderBy: string = "id desc",
  hiddenFields: string[] = []
): Promise<{ results: T[]; count: number } | { error: string; status: number }> => {
  if (typeof limit === "string") limit = parseInt(limit);
  if (typeof offset === "string") offset = parseInt(offset);
  if (!limit || limit < 0 || limit > 100) {
    return { error: "Invalid limit", status: 400 };
  }
  if (offset === null || offset === undefined || offset < 0) {
    return { error: "Invalid offset", status: 400 };
  }
  const resultsQuery = `${query} order by ${orderBy} limit ? offset ?`;
  const { results } = await env.DB.prepare(resultsQuery)
    .bind(...params, limit, offset)
    .all<T>();
  const count =
    offset === 0
      ? ((await env.DB.prepare(countQuery).bind(...params).first("count")) as number) || 0
      : 0;
  let finalResults: T[] = results as T[];
  if (hiddenFields.length > 0) {
    finalResults = results.map((row: any) => {
      const copy = { ...row };
      for (const field of hiddenFields) {
        delete copy[field];
      }
      return copy as T;
    });
  }
  return { results: finalResults, count };
};