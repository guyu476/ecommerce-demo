import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import { skuSpecText, validateSkuAgainstSpecs } from "@/lib/sku";

// 商品规格/SKU 写入的共享 schema 与逻辑（商家端 POST/PATCH 共用）
// 维护聚合：有 SKU 的商品 price=最低 SKU 价、stock=SKU 库存合计，随写随更

export const specDefSchema = z.object({
  name: z.string().trim().min(1, "规格名不能为空").max(20, "规格名最多 20 字"),
  values: z
    .array(z.string().trim().min(1, "规格值不能为空").max(30, "规格值最多 30 字"))
    .min(1, "规格值不能为空")
    .max(10, "每个规格最多 10 个值"),
});

export const specsSchema = z
  .array(specDefSchema)
  .max(3, "最多 3 个规格维度"); // 空数组 + 空 SKU = 清空规格退回单品

export const skuInputSchema = z.object({
  specs: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(20),
        value: z.string().trim().min(1).max(30),
      }),
    )
    .min(1, "SKU 规格取值不能为空")
    .max(3),
  price: z.coerce.number().min(0.01, "SKU 价格必须大于 0"),
  stock: z.coerce.number().int().min(0, "SKU 库存不能为负").max(999999),
  // 该组合的实拍图（本站路径或 data URL），可选
  image: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || v.startsWith("/") || v.startsWith("data:image/"), {
      message: "SKU 图片仅支持本站路径或 data URL",
    })
    .optional(),
});

export const skusSchema = z
  .array(skuInputSchema)
  .max(100, "SKU 组合最多 100 个");

type Tx = Prisma.TransactionClient;

/**
 * 全量替换商品的规格与 SKU（skus 传空数组 = 清空规格退回单品）。
 * 校验：SKU 取值必须落在规格定义内、组合不得重复；同步维护商品聚合价格/库存。
 */
export async function applySkus(
  tx: Tx,
  productId: number,
  specs: z.infer<typeof specsSchema>,
  skus: z.infer<typeof skusSchema>,
): Promise<void> {
  if (skus.length > 0 && specs.length === 0) {
    throw new ApiError("提交 SKU 时规格定义不能为空", 42202, 422);
  }
  // 组合不得重复（同一规格取值组合只能有一个 SKU）
  const seen = new Set<string>();
  for (const sku of skus) {
    if (!validateSkuAgainstSpecs(sku.specs, specs)) {
      throw new ApiError(
        `SKU「${skuSpecText(sku.specs)}」的取值与规格定义不符`,
        42202,
        422,
      );
    }
    const key = [...sku.specs].map((s) => `${s.name}:${s.value}`).sort().join("|");
    if (seen.has(key)) {
      throw new ApiError(`SKU 组合「${skuSpecText(sku.specs)}」重复`, 42202, 422);
    }
    seen.add(key);
  }

  await tx.sku.deleteMany({ where: { productId } });

  if (skus.length === 0) {
    // 清空规格：商品退回无规格单品
    await tx.product.update({ where: { id: productId }, data: { specs: null } });
    return;
  }

  await tx.sku.createMany({
    data: skus.map((sku) => ({
      productId,
      specs: JSON.stringify(sku.specs),
      price: sku.price,
      stock: sku.stock,
      image: sku.image || null,
    })),
  });

  const minPrice = Math.min(...skus.map((s) => s.price));
  const totalStock = skus.reduce((sum, s) => sum + s.stock, 0);
  await tx.product.update({
    where: { id: productId },
    data: { specs: JSON.stringify(specs), price: minPrice, stock: totalStock },
  });
}
