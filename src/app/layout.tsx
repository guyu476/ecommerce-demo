import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { UserNav } from "@/components/user-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "鸟西商城 · Next.js 电商 Demo",
  description: "基于 Next.js 全栈的电商网站演示项目",
};

// 促销跑马灯文案（市集画报的门面担当）
const PROMOS = [
  "🚚 全场包邮",
  "📦 48 小时内发货",
  "🔄 7 天无理由退换",
  "🔥 今日爆款限时直降",
  "🎁 新人注册即享新人价",
];

// 可爱小鸟 Logo（与 favicon icon.svg 同款造型）
export function BirdMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#E63946" />
      <path d="M13 27 L20 22 L18 33 Z" fill="#ffffff" opacity="0.9" />
      <circle cx="31" cy="33" r="15" fill="#ffffff" />
      <ellipse cx="26" cy="37" rx="7" ry="5" fill="#FCA311" opacity="0.85" />
      <circle cx="39" cy="28" r="2.6" fill="#14213D" />
      <path d="M47 30 L55 33 L47 36 Z" fill="#FCA311" />
      <path d="M26 20 C28 16 32 15 34 17 C31 18 29 20 28 23 Z" fill="#ffffff" opacity="0.9" />
    </svg>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  const marqueeItems = [...PROMOS, ...PROMOS];

  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* 促销跑马灯 */}
        <div className="overflow-hidden bg-promo text-white" aria-hidden>
          <div className="marquee-track flex w-max gap-10 py-1.5 text-xs whitespace-nowrap">
            {marqueeItems.map((promo, i) => (
              <span key={i} className="tracking-wider">
                {promo}
              </span>
            ))}
          </div>
        </div>

        {/* 非悬浮头部：滚动时不遮挡页面内容 */}
        <header className="bg-ink text-white">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-3">
              <BirdMark />
              <span className="text-xl font-bold tracking-tight">鸟西商城</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/" className="hover:opacity-70">
                首页
              </Link>
              <UserNav />
            </nav>
          </div>
        </header>

        {children}

        <footer className="bg-mist py-10 text-center text-xs opacity-60 dark:bg-white/5">
          鸟西商城 · Next.js 全栈演示项目
        </footer>
      </body>
    </html>
  );
}
