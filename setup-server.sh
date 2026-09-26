#!/usr/bin/env bash
# 服务器一次性初始化：装 Docker + 加 2G swap
# 用法（在服务器上，用 root 执行）： bash setup-server.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 运行： sudo bash setup-server.sh"
  exit 1
fi

echo "▶ 1/3 安装 Docker..."
if command -v docker >/dev/null 2>&1; then
  echo "  已安装，跳过"
else
  # 首选官方一键脚本；新版本 Ubuntu 若未被收录则回退到 apt
  if ! curl -fsSL https://get.docker.com | sh; then
    echo "  官方脚本失败（可能该系统版本尚未被收录），回退到 apt 安装..."
    apt-get update
    apt-get install -y docker.io
  fi
  systemctl enable --now docker
fi

echo "  检查 docker compose..."
if docker compose version >/dev/null 2>&1; then
  echo "  ✔ docker compose（v2 插件）可用"
elif command -v docker-compose >/dev/null 2>&1; then
  echo "  ✔ docker-compose（v1）可用"
else
  echo "  安装 compose 插件..."
  apt-get update >/dev/null 2>&1 || true
  apt-get install -y docker-compose-v2 >/dev/null 2>&1 \
    || apt-get install -y docker-compose-plugin >/dev/null 2>&1 \
    || echo "  ⚠ 自动安装失败，deploy.sh 会再提示你"
fi

echo "▶ 2/3 配置 2G swap（2核2G 构建 Next.js 会内存吃紧，swap 是保险）..."
if [ -f /swapfile ]; then
  echo "  /swapfile 已存在，跳过"
else
  if ! fallocate -l 2G /swapfile 2>/dev/null; then
    dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  fi
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "▶ 3/3 完成。当前资源："
free -h
echo ""
echo "接下来的步骤："
echo "  1. git clone <你的仓库地址> ecommerce-demo"
echo "  2. cd ecommerce-demo"
echo "  3. cp deploy.env.example .env && vi .env"
echo "  4. bash deploy.sh"