-- 实体构成 / 路段 / 关联边
CREATE TABLE IF NOT EXISTS ai_entity_edge (
  id BIGSERIAL PRIMARY KEY,
  from_entity_id BIGINT NOT NULL REFERENCES ai_entity_proposal(id) ON DELETE CASCADE,
  to_entity_id BIGINT NOT NULL REFERENCES ai_entity_proposal(id) ON DELETE CASCADE,
  edge_type VARCHAR(32) NOT NULL,
  -- part_of: from=子 to=父
  -- segment_of: from=路段 to=路
  -- landmark_of: from=地标 to=路/路段（弱关联）
  confidence VARCHAR(16) NOT NULL DEFAULT '有把握',
  evidence TEXT,
  -- proposed=待校验 / approved=已校验 / rejected=驳回
  status VARCHAR(32) NOT NULL DEFAULT 'proposed',
  reviewed_at TIMESTAMPTZ,
  reviewed_by VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ai_entity_edge UNIQUE (from_entity_id, to_entity_id, edge_type),
  CONSTRAINT chk_ai_entity_edge_type CHECK (
    edge_type IN ('part_of', 'segment_of', 'landmark_of')
  ),
  CONSTRAINT chk_ai_entity_edge_not_self CHECK (from_entity_id <> to_entity_id),
  CONSTRAINT chk_ai_entity_edge_status CHECK (
    status IN ('proposed', 'approved', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_entity_edge_from ON ai_entity_edge (from_entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_entity_edge_to ON ai_entity_edge (to_entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_entity_edge_type ON ai_entity_edge (edge_type);
CREATE INDEX IF NOT EXISTS idx_ai_entity_edge_status ON ai_entity_edge (status);

ALTER TABLE ai_entity_edge
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(64);

ALTER TABLE ai_entity_proposal
  ADD COLUMN IF NOT EXISTS parent_entity_id BIGINT,
  ADD COLUMN IF NOT EXISTS entity_role VARCHAR(32) DEFAULT 'leaf';
  -- leaf: 相机挂载叶子
  -- parent: 抽边产生的父实体（可无直挂相机）
  -- both: 既有相机又有子实体

COMMENT ON TABLE ai_entity_edge IS '实体关系：构成(part_of) / 路段(segment_of) / 地标关联(landmark_of)';
COMMENT ON COLUMN ai_entity_edge.from_entity_id IS '边起点：子实体或路段或地标';
COMMENT ON COLUMN ai_entity_edge.to_entity_id IS '边终点：父实体或主路';
COMMENT ON COLUMN ai_entity_proposal.parent_entity_id IS '主构成父实体（冗余便于列表展示）';
COMMENT ON COLUMN ai_entity_proposal.entity_role IS 'leaf|parent|both';
