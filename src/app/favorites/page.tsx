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

type ShopFavoriteView = {
  id: number;
  shopId: number;
  shop: {
    id: number;
    name: string;
    logo: string | null;
    description: string | null;
    productCount: number;
  };
};

// 我的收藏：商品 / 店铺 两个 Tab；取消收藏即时移除；?tab=shops 直达店铺 Tab
export default function FavoritesPage() {
  const [tab, setTab] = useState<"products" | "shops">(() => {
    if (typeof window === "undefined") return "products";
    return new URLSearchParams(window.location.search).get("tab") === "shops" ? "shops" : "products";
  });
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [favorites, setFavorites] = useState<FavoriteView[]>([]);
  const [shopFavorites, setShopFavorites] = useState<ShopFavoriteView[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadFavorites = useCallback(async () => {
    const res = await fetch("/api/favorites");
    const result = (await res.json()) as ApiResponse<FavoriteView[]>;
    if (isApiSuccess(result)) {
      setFavorites(result.data);
    }
    setStatus("ready");
  }, []);

  const loadShopFavorites = useCallback(async () => {
    const res = await fetch("/api/favorite-shops");
    const result = (await res.json()) as ApiResponse<ShopFavoriteView[]>;
    if (isApiSuccess(result)) setShopFavorites(result.data);
  }, []);

  useEffect(() => {
    // 初始加载：setState 在 await 之后，非同步级联，规则误报；两个 Tab 数据都先拉好
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFavorites();
    void loadShopFavorites();
  }, [loadFavorites, loadShopFavorites]);

  async function unfavorite(productId: number) {
    setBusyId(productId);
    await fetch(`/api/favorites?productId=${productId}`, { method: "DELETE" });
    await loadFavorites();
    setBusyId(null);
  }

  async function unfavoriteShop(shopId: number) {
    setBusyId(shopId);
    await fetch(`/api/favorite-shops?shopId=${shopId}`, { method: "DELETE" });
    await loadShopFavorites();
    setBusyId(null);
  }

  function switchTab(next: "products" | "shops") {
    setTab(next);
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight">我的收藏</h1>
      <p className="mb-8 text-sm opacity-60">心动的商品和店铺都在这里，库存与在售状态以实时页面为准</p>

      {/* Tab */}
      <div className="mb-8 flex gap-2">
        {(
          [
            { key: "products", label: `商品（${favorites.length}）` },
            { key: "shops", label: `店铺（${shopFavorites.length}）` },
          ] as { key: "products" | "shops"; label: string }[]
        ).map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => switchTab(entry.key)}
            className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${
              tab === entry.key
                ? "bg-ink text-white shadow-md"
                : "bg-mist hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "products" ? (
        status === "loading" ? (
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
        )
      ) : shopFavorites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 py-16 text-center text-sm dark:border-white/20">
          <p className="mb-2 text-4xl">🏪</p>
          <p className="mb-4 opacity-60">还没有收藏的店铺，逛到心仪的店点个「收藏店铺」吧</p>
          <Link
            href="/"
            className="inline-block rounded-full bg-promo px-8 py-2.5 text-sm font-medium text-white hover:bg-promo-deep"
          >
            去逛逛
          </Link>
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2">
          {shopFavorites.map(({ shop }) => (
            <li
              key={shop.id}
              className="relative flex items-center gap-5 rounded-2xl border border-black/10 p-6 transition-shadow hover:shadow-lg dark:border-white/15"
            >
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-mist text-4xl dark:bg-white/10">
                {shop.logo ?? "🏪"}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/shops/${shop.id}`}
                  className="truncate text-lg font-bold hover:text-promo hover:underline"
                >
                  {shop.name}
                </Link>
                <p className="mt-1 line-clamp-2 text-xs leading-5 opacity-55">
                  {shop.description || "店主很懒，还没写店铺简介"}
                </p>
                <p className="mt-1.5 text-xs opacity-50">在售 {shop.productCount} 件</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Link
                  href={`/shops/${shop.id}`}
                  className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ink-soft"
                >
                  进店 →
                </Link>
                <button
                  type="button"
                  disabled={busyId === shop.id}
                  onClick={() => unfavoriteShop(shop.id)}
                  className="text-xs opacity-50 hover:text-promo hover:opacity-100 disabled:opacity-30"
                >
                  取消收藏
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
