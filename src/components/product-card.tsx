import Link from "next/link";
import { formatPrice, formatSales } from "@/lib/format";
import type { ProductWithCategory } from "@/lib/queries";

// 商品卡片：服务端组件，直接渲染数据库数据
export function ProductCard({ product }: { product: ProductWithCategory }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="group overflow-hidden rounded-xl border border-black/10 bg-white transition-shadow hover:shadow-md dark:border-white/15 dark:bg-zinc-900"
    >
      <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 text-6xl dark:from-zinc-800 dark:to-zinc-800/40">
        <span className="transition-transform group-hover:scale-110">
          {product.category?.icon ?? "🛍️"}
        </span>
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm leading-5">{product.name}</h3>
        <p className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-red-600 dark:text-red-400">
            {formatPrice(product.price)}
          </span>
          <span className="text-xs opacity-50">已售 {formatSales(product.sales)}</span>
        </p>
      </div>
    </Link>
  );
}
