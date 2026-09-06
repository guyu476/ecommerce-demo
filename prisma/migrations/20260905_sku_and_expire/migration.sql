-- DropForeignKey
ALTER TABLE `cart_items` DROP FOREIGN KEY `cart_items_user_id_fkey`;

-- DropIndex
DROP INDEX `cart_items_user_id_product_id_key` ON `cart_items`;

-- AlterTable
ALTER TABLE `cart_items` ADD COLUMN `sku_id` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `sku_specs` VARCHAR(200) NULL;

-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `sku_id` INTEGER NULL,
    ADD COLUMN `sku_specs` VARCHAR(200) NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `expire_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `specs` MEDIUMTEXT NULL;

-- CreateTable
CREATE TABLE `product_skus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `specs` VARCHAR(500) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `sales` INTEGER NOT NULL DEFAULT 0,

    INDEX `product_skus_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `cart_items_user_id_product_id_sku_id_key` ON `cart_items`(`user_id`, `product_id`, `sku_id`);

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_skus` ADD CONSTRAINT `product_skus_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

