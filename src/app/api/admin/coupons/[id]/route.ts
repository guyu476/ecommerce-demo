import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/admin/coupons/[id] 管理员撤下还没人领的券（平台券/店铺券均可，有人领过则不可删）
type Context = RouteContext<"/api/admin/coupons/[id]">;

const idSchema = z.coerce.number().int().positive();

export async function DELETE(_request: NextRequest, context: Context) {
  return handleRoute(async () => {
    await requireRole("ADMIN");
    const { id } = await context.params;
    const couponId = idSchema.parse(id);

    const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) {
      throw new ApiError("优惠券不存在", 40404, 404);
    }
    if (coupon.claimedCount > 0) {
      throw new ApiError("已有用户领取，不能删除（可等其过期）", 40907, 409);
    }

    await prisma.coupon.delete({ where: { id: couponId } });
    return ok({ id: couponId }, "已撤下");
  });
}
