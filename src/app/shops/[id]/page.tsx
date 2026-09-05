import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DbSetupNotice } from "@/components/db-setup-notice";
import { ProductCard } from "@/components/product-card";
import { ShopFavoriteButton } from "@/components/shop-favorite-button";
import { getShopById } from "@/lib/queries";

type Props = PageProps<"/shops/[id]">;

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const numericId = parseId(id);
  const shop = numericId ? await getShopById(numericId) : null;
  return { title: shop ? `${shop.name} · 鸟西商城` : "店铺不存在" };
}

// 店铺主页：店招横幅（emoji + 印章）+ 在售商品纸签墙
export default async function ShopPage({ params }: Props) {
  const { id } = await params;
  const numericId = parseId(id);
  if (numericId === null) notFound();

  const shop = await getShopById(numericId);

  // 数据库未就绪
  if (shop === undefined) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <DbSetupNotice />
      </main>
    );
  }

  // 店铺不存在
  if (shop === null) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      {/* 店招：市集摊位横匾 */}
      <header className="relative mb-12 overflow-hidden rounded-2xl bg-ink px-8 py-10 text-white shadow-xl">
        <span
          aria-hidden
          className="text-outline pointer-events-none absolute -top-4 right-6 text-8xl font-black select-none"
        >
          SHOP
        </span>
        <div className="flex flex-wrap items-center gap-6">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-5xl shadow-inner">
            {shop.logo ?? "🏪"}
          </span>
          <div className="min-w-0">
            <h1 className="text-3xl font-black tracking-tight">{shop.name}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
              {shop.description || "店主很懒，还没写店铺简介"}
            </p>
            <p className="mt-3 text-xs text-white/50">
              在售 {shop.productCount} 件 · {new Date(shop.createdAt).toLocaleDateString("zh-CN")}{" "}
              开张
            </p>
          </div>
          <Link
            href="/"
            className="ml-auto hidden rounded-full border border-white/25 px-5 py-2 text-sm transition-colors hover:bg-white/10 sm:block"
          >
            ← 回商城
          </Link>
          <div className="ml-auto sm:ml-0">
            <ShopFavoriteButton shopId={shop.id} />
          </div>
        </div>
      </header>

      <section>
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-xl font-extrabold tracking-tight">店内商品</h2>
          <span className="text-sm opacity-50">共 {shop.products.length} 件在售</span>
        </div>

        {shop.products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 py-16 text-center text-sm dark:border-white/20">
            <p className="mb-2 text-3xl">🧺</p>
            <p className="opacity-60">货架空空如也，店主正在补货中…</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
            {shop.products.map((product, i) => (
              <li key={product.id} className="pt-1">
                <ProductCard product={product} tilt={i % 2 === 0 ? 0.6 : -0.5} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
