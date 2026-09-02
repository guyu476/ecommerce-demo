import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const addressSchema = z.object({
  recipientName: z.string().trim().min(1, "收货人不能为空").max(50, "收货人最多 50 字"),
  recipientPhone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
  shippingAddress: z.string().trim().min(5, "收货地址至少 5 个字").max(500, "地址最多 500 字"),
  isDefault: z.boolean().optional(),
});

// GET /api/addresses 当前用户地址簿（默认地址排最前）
export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    const addresses = await prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    return ok(addresses);
  });
}

// POST /api/addresses 新增地址（isDefault 或首条地址自动设为默认）
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const body = addressSchema.parse(await request.json());

    const count = await prisma.address.count({ where: { userId: user.id } });
    const makeDefault = body.isDefault === true || count === 0;

    const address = await prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.address.updateMany({
          where: { userId: user.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: { userId: user.id, ...body, isDefault: makeDefault },
      });
    });

    return ok(address, "地址已添加");
  });
}
