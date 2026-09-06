import Link from "next/link";
import { TearStub } from "@/components/tear-stub";
import { discountedPrice, rateLabel } from "@/lib/discounts";
import { parseProductImages } from "@/lib/queries";
import type { ProductWithCategory } from "@/lib/queries";

// 商品卡片：主图 = 商家上传的第一张图；未上传时显示浅黑色占位
// 底部价格行是「可撕票根」——按住向右撕开直接加购（TearStub）
// 参与限时折扣时：图片角标折扣 + 票根划线原价
export function ProductCard({
  product,
  rank,
  tilt = 0,
  discountRate = null,
}: {
  product: ProductWithCategory;
  rank?: number;
  tilt?: number;
  discountRate?: number | null;
}) {
  const images = parseProductImages(product.images);
  const cover = images[0];
  const displayPrice = discountRate
    ? discountedPrice(Number(product.price), discountRate)
    : Number(product.price);

  return (
    <div
      className="hover-lift group block overflow-visible rounded-xl border border-black/10 bg-white transition-all hover:z-10 hover:-translate-y-1 hover:rotate-0 hover:shadow-xl dark:border-white/15 dark:bg-white/5"
      style={{ rotate: `${tilt}deg` }}
    >
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative">
          <div className="aspect-square overflow-hidden rounded-t-xl bg-zinc-800">
            {cover ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={cover}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : null}
          </div>

          {/* hover 提示层：底部渐变 + 查看详情 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-black/50 to-transparent pb-3 pt-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          >
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-ink">
              查看详情 →
            </span>
          </div>

          {discountRate != null && (
            <span className="absolute top-0 left-0 rounded-tr-xl bg-promo px-2 py-1 text-[11px] font-bold text-white">
              限时 {rateLabel(discountRate)}
            </span>
          )}

          {rank != null && rank <= 3 && (
            <span className="absolute top-0 right-0 rounded-bl-xl bg-ink px-2.5 py-1 font-mono text-[11px] font-bold text-market">
              TOP {rank}
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 min-h-10 px-4 pt-3 text-sm leading-5 font-medium">
          {product.name}
        </h3>
      </Link>

      <TearStub
        productId={product.id}
        price={String(displayPrice)}
        originalPrice={discountRate != null ? String(product.price) : null}
        sales={product.sales}
      />
    </div>
  );
}
