"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type Product = {
  id: number;
  name: string;
  price: string;
  stock: number;
  sales: number;
  status: string;
  categoryId: number;
  images: string | null;
  seller?: { nickname: string } | null;
  category: { id: number; name: string; icon: string | null } | null;
};

type Category = { id: number; name: string; icon: string | null };

const EMPTY_FORM = {
  name: "",
  price: "",
  stock: "10",
  categoryId: "",
  description: "",
  status: "ON_SALE",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  ON_SALE: "在售",
  OFF_SALE: "已下架",
};

/** 解析商品 images JSON */
function parseImages(images: string | null): string[] {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** 图片压缩：等比缩放到 600px 以内方图（cover 裁剪），JPEG data URL */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 600;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas 不可用"));
          return;
        }
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.onerror = () => reject(new Error("图片读取失败"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

// 商品管理器：商家（自己的）/ 管理员（全部）共用，走 /api/merchant/products
export function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formImages, setFormImages] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 查询：名称 / 店铺（客户端过滤，数据已全量加载）
  const filtered = products.filter((product) => {
    const text = keyword.trim().toLowerCase();
    if (!text) return true;
    return (
      product.name.toLowerCase().includes(text) ||
      (product.seller?.nickname ?? "").toLowerCase().includes(text)
    );
  });

  const loadProducts = useCallback(async () => {
    const res = await fetch("/api/merchant/products");
    const result = (await res.json()) as ApiResponse<Product[]>;
    if (isApiSuccess(result)) setProducts(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/categories");
      const result = (await res.json()) as ApiResponse<Category[]>;
      if (isApiSuccess(result)) {
        setCategories(result.data);
        setForm((prev) => ({ ...prev, categoryId: String(result.data[0]?.id ?? "") }));
      }
      await loadProducts();
    })();
  }, [loadProducts]);

  function startCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, categoryId: String(categories[0]?.id ?? "") });
    setFormImages([]);
    setError(null);
    setFieldErrors({});
    setShowForm(true);
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      price: product.price,
      stock: String(product.stock),
      categoryId: String(product.categoryId),
      description: "",
      status: product.status,
    });
    setFormImages(parseImages(product.images));
    setError(null);
    setFieldErrors({});
    setShowForm(true);
  }

  // 图片上传：逐张压缩，最多 6 张
  async function handleImageFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (files.length === 0) return;
    if (formImages.length + files.length > 6) {
      setError("最多 6 张图片");
      return;
    }
    setBusy(true);
    try {
      const compressed: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        compressed.push(await compressImage(file));
      }
      setFormImages((prev) => [...prev, ...compressed]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片处理失败");
    } finally {
      setBusy(false);
    }
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const url = editingId ? `/api/merchant/products/${editingId}` : "/api/merchant/products";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, images: formImages }),
      });
      const result = (await res.json()) as ApiResponse;
      if (isApiSuccess(result)) {
        setShowForm(false);
        await loadProducts();
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

  async function toggleStatus(product: Product) {
    const next = product.status === "ON_SALE" ? "OFF_SALE" : "ON_SALE";
    setBusy(true);
    await fetch(`/api/merchant/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await loadProducts();
    setBusy(false);
  }

  async function removeProduct(id: number) {
    setBusy(true);
    await fetch(`/api/merchant/products/${id}`, { method: "DELETE" });
    await loadProducts();
    setBusy(false);
  }

  const inputClass =
    "w-full rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20";

  return (
    <section className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
      <div className="flex items-center justify-between bg-mist px-6 py-3 dark:bg-white/5">
        <h2 className="text-sm font-semibold">
          商品管理（{filtered.length}/{products.length}）
        </h2>
        <button
          type="button"
          onClick={() => (showForm ? setShowForm(false) : startCreate())}
          className="text-xs text-promo hover:underline"
        >
          {showForm ? "收起" : "+ 新增商品"}
        </button>
      </div>

      {/* 查询栏 */}
      <div className="border-b border-black/5 px-6 py-3 dark:border-white/10">
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="🔍 搜索商品名称或店铺"
          className="w-full rounded-full border border-black/15 px-4 py-2 text-sm outline-none focus:border-promo dark:border-white/20"
        />
      </div>

      {showForm && (
        <form
          onSubmit={submitForm}
          className="space-y-3 border-b border-black/5 p-5 dark:border-white/10"
        >
          <input
            required
            placeholder="商品名称"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="价格"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className={inputClass}
            />
            <input
              required
              type="number"
              min="0"
              placeholder="库存"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className={inputClass}
            />
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className={inputClass}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>
          <textarea
            rows={2}
            placeholder="商品描述（可选）"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputClass}
          />

          {/* 商品图片：上传（自动压缩为 600px 方图）+ 缩略图管理 */}
          <div>
            <p className="mb-2 text-sm opacity-70">
              商品图片（{formImages.length}/6，第一张为主图）
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {formImages.map((image, i) => (
                <div
                  key={i}
                  className="group relative h-20 w-20 overflow-hidden rounded-lg border border-black/10 dark:border-white/20"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt={`商品图 ${i + 1}`} className="h-full w-full object-cover" />
                  {i === 0 && (
                    <span className="absolute left-0 top-0 bg-ink px-1 py-0.5 text-[9px] text-white">
                      主图
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`删除第 ${i + 1} 张图`}
                    onClick={() => setFormImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center bg-black/55 text-[10px] text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
              {formImages.length < 6 && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageFiles}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-black/25 text-2xl opacity-60 transition-colors hover:border-promo hover:text-promo hover:opacity-100 dark:border-white/25"
                    aria-label="上传商品图片"
                  >
                    +
                  </button>
                </>
              )}
            </div>
            <p className="mt-1 text-xs opacity-45">不上传则使用系统默认图</p>
          </div>

          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className={inputClass}
          >
            <option value="ON_SALE">立即上架</option>
            <option value="DRAFT">存为草稿</option>
            <option value="OFF_SALE">下架状态</option>
          </select>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {Object.entries(fieldErrors).map(([field, message]) => (
            <p key={field} className="text-xs text-red-500">
              {message}
            </p>
          ))}

          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-promo px-8 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {editingId ? "保存修改" : "创建商品"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="p-5 text-sm opacity-50">加载商品…</p>
      ) : products.length === 0 ? (
        <p className="p-5 text-sm opacity-50">还没有商品，点上方「新增商品」创建</p>
      ) : filtered.length === 0 ? (
        <p className="p-5 text-sm opacity-50">没有匹配「{keyword}」的商品</p>
      ) : (
        <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
          {filtered.map((product) => (
            <li key={product.id} className="flex items-center gap-4 px-6 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{product.name}</p>
                <p className="mt-0.5 text-xs opacity-50">
                  {product.category?.icon} {product.category?.name}
                  {product.seller && <span className="ml-2">· {product.seller.nickname}</span>}
                  <span className="ml-2">· 库存 {product.stock}</span>
                  <span className="ml-2">· 已售 {product.sales}</span>
                </p>
              </div>
              <span className="font-mono font-bold text-promo">{formatPrice(product.price)}</span>
              <span
                className={`w-14 text-center text-xs ${
                  product.status === "ON_SALE"
                    ? "text-emerald-600"
                    : product.status === "DRAFT"
                      ? "opacity-40"
                      : "opacity-60"
                }`}
              >
                {STATUS_LABEL[product.status]}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => toggleStatus(product)}
                className="text-xs opacity-60 hover:text-promo hover:opacity-100"
              >
                {product.status === "ON_SALE" ? "下架" : "上架"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => startEdit(product)}
                className="text-xs opacity-60 hover:text-promo hover:opacity-100"
              >
                编辑
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => removeProduct(product.id)}
                className="text-xs opacity-60 hover:text-red-500 hover:opacity-100"
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
