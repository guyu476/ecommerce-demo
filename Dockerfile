# 电商演示站 · 生产镜像
#
# 设计取舍：不做 Next.js standalone 瘦身，直接带完整 node_modules（镜像约 1GB）。
# 换来的是「构建 / 数据库迁移 / 播种」都能在容器里直接跑，少一层踩坑。
# 已验证：本项目构建期不访问数据库（页面全部 force-dynamic，DB 调用都在 API 路由）。

FROM node:22-bookworm-slim

# Prisma 在 debian-slim 上需要 openssl 才能加载查询引擎
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---- 依赖层：先只复制清单和 schema，最大化复用 Docker 层缓存 ----
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- 源码 + 构建 ----
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000

# 建表 / 播种 / 启动 由 docker-compose.yml 的 command 负责
CMD ["npm", "run", "start"]