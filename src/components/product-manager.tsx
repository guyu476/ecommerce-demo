"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { cartesianSpecCombinations, parseSpecs, parseSkuSpecs, skuSpecText } from "@/lib/sku";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type Product = {
  id: number;
  name: string;
  description: string | null;
  price: string;
  stock: number;
  sales: number;
  status: string;
  categoryId: number;
  images: string | null;
  specs: string | null;
  skus: { id: number; specs: string; price: string; stock: number }[];
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

// SKU 编辑器状态
type SpecRow = { name: string; valuesText: string };
type SkuRow = { key: string; specsText: string; specs: { name: string; value: string }[]; price: string; stock: string };
const EMPTY_SPEC_ROWS: SpecRow[] = [];

// 商品管理器：商家（自己的）/ 管理员（全部）共用，走 /api/merchant/products
// 新增表单在顶部；点「编辑」在该商品行下方展开表单，保存/收起即关闭
export function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formImages, setFormImages] = useState<string[]>([]);
  const [specRows, setSpecRows] = useState<SpecRow[]>(EMPTY_SPEC_ROWS);
  const [skuRows, setSkuRows] = useState<SkuRow[]>([]);
  // 编辑的商品原本是否启用规格（用于判断「清空规格行」= 清空 SKU）
  const [hadSkus, setHadSkus] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 规格定义 → 笛卡尔组合生成 SKU 行（保留已填的价格/库存）
  function generateSkuRows(rows: SpecRow[]) {
    const defs = rows
      .filter((row) => row.name.trim() && row.valuesText.trim())
      .map((row) => ({
        name: row.name.trim(),
        values: row.valuesText.split(/[，,]/).map((v) => v.trim()).filter(Boolean),
      }));
    if (defs.length === 0) {
      setSkuRows([]);
      return;
    }
    const combos = cartesianSpecCombinations(defs);
    setSkuRows((prev) =>
      combos.map((specs) => {
        const key = [...specs].map((s) => `${s.name}:${s.value}`).sort().join("|");
        const existing = prev.find((row) => row.key === key);
        return {
          key,
          specs,
          specsText: skuSpecText(specs),
          price: existing?.price ?? "",
          stock: existing?.stock ?? "",
        };
      }),
    );
  }

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

  function closeForms() {
    setShowCreate(false);
    setEditingId(null);
  }

  function startCreate() {
    closeForms();
    setForm({ ...EMPTY_FORM, categoryId: String(categories[0]?.id ?? "") });
    setFormImages([]);
    setSpecRows([]);
    setSkuRows([]);
    setHadSkus(false);
    setError(null);
    setFieldErrors({});
    setShowCreate(true);
  }

  function startEdit(product: Product) {
    // 再点一次同一行的「编辑」= 收起
    if (editingId === product.id) {
      setEditingId(null);
      return;
    }
    setShowCreate(false);
    setEditingId(product.id);
    setForm({
      name: product.name,
      price: product.price,
      stock: String(product.stock),
      categoryId: String(product.categoryId),
      description: product.description ?? "",
      status: product.status,
    });
    setFormImages(parseImages(product.images));
    // 回显规格与 SKU
    const defs = parseSpecs(product.specs);
    setHadSkus(product.specs != null);
    setSpecRows(defs.map((def) => ({ name: def.name, valuesText: def.values.join("，") })));
    setSkuRows(
      product.skus.map((sku) => ({
        key: [...parseSkuSpecs(sku.specs)].map((s) => `${s.name}:${s.value}`).sort().join("|"),
        specs: parseSkuSpecs(sku.specs),
        specsText: skuSpecText(parseSkuSpecs(sku.specs)),
        price: String(sku.price),
        stock: String(sku.stock),
      })),
    );
    setError(null);
    setFieldErrors({});
  }

  // 图片上传：逐张压缩成 600px 方图，再传到 /api/upload 存为站点文件（不再把 data URL 存库）
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
      const uploaded: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await compressImage(file);
        const blob = await (await fetch(dataUrl)).blob();
        const formData = new FormData();
        formData.append("file", blob, "image.jpg");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const result = (await res.json()) as ApiResponse<{ url: string }>;
        if (!isApiSuccess(result)) {
          throw new Error(result.message);
        }
        uploaded.push(result.data.url);
      }
      if (uploaded.length > 0) {
        setFormImages((prev) => [...prev, ...uploaded]);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片上传失败");
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
      // 组装规格/SKU 载荷：有完整规格行才提交；全部清空且原本有 SKU 则提交空数组=清空规格
      const defs = specRows
        .filter((row) => row.name.trim() && row.valuesText.trim())
        .map((row) => ({
          name: row.name.trim(),
          values: row.valuesText.split(/[，,]/).map((v) => v.trim()).filter(Boolean),
        }));
      const hasSkuPayload = defs.length > 0 && skuRows.length > 0;
      const clearingSkus = defs.length === 0 && hadSkus;
      if (
        hasSkuPayload &&
        skuRows.some(
          (row) => row.price === "" || Number(row.price) <= 0 || row.stock === "" || Number(row.stock) < 0,
        )
      ) {
        setError("请为每个规格组合填写有效的价格和库存");
        setBusy(false);
        return;
      }

      const payload: Record<string, unknown> = { ...form, images: formImages };
      if (hasSkuPayload) {
        payload.specs = defs;
        payload.skus = skuRows.map((row) => ({
          specs: row.specs,
          price: Number(row.price),
          stock: Number(row.stock),
        }));
      } else if (clearingSkus) {
        payload.specs = [];
        payload.skus = [];
      }

      const url = editingId ? `/api/merchant/products/${editingId}` : "/api/merchant/products";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await res.json()) as ApiResponse;
      if (isApiSuccess(result)) {
        closeForms();
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

  // 商品表单（新增/编辑共用）：新增时渲染在顶部，编辑时渲染在对应行下方
  const formJsx = (
    <form
      onSubmit={submitForm}
      className="space-y-3 border-black/5 bg-mist/60 p-5 dark:border-white/10 dark:bg-white/5"
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
          required={!skuRows.length}
          type="number"
          min="0"
          step="0.01"
          placeholder={skuRows.length ? "由 SKU 聚合自动维护" : "价格"}
          disabled={skuRows.length > 0}
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className={inputClass + (skuRows.length ? " opacity-40" : "")}
        />
        <input
          type="number"
          min="0"
          placeholder={skuRows.length ? "由 SKU 聚合自动维护" : "库存"}
          disabled={skuRows.length > 0}
          value={form.stock}
          onChange={(e) => setForm({ ...form, stock: e.target.value })}
          className={inputClass + (skuRows.length ? " opacity-40" : "")}
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

      {/* 规格 / SKU 编辑器 */}
      <div className="rounded-lg border border-black/10 p-3 dark:border-white/15">
        <p className="mb-2 text-sm font-medium">
          商品规格（可选）
          <span className="ml-2 text-xs font-normal opacity-50">
            如 颜色：黑，白 ／ 版本：8+128，12+256 → 自动生成组合，逐个定价定库存
          </span>
        </p>

        {specRows.map((row, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <input
              placeholder="规格名（如 颜色）"
              value={row.name}
              onChange={(e) =>
                setSpecRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))
              }
              className="w-32 rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20"
            />
            <input
              placeholder="规格值，逗号分隔（如 黑，白）"
              value={row.valuesText}
              onChange={(e) =>
                setSpecRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, valuesText: e.target.value } : r)))
              }
              className="min-w-0 flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20"
            />
            <button
              type="button"
              aria-label="删除该规格"
              onClick={() => {
                setSpecRows((prev) => prev.filter((_, idx) => idx !== i));
                setSkuRows([]);
              }}
              className="px-2 text-xs opacity-50 hover:text-promo hover:opacity-100"
            >
              删除
            </button>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          {specRows.length < 3 && (
            <button
              type="button"
              onClick={() => setSpecRows((prev) => [...prev, { name: "", valuesText: "" }])}
              className="rounded-full border border-dashed border-black/25 px-4 py-1 text-xs opacity-70 hover:border-promo hover:text-promo dark:border-white/25"
            >
              + 添加规格
            </button>
          )}
          {specRows.some((row) => row.name.trim() && row.valuesText.trim()) && (
            <button
              type="button"
              onClick={() => generateSkuRows(specRows)}
              className="rounded-full bg-ink px-4 py-1 text-xs font-medium text-white hover:bg-ink-soft"
            >
              生成 SKU 组合
            </button>
          )}
        </div>

        {skuRows.length > 0 && (
          <div className="mt-3 space-y-2">
            {skuRows.map((row) => (
              <div key={row.key} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-40 shrink-0 truncate rounded bg-mist px-2 py-1.5 text-xs dark:bg-white/10">
                  {row.specsText}
                </span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="价格"
                  value={row.price}
                  onChange={(e) =>
                    setSkuRows((prev) =>
                      prev.map((r) => (r.key === row.key ? { ...r, price: e.target.value } : r)),
                    )
                  }
                  className="w-28 rounded-lg border border-black/15 px-3 py-1.5 dark:border-white/20"
                />
                <input
                  required
                  type="number"
                  min="0"
                  placeholder="库存"
                  value={row.stock}
                  onChange={(e) =>
                    setSkuRows((prev) =>
                      prev.map((r) => (r.key === row.key ? { ...r, stock: e.target.value } : r)),
                    )
                  }
                  className="w-24 rounded-lg border border-black/15 px-3 py-1.5 dark:border-white/20"
                />
              </div>
            ))}
            <p className="text-xs opacity-45">
              保存后商品价格显示最低 SKU 价、库存为各 SKU 合计；已有订单的库存扣减/回补都走 SKU
            </p>
          </div>
        )}
      </div>

      {/* 商品图片：上传（自动压缩为 600px 方图）+ 缩略图管理 */}
      <div>
        <p className="mb-2 text-sm opacity-70">商品图片（{formImages.length}/6，第一张为主图）</p>
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
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
      <div className="flex items-center justify-between bg-mist px-6 py-3 dark:bg-white/5">
        <h2 className="text-sm font-semibold">
          商品管理（{filtered.length}/{products.length}）
        </h2>
        <button
          type="button"
          onClick={() => (showCreate ? setShowCreate(false) : startCreate())}
          className="text-xs text-promo hover:underline"
        >
          {showCreate ? "收起" : "+ 新增商品"}
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

      {/* 新增商品：顶部表单 */}
      {showCreate && <div className="border-b border-black/5 dark:border-white/10">{formJsx}</div>}

      {loading ? (
        <p className="p-5 text-sm opacity-50">加载商品…</p>
      ) : products.length === 0 ? (
        <p className="p-5 text-sm opacity-50">还没有商品，点上方「新增商品」创建</p>
      ) : filtered.length === 0 ? (
        <p className="p-5 text-sm opacity-50">没有匹配「{keyword}」的商品</p>
      ) : (
        <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
          {filtered.map((product) => (
            <li key={product.id} className="flex flex-col">
              <div className="flex items-center gap-4 px-6 py-3.5">
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
                  className={`text-xs hover:opacity-100 ${
                    editingId === product.id
                      ? "font-semibold text-promo opacity-100"
                      : "opacity-60 hover:text-promo"
                  }`}
                >
                  {editingId === product.id ? "收起" : "编辑"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeProduct(product.id)}
                  className="text-xs opacity-60 hover:text-red-500 hover:opacity-100"
                >
                  删除
                </button>
              </div>

              {/* 行内编辑表单：在对应商品行下方展开 */}
              {editingId === product.id && (
                <div className="border-t border-black/5 dark:border-white/10">{formJsx}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
