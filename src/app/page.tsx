import { DbSetupNotice } from "@/components/db-setup-notice";
import { ProductCard } from "@/components/product-card";
import { getStorefrontData } from "@/lib/queries";

// 首页 = 商城门面：分类导航 + 热卖商品（服务端组件直查数据库）
// 商品数据需要每次请求时拉取最新，强制动态渲染
export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getStorefrontData();

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <DbSetupNotice />
      </main>
    );
  }

  const { categories, products } = data;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <section className="mb-8 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-10 text-white">
        <h1 className="text-2xl font-bold sm:text-3xl">精品好物 · 每日上新</h1>
        <p className="mt-2 opacity-90">ecommerce-demo 商城，Next.js 全栈演示项目</p>
      </section>

      {categories.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">商品分类</h2>
          <ul className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <li
                key={category.id}
                className="rounded-full border border-black/10 px-4 py-1.5 text-sm dark:border-white/15"
              >
                <span className="mr-1">{category.icon}</span>
                {category.name}
                <span className="ml-1.5 text-xs opacity-50">{category.productCount}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">热卖商品</h2>
        {products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 p-10 text-center text-sm dark:border-white/20">
            <p className="mb-2 opacity-70">还没有在售商品</p>
            <p className="font-mono text-xs opacity-50">执行 npm run db:seed 导入演示数据</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
