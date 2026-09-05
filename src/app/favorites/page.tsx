"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { ProductWithCategory } from "@/lib/queries";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type FavoriteView = {
  id: number;
  productId: number;
  product: ProductWithCategory;
};

// 我的收藏：纸签墙 + 右上角取消收藏；取消后即时移除
export default function FavoritesPage() {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [favorites, setFavorites] = useState<FavoriteView[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadFavorites = useCallback(async () => {
    const res = await fetch("/api/favorites");
    const result = (await res.json()) as ApiResponse<FavoriteView[]>;
    if (isApiSuccess(result)) {
      setFavorites(result.data);
    }
    setStatus("ready");
  }, []);

  useEffect(() => {
    // 初始加载：setState 在 await 之后，非同步级联，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFavorites();
  }, [loadFavorites]);

  async function unfavorite(productId: number) {
    setBusyId(productId);
    await fetch(`/api/favorites?productId=${productId}`, { method: "DELETE" });
    await loadFavorites();
    setBusyId(null);
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight">我的收藏</h1>
      <p className="mb-8 text-sm opacity-60">心动的商品都在这里，库存变化以商品页为准</p>

      {status === "loading" ? (
        <ul className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="space-y-3">
              <div className="skeleton aspect-square rounded-xl" />
              <div className="skeleton h-4 w-3/4 rounded" />
            </li>
          ))}
        </ul>
      ) : favorites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 py-16 text-center text-sm dark:border-white/20">
          <p className="mb-2 text-4xl">🤍</p>
          <p className="mb-4 opacity-60">还没有收藏的商品，看到喜欢的点个心吧</p>
          <Link
            href="/"
            className="inline-block rounded-full bg-promo px-8 py-2.5 text-sm font-medium text-white hover:bg-promo-deep"
          >
            去逛逛
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
          {favorites.map(({ product }) => (
            <li key={product.id} className="relative pt-1">
              <ProductCard product={product} />
              <button
                type="button"
                disabled={busyId === product.id}
                onClick={() => unfavorite(product.id)}
                aria-label="取消收藏"
                className="absolute top-0 right-0 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ink/85 text-sm text-white shadow-md transition-transform hover:scale-110 disabled:opacity-40 dark:bg-white/20"
              >
                ♥
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
