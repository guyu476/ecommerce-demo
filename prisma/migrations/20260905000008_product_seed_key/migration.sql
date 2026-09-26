-- AlterTable
ALTER TABLE `products` ADD COLUMN `seed_key` VARCHAR(40) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `products_seed_key_key` ON `products`(`seed_key`);

