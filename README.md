# ecommerce-demo

电商网站 Demo · Next.js 全栈项目（三角色：用户 / 商家 / 管理员）。

> **演示口径说明**：以下环节为「流程演示」，不做真实外部对接，将来接入真实服务时只需替换对应实现，接口契约不变——
>
> - 💳 **支付**：订单页「模拟支付」按钮完成付款流转，不接支付宝/微信等支付网关，无真实资金流；
> - 💸 **退款打款**：商家同意退款即视为「原路退回完成」（模拟），无真实退款通道；
> - 📱 **短信**：短信登录与找回密码的验证码在前端模拟显示，服务端不校验其真实性（任意 6 位数字均可通过）；
> - 🚚 **物流**：发货单号由商家填写或自动生成 `BX` 开头的演示单号，不接快递公司 API、无真实轨迹；
> - 💰 **币值**：优惠券为演示币，无真实营销预算约束。

## 技术栈

| 层     | 选型                     | 说明                                   |
| ------ | ------------------------ | -------------------------------------- |
| 框架   | Next.js 16（App Router） | React 全栈，页面与 API 同仓库          |
| 语言   | TypeScript（strict）     | 全量类型覆盖                           |
| 样式   | Tailwind CSS v4          | 原子化 CSS，暗色模式                   |
| ORM    | Prisma 6                 | 数据库模型与迁移                       |
| 数据库 | MySQL 8                  | 连接串配置在 `.env`                    |
| 校验   | Zod                      | 请求参数/请求体校验                    |
| 单测   | Vitest                   | `npm test`（状态机/单号/指纹等纯逻辑） |
| 规范   | ESLint + Prettier        | `npm run lint` / `npm run format`      |

## 快速开始

```bash
npm install              # 安装依赖

cp .env.example .env     # 编辑 .env，把 DATABASE_URL 里的 PASSWORD 换成你的 MySQL 密码

npm run db:migrate       # 首次执行会自动创建 ecommerce_demo 库并建表
                         # （会提示输入迁移名，如 init）

npm run db:seed          # 导入演示数据（幂等，可重复执行）

npm test                 # 单元测试

npm run dev              # 启动开发服务器，打开 http://localhost:3000
```

其他常用命令：`npm run db:studio`（可视化看数据）、`npm run db:generate`（改了 schema 后重新生成客户端）、`npm run build`（生产构建）。

## 演示账号

| 角色         | 账号                  | 密码           | 店铺                                      |
| ------------ | --------------------- | -------------- | ----------------------------------------- |
| 用户         | demo@example.com      | demo123456     | —                                         |
| 商家（一店） | merchant@example.com  | merchant123456 | 鸟西数码旗舰店（手机数码 / 电脑办公）     |
| 商家（二店） | merchant2@example.com | merchant123456 | 优选生活百货（家电 / 服饰 / 美妆 / 生鲜） |
| 管理员       | admin@example.com     | admin123456    | —                                         |

短信登录 / 找回密码：任意合法手机号 + 任意 6 位验证码（演示环境不校验；短信登录时未注册手机号会自动建号）。

## 已实现功能

**买家侧**

- 商城首页：搜索（名称/描述）、排序（综合/最新/价格升降）、分类票签筛选、热卖轮播、分页、领券条幅
- 商品详情：多图画廊 + 灯箱、评分与评价列表、加入购物车、收藏心形、进店逛逛
- 购物车 → 结算：**勾选结算**（单品圈选 + 全选，只结算勾中项，状态持久化）、地址簿预填、**优惠券抵扣**（平台券整单满减、店铺券按该店商品小计满减，服务端二次校验）、幂等键防重复下单
- 订单：模拟支付、查看物流单号、确认收货、**申请退款（售后）**、评价（星级 + 文字）、五入口红点计数
- 个人中心：昵称/头像、收货地址簿、我的收藏、领券中心（领券 + 我的券）

**商家侧**（商家中心 `/merchant`）

- 店铺设置（一人一店）：店名 / 店招 emoji / 简介，公开店铺主页 `/shops/[id]`
- **发店铺券**：自定门槛/面额/数量/有效期，限本店商品满减；领取进度条、未领取可撤下
- 商品管理：上架 / 下架 / 草稿、多图上传（`/api/upload`，客户端压缩后存站点文件）
- 订单发货：填写物流单号（留空自动生成演示单号）
- 退款处理：同意退款（模拟打款、回补库存、订单取消）或拒绝

**管理侧**（后台 `/admin`）

- 数据看板：GMV（实付口径）、近 7 天订单趋势、状态分布、热卖 TOP 5、待发货 / 退款待处理告警
- **发平台券**：全店通用；可查看全平台券（平台券/店铺券标识与领取进度）、撤下未领取的券
- 商品 / 订单管理（只读监督）、用户角色管理

**工程质量**

- 下单事务内条件扣库存（防超卖）+ 幂等键唯一约束原子抢占（防重复下单）
- 订单主状态机与退款状态机收敛在 `src/types/order.ts`（契约先行，接口守卫与页面按钮共用），配 Vitest 单测
- 统一 API 响应封套 `{code, message, data}` + `handleRoute` 集中错误处理（Zod 字段级错误、Prisma 已知错误码特判）
- 三角色权限：API 层 `requireUser` / `requireRole`，页面层 `src/proxy.ts` 登录守卫（Next.js 16 将 middleware 更名为 proxy），双层防御
- 会话：JWT（jose）写 httpOnly cookie；令牌签发/校验独立在 `src/lib/session.ts`（Edge 兼容，供 proxy 复用）

## 已实现页面

| 路由                 | 说明                                                |
| -------------------- | --------------------------------------------------- |
| `/`                  | 首页：搜索/排序/分类筛选/热卖轮播/领券条幅/分页     |
| `/products/[id]`     | 商品详情：画廊、评分评价、加购、收藏、进店          |
| `/shops/[id]`        | 店铺主页：店招横幅 + 店内在售商品                   |
| `/cart`              | 购物车                                              |
| `/checkout`          | 确认订单：地址簿、优惠券抵扣、幂等提交              |
| `/orders`            | 我的订单：支付/物流/收货/退款/评价                  |
| `/favorites`         | 我的收藏                                            |
| `/user`              | 个人中心：资料、地址簿、**优惠券（领券 + 我的券）**、订单入口 |
| `/login` `/register` | 密码登录 / 短信登录（模拟）/ 找回密码（模拟）/ 注册 |
| `/merchant`          | 商家中心：店铺设置、商品管理、发货、退款处理        |
| `/admin`             | 管理后台：数据看板、商品/订单/用户管理              |

数据库未就绪时页面会显示引导提示，而不是白屏报错。

## 数据模型（prisma/schema.prisma）

`User`（三角色）、`Address`、`CartItem`、`Category`、`Product`（挂 `sellerId` 与 `shopId`，带 `seedKey` 种子幂等键）、`Shop`（一人一店）、`Favorite`、`Coupon`（发券方 `ownerId`：空 = 平台券，非空 = 店铺券）/ `UserCoupon`（每人限领一张、一单至多用一张）、`Order`（含退款状态/原因/金额、物流单号、支付/发货/收货时间、券抵扣金额）、`OrderItem`（下单快照）、`Review`（一单一商品一条）、`IdempotencyKey`。

## 目录结构

```text
src/
├── app/
│   ├── api/                # Route Handlers（auth/products/orders/coupons/favorites/shops/upload/admin ...）
│   ├── products/[id]/      # 商品详情
│   ├── shops/[id]/         # 店铺主页
│   ├── favorites/         # 收藏
│   ├── cart/ checkout/ orders/ user/ login/ register/
│   ├── merchant/ admin/    # 商家中心 / 管理后台
│   ├── layout.tsx page.tsx loading.tsx   # 布局 / 首页 / 骨架屏
│   └── globals.css         # 设计 token（市集画报风）
├── components/             # ProductCard / OrderManager / Toast / MobileNav 等
├── lib/
│   ├── api-response.ts     # 统一响应 ok/fail + handleRoute
│   ├── auth.ts             # 会话读取 + requireUser/requireRole
│   ├── session.ts          # JWT 签发/校验（Edge 兼容，proxy.ts 复用）
│   ├── order.ts            # 订单号/物流单号/请求指纹生成器
│   ├── prisma.ts queries.ts format.ts
├── proxy.ts                # 页面级登录守卫（Next.js 16：middleware 更名为 proxy）
└── types/order.ts          # 订单/退款状态机契约（可单测的纯函数）
prisma/
├── schema.prisma migrations/ seed.ts
tests/                      # Vitest 单测（状态机/单号/指纹）
scripts/                    # 绑图 / 重置演示订单 / 清理测试账号
```

## 接口速览

| 方法与路径                                                                    | 说明                                                     |
| ----------------------------------------------------------------------------- | -------------------------------------------------------- |
| GET `/api/health`                                                             | 健康检查                                                 |
| POST `/api/auth/register` \| `login` \| `logout` \| `sms-login`               | 注册 / 登录 / 登出 / 短信登录（模拟）                    |
| POST `/api/auth/reset-password`                                               | 找回密码（模拟短信）                                     |
| GET `/api/auth/me`                                                            | 当前用户                                                 |
| GET `/api/categories`                                                         | 分类列表（含在售计数）                                   |
| GET `/api/products`                                                           | 商品分页：keyword（名称/描述）、sort、categoryId、status |
| GET/POST/PATCH `/api/cart`（PATCH=全选/取消全选），PATCH/DELETE `/api/cart/[id]`（数量/勾选） | 购物车（`?checkedOnly=1` 只看勾选项） |
| GET/POST `/api/favorites`，DELETE `?productId=`，GET `/api/favorites/ids`     | 收藏列表 / 收藏 / 取消 / 心形状态                        |
| GET `/api/coupons`，POST（领取），GET `/api/coupons/mine`                     | 券模板（含平台券/店铺券标识）/ 领取 / 我的券             |
| GET/POST `/api/merchant/coupons`，DELETE `/api/merchant/coupons/[id]`         | 店铺券管理（商家发券，限本店商品满减；未领取可撤）       |
| GET/POST `/api/admin/coupons`，DELETE `/api/admin/coupons/[id]`               | 平台券管理（管理员发券，全店通用；未领取可撤）           |
| POST `/api/orders`（Idempotency-Key + 可选 userCouponId）、GET                | 下单（券抵扣）/ 订单分页                                 |
| GET `/api/orders/[id]`、GET `/api/orders/counts`                              | 订单详情 / 各状态计数                                    |
| POST `/api/orders/[id]/transition`                                            | pay / ship（可带单号）/ confirm                          |
| POST `/api/orders/[id]/cancel`                                                | 取消（仅待付款，回补库存）                               |
| POST `/api/orders/[id]/refund`                                                | request（买家）/ approve、reject（商家）                 |
| POST `/api/orders/[id]/reviews`                                               | 评价                                                     |
| GET `/api/merchant/orders`                                                    | 含我商品的订单（发货/退款视角）                          |
| GET/PUT `/api/merchant/shop`                                                  | 我的店铺 / 开店或更新                                    |
| GET/POST `/api/merchant/products`，PATCH/DELETE `/api/merchant/products/[id]` | 商家商品管理                                             |
| PATCH `/api/admin/users`，GET `/api/admin/stats`                              | 用户角色 / 数据看板                                      |
| POST `/api/upload`                                                            | 图片上传（multipart 字段 `file`，存 `public/uploads`）   |
| GET/POST `/api/addresses`，PATCH/DELETE `/api/addresses/[id]`                 | 地址簿                                                   |

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

- HTTP 状态码表达传输层语义（400/401/403/404/409/422/500）
- `code` 表达业务语义：`0` 成功；`40101` 未登录；`40301` 无权限；`40404` 不存在；`4090x` 状态/库存/券冲突；`42201` 幂等冲突
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

## 以后有能力再改的清单（TODO）

1. 支付网关接入（支付宝/微信），替换「模拟支付」，并补支付流水表与对账；
2. 真实短信服务商（验证码缓存 + 防刷），替换模拟验证码；
3. 物流跟踪 API（快递 100 / 快递鸟等），用真实单号与轨迹替换演示单号；
4. 图片迁移到对象存储 + CDN（替换 `/api/upload` 的存储实现即可，url 形态不变）；
5. 退款接入原支付渠道的退款接口，替代「模拟打款」；
6. 多商家订单的金额拆分与结算分账；
7. SKU / 商品规格（当前商品为单一价格、单一库存）。
