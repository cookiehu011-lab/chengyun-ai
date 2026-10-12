-- 第3步：冷启动实体提案
CREATE TABLE IF NOT EXISTS ai_entity_proposal (
  id BIGSERIAL PRIMARY KEY,
  entity_name VARCHAR(256) NOT NULL,
  cat_l1 VARCHAR(64),
  cat_l2 VARCHAR(64),
  gcj02_lon DOUBLE PRECISION,
  gcj02_lat DOUBLE PRECISION,
  camera_count INT NOT NULL DEFAULT 0,
  camera_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  name_hint VARCHAR(512),
  confidence VARCHAR(16),
  reason TEXT,
  parent_hint VARCHAR(256),
  cluster_key VARCHAR(128),
  raw_json JSONB,
  status VARCHAR(32) NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_entity_proposal_status
  ON ai_entity_proposal (status);
CREATE INDEX IF NOT EXISTS idx_ai_entity_proposal_cat
  ON ai_entity_proposal (cat_l1, cat_l2);

ALTER TABLE ai_model_validation
  ADD COLUMN IF NOT EXISTS entity_proposal_id BIGINT,
  ADD COLUMN IF NOT EXISTS entity_name_proposed VARCHAR(256),
  ADD COLUMN IF NOT EXISTS step3_confidence VARCHAR(16),
  ADD COLUMN IF NOT EXISTS step3_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ai_model_validation_entity
  ON ai_model_validation (entity_proposal_id);

COMMENT ON TABLE ai_entity_proposal IS '第3步冷启动：由有价值相机聚成的候选实体';
