"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { formatPrice, formatSales } from "@/lib/format";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

const TEAR_THRESHOLD = 90;
const CLIP_STEPS = 8;
const DEBRIS_COLORS = ["#ffffff", "#e63946", "#fca311", "#14213d"];

// 撕票根（渐进撕开版）：按住向右拖，撕口沿锯齿一点一点向右推进——
// 左半边先撕开悬垂晃动，右半边还连在卡片上；松手过线整块飞走。
// 双副本 + clip-path 锯齿切割（Web Animations API 随机飞散），尊重减弱动效偏好。

function prefersReduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 纸屑乱飞 */
function burstDebris(container: HTMLElement) {
  for (let i = 0; i < 12; i++) {
    const bit = document.createElement("span");
    const w = 3 + Math.random() * 8;
    bit.style.cssText = [
      "position:absolute",
      "pointer-events:none",
      `left:${15 + Math.random() * 65}%`,
      `top:${25 + Math.random() * 45}%`,
      `width:${w.toFixed(1)}px`,
      `height:${(w * (0.5 + Math.random())).toFixed(1)}px`,
      `background:${DEBRIS_COLORS[Math.floor(Math.random() * DEBRIS_COLORS.length)]}`,
      "border-radius:1px",
      "opacity:.95",
    ].join(";");
    container.appendChild(bit);
    const dx = (Math.random() - 0.35) * 170;
    const dy = 20 + Math.random() * 110;
    const rot = (Math.random() - 0.5) * 620;
    bit
      .animate(
        [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${dx.toFixed(0)}px,${dy.toFixed(0)}px) rotate(${rot.toFixed(0)}deg)`, opacity: 0 },
        ],
        { duration: 420 + Math.random() * 480, easing: "cubic-bezier(.15,.6,.3,1)" },
      )
      .finished.then(() => bit.remove())
      .catch(() => bit.remove());
  }
}

function shake(el: HTMLElement | null) {
  el?.animate(
    [
      { transform: "translateX(0) rotate(0deg)" },
      { transform: "translateX(-5px) rotate(-0.6deg)" },
      { transform: "translateX(5px) rotate(0.5deg)" },
      { transform: "translateX(-3px)" },
      { transform: "translateX(2px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 280, easing: "ease-out" },
  );
}

/** 生成撕口两侧的锯齿 clip-path（撕开瞬间随机毛边，拖拽期间保持稳定） */
function makeTearClips(): { leftClip: (p: number) => string; rightClip: (p: number) => string } {
  const leftJitter = Array.from({ length: CLIP_STEPS + 1 }, (_, i) =>
    i === 0 || i === CLIP_STEPS ? 0 : (i % 2 === 0 ? -1 : 1) * (0.8 + Math.random() * 1.6),
  );
  const rightJitter = leftJitter.map((v, i) => (i === 0 || i === CLIP_STEPS ? 0 : -v));

  const leftClip = (p: number) => {
    const x = p * 100;
    const teeth = leftJitter.map((j, i) => `${(x + j).toFixed(2)}% ${((i / CLIP_STEPS) * 100).toFixed(1)}%`);
    return `polygon(0% 0%, ${teeth.join(", ")}, 0% 100%)`;
  };
  const rightClip = (p: number) => {
    const x = p * 100;
    const teeth = rightJitter.map((j, i) => `${(x + j).toFixed(2)}% ${((i / CLIP_STEPS) * 100).toFixed(1)}%`);
    return `polygon(${teeth.join(", ")}, 100% 100%, 100% 0%)`;
  };
  return { leftClip, rightClip };
}

export function TearStub({
  productId,
  price,
  sales,
}: {
  productId: number;
  price: string;
  sales: number;
}) {
  const toast = useToast();
  const [delta, setDelta] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<"idle" | "torn">("idle");
  const [added, setAdded] = useState(false);
  const startX = useRef<number | null>(null);
  const deltaRef = useRef(0);
  const busy = useRef(false);
  const clips = useRef(makeTearClips());
  const rootRef = useRef<HTMLDivElement>(null);
  const looseRef = useRef<HTMLDivElement>(null);
  const debrisRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLSpanElement>(null);

  const progress = Math.min(1, delta / TEAR_THRESHOLD);
  const atThreshold = delta >= TEAR_THRESHOLD;

  async function addToCart(): Promise<boolean> {
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      const result = (await res.json()) as ApiResponse;
      if (result.code === 40101) {
        toast("登录后才能撕下加购", "error");
        return false;
      }
      if (!isApiSuccess(result)) {
        toast(result.message, "error");
        return false;
      }
      window.dispatchEvent(new Event("cart-changed"));
      toast("已加入购物车 🎉");
      return true;
    } catch {
      toast("网络异常，请稍后重试", "error");
      return false;
    }
  }

  function slamStamp() {
    stampRef.current?.animate(
      [
        { transform: "scale(2.4) rotate(-24deg)", opacity: 0 },
        { transform: "scale(1) rotate(-7deg)", opacity: 1 },
      ],
      { duration: 200, easing: "cubic-bezier(.2,.9,.3,1.2)" },
    );
  }

  async function handleTear() {
    if (busy.current) return;
    busy.current = true;
    setPhase("torn");

    const loose = looseRef.current;
    if (loose && !prefersReduced()) {
      // 已撕开的部分整块飞走（从当前位置继续）
      loose.animate(
        [
          { transform: getComputedStyle(loose).transform === "none" ? "none" : getComputedStyle(loose).transform, opacity: 1 },
          { transform: "translate(190px,64px) rotate(28deg)", opacity: 0 },
        ],
        { duration: 430, easing: "cubic-bezier(.25,.65,.3,1)", fill: "forwards" },
      );
      if (debrisRef.current) burstDebris(debrisRef.current);
      shake(rootRef.current);
    } else if (loose) {
      loose.style.opacity = "0";
    }

    const ok = await addToCart();
    if (ok) slamStamp();
    setAdded(true);

    window.setTimeout(() => {
      loose?.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      loose && (loose.style.opacity = "1");
      setPhase("idle");
      setDelta(0);
      deltaRef.current = 0;
      busy.current = false;
      window.setTimeout(() => setAdded(false), 300);
    }, ok ? 1500 : 500);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (phase === "torn" || busy.current) return;
    if (prefersReduced()) {
      void handleTear();
      return;
    }
    e.stopPropagation();
    startX.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    const raw = Math.max(0, Math.min(150, e.clientX - startX.current));
    const resist = raw > TEAR_THRESHOLD ? (raw - TEAR_THRESHOLD) * 0.35 : 0;
    const next = Math.max(0, raw - resist + (Math.random() - 0.5) * 2);
    deltaRef.current = next;
    setDelta(next);
  }

  function onPointerUp() {
    if (startX.current === null) return;
    startX.current = null;
    setDragging(false);
    if (deltaRef.current >= TEAR_THRESHOLD) {
      void handleTear();
    } else {
      deltaRef.current = 0;
      setDelta(0);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void handleTear();
    }
  }

  const stubContent = (
    <>
      <span aria-hidden className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-white dark:bg-[#0b1220]" />
      <span aria-hidden className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-white dark:bg-[#0b1220]" />
      <span aria-hidden className="scissors absolute -top-2.5 left-6 text-xs opacity-60 transition-opacity group-hover:opacity-100">
        ✂
      </span>
      <p className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-lg font-bold text-promo">{formatPrice(price)}</span>
        <span className="text-xs opacity-50">已售 {formatSales(sales)}</span>
      </p>
      <p
        className="mt-1 text-right text-[10px] font-medium"
        style={{ color: atThreshold ? "var(--color-promo)" : undefined, opacity: atThreshold ? 1 : 0.4 }}
      >
        {atThreshold ? "松手！！" : "按住向右撕 = 加购"}
      </p>
    </>
  );

  const stubBase =
    "coupon-dash absolute inset-0 rounded-b-xl bg-paper px-4 pb-4 pt-3 dark:bg-white/5";

  return (
    <div ref={rootRef} className="relative select-none">
      {/* 底层：锯齿撕口 + 甩出来的印章 */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center rounded-b-xl bg-promo/10 transition-opacity duration-150"
        style={{ opacity: phase === "torn" || progress > 0.3 ? 1 : 0 }}
      >
        <div aria-hidden className="tear-edge absolute inset-x-0 -top-1.5 h-2" />
        <span
          ref={stampRef}
          className={`inline-block rounded border-[3px] border-promo px-3 py-1 text-sm font-black tracking-widest text-promo ${
            added ? "-rotate-6" : "rotate-3 opacity-60"
          }`}
        >
          {added ? "已加入购物车" : "撕下加购"}
        </span>
      </div>

      {/* 碎纸粒子层 */}
      <div ref={debrisRef} aria-hidden className="pointer-events-none absolute inset-0 z-20" />

      {/* 可撕票根：撕口渐进推进——左半边（已撕开）悬垂移动，右半边（未撕开）原位不动 */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`撕下加购，价格 ${formatPrice(price)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={`relative z-10 h-[88px] cursor-grab touch-pan-y active:cursor-grabbing dark:![background-color:transparent] ${
          dragging ? "" : "transition-[clip-path,transform] duration-200"
        }`}
      >
        {/* 未撕开的右半边：原位不动 */}
        <div
          aria-hidden={progress === 0}
          className={stubBase}
          style={
            progress === 0 && !dragging
              ? undefined
              : { clipPath: clips.current.rightClip(progress), transformOrigin: "100% 100%" }
          }
        >
          {stubContent}
        </div>
        {/* 已撕开的左半边：悬垂着跟手走 */}
        <div
          ref={looseRef}
          className={stubBase}
          style={
            progress === 0 && !dragging
              ? { opacity: 0 }
              : {
                  clipPath: clips.current.leftClip(progress),
                  transform: `translateX(${delta * 0.6}px) translateY(${progress * 5}px) rotate(${progress * 7}deg)`,
                  transformOrigin: "0% 100%",
                }
          }
        >
          {stubContent}
        </div>
      </div>
    </div>
  );
}
