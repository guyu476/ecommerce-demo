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
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
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