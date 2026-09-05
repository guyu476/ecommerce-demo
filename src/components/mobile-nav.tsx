"use client";

import Link from "next/link";
import { useState } from "react";

// 移动端汉堡菜单：小屏显示，展开全站入口（桌面端由 header 常驻导航承接）
const LINKS = [
  { href: "/", label: "🏠 首页" },
  { href: "/coupons", label: "🎟️ 领券中心" },
  { href: "/cart", label: "🛒 购物车" },
  { href: "/user", label: "🙂 我的鸟西" },
  { href: "/merchant", label: "🏪 商家中心" },
  { href: "/admin", label: "🛡️ 管理后台" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        aria-label={open ? "关闭菜单" : "打开菜单"}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-lg px-2 py-1.5 text-xl leading-none hover:bg-white/10"
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <nav className="absolute top-full right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-ink py-2 shadow-2xl">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="block px-5 py-2.5 text-sm text-white/85 transition-colors last:border-0 hover:bg-white/10 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
