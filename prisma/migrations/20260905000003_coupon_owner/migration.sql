-- AlterTable
ALTER TABLE `coupons` ADD COLUMN `owner_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `coupons_owner_id_idx` ON `coupons`(`owner_id`);

-- AddForeignKey
ALTER TABLE `coupons` ADD CONSTRAINT `coupons_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

