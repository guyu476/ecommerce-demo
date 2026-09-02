import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { DbSetupNotice } from "@/components/db-setup-notice";
import { formatPrice, formatSales } from "@/lib/format";
import { getProductById } from "@/lib/queries";

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
  return { title: product ? `${product.name} · 淘东商城` : "商品不存在" };
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
        {/* 拍立得相框 + 纸胶带（画报感） */}
        <div className="relative -rotate-1 self-start rounded-lg bg-white p-3 shadow-xl dark:bg-white/10">
          <span
            aria-hidden
            className="washi absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 rotate-2 rounded-sm"
          />
          <div className="flex aspect-square items-center justify-center rounded-md bg-mist text-[130px] dark:bg-white/5">
            {product.category?.icon ?? "🛍️"}
          </div>
          <p className="pt-2.5 pb-1 text-center font-mono text-xs opacity-50">
            NO.{String(product.id).padStart(4, "0")}
          </p>
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
            <li>库存 {product.stock} 件</li>
            <li>{product.stock > 0 ? "现货" : "暂时缺货"}</li>
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
    </main>
  );
}
