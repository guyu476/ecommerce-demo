"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";

// 轮播数据：纯对象（Decimal 等类实例无法跨服务端→客户端边界序列化）
export interface CarouselSlide {
  id: number;
  name: string;
  price: number;
  icon: string;
}

// 首页轮播：销量最高的商品自动轮播（4.5s），悬停暂停，尊重减弱动效偏好
export function HeroCarousel({ products }: { products: CarouselSlide[] }) {
  const count = products.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count]);

  useEffect(() => {
    if (paused || count <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(next, 4500);
    return () => clearInterval(timer);
  }, [paused, count, next]);

  const controlClass =
    "flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg text-white/80 backdrop-blur transition-colors hover:bg-white/25";

  return (
    <section
      aria-label="今日爆款轮播"
      className="relative overflow-hidden rounded-xl bg-ink text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative h-52 sm:h-60">
        {products.map((product, i) => (
          <div
            key={product.id}
            aria-hidden={i !== index}
            className={`absolute inset-0 flex items-center justify-between gap-4 px-8 transition-opacity duration-500 sm:px-10 ${
              i === index ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-medium tracking-[0.35em] text-market">今日爆款</p>
              <h2 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
                {product.name}
              </h2>
              <p className="mt-2 font-mono text-2xl font-bold text-market sm:text-3xl">
                {formatPrice(product.price)}
              </p>
              <Link
                href={`/products/${product.id}`}
                className="mt-5 inline-block rounded-full bg-paper px-6 py-2 text-xs font-semibold text-ink transition-colors hover:bg-mist"
              >
                立即查看
              </Link>
            </div>
            <div className="shrink-0 text-[90px] sm:text-[110px]">{product.icon}</div>
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="上一张"
            onClick={prev}
            className={controlClass + " absolute left-3 top-1/2 -translate-y-1/2"}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="下一张"
            onClick={next}
            className={controlClass + " absolute right-3 top-1/2 -translate-y-1/2"}
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {products.map((product, i) => (
              <button
                key={product.id}
                type="button"
                aria-label={`第 ${i + 1} 张：${product.name}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-market" : "w-1.5 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
