-- 0011_token_usage_runtime.sql
-- EPIC 2.3a — add runtime origin column to token_usage
-- so dashboards can show cloud vs local cost split.
ALTER TABLE `token_usage` ADD `runtime` text NOT NULL DEFAULT 'cloud';