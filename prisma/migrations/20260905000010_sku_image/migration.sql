-- AlterTable
ALTER TABLE `product_skus` ADD COLUMN `image` VARCHAR(500) NULL;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

