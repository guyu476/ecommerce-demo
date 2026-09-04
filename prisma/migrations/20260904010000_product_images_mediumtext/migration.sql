-- 商品多图升级为 MEDIUMTEXT（支持商家上传的多张 data URL 图片）
ALTER TABLE `products` MODIFY `images` MEDIUMTEXT NULL;
