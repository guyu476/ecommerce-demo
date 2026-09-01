import { ApiStatus } from "@/components/api-status";

const techStack = [
  "Next.js 16 (App Router)",
  "TypeScript",
  "Tailwind CSS v4",
  "Prisma ORM",
  "MySQL",
  "Zod 校验",
];

const apiEndpoints = [
  { method: "GET", path: "/api/health", desc: "健康检查" },
  {
    method: "GET",
    path: "/api/products?page=1&pageSize=10",
    desc: "商品分页列表（需先配置数据库）",
  },
  { method: "POST", path: "/api/products", desc: "新增商品（Zod 请求体校验）" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">ecommerce-demo</h1>
        <p className="opacity-70">电商网站 Demo · Next.js 全栈项目框架</p>
        <ul className="flex flex-wrap gap-2 text-xs">
          {techStack.map((item) => (
            <li
              key={item}
              className="rounded-full border border-black/10 px-3 py-1 dark:border-white/20"
            >
              {item}
            </li>
          ))}
        </ul>
      </header>

      <ApiStatus />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">内置示例接口</h2>
        <ul className="space-y-1 font-mono text-sm">
          {apiEndpoints.map((api) => (
            <li key={api.method + api.path} className="flex gap-3">
              <span className="w-10 shrink-0 font-bold text-green-600 dark:text-green-400">
                {api.method}
              </span>
              <span className="shrink-0">{api.path}</span>
              <span className="opacity-60">{api.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="text-sm opacity-60">
        下一步：填好 .env 里的 MySQL 密码 → npm run db:migrate 建库建表 →开始写业务。详见 README.md
      </footer>
    </main>
  );
}
