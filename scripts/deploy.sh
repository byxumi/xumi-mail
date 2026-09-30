#!/usr/bin/env bash
# 部署脚本：构建 Next.js 并通过 OpenNext 构建/部署到 Cloudflare Workers
set -euo pipefail

cd "$(dirname "$0")"

echo "==> 1/3 安装依赖"
npm install

echo "==> 2/3 构建 (next build + opennextjs-cloudflare build)"
npm run build:worker

echo "==> 3/3 部署到 Cloudflare Workers"
npx opennextjs-cloudflare deploy

echo "✅ 部署完成"