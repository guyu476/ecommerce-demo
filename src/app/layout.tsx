import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { MobileNav } from "@/components/mobile-nav";
import { ToastProvider } from "@/components/toast";
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
        <ToastProvider>
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
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
              <Link href="/" className="flex items-center gap-3">
                <BirdMark />
                <span className="text-xl font-bold tracking-tight">鸟西商城</span>
              </Link>
              <div className="flex items-center gap-3">
                {/* 桌面端常驻导航；移动端收进汉堡菜单 */}
                <nav className="hidden items-center gap-6 text-sm sm:flex">
                  <Link href="/" className="hover:opacity-70">
                    首页
                  </Link>
                  <UserNav />
                </nav>
                <MobileNav />
              </div>
            </div>
          </header>

        {children}

        {/* 画报风页脚：品牌 + 服务导航 + 演示声明 */}
        <footer className="bg-ink text-white/80">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <BirdMark />
                <span className="text-lg font-bold text-white">鸟西商城</span>
              </div>
              <p className="text-sm leading-6 text-white/60">
                一家开在市集画报里的在线小店。
                <br />
                Next.js 全栈演示 · 支付/短信/物流为演示流程
              </p>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-white">买家服务</p>
              <ul className="space-y-2 text-sm text-white/60">
                <li>
                  <Link href="/user?tab=coupons" className="transition-colors hover:text-market">
                    🎟️ 领券中心
                  </Link>
                </li>
                <li>
                  <Link href="/orders" className="transition-colors hover:text-market">
                    🧾 我的订单
                  </Link>
                </li>
                <li>
                  <Link href="/favorites" className="transition-colors hover:text-market">
                    ❤️ 我的收藏
                  </Link>
                </li>
                <li>
                  <Link href="/cart" className="transition-colors hover:text-market">
                    🛒 购物车
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-white">商家与平台</p>
              <ul className="space-y-2 text-sm text-white/60">
                <li>
                  <Link href="/merchant" className="transition-colors hover:text-market">
                    🏪 商家中心
                  </Link>
                </li>
                <li>
                  <Link href="/admin" className="transition-colors hover:text-market">
                    🛡️ 管理后台
                  </Link>
                </li>
                <li>
                  <a
                    href="https://github.com/guyu476/ecommerce-demo"
                    target="_blank"
                    rel="noreferrer"
                    className="transition-colors hover:text-market"
                  >
                    🐙 GitHub 开源仓库
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-white">演示账号</p>
              <ul className="space-y-1.5 font-mono text-xs leading-5 text-white/50">
                <li>用户 demo@example.com</li>
                <li>商家 merchant@example.com</li>
                <li>商家2 merchant2@example.com</li>
                <li>管理员 admin@example.com</li>
                <li className="pt-1 text-white/40">密码均为「账号前缀 + 123456」</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 py-4 text-center text-xs text-white/40">
            © 2026 鸟西商城 · 仅供学习与技术演示
          </div>
        </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
