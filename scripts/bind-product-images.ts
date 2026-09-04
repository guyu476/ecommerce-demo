// 将下载好的免费图库图片绑定到对应商品（每商品 1 张主图）
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MAP: Record<string, string> = {
  "星耀 X7 Pro 5G 手机 12GB+256GB": "/products/p1.jpg",
  "降噪无线蓝牙耳机 AirPro 3": "/products/p2.jpg",
  "智能手表 Watch S2 运动版": "/products/p3.jpg",
  "轻薄笔记本电脑 MateBook 14 英寸": "/products/p4.jpg",
  "机械键盘 87 键 红轴": "/products/p5.jpg",
  "4K 显示器 27 英寸 IPS": "/products/p6.jpg",
  "变频空调 大1.5匹 新一级能效": "/products/p7.jpg",
  "扫地机器人 扫拖一体": "/products/p8.jpg",
  "纯棉基础款圆领 T 恤": "/products/p9.jpg",
  轻商务休闲双肩包: "/products/p10.jpg",
  "氨基酸保湿洁面乳 150ml": "/products/p11.jpg",
  "阿克苏冰糖心苹果 5kg 装": "/products/p12.jpg",
};

async function main() {
  let updated = 0;
  for (const [name, image] of Object.entries(MAP)) {
    const result = await prisma.product.updateMany({
      where: { name },
      data: { images: JSON.stringify([image]) },
    });
    updated += result.count;
  }
  console.log("已绑定图片的商品数:", updated);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
