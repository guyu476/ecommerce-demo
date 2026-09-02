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
  title: "ecommerce-demo · 电商网站 Demo",
  description: "基于 Next.js 全栈的电商网站演示项目",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-10 bg-ink text-white">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
            <Link href="/" className="text-lg font-bold tracking-tight">
              🛒 ecommerce-demo 商城
            </Link>
            <nav className="flex gap-5 text-sm">
              <Link href="/" className="hover:opacity-70">
                首页
              </Link>
              <UserNav />
            </nav>
          </div>
        </header>
        {children}
        <footer className="bg-mist py-6 text-center text-xs opacity-60 dark:bg-white/5">
          ecommerce-demo · Next.js 全栈演示项目
        </footer>
      </body>
    </html>
  );
}
