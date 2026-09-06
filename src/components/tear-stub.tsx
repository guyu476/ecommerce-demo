"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { formatPrice, formatSales } from "@/lib/format";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

const TEAR_THRESHOLD = 90;
const CLIP_STEPS = 8;
const DEBRIS_COLORS = ["#ffffff", "#e63946", "#fca311", "#14213d"];

// 撕票根（Verlet 物理版）：已撕开的半边是挂在撕口上的「摆」，有重力/惯性/阻尼；
// 撕口随拖拽渐进推进，拉满（或甩太狠弯折过限）约束崩断 → 整块带着惯性飞走。
// 约束崩断 = 加购（唯一触发点，三条路径汇合：拖满 / 甩断 / 键盘直撕）。

function prefersReduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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
          {
            transform: `translate(${dx.toFixed(0)}px,${dy.toFixed(0)}px) rotate(${rot.toFixed(0)}deg)`,
            opacity: 0,
          },
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

function makeTearClips(): { leftClip: (p: number) => string; rightClip: (p: number) => string } {
  const leftJitter = Array.from({ length: CLIP_STEPS + 1 }, (_, i) =>
    i === 0 || i === CLIP_STEPS ? 0 : (i % 2 === 0 ? -1 : 1) * (0.8 + Math.random() * 1.6),
  );
  const rightJitter = leftJitter.map((v, i) => (i === 0 || i === CLIP_STEPS ? 0 : -v));
  const leftClip = (p: number) => {
    const x = p * 100;
    const teeth = leftJitter.map(
      (j, i) => `${(x + j).toFixed(2)}% ${((i / CLIP_STEPS) * 100).toFixed(1)}%`,
    );
    return `polygon(0% 0%, ${teeth.join(", ")}, 0% 100%)`;
  };
  const rightClip = (p: number) => {
    const x = p * 100;
    const teeth = rightJitter.map(
      (j, i) => `${(x + j).toFixed(2)}% ${((i / CLIP_STEPS) * 100).toFixed(1)}%`,
    );
    return `polygon(${teeth.join(", ")}, 100% 100%, 100% 0%)`;
  };
  return { leftClip, rightClip };
}

export function TearStub({
  productId,
  price,
  sales,
  originalPrice = null,
}: {
  productId: number;
  price: string;
  sales: number;
  /** 参与限时折扣时的原价（划线展示） */
  originalPrice?: string | null;
}) {
  const toast = useToast();
  const [view, setView] = useState({ p: 0, theta: 0, x: 0, y: 0, rot: 0 });
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<"idle" | "torn">("idle");
  const [added, setAdded] = useState(false);
  const startX = useRef<number | null>(null);
  const lastX = useRef<number | null>(null);
  const busy = useRef(false);
  const clips = useRef(makeTearClips());
  // 物理状态：p 撕口进度（弹簧式追赶 pTarget）；theta/omega 悬垂摆；snapped 后自由落体
  const phys = useRef({
    p: 0,
    pTarget: 0,
    theta: 0,
    omega: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rot: 0,
    vr: 0,
    raf: 0,
    running: false,
    snapped: false,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const looseRef = useRef<HTMLDivElement>(null);
  const debrisRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLSpanElement>(null);

  const progress = Math.min(1, view.p);
  const snapped = phys.current.snapped;

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

  /** 约束崩断（唯一加购触发点）：纸片带惯性自由落体翻滚，同时调加购接口 */
  function snapNow() {
    const s = phys.current;
    if (s.snapped || busy.current) return;
    s.snapped = true;
    s.vx = 130 + Math.abs(s.omega) * 220;
    s.vy = -50;
    s.vr = 2.5 + s.omega * 3;
    if (!prefersReduced()) {
      if (debrisRef.current) burstDebris(debrisRef.current);
      shake(rootRef.current);
    }

    void addToCart().then((ok) => {
      if (ok) slamStamp();
      setAdded(true);
    });

    window.setTimeout(() => {
      looseRef.current?.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      Object.assign(s, {
        p: 0,
        pTarget: 0,
        theta: 0,
        omega: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rot: 0,
        vr: 0,
        snapped: false,
      });
      setView({ p: 0, theta: 0, x: 0, y: 0, rot: 0 });
      setPhase("idle");
      setAdded(false);
      busy.current = false;
    }, 1500);
  }

  /** Verlet 主循环：拖拽/摆动/自由落体期间运行，静止或飞出视野即停 */
  function startPhysicsLoop(onSettle: () => void) {
    const s = phys.current;
    if (s.running) return;
    s.running = true;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(32, now - last) / 1000;
      last = now;

      if (!s.snapped) {
        // 撕口弹簧式追赶拖拽目标
        s.p += (s.pTarget - s.p) * 0.35;
        // 悬垂摆：重力回复 + 微下沉 + 阻尼
        const acc = -6 * Math.sin(s.theta) - s.omega * 1.5 + 0.9 * (1 - s.p);
        s.omega += acc * dt;
        s.theta += s.omega * dt;
        // 约束崩断条件：撕口拉满，或纸被甩得弯折过限（此时必然撕口过半）
        if (s.p >= 0.995 || (Math.abs(s.theta) > 0.8 && s.p > 0.3)) {
          snapNow();
        }
      } else {
        // 自由落体 + 翻滚
        s.vy += 900 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot += s.vr * dt;
      }

      setView({ p: s.p, theta: s.theta, x: s.x, y: s.y, rot: s.rot });

      const settled =
        !s.snapped &&
        Math.abs(s.p - s.pTarget) < 0.002 &&
        Math.abs(s.theta) < 0.002 &&
        Math.abs(s.omega) < 0.002;
      const flown = s.snapped && s.y > 320;

      if (settled || flown) {
        s.running = false;
        onSettle();
        return;
      }
      s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (phase === "torn" || busy.current) return;
    if (prefersReduced()) {
      snapNow();
      return;
    }
    e.stopPropagation();
    startX.current = e.clientX;
    lastX.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    startPhysicsLoop(() => {
      // 纸片飞出视野后整体复位
      setAdded(false);
      Object.assign(phys.current, {
        p: 0,
        pTarget: 0,
        theta: 0,
        omega: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rot: 0,
        vr: 0,
        snapped: false,
      });
      setView({ p: 0, theta: 0, x: 0, y: 0, rot: 0 });
      setPhase("idle");
    });
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    const raw = Math.max(0, Math.min(150, e.clientX - startX.current));
    const resist = raw > TEAR_THRESHOLD ? (raw - TEAR_THRESHOLD) * 0.3 : 0;
    const s = phys.current;
    s.pTarget = Math.min(1, (raw - resist) / TEAR_THRESHOLD);
    // 手速注入角速度（甩纸）
    s.omega += (e.clientX - (lastX.current ?? e.clientX)) * 0.0012;
    lastX.current = e.clientX;
  }

  function onPointerUp() {
    if (startX.current === null) return;
    startX.current = null;
    setDragging(false);
    // 拖到头（撕口拉满）松手 = 约束崩断
    if (phys.current.p >= 0.9) {
      snapNow();
    } else {
      // 未撕断：撕口弹回合拢
      phys.current.pTarget = 0;
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      phys.current.pTarget = 1;
      phys.current.p = 1;
      snapNow();
    }
  }

  const s = phys.current;
  const stubContent = (
    <>
      <span
        aria-hidden
        className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-white dark:bg-[#0b1220]"
      />
      <span
        aria-hidden
        className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-white dark:bg-[#0b1220]"
      />
      <span
        aria-hidden
        className="scissors absolute -top-2.5 left-6 text-xs opacity-60 transition-opacity group-hover:opacity-100"
      >
        ✂
      </span>
      <p className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-lg font-bold text-promo">
          {formatPrice(price)}
          {originalPrice && (
            <span className="ml-1.5 text-xs font-normal line-through opacity-40">
              {formatPrice(originalPrice)}
            </span>
          )}
        </span>
        <span className="text-xs opacity-50">已售 {formatSales(sales)}</span>
      </p>
      <p
        className="mt-1 text-right text-[10px] font-medium"
        style={{
          color: progress >= 0.7 ? "var(--color-promo)" : undefined,
          opacity: progress >= 0.7 ? 1 : 0.4,
        }}
      >
        {snapped ? "撕开了！" : progress >= 0.7 ? "再撕！快断了！" : "按住向右撕 = 加购"}
      </p>
    </>
  );

  const stubBase =
    "coupon-dash absolute inset-0 rounded-b-xl bg-paper px-4 pb-4 pt-3 dark:bg-white/5";

  return (
    <div ref={rootRef} className="relative select-none">
      {/* 底层：锯齿撕口 + 印章 */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center rounded-b-xl bg-promo/10 transition-opacity duration-150"
        style={{ opacity: phase === "torn" || progress > 0.3 || snapped ? 1 : 0 }}
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

      <div ref={debrisRef} aria-hidden className="pointer-events-none absolute inset-0 z-20" />

      {/* 可撕票根：左半边带物理悬垂，右半边连着卡片 */}
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
        {/* 未撕开的右半边 */}
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
        {/* 已撕开的左半边：挂在撕口上物理摆动；崩断后自由落体翻滚 */}
        <div
          ref={looseRef}
          className={stubBase}
          style={{
            opacity: progress === 0 && !dragging && !snapped ? 0 : 1,
            clipPath: clips.current.leftClip(progress),
            transformOrigin: "100% 50%",
            transform: snapped
              ? `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) rotate(${s.rot.toFixed(1)}deg)`
              : `rotate(${s.theta.toFixed(3)}rad) translateY(${(progress * 4).toFixed(1)}px)`,
          }}
        >
          {stubContent}
        </div>
      </div>
    </div>
  );
}
