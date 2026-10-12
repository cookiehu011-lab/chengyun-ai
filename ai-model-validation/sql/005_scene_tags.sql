-- 第5步：相机画面理解（场景 + 静态/动态标签）
ALTER TABLE ai_model_validation
  ADD COLUMN IF NOT EXISTS scene_type VARCHAR(64),
  ADD COLUMN IF NOT EXISTS scene_viewpoint VARCHAR(64),
  ADD COLUMN IF NOT EXISTS scene_summary TEXT,
  ADD COLUMN IF NOT EXISTS static_tags JSONB,
  ADD COLUMN IF NOT EXISTS dynamic_tags JSONB,
  ADD COLUMN IF NOT EXISTS step5_confidence VARCHAR(16),
  ADD COLUMN IF NOT EXISTS step5_raw_json JSONB,
  ADD COLUMN IF NOT EXISTS step5_at TIMESTAMPTZ;

COMMENT ON COLUMN ai_model_validation.scene_type IS '第5步：场景类型（闭集）';
COMMENT ON COLUMN ai_model_validation.scene_viewpoint IS '第5步：机位视角';
COMMENT ON COLUMN ai_model_validation.scene_summary IS '第5步：场景一句话摘要';
COMMENT ON COLUMN ai_model_validation.static_tags IS '第5步：静态标签数组 [{key,value?,confidence}]';
COMMENT ON COLUMN ai_model_validation.dynamic_tags IS '第5步：动态标签数组 [{key,level?,value?,slots,confidence}]';
COMMENT ON COLUMN ai_model_validation.step5_confidence IS '第5步整体把握：有把握|没把握';
