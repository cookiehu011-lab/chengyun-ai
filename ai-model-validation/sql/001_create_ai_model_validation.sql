-- 全链路 AI 建模验证表（不改动 xuanwu_camera）
CREATE TABLE IF NOT EXISTS ai_model_validation (
  id BIGSERIAL PRIMARY KEY,

  -- 来源相机（对齐 xuanwu_camera 关键要素）
  source_id BIGINT NOT NULL,
  camera_id VARCHAR(64) NOT NULL,
  camera_name VARCHAR(512),
  gcj02_lon DOUBLE PRECISION,
  gcj02_lat DOUBLE PRECISION,

  image_morning_cos_key VARCHAR(512),
  image_noon_cos_key VARCHAR(512),
  image_afternoon_cos_key VARCHAR(512),
  image_morning_access_url TEXT,
  image_noon_access_url TEXT,
  image_afternoon_access_url TEXT,

  -- 抽样分层标签（仅用于保证样本多样性）
  sample_stratum VARCHAR(64) NOT NULL,

  -- 第 2 步：价值筛选 + 实体分类（AI）
  -- worth_use: NULL=未跑, 1=用, 0=不用
  worth_use SMALLINT,
  cat_l1 VARCHAR(64),
  cat_l2 VARCHAR(64),
  scene_desc TEXT,
  ai_confidence VARCHAR(16),
  step2_raw_json JSONB,
  step2_at TIMESTAMPTZ,

  -- 第 2 步：人审（可空）
  human_worth_use SMALLINT,
  human_cat_l1 VARCHAR(64),
  human_cat_l2 VARCHAR(64),
  human_scene_desc TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by VARCHAR(64),

  -- 第 3 步及以后预留
  entity_proposal_json JSONB,

  -- 流程
  -- 0=已抽样待第2步, 2=第2步完成, 3=第3步… 
  pipeline_step SMALLINT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'sampled',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_ai_model_validation_camera UNIQUE (camera_id),
  CONSTRAINT chk_worth_use CHECK (worth_use IS NULL OR worth_use IN (0, 1)),
  CONSTRAINT chk_human_worth_use CHECK (human_worth_use IS NULL OR human_worth_use IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_ai_model_validation_status
  ON ai_model_validation (status);
CREATE INDEX IF NOT EXISTS idx_ai_model_validation_stratum
  ON ai_model_validation (sample_stratum);
CREATE INDEX IF NOT EXISTS idx_ai_model_validation_pipeline
  ON ai_model_validation (pipeline_step);

COMMENT ON TABLE ai_model_validation IS '实体建模 AI 全链路验证：从 xuanwu_camera 抽样，逐步写入第2/3/…步结果';
COMMENT ON COLUMN ai_model_validation.worth_use IS '第2步：对C端有无价值。1用 0不用；不用时 cat_l1/l2 应为空';
COMMENT ON COLUMN ai_model_validation.cat_l1 IS '实体一级分类（闭集）';
COMMENT ON COLUMN ai_model_validation.cat_l2 IS '实体二级分类（闭集，隶属 cat_l1）';
