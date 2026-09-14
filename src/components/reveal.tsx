"use client";

import { useEffect, useRef, useState } from "react";

// idle   = 服务端渲染 / 未决策，不带任何动效类，内容正常可见（无 JS 也不会消失）
// plain  = 首屏内容或用户偏好减弱动效，直接显示，不播动画（避免刷新时闪一下）
// hidden = 已确认在首屏之外，隐藏，等待滚入
// revealed = 滚入视口，播入场动画
type RevealPhase = "idle" | "plain" | "hidden" | "revealed";

const PHASE_CLASS: Record<RevealPhase, string> = {
  idle: "",
  plain: "",
  hidden: "reveal",
  revealed: "reveal is-in",
};

// 滚动入场容器：元素滚进视口时挂 .is-in 触发 CSS 动画（见 globals.css 的 rise-in / fade-in）
export function Reveal({
  children,
  className = "",
  stagger = false,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** 子项逐个错位入场（配合子项内联的 --i 使用） */
  stagger?: boolean;
  /** 外层语义标签：列表场景传 "ul"，避免在 div 里塞 li */
  as?: "div" | "ul" | "section";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [phase, setPhase] = useState<RevealPhase>("idle");
  const Tag = as as React.ElementType;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 不支持观察器 / 用户要求减弱动效：不折腾，直接落到最终态
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("plain");
      return;
    }

    // 已经在首屏（或快进入首屏）就正常显示，不做入场动画
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("plain");
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("hidden");

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPhase("revealed");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const classes = [PHASE_CLASS[phase], stagger ? "stagger" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag ref={ref} className={classes}>
      {children}
    </Tag>
  );
}
