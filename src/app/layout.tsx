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
  title: "淘东商城 · Next.js 电商 Demo",
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
              <span className="seal h-10 w-10 rounded-lg text-2xl">淘</span>
              <span className="text-xl font-bold tracking-tight">淘东商城</span>
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link href="/" className="hover:opacity-70">
                首页
              </Link>
              <UserNav />
            </nav>
          </div>
        </header>

        {children}

        <footer className="bg-mist py-10 text-center text-xs opacity-60 dark:bg-white/5">
          淘东商城 · Next.js 全栈演示项目
        </footer>
      </body>
    </html>
  );
}
