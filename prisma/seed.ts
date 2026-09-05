// 种子数据：开发环境的演示分类/商品/订单/评价（幂等，可重复执行）
// 运行：npm run db:seed（需先完成 db:migrate）

import { PrismaClient, ProductStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const categories = [
  { name: "手机数码", slug: "digital", icon: "📱" },
  { name: "电脑办公", slug: "computer", icon: "💻" },
  { name: "家用电器", slug: "appliance", icon: "🏠" },
  { name: "服饰鞋包", slug: "fashion", icon: "👕" },
  { name: "美妆个护", slug: "beauty", icon: "💄" },
  { name: "食品生鲜", slug: "food", icon: "🍎" },
];

type SeedProduct = {
  name: string;
  description: string;
  price: number;
  stock: number;
  sales: number;
  categorySlug: string;
};

const products: SeedProduct[] = [
  {
    name: "星耀 X7 Pro 5G 手机 12GB+256GB",
    description: "6.7 英寸 OLED 曲面屏，5400mAh 长续航，100W 快充，旗舰影像系统。",
    price: 3499,
    stock: 120,
    sales: 856,
    categorySlug: "digital",
  },
  {
    name: "降噪无线蓝牙耳机 AirPro 3",
    description: "主动降噪，空间音频，单次续航 8 小时，IPX4 防水。",
    price: 699,
    stock: 300,
    sales: 2143,
    categorySlug: "digital",
  },
  {
    name: "智能手表 Watch S2 运动版",
    description: "血氧心率监测，100+ 运动模式，14 天超长续航。",
    price: 1299,
    stock: 85,
    sales: 432,
    categorySlug: "digital",
  },
  {
    name: "轻薄笔记本电脑 MateBook 14 英寸",
    description: "标压处理器，2.8K 触控全面屏，多屏协同，16GB+512GB。",
    price: 5499,
    stock: 45,
    sales: 189,
    categorySlug: "computer",
  },
  {
    name: "机械键盘 87 键 红轴",
    description: "全键无冲，PBT 键帽，三模连接（蓝牙/2.4G/有线）。",
    price: 329,
    stock: 210,
    sales: 1240,
    categorySlug: "computer",
  },
  {
    name: "4K 显示器 27 英寸 IPS",
    description: "Type-C 90W 反向充电，升降旋转支架，出厂校色。",
    price: 1899,
    stock: 60,
    sales: 267,
    categorySlug: "computer",
  },
  {
    name: "变频空调 大1.5匹 新一级能效",
    description: "智能温控，静音运行，支持 App 远程控制，含安装服务。",
    price: 2899,
    stock: 35,
    sales: 98,
    categorySlug: "appliance",
  },
  {
    name: "扫地机器人 扫拖一体",
    description: "激光导航，自动集尘，3000Pa 大吸力，拖扫同步。",
    price: 2199,
    stock: 50,
    sales: 356,
    categorySlug: "appliance",
  },
  {
    name: "纯棉基础款圆领 T 恤",
    description: "270g 新疆长绒棉，透气不闷汗，多色可选。",
    price: 89,
    stock: 500,
    sales: 5320,
    categorySlug: "fashion",
  },
  {
    name: "轻商务休闲双肩包",
    description: "15.6 英寸电脑仓，防泼水面料，USB 外接充电设计。",
    price: 199,
    stock: 260,
    sales: 876,
    categorySlug: "fashion",
  },
  {
    name: "氨基酸保湿洁面乳 150ml",
    description: "温和不刺激，弱酸性配方，适合敏感肌，早晚可用。",
    price: 79,
    stock: 400,
    sales: 2980,
    categorySlug: "beauty",
  },
  {
    name: "阿克苏冰糖心苹果 5kg 装",
    description: "产地直发，脆甜多汁，坏果包赔，48 小时保鲜送达。",
    price: 59.9,
    stock: 150,
    sales: 4110,
    categorySlug: "food",
  },
];

async function main() {
  // 演示账号：demo@example.com / demo123456（幂等，密码变更不覆盖）
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      nickname: "演示用户",
      passwordHash: await bcrypt.hash("demo123456", 10),
    },
  });

  // 管理员账号：admin@example.com / admin123456
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      nickname: "平台管理员",
      role: "ADMIN",
      passwordHash: await bcrypt.hash("admin123456", 10),
    },
  });

  // 商家账号：merchant@example.com / merchant123456
  const merchantUser = await prisma.user.upsert({
    where: { email: "merchant@example.com" },
    update: {},
    create: {
      email: "merchant@example.com",
      nickname: "鸟西自营数码店",
      role: "MERCHANT",
      passwordHash: await bcrypt.hash("merchant123456", 10),
    },
  });

  // 演示店铺：一人一店，挂到商家账号（幂等按 ownerId）
  const demoShop = await prisma.shop.upsert({
    where: { ownerId: merchantUser.id },
    update: { name: "鸟西数码旗舰店", logo: "🏪" },
    create: {
      ownerId: merchantUser.id,
      name: "鸟西数码旗舰店",
      logo: "🏪",
      description: "专注手机数码与电脑外设，官方直营，全国联保，48 小时发货。",
    },
  });

  // 分类按 slug 幂等写入
  const categoryMap = new Map<string, number>();
  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, icon: category.icon },
      create: category,
    });
    categoryMap.set(category.slug, record.id);
  }

  // 商品按名称幂等写入（已存在但缺商家的补齐，不重复堆积）
  // 商品图片一律由商家上传，种子数据不生成图片
  let created = 0;
  const productIdByName = new Map<string, number>();
  for (const product of products) {
    const sellerId =
      product.categorySlug === "digital" || product.categorySlug === "computer"
        ? merchantUser.id
        : null;
    const existing = await prisma.product.findFirst({
      where: { name: product.name },
    });
    if (existing) {
      productIdByName.set(product.name, existing.id);
      const shopId = sellerId !== null ? demoShop.id : null;
      if (existing.sellerId === null && sellerId !== null) {
        await prisma.product.update({
          where: { id: existing.id },
          data: { sellerId, shopId },
        });
      } else if (sellerId !== null && existing.shopId === null) {
        await prisma.product.update({ where: { id: existing.id }, data: { shopId } });
      }
      continue;
    }
    const record = await prisma.product.create({
      data: {
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        sales: product.sales,
        status: ProductStatus.ON_SALE,
        categoryId: categoryMap.get(product.categorySlug),
        sellerId,
        shopId: sellerId !== null ? demoShop.id : null,
      },
    });
    productIdByName.set(product.name, record.id);
    created += 1;
  }

  // 演示订单 1：已完成（带评价）——幂等按 orderNo
  const completedItems = [
    { name: "降噪无线蓝牙耳机 AirPro 3", price: 699, quantity: 1 },
    { name: "氨基酸保湿洁面乳 150ml", price: 79, quantity: 2 },
  ];
  const completedOrder = await prisma.order.upsert({
    where: { orderNo: "DEMO202609010001" },
    update: {},
    create: {
      orderNo: "DEMO202609010001",
      userId: demoUser.id,
      status: "COMPLETED",
      totalAmount: completedItems.reduce((s, i) => s + i.price * i.quantity, 0),
      recipientName: "演示用户",
      recipientPhone: "13800138000",
      shippingAddress: "浙江省杭州市西湖区文三路 100 号",
      items: {
        create: completedItems.map((item) => ({
          productId: productIdByName.get(item.name)!,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      },
    },
    include: { items: true },
  });

  // 已完成订单的演示评价（一单一商品一条，唯一约束幂等）
  const reviewSpecs = [
    {
      productName: "降噪无线蓝牙耳机 AirPro 3",
      rating: 5,
      content: "降噪效果一流，戴着一下午耳朵也不累，音质超出预期！",
    },
    {
      productName: "氨基酸保湿洁面乳 150ml",
      rating: 4,
      content: "洗完不紧绷，敏感肌友好，就是泡沫略少一点。",
    },
  ];
  for (const spec of reviewSpecs) {
    const item = completedOrder.items.find((i) => i.name === spec.productName);
    if (!item) continue;
    const exists = await prisma.review.findUnique({
      where: { orderId_productId: { orderId: completedOrder.id, productId: item.productId } },
    });
    if (!exists) {
      await prisma.review.create({
        data: {
          orderId: completedOrder.id,
          userId: demoUser.id,
          productId: item.productId,
          rating: spec.rating,
          content: spec.content,
        },
      });
    }
  }

  // 演示订单 2：已发货（带物流单号，待评价，给「待评价」入口留演示数据）
  const shippedProduct = "机械键盘 87 键 红轴";
  await prisma.order.upsert({
    where: { orderNo: "DEMO202609010002" },
    update: {},
    create: {
      orderNo: "DEMO202609010002",
      userId: demoUser.id,
      status: "SHIPPED",
      totalAmount: 329,
      trackingNo: "BX20260903090000123456",
      shippedAt: new Date(),
      recipientName: "演示用户",
      recipientPhone: "13800138000",
      shippingAddress: "浙江省杭州市西湖区文三路 100 号",
      items: {
        create: [
          {
            productId: productIdByName.get(shippedProduct)!,
            name: shippedProduct,
            price: 329,
            quantity: 1,
          },
        ],
      },
    },
  });

  // 演示优惠券：未过期满减券两张（幂等按 title；每人限领一张由业务约束保证）
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const couponSpecs = [
    { title: "新人专享满 99 减 20", threshold: 99, discount: 20, totalCount: 1000 },
    { title: "数码狂嗨满 1000 减 120", threshold: 1000, discount: 120, totalCount: 200 },
    { title: "周末加餐满 200 减 30", threshold: 200, discount: 30, totalCount: 500 },
  ];
  for (const spec of couponSpecs) {
    const existing = await prisma.coupon.findFirst({ where: { title: spec.title } });
    if (!existing) {
      await prisma.coupon.create({
        data: {
          title: spec.title,
          threshold: spec.threshold,
          discount: spec.discount,
          totalCount: spec.totalCount,
          expiresAt: nextYear,
        },
      });
    }
  }

  console.log(
    `种子数据完成：分类 ${categories.length} 个，新写入商品 ${created} 个（共 ${products.length} 条），演示订单 2 笔 + 评价 2 条，店铺 1 家（${demoShop.name}），优惠券 ${couponSpecs.length} 张`,
  );
}

main()
  .catch((error) => {
    console.error("种子数据执行失败:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
