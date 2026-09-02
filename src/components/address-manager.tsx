"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type Address = {
  id: number;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  isDefault: boolean;
};

const EMPTY_FORM = { recipientName: "", recipientPhone: "", shippingAddress: "", isDefault: false };

// 地址簿管理：列表 / 新增 / 删除 / 设为默认（结算页会自动带出默认地址）
export function AddressManager() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAddresses = useCallback(async () => {
    const res = await fetch("/api/addresses");
    const result = (await res.json()) as ApiResponse<Address[]>;
    if (isApiSuccess(result)) setAddresses(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // 初始加载：setState 在 await 之后，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAddresses();
  }, [loadAddresses]);

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await res.json()) as ApiResponse;
      if (isApiSuccess(result)) {
        setForm(EMPTY_FORM);
        setShowForm(false);
        await loadAddresses();
      } else {
        setError(result.message);
        if (result.data) setFieldErrors(result.data as Record<string, string>);
      }
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  async function removeAddress(id: number) {
    setBusy(true);
    await fetch(`/api/addresses/${id}`, { method: "DELETE" });
    await loadAddresses();
    setBusy(false);
  }

  async function makeDefault(id: number) {
    setBusy(true);
    await fetch(`/api/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    await loadAddresses();
    setBusy(false);
  }

  const inputClass =
    "w-full rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20";

  return (
    <section className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
      <div className="flex items-center justify-between bg-mist px-6 py-3 dark:bg-white/5">
        <h2 className="text-sm font-semibold">收货地址</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-xs text-promo hover:underline"
        >
          {showForm ? "收起" : "+ 新增地址"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={addAddress}
          className="space-y-3 border-b border-black/5 p-5 dark:border-white/10"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              placeholder="收货人"
              value={form.recipientName}
              onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
              className={inputClass}
            />
            <input
              required
              placeholder="手机号"
              inputMode="numeric"
              value={form.recipientPhone}
              onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })}
              className={inputClass}
            />
          </div>
          <textarea
            required
            rows={2}
            placeholder="收货地址（至少 5 个字）"
            value={form.shippingAddress}
            onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
            className={inputClass}
          />
          <label className="flex items-center gap-2 text-sm opacity-70">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            设为默认地址
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {Object.entries(fieldErrors).map(([field, message]) => (
            <p key={field} className="text-xs text-red-500">
              {message}
            </p>
          ))}

          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-ink px-8 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy ? "保存中…" : "添加地址"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="p-5 text-sm opacity-50">加载地址…</p>
      ) : addresses.length === 0 ? (
        <p className="p-5 text-sm opacity-50">还没有收货地址，点上方「新增地址」添加一个</p>
      ) : (
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {addresses.map((address) => (
            <li key={address.id} className="flex items-center gap-4 px-6 py-4 text-sm">
              <div className="min-w-0 flex-1">
                <p>
                  {address.recipientName}
                  <span className="mx-2 opacity-40">|</span>
                  {address.recipientPhone}
                  {address.isDefault && (
                    <span className="ml-2 rounded bg-promo px-1.5 py-0.5 text-[10px] text-white">
                      默认
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate opacity-60">{address.shippingAddress}</p>
              </div>
              {!address.isDefault && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => makeDefault(address.id)}
                  className="text-xs opacity-60 hover:text-promo hover:opacity-100"
                >
                  设为默认
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => removeAddress(address.id)}
                className="text-xs opacity-60 hover:text-promo hover:opacity-100"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
