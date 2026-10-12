-- 验证表补充高德位置证据（可来自 xuanwu 同步或实时调用）
ALTER TABLE ai_model_validation
  ADD COLUMN IF NOT EXISTS amap_formatted_address TEXT,
  ADD COLUMN IF NOT EXISTS amap_nearest_poi_name VARCHAR(256),
  ADD COLUMN IF NOT EXISTS amap_nearest_poi_type VARCHAR(256),
  ADD COLUMN IF NOT EXISTS amap_nearest_poi_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS amap_evidence_json JSONB,
  ADD COLUMN IF NOT EXISTS amap_enriched_at TIMESTAMPTZ;

COMMENT ON COLUMN ai_model_validation.amap_nearest_poi_name IS '高德最近 POI/AOI 名，第2/3步实体判定依据';
