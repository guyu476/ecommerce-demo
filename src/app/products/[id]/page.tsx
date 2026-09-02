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
  return { title: product ? `${product.name} · ecommerce-demo 商城` : "商品不存在" };
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
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
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

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="flex aspect-square items-center justify-center rounded-2xl bg-mist text-[120px] ">
          {product.category?.icon ?? "🛍️"}
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-bold leading-7">{product.name}</h1>

          <p className="font-mono text-3xl font-bold text-promo">{formatPrice(product.price)}</p>

          <ul className="flex gap-4 text-sm opacity-60">
            <li>已售 {formatSales(product.sales)} 件</li>
            <li>库存 {product.stock} 件</li>
            <li>{product.stock > 0 ? "现货" : "暂时缺货"}</li>
          </ul>

          {product.description && (
            <p className="text-sm leading-6 opacity-80">{product.description}</p>
          )}

          <div className="mt-auto pt-2">
            <AddToCartButton productId={product.id} disabled={product.stock <= 0} />
          </div>
        </div>
      </div>
    </main>
  );
}
