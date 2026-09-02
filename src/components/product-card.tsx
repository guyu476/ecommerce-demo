import Link from "next/link";
import { formatPrice, formatSales } from "@/lib/format";
import type { ProductWithCategory } from "@/lib/queries";

// 商品卡片：服务端组件，价格用促销红等宽字体（价签的打印感）
export function ProductCard({ product }: { product: ProductWithCategory }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="hover-lift group block overflow-hidden rounded-xl border border-black/10 bg-white transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/15 dark:bg-white/5"
    >
      <div className="flex aspect-square items-center justify-center bg-mist text-6xl dark:bg-white/5">
        <span className="transition-transform group-hover:scale-110">
          {product.category?.icon ?? "🛍️"}
        </span>
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm leading-5">{product.name}</h3>
        <p className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-base font-bold text-promo">
            {formatPrice(product.price)}
          </span>
          <span className="text-xs opacity-50">已售 {formatSales(product.sales)}</span>
        </p>
      </div>
    </Link>
  );
}
