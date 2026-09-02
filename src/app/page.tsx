import Link from "next/link";
import { DbSetupNotice } from "@/components/db-setup-notice";
import { ProductCard } from "@/components/product-card";
import { formatPrice } from "@/lib/format";
import { getStorefrontData } from "@/lib/queries";

// 首页 = 商城门面：今日爆款价签板 + 分类导航 + 热卖商品
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
  const featured = products[0];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      {/* 签名元素：今日爆款价签板（墨蓝底 + 促销价签） */}
      {featured && (
        <section className="mb-10 overflow-hidden rounded-2xl bg-ink text-white">
          <div className="flex flex-col items-center gap-6 px-8 py-10 sm:flex-row sm:py-12">
            <div className="min-w-0 flex-1">
              <span className="price-tag mb-4 px-4 py-1 text-sm tracking-widest">今日爆款</span>
              <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">
                {featured.name}
              </h1>
              <p className="mt-3 font-mono text-3xl font-bold text-market">
                {formatPrice(featured.price)}
              </p>
              <Link
                href={`/products/${featured.id}`}
                className="mt-6 inline-block rounded-full bg-paper px-8 py-3 text-sm font-semibold text-ink transition-colors hover:bg-mist"
              >
                立即查看
              </Link>
            </div>
            <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-[100px] sm:h-48 sm:w-48 sm:text-[120px]">
              {featured.category?.icon ?? "🛍️"}
            </div>
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-bold tracking-tight">商品分类</h2>
          <ul className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <li
                key={category.id}
                className="rounded-full border border-black/10 bg-white px-4 py-1.5 text-sm transition-colors hover:border-ink/30 dark:border-white/15 dark:bg-white/5"
              >
                <span className="mr-1">{category.icon}</span>
                {category.name}
                <span className="ml-1.5 font-mono text-xs opacity-50">{category.productCount}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight">热卖商品</h2>
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
