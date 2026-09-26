#!/usr/bin/env bash
# 一键部署 / 更新（在服务器上，项目根目录执行）
#   bash deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "✘ 还没装 Docker。请先执行： bash setup-server.sh"
  exit 1
fi

if [ ! -f .env ]; then
  echo "✘ 找不到 .env"
  echo "  请先执行： cp deploy.env.example .env"
  echo "  然后编辑 .env，填好 MYSQL_ROOT_PASSWORD 和 JWT_SECRET"
  exit 1
fi

echo "▶ 1/3 拉取最新代码..."
git pull --ff-only

echo "▶ 2/3 构建并启动（首次约 5-10 分钟，请耐心等待）..."
docker compose up -d --build

echo "▶ 3/3 当前状态："
docker compose ps

IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "<你的公网IP>")
echo ""
echo "=========================================="
echo "  访问地址： http://${IP}:3000"
echo "  查看日志： docker compose logs -f app"
echo "  停止服务： docker compose down"
echo "=========================================="