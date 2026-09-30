// 服务端逻辑集成测试（使用内存版 D1 mock，不依赖 next build）
// 运行：npx tsx scripts/integration-test.ts
import { newAddress, deleteAddressWithData, cleanup, normalizeAddressDomain } from "../src/lib/address";
import { signAddressJwt, verifyAddressJwtWithDb, signUserJwt, verifyUserJwt } from "../src/lib/auth";
import { getJsonSetting, saveSetting, handleListQuery } from "../src/lib/db";
import { storeRawMail } from "../src/lib/email/storage";
import { processEmail, EmailMessageLike } from "../src/lib/email";
import { Env } from "../src/types";
import { compressText, decompressBlob, resolveRawEmailRow } from "../src/lib/gzip";
import { getBooleanValue, isAnySendMailEnabled } from "../src/lib/config";

let pass = 0;
let fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`✅ ${name}`);
  } else {
    fail++;
    console.log(`❌ ${name}\n   期望: ${JSON.stringify(expected)}\n   实际: ${JSON.stringify(actual)}`);
  }
}

// ---------- 内存 D1 mock ----------
type Row = Record<string, unknown>;
class MemoryD1 {
  tables: Record<string, Row[]> = {
    raw_mails: [],
    address: [],
    auto_reply_mails: [],
    address_sender: [],
    sendbox: [],
    settings: [],
    users: [],
    users_address: [],
    user_roles: [],
  };
  idCounter: Record<string, number> = {};

  prepare(sql: string) {
    const run = (params: unknown[]) => this.exec(sql, params);
    const noParams = {
      run: () => run([]),
      first: (col?: string) => run([]).then((r) => (r as any).first?.(col)),
      all: () => run([]).then((r) => (r as any).all?.()),
    };
    return {
      ...noParams,
      bind: (...params: unknown[]) => ({
        run: () => run(params),
        first: (col?: string) => run(params).then((r) => (r as any).first?.(col)),
        all: () => run(params).then((r) => (r as any).all?.()),
      }),
    };
  }

  private async exec(sql: string, params: unknown[]) {
    const table = Object.keys(this.tables).find((t) => sql.includes(t));
    const isInsert = /^\s*INSERT/i.test(sql);
    const isSelect = /^\s*SELECT/i.test(sql);
    const isUpdate = /^\s*UPDATE/i.test(sql);
    const isDelete = /^\s*DELETE/i.test(sql);

    // 简易解析：仅支持本测试用到的语句模式
    if (sql.includes("PRAGMA table_info")) {
      return { all: async () => ({ results: this.tables[table || "raw_mails"].map((_, i) => ({ name: Object.keys(this.tables[table || "raw_mails"][0] || {})[i] })) }) };
    }

    if (isInsert) {
      this.idCounter[table || "raw_mails"] = (this.idCounter[table || "raw_mails"] || 0) + 1;
      const row: Row = { id: this.idCounter[table || "raw_mails"] };
      const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      // 从 bind 参数按列名填充（简化：拿 INSERT 中的列名）
      let paramIdx = 0;
      if (colsMatch) {
        const cols = colsMatch[1].split(",").map((c) => c.trim().replace(/["`]/g, ""));
        for (const col of cols) {
          if (col && paramIdx < params.length) {
            row[col] = params[paramIdx++];
          }
        }
      }
      this.tables[table || "raw_mails"].push(row);
      return { success: true, meta: { last_row_id: row.id, changes: 1 } };
    }

    if (isSelect) {
      let rows = this.tables[table || "raw_mails"];
      // 支持简单的 where 过滤（address = ? / name = ? / id = ? / user_id = ? 等）
      const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+order by|\s+limit|\s*$)/i);
      if (whereMatch) {
        const conditions = whereMatch[1].split(/\s+and\s+/i);
        rows = rows.filter((row) => {
          let idx = 0;
          return conditions.every((cond) => {
            const m = cond.match(/^(\w+)\s*=\s*\?$/i);
            if (!m) return true;
            const val = params[idx++];
            return String(row[m[1]]) === String(val);
          });
        });
      }
      // limit/offset
      const limitMatch = sql.match(/limit\s+(\?|\d+)/i);
      const offsetMatch = sql.match(/offset\s+(\?|\d+)/i);
      let result = rows;
      // SQL 顺序: ... limit ? offset ? → params 中 limit 在前 offset 在后
      let limitIdx = 1;
      if (offsetMatch) {
        const off = offsetMatch[1] === "?" ? (params[offsetMatch[1] === "?" ? limitIdx + (limitMatch?.[1] === "?" ? 1 : 0) : 0] as number) : Number(offsetMatch[1]);
        void off;
        const offVal = offsetMatch[1] === "?" ? Number(params[limitMatch?.[1] === "?" ? 2 : 1]) : Number(offsetMatch[1]);
        result = result.slice(offVal);
      }
      if (limitMatch) {
        const lim = limitMatch[1] === "?" ? Number(params[1]) : Number(limitMatch[1]);
        result = result.slice(0, lim);
      }
      if (sql.includes("count(*)") || sql.includes("count(*)")) {
        const count = result.length;
        return { first: async () => count };
      }
      const firstMatch = sql.includes(".first(") || !sql.toUpperCase().includes("ORDER BY");
      void firstMatch;
      return {
        first: async (col?: string) => {
          const row = result[0];
          if (!row) return undefined;
          return col ? row[col] : row;
        },
        all: async <T = Row>() => ({ results: (result as T[]) || [], count: result.length, success: true, meta: { changes: 0 } }),
      };
    }

    if (isUpdate) {
      // 简单支持 WHERE id=? / name=? 全表更新
      const setMatch = sql.match(/SET\s+(.+?)(?:\s+WHERE|\s*$)/i);
      if (setMatch) {
        let idx = 0;
        const assignments = setMatch[1].split(",").map((a) => a.trim());
        const sets: Array<[string, unknown]> = [];
        for (const a of assignments) {
          const m = a.match(/^(\w+)\s*=\s*(\?|[^,]+)$/i);
          if (m && m[2] === "?") {
            sets.push([m[1], params[idx++]]);
          } else if (m) {
            // datetime('now') 之类，忽略
          }
        }
        let target = this.tables[table || "raw_mails"];
        const whereMatch = sql.match(/WHERE\s+(.+?)\s*$/i);
        if (whereMatch) {
          const conditions = whereMatch[1].split(/\s+and\s+/i);
          const filtered: Row[] = [];
          for (const row of target) {
            if (
              conditions.every((cond) => {
                const m = cond.match(/^(\w+)\s*=\s*\?$/i);
                if (!m) return true;
                const val = params[idx++];
                return String(row[m[1]]) === String(val);
              })
            ) {
              for (const [k, v] of sets) row[k] = v;
              filtered.push(row);
            }
          }
          void filtered;
        } else {
          for (const row of target) for (const [k, v] of sets) row[k] = v;
        }
        void target;
      }
      return { success: true, meta: { changes: 1 } };
    }

    if (isDelete) {
      const whereMatch = sql.match(/WHERE\s+(.+?)\s*$/i);
      if (whereMatch) {
        const conditions = whereMatch[1].split(/\s+and\s+/i);
        let idx = 0;
        this.tables[table || "raw_mails"] = this.tables[table || "raw_mails"].filter((row) => {
          const matches = conditions.every((cond) => {
            const m = cond.match(/^(\w+)\s*=\s*\?$/i);
            if (!m) return true;
            const val = params[idx++];
            return String(row[m[1]]) === String(val);
          });
          return !matches;
        });
      } else {
        this.tables[table || "raw_mails"] = [];
      }
      return { success: true, meta: { changes: 1 } };
    }

    return { success: true, meta: { changes: 0 } };
  }
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: new MemoryD1() as unknown as D1Database,
    JWT_SECRET: "test-secret",
    DOMAINS: ["example.com", "mail.example.com"],
    DEFAULT_DOMAINS: ["example.com", "mail.example.com"],
    PREFIX: "tmp",
    ENABLE_USER_CREATE_EMAIL: "true",
    ENABLE_USER_DELETE_EMAIL: "true",
    ...overrides,
  } as Env;
}

// ---------- 测试 ----------
async function main() {
  // 1. 地址创建 → JWT → 校验
  const env = makeEnv();
  const res = await newAddress(env, { name: "alice", domain: "example.com", enablePrefix: true, sourceMeta: "test" });
  check("创建地址: 带前缀", res.address, "tmpalice@example.com");
  check("创建地址: 返回 jwt", typeof res.jwt === "string" && res.jwt.length > 20, true);
  const payload = await verifyAddressJwtWithDb(env, res.jwt);
  check("JWT 校验通过", payload?.address, "tmpalice@example.com");

  // 2. 存储邮件 + gzip 往返
  await storeRawMail(env, "sender@x.com", res.address, "msg-1", "raw email body 内容");
  const rows = (env.DB as unknown as MemoryD1).tables.raw_mails;
  check("存储邮件: 行数", rows.length, 1);
  check("存储邮件: address", rows[0].address, "tmpalice@example.com");

  const gz = await compressText("compress me 压缩");
  const back = await decompressBlob(gz);
  check("gzip 往返", back, "compress me 压缩");

  // 3. 收信管线：processEmail 存邮件
  const env2 = makeEnv();
  const msgRaw = [
    "From: sender@example.org",
    "To: tmpbob@example.com",
    "Subject: Welcome",
    "Message-ID: <welcome-1@example.org>",
    "",
    "Hello Bob!",
  ].join("\r\n");
  const rejects: string[] = [];
  const forwards: string[] = [];
  const message: EmailMessageLike = {
    from: "sender@example.org",
    to: "tmpbob@example.com",
    headers: new Headers({
      From: "sender@example.org",
      "Message-ID": "<welcome-1@example.org>",
    }),
    raw: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(msgRaw));
        controller.close();
      },
    }),
    rawSize: msgRaw.length,
    setReject: (reason: string) => rejects.push(reason),
    forward: async (addr) => {
      forwards.push(addr);
    },
    reply: async () => {},
  };
  await processEmail(message, env2);
  const rows2 = (env2.DB as unknown as MemoryD1).tables.raw_mails;
  check("收信管线: 未拒绝", rejects.length, 0);
  check("收信管线: 存下邮件", rows2.length, 1);
  check("收信管线: 收件人", rows2[0].address, "tmpbob@example.com");
  check("收信管线: 来源", rows2[0].source, "sender@example.org");

  // 未知地址拒收
  const env3 = makeEnv();
  await saveSetting(env3, "email_rule_settings", JSON.stringify({ blockReceiveUnknowAddressEmail: true }));
  const rejects3: string[] = [];
  const message3: EmailMessageLike = {
    from: "x@y.com",
    to: "nobody@example.com",
    headers: new Headers(),
    raw: new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("hi"));
        c.close();
      },
    }),
    setReject: (r: string) => rejects3.push(r),
    forward: async () => {},
    reply: async () => {},
  };
  await processEmail(message3, env3);
  check("未知地址拒收", rejects3.length, 1);

  // 4. 黑名单拒收
  const env4 = makeEnv({ BLACK_LIST: "spam" });
  const rejects4: string[] = [];
  await processEmail(
    {
      from: "spam@evil.com",
      to: "tmpa@example.com",
      headers: new Headers({ From: "spam@evil.com" }),
      raw: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("ad"));
          c.close();
        },
      }),
      setReject: (r: string) => rejects4.push(r),
      forward: async () => {},
      reply: async () => {},
    } as any,
    env4
  );
  check("黑名单拒收", rejects4.length, 1);

  // 5. 清理逻辑
  const env5 = makeEnv();
  await newAddress(env5, { name: "old", domain: "example.com", enablePrefix: true });
  const ok = await cleanup(env5, "addressCreated", 1);
  check("清理 addressCreated 返回 true", ok, true);

  // 6. 用户 JWT
  const ujwt = await signUserJwt(env, { user_id: 42, user_email: "u@x.com" });
  const u = await verifyUserJwt(env, ujwt);
  check("用户 JWT 校验", u?.user_id, 42);

  // 7. handleListQuery 分页
  const env6 = makeEnv();
  for (let i = 0; i < 5; i++) {
    await storeRawMail(env6, `s${i}@x.com`, "paging@example.com", `m${i}`, `raw-${i}`);
  }
  const page = await handleListQuery(
    env6,
    `SELECT * FROM raw_mails where address = ?`,
    `SELECT count(*) as count FROM raw_mails where address = ?`,
    ["paging@example.com"],
    2,
    0
  );
  check("分页: 首页 2 条", "results" in page && page.results.length, 2);
  check("分页: 总数 5", "count" in page && page.count, 5);

  // 8. 删除地址连带邮件
  const env7 = makeEnv();
  const a7 = await newAddress(env7, { name: "d", domain: "example.com", enablePrefix: true });
  await storeRawMail(env7, "s@x.com", a7.address, "m", "raw");
  await deleteAddressWithData(env7, a7.address, a7.address_id);
  check("删除地址: address 表空", (env7.DB as unknown as MemoryD1).tables.address.length, 0);
  check("删除地址: raw_mails 空", (env7.DB as unknown as MemoryD1).tables.raw_mails.length, 0);

  // 9. resolveRawEmailRow 保留 raw
  const env8 = makeEnv();
  await storeRawMail(env8, "s@x.com", "r@example.com", "m", "hello raw");
  const rawRow = (env8.DB as unknown as MemoryD1).tables.raw_mails[0];
  const resolved = await resolveRawEmailRow(rawRow as any);
  check("resolveRawEmailRow: raw 保留", (resolved as any).raw, "hello raw");

  // 10. 发信能力检测
  const env9 = makeEnv({ RESEND_TOKEN: "re_xxx" });
  check("检测到发信能力", isAnySendMailEnabled(env9), true);

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});