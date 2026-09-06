"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminCoupons } from "@/components/admin-coupons";
import { DiscountManager } from "@/components/discount-manager";
import { AdminDashboard } from "@/components/admin-dashboard";
import { OrderManager } from "@/components/order-manager";
import { ProductManager } from "@/components/product-manager";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type Me = { id: number; nickname: string; role: string } | null;

type AdminUser = {
  id: number;
  email: string | null;
  phone: string | null;
  nickname: string;
  role: string;
  createdAt: string;
};

const ROLE_LABEL: Record<string, string> = {
  USER: "用户",
  MERCHANT: "商家",
  ADMIN: "管理员",
};

type AdminTab = "dashboard" | "products" | "orders" | "coupons" | "users";

const VALID_TABS: AdminTab[] = ["dashboard", "products", "orders", "coupons", "users"];

// 管理后台：数据看板 / 商品管理 / 订单管理 / 优惠券 / 用户管理（仅管理员）
export default function AdminPage() {
  const [status, setStatus] = useState<"loading" | "guest" | "denied" | "ready">("loading");
  const [tab, setTab] = useState<AdminTab>(() => {
    if (typeof window === "undefined") return "dashboard";
    const param = new URLSearchParams(window.location.search).get("tab");
    return VALID_TABS.includes(param as AdminTab) ? (param as AdminTab) : "dashboard";
  });
  // Tab 红点：待发货与退款待处理（来自看板统计，后台最该盯的异常项）
  const [pendingShipment, setPendingShipment] = useState(0);
  const [refundPending, setRefundPending] = useState(0);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const result = (await res.json()) as ApiResponse<AdminUser[]>;
    if (isApiSuccess(result)) setUsers(result.data);
  }, []);

  const [userKeyword, setUserKeyword] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");

  // 查询：昵称 / 邮箱 / 手机号 + 角色筛选
  const filteredUsers = users.filter((user) => {
    if (userRoleFilter !== "all" && user.role !== userRoleFilter) return false;
    const text = userKeyword.trim().toLowerCase();
    if (!text) return true;
    return (
      user.nickname.toLowerCase().includes(text) ||
      (user.email ?? "").toLowerCase().includes(text) ||
      (user.phone ?? "").includes(text)
    );
  });

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const result = (await res.json()) as ApiResponse<Me>;
    if (isApiSuccess(result) && result.data) {
      if (result.data.role !== "ADMIN") {
        setStatus("denied");
        return;
      }
      setStatus("ready");
      await loadUsers();

      // 拉取待办数字（订单 Tab 红点用）
      const statsRes = (await fetch("/api/admin/stats").then((r) => r.json())) as ApiResponse<{
        pendingShipment: number;
        refundPending: number;
      }>;
      if (isApiSuccess(statsRes)) {
        setPendingShipment(statsRes.data.pendingShipment);
        setRefundPending(statsRes.data.refundPending);
      }
    } else {
      setStatus("guest");
    }
  }, [loadUsers]);

  useEffect(() => {
    // 初始加载：setState 在 await 之后，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMe();
  }, [loadMe]);

  async function changeRole(userId: number, role: string) {
    setBusyUserId(userId);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    await loadUsers();
    setBusyUserId(null);
  }

  if (status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center py-24 text-sm opacity-50">
        加载中…
      </main>
    );
  }

  if (status === "guest") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-4xl">🔒</p>
        <p className="text-sm opacity-70">登录后才能进入管理后台</p>
        <Link
          href="/login?redirect=/admin"
          className="rounded-full bg-promo px-8 py-2.5 text-sm font-medium text-white hover:bg-promo-deep"
        >
          去登录
        </Link>
      </main>
    );
  }

  if (status === "denied") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-4xl">🚫</p>
        <p className="text-sm opacity-70">管理后台仅对管理员账号开放</p>
        <Link href="/" className="text-sm text-promo hover:underline">
          返回首页
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-6 py-12">
      <h1 className="text-2xl font-extrabold tracking-tight">管理后台</h1>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "dashboard", label: "数据看板" },
            { key: "products", label: "商品管理" },
            { key: "orders", label: "订单管理" },
            { key: "coupons", label: "营销中心" },
            { key: "users", label: "用户管理" },
          ] as { key: AdminTab; label: string }[]
        ).map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            aria-current={tab === entry.key ? "page" : undefined}
            className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${
              tab === entry.key
                ? "bg-ink text-white shadow-md"
                : "bg-mist hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
            }`}
          >
            {entry.label}
            {entry.key === "orders" && refundPending > 0 && (
              <span className="ml-1.5 rounded-full bg-promo px-1.5 py-0.5 text-[10px] text-white">
                {refundPending} 退款
              </span>
            )}
            {entry.key === "orders" && pendingShipment > 0 && (
              <span className="ml-1.5 rounded-full bg-market px-1.5 py-0.5 text-[10px] text-ink">
                {pendingShipment} 待发
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <AdminDashboard />}

      {tab === "products" && <ProductManager />}

      {tab === "orders" && <OrderManager role="ADMIN" />}

      {tab === "coupons" && (
        <div className="space-y-8">
          <AdminCoupons />
          <DiscountManager scope="admin" />
        </div>
      )}

      {tab === "users" && (
        <section className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
          <div className="bg-mist px-6 py-3 text-sm font-semibold dark:bg-white/5">
            用户（{filteredUsers.length}/{users.length}）
          </div>

          {/* 查询栏 */}
          <div className="flex flex-wrap gap-2 border-b border-black/5 px-6 py-3 dark:border-white/10">
            <input
              type="search"
              value={userKeyword}
              onChange={(e) => setUserKeyword(e.target.value)}
              placeholder="🔍 搜索昵称 / 邮箱 / 手机号"
              className="min-w-0 flex-1 rounded-full border border-black/15 px-4 py-2 text-sm outline-none focus:border-promo dark:border-white/20"
            />
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="rounded-full border border-black/15 px-4 py-2 text-sm dark:border-white/20"
            >
              <option value="all">全部角色</option>
              <option value="USER">用户</option>
              <option value="MERCHANT">商家</option>
              <option value="ADMIN">管理员</option>
            </select>
          </div>

          {filteredUsers.length === 0 ? (
            <p className="p-5 text-sm opacity-50">没有匹配的用户</p>
          ) : (
            <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
              {filteredUsers.map((user) => (
                <li key={user.id} className="flex items-center gap-4 px-6 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {user.nickname}
                      {user.role === "ADMIN" && (
                        <span className="ml-2 rounded bg-ink px-1.5 py-0.5 text-[10px] text-white">
                          管理员
                        </span>
                      )}
                      {user.role === "MERCHANT" && (
                        <span className="ml-2 rounded bg-market px-1.5 py-0.5 text-[10px] text-ink">
                          商家
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs opacity-50">
                      {user.email ?? user.phone ?? "—"}
                    </p>
                  </div>
                  <select
                    value={user.role}
                    disabled={busyUserId === user.id}
                    onChange={(e) => changeRole(user.id, e.target.value)}
                    className="rounded-lg border border-black/15 px-3 py-1.5 text-xs dark:border-white/20"
                  >
                    {Object.entries(ROLE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
