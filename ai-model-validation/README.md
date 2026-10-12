# AI 实体建模全链路验证

从 `xuanwu_camera` 分层抽 200 路样本，写入 `ai_model_validation`，逐步跑第 2 步起的 AI 验证。

## 准备

```bash
cd ai-model-validation
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # 填入 DB / OSS 密钥
```

## 建表并抽样

```bash
python scripts/init_sample.py
```

会：创建 `ai_model_validation` → 清空后写入 200 路分层样本。

## 第 2 步口径（已确认）

1. 先判「要不要用」
2. 仅对有价值的：用 **名称 + 经纬度 + 画面** 综合落到实体一级/二级（`data/entity_categories.json`）
3. 交回：用不用、一级、二级、画面大概是什么、有没有把握

视觉接口：`VISION_API_URL` + `VISION_MODEL=glm-5.3-flash`（OpenAI compatible `/chat/completions`）。

## 启动验证工作台

```bash
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server.app:app --app-dir . --host 127.0.0.1 --port 8765 --reload
```

打开 http://127.0.0.1:8765/

## 批量跑第 2 步

```bash
python scripts/step2_classify.py --limit 20
python scripts/step2_classify.py --id 12
```
