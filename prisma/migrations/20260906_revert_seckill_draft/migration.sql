-- 回退误提交的秒杀草稿迁移（表结构恢复到 20260905_discount_activities 之后）
DROP TABLE IF EXISTS `seckill_purchases`;
DROP TABLE IF EXISTS `seckill_activities`;
DROP TABLE IF EXISTS `view_histories`;
ALTER TABLE `order_items` DROP COLUMN `seckill_activity_id`;
ALTER TABLE `orders` DROP COLUMN `refund_address`, DROP COLUMN `return_tracking_no`;
ALTER TABLE `orders` MODIFY `refund_status` ENUM('NONE','REQUESTED','REFUNDED','REJECTED') NOT NULL DEFAULT 'NONE';
ALTER TABLE `reviews` DROP COLUMN `reply`, DROP COLUMN `replied_at`;
