# ecommerce-demo

电商网站 Demo · Next.js 全栈项目。

## 技术栈

| 层     | 选型                     | 说明                              |
| ------ | ------------------------ | --------------------------------- |
| 框架   | Next.js 16（App Router） | React 全栈，页面与 API 同仓库     |
| 语言   | TypeScript（strict）     | 全量类型覆盖                      |
| 样式   | Tailwind CSS v4          | 原子化 CSS                        |
| ORM    | Prisma 6                 | 数据库模型与迁移                  |
| 数据库 | MySQL 8                  | 连接串配置在 `.env`               |
| 校验   | Zod                      | 请求参数/请求体校验               |
| 规范   | ESLint + Prettier        | `npm run lint` / `npm run format` |

## 快速开始

```bash
npm install              # 安装依赖

cp .env.example .env     # 编辑 .env，把 DATABASE_URL 里的 PASSWORD 换成你的 MySQL 密码

npm run db:migrate       # 首次执行会自动创建 ecommerce_demo 库并建表
                         # （会提示输入迁移名，如 init）

npm run dev              # 启动开发服务器，打开 http://localhost:3000
```

其他常用命令：`npm run db:studio`（可视化看数据）、`npm run db:generate`（改了 schema 后重新生成客户端）、`npm run build`（生产构建）。

## 目录结构

```text
src/
├── app/
│   ├── api/                # API 路由（Route Handlers）
│   │   ├── health/         #   GET  /api/health   健康检查
│   │   └── products/       #   GET|POST /api/products
│   ├── layout.tsx          # 根布局
│   └── page.tsx            # 首页
├── components/             # 通用组件（含服务端/客户端组件）
├── lib/                    # 基础设施
│   ├── api-response.ts     #   统一响应 ok/fail + handleRoute 错误处理
│   └── prisma.ts           #   PrismaClient 单例（直接 import { prisma } 使用）
└── types/                  # 全局共享类型
    └── api.ts              #   ApiResponse 响应结构定义
prisma/
└── schema.prisma           # 数据库模型（改完执行 npm run db:migrate）
```

## 接口规范

### 统一响应格式

所有 `/api/**` 接口一律返回以下结构（见 `src/types/api.ts`）：

```jsonc
// 成功：code 固定为 0
{ "code": 0, "message": "ok", "data": { /* 业务数据 */ } }

// 失败：code 为非零业务码；参数校验失败时 data 携带字段级错误
{ "code": 422, "message": "参数校验失败", "data": { "name": "商品名称不能为空" } }
```

### 错误码约定

- HTTP 状态码表达传输层语义（400/401/403/404/422/500）
- `code` 表达业务语义：`0` 成功；`4xx` 请求侧错误；`5xx` 服务端错误

### 写接口的标准套路

新接口按以下模式编写（见 `src/app/api/products/route.ts`）：

1. 用 Zod 定义入参 schema（query 或 body），`schema.parse()` 校验，不合法自动返回 422；
2. 业务逻辑里需要失败时直接 `throw new ApiError("商品不存在", 40401, 404)`；
3. 整个处理函数包在 `handleRoute(async () => ...)` 里，兜底未知异常返回 500；
4. 成功路径只写 `return ok(data)`，不手动拼 JSON。

### 分页约定

列表接口统一使用 `page`（从 1 开始）+ `pageSize`（默认 10，上限 100），
响应 `data` 为 `{ list, total, page, pageSize }`。

## 数据库模型规范

- 表名/字段名用 snake_case，模型里通过 `@map` / `@@map` 映射（见 `prisma/schema.prisma`）
- 枚举统一大写蛇形命名（如 `ON_SALE`）
- 每张业务表自带 `createdAt` / `updatedAt`

## 当前进度

- [x] 项目脚手架（create-next-app）
- [x] 接口规范与错误处理基建
- [x] Prisma + MySQL 接入配置
- [ ] 商品模块完整 CRUD + 分类
- [ ] 用户注册 / 登录（含鉴权）
- [ ] 购物车、结算与订单流程
