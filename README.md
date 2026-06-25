# 御儿记飞书周打卡表生成服务

一个基于 `Node.js + Express + ExcelJS + 飞书多维表格 + DeepSeek/OpenAI 兼容接口` 的自动化服务。

它的目标是：

1. 在飞书 `周表格生成` 中点击生成
2. 服务端读取当前周表记录
3. 通过关联字段找到 `宝宝信息表` 对应记录
4. 调用 AI 生成周打卡表结构化数据
5. 套用 Excel 模板生成 `.xlsx`
6. 导入飞书表格并回写结果链接

## 当前表结构

同一个飞书多维表 App：

- `app_token`: `WsztwpxEbiGJ88kvZ3JcuXkYnBe`
- 宝宝信息表：`tblDWFTaPVowtziC`
- 周表格生成：`tblFS4XZfacEDDUF`

## 核心规则

- 统一标题格式：
  - `御儿记VIP宝宝带养 · 小满专属作息打卡表⭐⭐⭐⭐`
- `宝宝星级` 从宝宝信息表读取，并自动转换为标题末尾星号
- 周表负责触发和回写
- 宝宝信息表负责正文资料

## 目录说明

- `src/app.js`：服务入口
- `src/routes/feishu.js`：HTTP 路由
- `src/controllers/generate-controller.js`：请求控制器
- `src/services/job-service.js`：主流程编排
- `src/services/feishu-client.js`：飞书多维表格和云文档接口
- `src/services/ai-generator.js`：AI 调用
- `src/services/sheet-renderer.js`：Excel 渲染
- `src/services/checklist-layout.js`：打卡项提炼逻辑
- `src/services/baby-profile-parser.js`：宝宝基本信息解析
- `src/prompts/weekly-plan-prompt.js`：AI Prompt
- `tests/weekly-plan.test.js`：自动化测试
- `.tmp/template.xlsx`：Excel 模板

## 环境要求

- Node.js 20+
- 可访问飞书开放平台
- 可访问 DeepSeek 或 OpenAI 兼容接口

## 环境变量

参考 `.env.example`：

```env
PORT=3000

FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_BASE_APP_TOKEN=WsztwpxEbiGJ88kvZ3JcuXkYnBe
FEISHU_BABY_TABLE_ID=tblDWFTaPVowtziC
FEISHU_WEEKLY_TABLE_ID=tblFS4XZfacEDDUF
FEISHU_TARGET_FOLDER_TOKEN=

LLM_PROVIDER=deepseek
LLM_API_KEY=
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-pro

TEMPLATE_PATH=.tmp/template.xlsx
OUTPUT_DIR=outputs
```

说明：

- `FEISHU_TARGET_FOLDER_TOKEN`：生成后的 Excel 导入飞书表格时挂载到的云空间文件夹
- `FEISHU_BABY_TABLE_ID`：宝宝信息表 ID
- `FEISHU_WEEKLY_TABLE_ID`：周表格生成表 ID

## 本地启动

安装依赖：

```bash
npm install
```

启动服务：

```bash
npm start
```

开发模式：

```bash
npm run dev
```

健康检查：

```bash
curl http://127.0.0.1:3000/health
```

## 本地测试真实生成

请求示例：

```bash
curl -X POST http://127.0.0.1:3000/api/feishu/generate-weekly-sheet \
  -H "Content-Type: application/json" \
  -d '{"record_id":"recvnrLR0uOZqU"}'
```

说明：

- 这里的 `record_id` 是 `周表格生成` 那一条记录的 ID
- 服务端会通过周表中的关联字段 `宝宝信息` 读取宝宝信息表对应记录

## 自动化测试

```bash
npm test
```

## 飞书字段约定

### 1. 宝宝信息表

建议包含这些字段：

- `妈妈名称/昵称`
- `宝宝名称`
- `宝宝基本信息`
- `宝宝星级`
- `方案`
- `阶段总结`
- `作息表`
- `辅食安排`
- `瑶浴月历`
- `生成日期`
- `记录 ID`

### 2. 周表格生成

建议包含这些字段：

- `宝宝信息`：关联到宝宝信息表
- `记录 ID`
- `方案开始日期`
- `生成周数`
- `生成状态`
- `结果链接`
- `错误信息`
- `最近生成时间`

## 飞书自动化调用

HTTP 请求：

- 方法：`POST`
- URL：`http://你的地址/api/feishu/generate-weekly-sheet`
- Header：`Content-Type: application/json`
- Body：

```json
{
  "record_id": "{{$json.record_id}}"
}
```

## 部署说明

腾讯云服务器部署建议见：

- [操作手册](./docs/操作手册.md)

