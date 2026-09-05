import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/merchant/coupons/[id] 撤下我店铺发的券（有人领取过则不可删，只能等过期）
type Context = RouteContext<"/api/merchant/coupons/[id]">;

const idSchema = z.coerce.number().int().positive();

export async function DELETE(_request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const user = await requireRole("MERCHANT", "ADMIN");
    const { id } = await context.params;
    const couponId = idSchema.parse(id);

    const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
    // 商家只能撤自己的券；管理员可撤平台券
    const isMine = user.role === "ADMIN" ? coupon?.ownerId === null : coupon?.ownerId === user.id;
    if (!coupon || !isMine) {
      throw new ApiError("优惠券不存在", 40404, 404);
    }
    if (coupon.claimedCount > 0) {
      throw new ApiError("已有用户领取，不能删除（可等其过期）", 40907, 409);
    }

    await prisma.coupon.delete({ where: { id: couponId } });
    return ok({ id: couponId }, "已撤下");
  });
}
