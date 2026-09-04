import Link from "next/link";
import { formatPrice, formatSales } from "@/lib/format";
import { parseProductImages } from "@/lib/queries";
import type { ProductWithCategory } from "@/lib/queries";

// 商品卡片：主图 = 商家上传的第一张图；未上传时显示浅黑色占位
export function ProductCard({
  product,
  rank,
  tilt = 0,
}: {
  product: ProductWithCategory;
  rank?: number;
  tilt?: number;
}) {
  const images = parseProductImages(product.images);
  const cover = images[0];

  return (
    <Link
      href={`/products/${product.id}`}
      className="hover-lift group block overflow-visible rounded-xl border border-black/10 bg-white transition-all hover:z-10 hover:-translate-y-1 hover:rotate-0 hover:shadow-xl dark:border-white/15 dark:bg-white/5"
      style={{ rotate: `${tilt}deg` }}
    >
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

        {rank != null && rank <= 3 && (
          <span className="absolute top-0 right-0 rounded-bl-xl bg-ink px-2.5 py-1 font-mono text-[11px] font-bold text-market">
            TOP {rank}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="line-clamp-2 min-h-10 text-sm leading-5 font-medium">{product.name}</h3>
        <div className="coupon-dash my-2.5" />
        <p className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-lg font-bold text-promo">
            {formatPrice(product.price)}
          </span>
          <span className="text-xs opacity-50">已售 {formatSales(product.sales)}</span>
        </p>
      </div>
    </Link>
  );
}
