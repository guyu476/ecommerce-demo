import Link from "next/link";
import { DbSetupNotice } from "@/components/db-setup-notice";
import { HeroCarousel } from "@/components/hero-carousel";
import { ProductCard } from "@/components/product-card";
import { getStorefrontData } from "@/lib/queries";

// 首页 = 商城门面：轮播 + 可点击分类筛选 + 商品网格
// 商品数据需要每次请求时拉取最新，强制动态渲染
export const dynamic = "force-dynamic";

// 板块标题：红色短竖条 + 粗标题，紧凑大气
function SectionTitle({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
        <span className="h-4 w-1 rounded-full bg-promo" />
        {children}
      </h2>
      {extra}
    </div>
  );
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const categorySlug = typeof params.category === "string" ? params.category : undefined;
  const data = await getStorefrontData(categorySlug);

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <DbSetupNotice />
      </main>
    );
  }

  const { categories, products } = data;
  const activeCategory = categories.find((c) => c.slug === categorySlug);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-6">
      {products.length > 0 && (
        <HeroCarousel
          products={products.slice(0, 3).map((product) => ({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            icon: product.category?.icon ?? "🛍️",
          }))}
        />
      )}

      {categories.length > 0 && (
        <section>
          <SectionTitle>商品分类</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href="/"
                className={`inline-block rounded-full px-4 py-1.5 text-sm transition-colors ${
                  activeCategory
                    ? "bg-white text-ink hover:bg-mist dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                    : "bg-ink text-white"
                }`}
              >
                全部
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/?category=${category.slug}`}
                  className={`inline-block rounded-full px-4 py-1.5 text-sm transition-colors ${
                    activeCategory?.id === category.id
                      ? "bg-ink text-white"
                      : "bg-white hover:bg-mist dark:bg-white/10 dark:hover:bg-white/20"
                  }`}
                >
                  <span className="mr-1">{category.icon}</span>
                  {category.name}
                  <span className="ml-1.5 font-mono text-xs opacity-50">
                    {category.productCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle
          extra={
            activeCategory ? (
              <Link href="/" className="text-xs opacity-60 hover:opacity-100 hover:underline">
                查看全部
              </Link>
            ) : undefined
          }
        >
          {activeCategory ? `${activeCategory.icon} ${activeCategory.name}` : "热卖商品"}
        </SectionTitle>

        {products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 py-14 text-center text-sm dark:border-white/20">
            <p className="mb-2 opacity-70">
              {activeCategory ? "该分类下暂时没有在售商品" : "还没有在售商品"}
            </p>
            <p className="font-mono text-xs opacity-50">执行 npm run db:seed 导入演示数据</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
