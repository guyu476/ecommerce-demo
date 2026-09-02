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

npm run db:seed          # 导入演示数据（6 个分类 + 12 个商品，幂等可重复执行）

npm run dev              # 启动开发服务器，打开 http://localhost:3000
```

其他常用命令：`npm run db:studio`（可视化看数据）、`npm run db:generate`（改了 schema 后重新生成客户端）、`npm run build`（生产构建）。

## 已实现页面

| 路由             | 说明                                                      |
| ---------------- | --------------------------------------------------------- |
| `/`              | 商城首页：分类导航 + 热卖商品网格（服务端组件直查数据库） |
| `/products/[id]` | 商品详情：价格、销量、库存、描述、加入购物车（占位）      |

数据库未就绪时页面会显示引导提示，而不是白屏报错。

## 目录结构

```text
src/
├── app/
│   ├── api/                # API 路由（Route Handlers）
│   │   ├── health/         #   GET  /api/health   健康检查
│   │   ├── categories/     #   GET  /api/categories   分类列表（含商品数）
│   │   └── products/       #   商品接口（列表/新增/[id] 详情/更新/删除）
│   ├── products/[id]/      # 商品详情页
│   ├── layout.tsx          # 根布局（站点头部/底部）
│   └── page.tsx            # 首页
├── components/             # 通用组件（ProductCard、AddToCartButton 等）
├── lib/
│   ├── api-response.ts     #   统一响应 ok/fail + handleRoute 错误处理
│   ├── prisma.ts           #   PrismaClient 单例
│   ├── queries.ts          #   页面数据查询（服务端组件直查库）
│   └── format.ts           #   金额/销量格式化
└── types/
    └── api.ts              #   ApiResponse 响应结构定义
prisma/
├── schema.prisma           # 数据模型：Category / Product（含状态枚举）
└── seed.ts                 # 演示种子数据（npm run db:seed）
```

## 接口列表

| 方法   | 路径                 | 说明                                                                                                  |
| ------ | -------------------- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`        | 健康检查                                                                                              |
| GET    | `/api/categories`    | 分类列表（含 productCount）                                                                           |
| GET    | `/api/products`      | 商品分页列表，支持 `page` `pageSize` `keyword` `categoryId` `status`（默认只看在售，传 `all` 查全部） |
| POST   | `/api/products`      | 新增商品（Zod 请求体校验）                                                                            |
| GET    | `/api/products/[id]` | 商品详情（不存在返回 404 业务码）                                                                     |
| PATCH  | `/api/products/[id]` | 更新商品（部分字段，Zod 校验）                                                                        |
| DELETE | `/api/products/[id]` | 删除商品                                                                                              |

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
- Prisma 的记录不存在（P2025）已全局映射为 `404 / code 40404`

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
- [x] 商品模块 API（列表/详情/新增/更新/删除）+ 分类接口
- [x] 商城首页 + 商品详情页（服务端组件直查库）
- [x] 演示种子数据
- [ ] 用户注册 / 登录（含鉴权）
- [ ] 购物车、结算与订单流程
