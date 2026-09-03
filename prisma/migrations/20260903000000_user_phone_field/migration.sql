-- 手机号注册/登录：email 改为可空（邮箱/手机二选一），新增唯一 phone 字段
ALTER TABLE `users` MODIFY `email` VARCHAR(200) NULL;
ALTER TABLE `users` ADD COLUMN `phone` VARCHAR(20) NULL;
ALTER TABLE `users` ADD UNIQUE INDEX `users_phone_key`(`phone`);
