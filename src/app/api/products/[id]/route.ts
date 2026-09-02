import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// 路由参数（Next 16）：params 是 Promise，用 RouteContext 类型助手
type Context = RouteContext<"/api/products/[id]">;

const idSchema = z.coerce.number().int().positive();

function parseId(id: string): number {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError("商品 ID 不合法", 40001, 400);
  }
  return parsed.data;
}

// ============ GET /api/products/[id] 商品详情 ============

export async function GET(_request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const product = await prisma.product.findUnique({
      where: { id: parseId(id) },
      include: { category: true },
    });

    if (!product) {
      throw new ApiError("商品不存在", 40401, 404);
    }

    return ok(product);
  });
}

// ============ PATCH /api/products/[id] 更新商品（部分字段） ============

const updateBodySchema = z.object({
  name: z.string().trim().min(1, "商品名称不能为空").max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  price: z.coerce.number().min(0, "价格不能为负数").optional(),
  stock: z.coerce.number().int().min(0).optional(),
  // ON_SALE / OFF_SALE / DRAFT，传字符串枚举
  status: z.enum(["DRAFT", "ON_SALE", "OFF_SALE"]).optional(),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
});

export async function PATCH(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const body = updateBodySchema.parse(await request.json());

    if (body.categoryId != null) {
      const categoryExists = await prisma.category.findUnique({
        where: { id: body.categoryId },
        select: { id: true },
      });
      if (!categoryExists) {
        throw new ApiError("分类不存在", 40402, 404);
      }
    }

    const product = await prisma.product.update({
      where: { id: parseId(id) },
      data: body,
      include: { category: true },
    });

    return ok(product, "更新成功");
  });
}

// ============ DELETE /api/products/[id] 删除商品 ============

export async function DELETE(_request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const { id } = await context.params;
    await prisma.product.delete({ where: { id: parseId(id) } });
    return ok({ id: parseId(id) }, "删除成功");
  });
}
