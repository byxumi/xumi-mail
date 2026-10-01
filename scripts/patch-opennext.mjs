// 给 @opennextjs/cloudflare 的 bundle-server 注入 cloudflare: external 插件
// 原因：OpenNext 用 esbuild 打包 Next server bundle 时，无法解析 cloudflare:email / cloudflare:sockets
// 等 Workers 运行时内置模块；此脚本在 esbuild 中把它们标记为 external，由 workerd 运行时解析。
// 幂等：已 patch 则跳过。
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = join(
  __dirname,
  "..",
  "node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js"
);

// 插件定义（插在全部 import 之后）
const PLUGIN_DEF = `
const cloudflareExternalPlugin = () => ({
    name: "cloudflare-externals",
    setup(build) {
        build.onResolve({ filter: /^cloudflare:/ }, (args) => ({ path: args.path, external: true }));
    },
});
`;

let src;
try {
  src = readFileSync(target, "utf8");
} catch (e) {
  console.error("找不到 bundle-server.js:", target, e.message);
  process.exit(1);
}

if (src.includes("cloudflareExternalPlugin")) {
  console.log("已 patch，跳过");
  process.exit(0);
}

// 1) 在最后一条 import（needsExperimentalReact）之后插入插件定义
const importAnchor = `import { needsExperimentalReact } from "./utils/needs-experimental-react.js";`;
if (!src.includes(importAnchor)) {
  console.error("未找到注入点（needsExperimentalReact import）");
  process.exit(1);
}
src = src.replace(importAnchor, importAnchor + "\n" + PLUGIN_DEF);

// 2) 在 plugins 数组首元素前插入插件调用
const pluginsStart = "plugins: [";
if (!src.includes(pluginsStart)) {
  console.error("未找到 plugins 数组");
  process.exit(1);
}
src = src.replace(pluginsStart, "plugins: [\n            cloudflareExternalPlugin(),");

writeFileSync(target, src);
console.log("✅ 已注入 cloudflare external 插件");