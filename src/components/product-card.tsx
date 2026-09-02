import Link from "next/link";
import { formatPrice, formatSales } from "@/lib/format";
import type { ProductWithCategory } from "@/lib/queries";

// 商品卡片（市集纸签风）：
// - rank 1-3 时显示销量排名角标（排序真实反映数据，符合「结构即信息」）
// - 库存 <= 50 时盖「库存紧张」印章
// - 相邻卡片微微旋转，像钉在板上的纸签；悬停回正
export function ProductCard({
  product,
  rank,
  tilt = 0,
}: {
  product: ProductWithCategory;
  rank?: number;
  tilt?: number;
}) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="hover-lift group block overflow-visible rounded-xl border border-black/10 bg-white transition-all hover:z-10 hover:-translate-y-1 hover:rotate-0 hover:shadow-xl dark:border-white/15 dark:bg-white/5"
      style={{ rotate: `${tilt}deg` }}
    >
      <div className="relative">
        <div className="flex aspect-square items-center justify-center rounded-t-xl bg-mist text-6xl dark:bg-white/5">
          <span className="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
            {product.category?.icon ?? "🛍️"}
          </span>
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
