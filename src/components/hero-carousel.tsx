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
  image: string; // 商品第一张上传图；空则显示 icon 装饰
}

// 层叠位置 → 卡片变换（内联样式，避免动态类名被 JIT 漏掉）
const STACK_STYLES: Record<number, React.CSSProperties> = {
  0: { transform: "translate(-50%, 0) scale(1) rotate(0deg)", zIndex: 30, opacity: 1 },
  1: { transform: "translate(-30%, 6%) scale(0.88) rotate(5deg)", zIndex: 20, opacity: 0.65 },
  [-1]: { transform: "translate(-70%, 6%) scale(0.88) rotate(-5deg)", zIndex: 10, opacity: 0.65 },
  2: { transform: "translate(-50%, 0) scale(0.8) rotate(0deg)", zIndex: 0, opacity: 0 },
};

// 首页轮播（卡片层叠式）：销量最高商品居前，两侧卡片层叠露出；
// 自动轮播 4.5s，悬停暂停，点侧卡切到该卡，尊重减弱动效偏好
export function HeroCarousel({ slides }: { slides: CarouselSlide[] }) {
  const count = slides.length;
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

  function offsetOf(i: number): number {
    const offset = (i - index + count) % count;
    if (offset === 0) return 0;
    if (offset === 1) return 1;
    if (offset === count - 1) return -1;
    return 2; // 其余隐藏
  }

  return (
    <section
      aria-label="今日爆款轮播"
      className="relative isolate select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative h-72 sm:h-80">
        {slides.map((slide, i) => {
          const offset = offsetOf(i);
          const active = offset === 0;
          return (
            <article
              key={slide.id}
              aria-hidden={!active}
              onClick={() => !active && setIndex(i)}
              style={STACK_STYLES[offset]}
              className={`absolute inset-y-0 left-1/2 flex w-[min(680px,92%)] items-center justify-between gap-6 overflow-hidden rounded-2xl bg-ink px-10 text-white shadow-2xl transition-all duration-500 ease-out sm:px-12 ${
                active ? "" : "cursor-pointer"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="mb-3 text-xs font-medium tracking-[0.4em] text-market">今日爆款</p>
                <h2 className="truncate text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {slide.name}
                </h2>
                <p className="mt-4 font-mono text-3xl font-bold text-market">
                  {formatPrice(slide.price)}
                </p>
                <Link
                  href={`/products/${slide.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-8 inline-block rounded-full bg-paper px-8 py-3 text-sm font-semibold text-ink transition-colors hover:bg-mist"
                >
                  立即查看
                </Link>
              </div>
              <div
                className={`shrink-0 overflow-hidden rounded-xl transition-transform duration-500 ${
                  active ? "scale-100" : "scale-90"
                } ${slide.image ? "h-40 w-40 sm:h-48 sm:w-48" : "text-[110px] sm:text-[130px]"}`}
              >
                {slide.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={slide.image} alt={slide.name} className="h-full w-full object-cover" />
                ) : (
                  slide.icon
                )}
              </div>
            </article>
          );
        })}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="上一张"
            onClick={prev}
            className="absolute -left-2 top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-black/5 bg-white text-lg text-ink shadow-lg transition-transform hover:scale-110 sm:-left-5"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="下一张"
            onClick={next}
            className="absolute -right-2 top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-black/5 bg-white text-lg text-ink shadow-lg transition-transform hover:scale-110 sm:-right-5"
          >
            ›
          </button>
          <div className="mt-6 flex justify-center gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`第 ${i + 1} 张：${slide.name}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-7 bg-promo" : "w-2 bg-ink/20 hover:bg-ink/40 dark:bg-white/25"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
