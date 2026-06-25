import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

function optional(name, fallback = "") {
  return process.env[name] || fallback;
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

const defaultTemplatePath = path.resolve(".tmp", "template.xlsx");

export const env = {
  port: Number(optional("PORT", "3000")),
  feishuAppId: optional("FEISHU_APP_ID"),
  feishuAppSecret: optional("FEISHU_APP_SECRET"),
  feishuBaseAppToken: optional("FEISHU_BASE_APP_TOKEN"),
  feishuBaseTableId: optional("FEISHU_BASE_TABLE_ID"),
  feishuBabyTableId: optional("FEISHU_BABY_TABLE_ID"),
  feishuWeeklyTableId: optional("FEISHU_WEEKLY_TABLE_ID"),
  feishuTargetFolderToken: optional("FEISHU_TARGET_FOLDER_TOKEN"),
  feishuTransferOwnerEmail: optional("FEISHU_TRANSFER_OWNER_EMAIL"),
  feishuTransferOwnerMobile: optional("FEISHU_TRANSFER_OWNER_MOBILE"),
  openaiApiKey: optional("OPENAI_API_KEY"),
  openaiModel: optional("OPENAI_MODEL", "gpt-4.1"),
  llmProvider: optional("LLM_PROVIDER", "openai"),
  llmApiKey: optional("LLM_API_KEY", optional("OPENAI_API_KEY")),
  llmBaseUrl: optional("LLM_BASE_URL", "https://api.openai.com/v1"),
  llmModel: optional("LLM_MODEL", optional("OPENAI_MODEL", "gpt-4.1")),
  templatePath: optional("TEMPLATE_PATH", defaultTemplatePath),
  outputDir: path.resolve(optional("OUTPUT_DIR", "outputs"))
};

export function requireFeishuEnv() {
  return {
    appId: required("FEISHU_APP_ID"),
    appSecret: required("FEISHU_APP_SECRET"),
    baseAppToken: required("FEISHU_BASE_APP_TOKEN"),
    baseTableId: optional("FEISHU_BASE_TABLE_ID"),
    babyTableId: optional("FEISHU_BABY_TABLE_ID"),
    weeklyTableId: optional("FEISHU_WEEKLY_TABLE_ID")
  };
}

export function requireOpenAIEnv() {
  return {
    apiKey: required("OPENAI_API_KEY"),
    model: env.openaiModel
  };
}

export function requireLLMEnv() {
  return {
    provider: env.llmProvider,
    apiKey: env.llmApiKey || required("LLM_API_KEY"),
    baseUrl: env.llmBaseUrl,
    model: env.llmModel
  };
}

export function hasTemplateFile(templatePath = env.templatePath) {
  return fs.existsSync(templatePath);
}
