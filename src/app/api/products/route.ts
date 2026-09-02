import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// ============ GET /api/products 商品分页列表 ============
// 查询参数：page、pageSize、keyword（名称模糊搜索）、categoryId、status（默认只看在售，传 all 查全部）

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  keyword: z.string().trim().max(100).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  status: z.enum(["DRAFT", "ON_SALE", "OFF_SALE", "all"]).default("ON_SALE"),
});

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const where = {
      ...(query.keyword ? { name: { contains: query.keyword } } : {}),
      ...(query.categoryId != null ? { categoryId: query.categoryId } : {}),
      ...(query.status !== "all" ? { status: query.status } : {}),
    };

    if (query.categoryId != null) {
      const categoryExists = await prisma.category.findUnique({
        where: { id: query.categoryId },
        select: { id: true },
      });
      if (!categoryExists) {
        throw new ApiError("分类不存在", 40402, 404);
      }
    }

    // count 和 findMany 并发执行，保证分页总数与列表一致
    const [total, list] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: [{ sales: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return ok({
      list,
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  });
}

// ============ POST /api/products 新增商品（演示请求体校验） ============

const createBodySchema = z.object({
  name: z.string().trim().min(1, "商品名称不能为空").max(200),
  description: z.string().trim().max(2000).optional(),
  price: z.coerce.number().min(0, "价格不能为负数"),
  stock: z.coerce.number().int().min(0).default(0),
  categoryId: z.coerce.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = createBodySchema.parse(await request.json());

    if (body.categoryId != null) {
      const categoryExists = await prisma.category.findUnique({
        where: { id: body.categoryId },
        select: { id: true },
      });
      if (!categoryExists) {
        throw new ApiError("分类不存在", 40402, 404);
      }
    }

    const product = await prisma.product.create({
      data: {
        name: body.name,
        description: body.description,
        price: body.price,
        stock: body.stock,
        categoryId: body.categoryId,
      },
      include: { category: true },
    });

    return ok(product, "创建成功");
  });
}
