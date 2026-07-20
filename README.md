# 御儿记飞书周打卡表生成服务

这是一个基于 `Node.js + Express + ExcelJS + 飞书多维表格 + DeepSeek/OpenAI 兼容接口` 的自动化服务。

它的作用是：

1. 在飞书多维表格里创建一条“周表格生成”记录。
2. 服务端读取这条记录，并关联读取“宝宝信息表”里的资料。
3. 调用 LLM 生成结构化周计划。
4. 套用 Excel 模板生成周打卡表。
5. 导入飞书表格，回写结果链接。
6. 可选：自动转让飞书表格所有权。

---

## 1. 项目流程

完整链路如下：

1. 飞书“周表格生成”表新增一条记录。
2. 该记录通过 `宝宝信息` 关联字段指向“宝宝信息表”。
3. 填写 `方案开始日期` 和 `生成周数`。
4. 飞书自动化触发 HTTP 请求。
5. 服务端读取飞书数据。
6. 调用 AI 生成每周结构化内容。
7. 生成 `.xlsx`。
8. 上传到飞书云盘。
9. 导入为飞书表格。
10. 回写 `结果链接`、`生成状态`、`最近生成时间`。
11. 如已配置转让目标，则自动转让所有权。
12. 清理上传到云盘中的中间 `xlsx` 文件，只保留飞书表格。

---

## 2. 目录说明

- `src/app.js`：HTTP 服务入口
- `src/routes/feishu.js`：飞书接口路由
- `src/controllers/generate-controller.js`：生成接口控制器
- `src/services/job-service.js`：主流程编排
- `src/services/feishu-client.js`：飞书 API 封装
- `src/services/ai-generator.js`：LLM 调用
- `src/services/sheet-renderer.js`：Excel 渲染
- `src/services/checklist-layout.js`：打卡项提取逻辑
- `src/services/baby-profile-parser.js`：宝宝信息解析
- `src/prompts/weekly-plan-prompt.js`：AI Prompt
- `tests/`：自动化测试
- `.tmp/template.xlsx`：Excel 模板
- `outputs/`：本地调试输出目录
- `docs/操作手册.md`：更细的服务器操作手册

---

## 3. 环境要求

### 本地开发

- Node.js 20+
- npm 10+
- 可访问飞书开放平台
- 可访问 DeepSeek 或 OpenAI 兼容接口

### 服务器部署

推荐环境：

- Ubuntu 22.04
- Node.js 20+
- PM2
- Nginx（可选，但推荐）

---

## 4. 飞书表结构要求

### 4.1 宝宝信息表

建议至少包含这些字段：

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

### 4.2 周表格生成

建议至少包含这些字段：

- `宝宝信息`
  说明：关联到“宝宝信息表”
- `记录 ID`
- `方案开始日期`
- `生成周数`
- `生成状态`
- `结果链接`
- `错误信息`
- `最近生成时间`

### 4.3 字段类型建议

为了减少飞书字段校验报错，建议这样建：

- `宝宝信息`：关联记录
- `方案开始日期`：日期
- `生成周数`：单选或数字
- `生成状态`：单选
  选项建议包含：
  - `生成中`
  - `已完成`
  - `失败`
- `结果链接`：超链接 / URL
- `错误信息`：多行文本
- `最近生成时间`：日期时间

---

## 5. 环境变量配置

参考 `.env.example`，推荐最少配置如下：

```env
PORT=3000

FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_BASE_APP_TOKEN=
FEISHU_BABY_TABLE_ID=
FEISHU_WEEKLY_TABLE_ID=
FEISHU_TARGET_FOLDER_TOKEN=
FEISHU_TRANSFER_OWNER_EMAIL=
FEISHU_TRANSFER_OWNER_MOBILE=

LLM_PROVIDER=deepseek
LLM_API_KEY=
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-pro

TEMPLATE_PATH=.tmp/template.xlsx
OUTPUT_DIR=outputs
```

### 字段说明

- `PORT`
  服务监听端口，默认 `3000`

- `FEISHU_APP_ID`
  飞书应用 App ID

- `FEISHU_APP_SECRET`
  飞书应用 App Secret

- `FEISHU_BASE_APP_TOKEN`
  飞书多维表格 App Token

- `FEISHU_BABY_TABLE_ID`
  宝宝信息表 Table ID

- `FEISHU_WEEKLY_TABLE_ID`
  周表格生成 Table ID

- `FEISHU_TARGET_FOLDER_TOKEN`
  飞书云盘目标根文件夹 token

- `FEISHU_TRANSFER_OWNER_EMAIL`
  生成后自动转让的目标邮箱，可选

- `FEISHU_TRANSFER_OWNER_MOBILE`
  生成后自动转让的目标手机号，可选

- `LLM_PROVIDER`
  当前支持 `deepseek` 或兼容 OpenAI 的服务

- `LLM_API_KEY`
  模型服务 API Key

- `LLM_BASE_URL`
  模型服务 Base URL

- `LLM_MODEL`
  使用的模型名称

- `TEMPLATE_PATH`
  Excel 模板路径

- `OUTPUT_DIR`
  输出目录

---

## 6. 本地开发步骤

### 6.1 安装依赖

```bash
npm install
```

### 6.2 准备 `.env`

```bash
cp .env.example .env
```

然后补全飞书和模型配置。

### 6.3 准备模板文件

确认以下文件存在：

```text
.tmp/template.xlsx
```

### 6.4 启动服务

开发模式：

```bash
npm run dev
```

普通启动：

```bash
npm start
```

### 6.5 健康检查

```bash
curl http://127.0.0.1:3000/health
```

预期返回：

```json
{"ok":true}
```

---

## 7. 本地联调与测试

### 7.1 调试真实接口

```bash
curl -X POST http://127.0.0.1:3000/api/feishu/generate-weekly-sheet \
  -H "Content-Type: application/json" \
  -d '{"record_id":"你的记录ID"}'
```

说明：

- 这里的 `record_id` 是“周表格生成”表中的记录 ID
- 服务会自动根据 `宝宝信息` 关联字段找到对应宝宝资料

### 7.2 运行自动化测试

```bash
npm test
```

### 7.3 常用调试输出文件

如果接口报错，可优先查看：

- `outputs/feishu-last-response.txt`
- `outputs/feishu-upload-response.txt`
- `outputs/feishu-auth-response.txt`
- `outputs/last-llm-response.txt`

---

## 8. 飞书自动化配置

### 8.1 HTTP 请求配置

- 方法：`POST`
- URL：

```text
http://你的地址/api/feishu/generate-weekly-sheet
```

- Header：

```text
Content-Type: application/json
```

- Body：

```json
{
  "record_id": "{{$json.record_id}}"
}
```

### 8.2 触发建议

可选方式：

1. 新增记录时自动触发
2. 某个“生成”按钮或状态字段变化时触发

---

## 9. 服务器部署步骤

以下以腾讯云 Ubuntu 为例。

### 9.1 安装基础软件

```bash
sudo apt update
sudo apt install -y curl git nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 9.2 拉取代码

```bash
cd ~/srv
git clone https://github.com/jerrywei01/yuerji-feishu-weekExcel.git
cd ~/srv/yuerji-feishu-weekExcel
```

### 9.3 安装依赖

```bash
npm install
```

### 9.4 上传模板

确认模板文件存在：

```text
~/srv/yuerji-feishu-weekExcel/.tmp/template.xlsx
```

### 9.5 配置环境变量

```bash
cd ~/srv/yuerji-feishu-weekExcel
nano .env
```

### 9.6 先手动验证服务

```bash
node src/app.js
```

另开一个窗口执行：

```bash
curl http://127.0.0.1:3000/health
```

如果返回 `{"ok":true}`，说明服务本身没问题。

### 9.7 使用 PM2 托管

```bash
cd ~/srv/yuerji-feishu-weekExcel
pm2 start src/app.js --name yuerji-weekly --update-env
pm2 save
```

### 9.8 配置开机自启

```bash
pm2 startup
```

执行输出中的那条 `sudo ...` 命令，然后再执行：

```bash
pm2 save
```

### 9.9 验证 PM2 服务

```bash
pm2 status
pm2 info yuerji-weekly
curl http://127.0.0.1:3000/health
```

---

## 10. Nginx 反向代理

如果希望通过 `80` 端口访问，而不是直接暴露 `3000`，建议使用 Nginx。

### 10.1 示例配置

`/etc/nginx/sites-available/yuerji`

```nginx
server {
    listen 80;
    server_name 你的域名或公网IP;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 10.2 启用配置

```bash
sudo ln -s /etc/nginx/sites-available/yuerji /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 10.3 最终访问地址

```text
http://你的域名/api/feishu/generate-weekly-sheet
```

---

## 11. 腾讯云安全组建议

### 如果直接使用 3000 端口测试

需要在安全组中放行：

- 协议：`TCP`
- 端口：`3000`
- 来源：测试阶段可先 `0.0.0.0/0`

### 正式环境建议

- 使用 Nginx
- 只开放 `80` / `443`
- `3000` 仅本机访问

---

## 12. 代码更新步骤

服务器部署后，后续代码更新建议严格按下面步骤执行。

### 12.1 拉取最新代码

```bash
cd ~/srv/yuerji-feishu-weekExcel
git pull origin master
```

### 12.2 安装依赖

如果本次改动涉及依赖，执行：

```bash
npm install
```

### 12.3 跑测试

```bash
npm test
```

### 12.4 如修改了 `.env`

先编辑配置：

```bash
nano .env
```

然后重启服务并带上环境变量更新：

```bash
pm2 restart yuerji-weekly --update-env
```

### 12.5 普通重启

如果只是代码更新：

```bash
pm2 restart yuerji-weekly
```

### 12.6 保存当前 PM2 配置

```bash
pm2 save
```

### 12.7 更新后快速验证

```bash
curl http://127.0.0.1:3000/health
pm2 logs yuerji-weekly --lines 50
```

---

## 13. 日常运维命令

### 查看运行状态

```bash
pm2 status
```

### 查看详细信息

```bash
pm2 info yuerji-weekly
```

### 查看日志

```bash
pm2 logs yuerji-weekly --lines 100
```

### 重启服务

```bash
pm2 restart yuerji-weekly --update-env
```

### 停止服务

```bash
pm2 stop yuerji-weekly
```

### 删除服务

```bash
pm2 delete yuerji-weekly
```

### 重新启动单个服务

```bash
cd ~/srv/yuerji-feishu-weekExcel
pm2 start src/app.js --name yuerji-weekly --update-env
pm2 save
```

### 健康检查

```bash
curl http://127.0.0.1:3000/health
```

---

## 14. 常见问题排查

### 14.1 `RecordIdNotFound`

通常表示传入的 `record_id` 不属于当前“周表格生成”表。

排查：

- 确认 `record_id` 来自正确的表
- 确认 `.env` 中 `FEISHU_WEEKLY_TABLE_ID` 正确

### 14.2 `缺少记录 ID`

通常表示：

- 周表记录没有正确关联到宝宝信息表
- 或关联字段没有读到对应记录

排查：

- 检查 `宝宝信息` 关联字段是否有值
- 检查宝宝信息表中的 `记录 ID` 是否存在

### 14.3 `上游接口返回的不是合法 JSON`

优先查看：

- `outputs/last-llm-response.txt`
- `outputs/feishu-last-response.txt`

### 14.4 `field validation failed`

通常是飞书字段类型与写入格式不匹配。

重点检查：

- `生成状态`
- `结果链接`
- `错误信息`
- `最近生成时间`

### 14.5 `URLFieldConvFail`

通常是飞书 URL 字段写入格式问题。

当前项目已使用兼容 `Url` 字段的对象格式：

```json
{
  "text": "标题",
  "link": "https://..."
}
```

### 14.6 `Cannot merge already merged cells`

这是 Excel 模板合并单元格冲突问题。

当前项目已经针对模板预合并场景做了容错。

如果再次出现：

- 检查模板是否新增了大范围合并
- 检查 `src/services/sheet-renderer.js`
- 重新运行：

```bash
npm test
```

### 14.7 PM2 显示在线但接口不通

优先执行：

```bash
curl http://127.0.0.1:3000/health
pm2 info yuerji-weekly
pm2 logs yuerji-weekly --lines 100
```

如果 `curl` 不通，说明服务没真正监听端口。

### 14.8 服务器重启后服务没起来

检查：

```bash
pm2 startup
pm2 save
```

并确认已经执行过 `pm2 startup` 输出的那条 `sudo` 命令。

---

## 15. 推荐上线检查清单

正式投入使用前，建议逐项确认：

- `.env` 已完整配置
- `.tmp/template.xlsx` 已上传
- `npm install` 已执行
- `npm test` 通过
- `pm2 status` 正常
- `curl http://127.0.0.1:3000/health` 返回正常
- 飞书自动化 HTTP 请求已配置
- 云盘目标文件夹 token 正确
- 所有权转让目标账号正确
- 腾讯云安全组已正确放行

---

## 16. 补充说明

更细的服务器运维说明可参考：

- [docs/操作手册.md](./docs/操作手册.md)

如果后续你希望把 README 和操作手册合并成一份，我也建议统一成“README 放概览，操作手册放实操”的结构，这样最不容易乱。
