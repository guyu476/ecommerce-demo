import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { DbSetupNotice } from "@/components/db-setup-notice";
import { ProductGallery } from "@/components/product-gallery";
import { formatPrice, formatSales } from "@/lib/format";
import { getProductById, parseProductImages } from "@/lib/queries";

type Props = PageProps<"/products/[id]">;

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// SEO：商品名作为页面标题
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const numericId = parseId(id);
  const product = numericId ? await getProductById(numericId) : null;
  return { title: product ? `${product.name} · 鸟西商城` : "商品不存在" };
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-market" aria-label={`${rating} 星`}>
      {"★".repeat(rating)}
      <span className="opacity-30">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function AvatarChip({ avatar }: { avatar: string | null }) {
  if (avatar?.startsWith("data:")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mist text-base dark:bg-white/10">
      {avatar ?? "🙂"}
    </span>
  );
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  const numericId = parseId(id);
  if (numericId === null) notFound();

  const product = await getProductById(numericId);

  // 数据库未就绪
  if (product === undefined) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <DbSetupNotice />
      </main>
    );
  }

  // 商品不存在
  if (product === null) notFound();

  const images = parseProductImages(product.images);
  const avgRating =
    product.reviews.length > 0
      ? product.reviews.reduce((sum, review) => sum + review.rating, 0) / product.reviews.length
      : 0;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <nav className="mb-6 text-sm opacity-60">
        <Link href="/" className="hover:underline">
          首页
        </Link>
        {product.category && (
          <>
            <span className="mx-2">/</span>
            <span>{product.category.name}</span>
          </>
        )}
        <span className="mx-2">/</span>
        <span>商品详情</span>
      </nav>

      <div className="grid gap-14 sm:grid-cols-2">
        {/* 拍立得相框 + 纸胶带（画报感）+ 多图相册 */}
        <div className="relative -rotate-1 self-start rounded-lg bg-white p-3 shadow-xl dark:bg-white/10">
          <span
            aria-hidden
            className="washi absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 rotate-2 rounded-sm"
          />
          <ProductGallery images={images} fallbackIcon={product.category?.icon ?? "🛍️"} />
        </div>

        <div className="flex flex-col gap-5">
          <h1 className="text-2xl font-extrabold leading-8 tracking-tight">{product.name}</h1>

          {/* 海报式价格：小眉毛 + 大字 */}
          <div>
            <p className="text-xs tracking-[0.3em] text-promo">到手价</p>
            <p className="font-mono text-4xl font-black text-promo">{formatPrice(product.price)}</p>
          </div>

          <ul className="flex gap-5 text-sm opacity-60">
            <li>已售 {formatSales(product.sales)} 件</li>
            <li>{product.stock > 0 ? "现货" : "暂时缺货"}</li>
            {product.seller && <li>店铺：{product.seller.nickname}</li>}
          </ul>

          {product.description && (
            <p className="border-l-2 border-market/60 pl-4 text-sm leading-7 opacity-80">
              {product.description}
            </p>
          )}

          <div className="mt-auto pt-2">
            <AddToCartButton productId={product.id} disabled={product.stock <= 0} />
          </div>
        </div>
      </div>

      {/* 评价栏目 */}
      <section className="mt-16">
        <div className="mb-6 flex items-end justify-between border-b border-black/10 pb-3 dark:border-white/10">
          <h2 className="text-xl font-extrabold tracking-tight">
            用户评价（{product.reviews.length}）
          </h2>
          {product.reviews.length > 0 && (
            <p className="text-sm">
              <span className="font-mono text-lg font-bold text-market">
                {avgRating.toFixed(1)}
              </span>
              <span className="ml-2">
                <Stars rating={Math.round(avgRating)} />
              </span>
            </p>
          )}
        </div>

        {product.reviews.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 py-12 text-center text-sm opacity-60 dark:border-white/20">
            还没有评价，购买后快来抢首评吧～
          </p>
        ) : (
          <ul className="space-y-6">
            {product.reviews.map((review) => (
              <li key={review.id} className="flex gap-4">
                <AvatarChip avatar={review.user.avatar} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{review.user.nickname}</p>
                  <p className="mt-0.5 text-xs">
                    <Stars rating={review.rating} />
                    <span className="ml-2 opacity-40">
                      {new Date(review.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </p>
                  <p className="mt-1.5 text-sm leading-6 opacity-80">{review.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
