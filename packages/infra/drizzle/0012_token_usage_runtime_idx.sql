-- 0012_token_usage_runtime_idx.sql
-- EPIC 2.3a — index for the cloud/local cost split aggregation
CREATE INDEX `token_usage_runtime_idx` ON `token_usage` (`runtime`);