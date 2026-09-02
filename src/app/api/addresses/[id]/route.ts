import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// /api/addresses/[id]：更新 / 删除自己的地址
type Context = RouteContext<"/api/addresses/[id]">;

const idSchema = z.coerce.number().int().positive();

const updateBodySchema = z.object({
  recipientName: z.string().trim().min(1).max(50).optional(),
  recipientPhone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "手机号格式不正确")
    .optional(),
  shippingAddress: z.string().trim().min(5).max(500).optional(),
  isDefault: z.boolean().optional(),
});

async function getOwnedAddress(addressId: number, userId: number) {
  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== userId) {
    throw new ApiError("地址不存在", 40407, 404);
  }
  return address;
}

export async function PATCH(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const addressId = idSchema.parse(id);
    await getOwnedAddress(addressId, user.id);
    const body = updateBodySchema.parse(await request.json());

    const address = await prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.address.updateMany({
          where: { userId: user.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.update({ where: { id: addressId }, data: body });
    });

    return ok(address, "地址已更新");
  });
}

export async function DELETE(_request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const addressId = idSchema.parse(id);
    await getOwnedAddress(addressId, user.id);

    await prisma.address.delete({ where: { id: addressId } });
    return ok({ id: addressId }, "地址已删除");
  });
}
