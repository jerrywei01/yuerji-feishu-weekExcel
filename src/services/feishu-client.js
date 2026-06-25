import fs from "node:fs/promises";
import path from "node:path";

import { env, requireFeishuEnv } from "../utils/env.js";

const WEEKLY_FIELDS = {
  planTitle: "方案",
  babyName: "宝宝名称",
  babyRelation: "宝宝信息",
  babyRecordId: "记录 ID",
  stageSummary: "阶段总结",
  routinePlan: "作息表",
  feedingPlan: "辅食安排",
  bathPlan: "瑶浴月历",
  recordDate: "生成日期",
  planStartDate: "方案开始日期",
  weekCount: "生成周数"
};

const BABY_FIELDS = {
  motherName: "妈妈名称/昵称",
  babyName: "宝宝名称",
  babyProfile: "宝宝基本信息",
  babyStars: "宝宝星级",
  planTitle: "方案",
  stageSummary: "阶段总结",
  routinePlan: "作息表",
  feedingPlan: "辅食安排",
  bathPlan: "瑶浴月历",
  recordDate: "生成日期",
  babyRecordId: "记录 ID"
};

export class FeishuClient {
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl || fetch;
    this.tenantToken = null;
  }

  async getTenantAccessToken() {
    if (this.tenantToken) return this.tenantToken;

    const config = requireFeishuEnv();
    const response = await this.fetchImpl("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        app_id: config.appId,
        app_secret: config.appSecret
      })
    });

    const data = await parseJsonResponse(response, "feishu-auth-response.txt");
    if (!response.ok || data.code !== 0) {
      throw new Error(`Failed to get Feishu tenant_access_token: ${data.msg || response.statusText}`);
    }

    this.tenantToken = data.tenant_access_token;
    return this.tenantToken;
  }

  async request(method, url, body, headers = {}) {
    const token = await this.getTenantAccessToken();
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...headers
      },
      body
    });

    const data = await parseJsonResponse(response, "feishu-last-response.txt");
    if (!response.ok || data.code !== 0) {
      throw new Error(`飞书请求失败: ${data.msg || response.statusText}`);
    }

    return data;
  }

  async getWeeklyRecord(recordId) {
    const fields = await this.getRecordFields(this.getWeeklyTableId(), recordId);

    return {
      recordId,
      planTitle: stringifyField(fields[WEEKLY_FIELDS.planTitle]),
      babyName: stringifyField(fields[WEEKLY_FIELDS.babyName]),
      babyRecordId: extractRelationRecordId(fields[WEEKLY_FIELDS.babyRelation]) || stringifyField(fields[WEEKLY_FIELDS.babyRecordId]),
      stageSummary: stringifyField(fields[WEEKLY_FIELDS.stageSummary]),
      routinePlan: stringifyField(fields[WEEKLY_FIELDS.routinePlan]),
      feedingPlan: stringifyField(fields[WEEKLY_FIELDS.feedingPlan]),
      bathPlan: stringifyField(fields[WEEKLY_FIELDS.bathPlan]),
      recordDate: stringifyField(fields[WEEKLY_FIELDS.recordDate]),
      planStartDate: stringifyField(fields[WEEKLY_FIELDS.planStartDate]),
      weekCount: Number(stringifyField(fields[WEEKLY_FIELDS.weekCount]) || 0)
    };
  }

  async getBabyRecord(recordId) {
    const fields = await this.getRecordFields(this.getBabyTableId(), recordId);

    return {
      recordId,
      motherName: stringifyField(fields[BABY_FIELDS.motherName]),
      babyName: stringifyField(fields[BABY_FIELDS.babyName]),
      babyProfile: stringifyField(fields[BABY_FIELDS.babyProfile]),
      babyStars: stringifyField(fields[BABY_FIELDS.babyStars]),
      planTitle: stringifyField(fields[BABY_FIELDS.planTitle]),
      stageSummary: stringifyField(fields[BABY_FIELDS.stageSummary]),
      routinePlan: stringifyField(fields[BABY_FIELDS.routinePlan]),
      feedingPlan: stringifyField(fields[BABY_FIELDS.feedingPlan]),
      bathPlan: stringifyField(fields[BABY_FIELDS.bathPlan]),
      recordDate: stringifyField(fields[BABY_FIELDS.recordDate]),
      babyRecordId: stringifyField(fields[BABY_FIELDS.babyRecordId])
    };
  }

  async updateWeeklyRecord(recordId, fields) {
    return this.updateRecord(this.getWeeklyTableId(), recordId, fields);
  }

  async getRecordFields(tableId, recordId) {
    const config = requireFeishuEnv();
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.baseAppToken}/tables/${tableId}/records/${recordId}`;
    const data = await this.request("GET", url);
    return data.data?.record?.fields || {};
  }

  async updateRecord(tableId, recordId, fields) {
    const config = requireFeishuEnv();
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.baseAppToken}/tables/${tableId}/records/${recordId}`;

    return this.request(
      "PUT",
      url,
      JSON.stringify({ fields }),
      {
        "Content-Type": "application/json"
      }
    );
  }

  async uploadFile(filePath) {
    const token = await this.getTenantAccessToken();
    const fileBuffer = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);
    const formData = new FormData();

    formData.append("file_name", path.basename(filePath));
    formData.append("parent_type", "explorer");
    formData.append("parent_node", env.feishuTargetFolderToken);
    formData.append("size", String(stats.size));
    formData.append("file", new Blob([fileBuffer]), path.basename(filePath));

    const response = await this.fetchImpl("https://open.feishu.cn/open-apis/drive/v1/files/upload_all", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const data = await parseJsonResponse(response, "feishu-upload-response.txt");
    if (!response.ok || data.code !== 0) {
      throw new Error(`飞书文件上传失败: ${data.msg || response.statusText}`);
    }

    return data.data;
  }

  async importExcelAsSheet(fileToken, fileName) {
    const payload = {
      file_extension: "xlsx",
      file_token: fileToken,
      type: "sheet",
      file_name: fileName,
      point: {
        mount_type: 1,
        mount_key: env.feishuTargetFolderToken
      }
    };

    const created = await this.request(
      "POST",
      "https://open.feishu.cn/open-apis/drive/v1/import_tasks",
      JSON.stringify(payload),
      { "Content-Type": "application/json" }
    );

    return this.pollImportResult(created.data.ticket);
  }

  async pollImportResult(ticket) {
    const maxAttempts = 40;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await this.request(
        "GET",
        `https://open.feishu.cn/open-apis/drive/v1/import_tasks/${ticket}`
      );

      const result = response.data?.result || response.data || {};
      const jobStatus = result.job_status;

      if (jobStatus === 0 || result.url || result.token) {
        return {
          url: result.url || "",
          token: result.token || ""
        };
      }

      if (jobStatus === 1 || jobStatus === "failed") {
        throw new Error(`飞书导入电子表格失败: ${result.job_error_msg || JSON.stringify(result.extra || []) || "未知错误"}`);
      }

      await sleep(1500);
    }

    throw new Error("飞书导入电子表格超时");
  }

  getWeeklyTableId() {
    const config = requireFeishuEnv();
    return config.weeklyTableId || config.baseTableId || requiredTableId("FEISHU_WEEKLY_TABLE_ID");
  }

  getBabyTableId() {
    const config = requireFeishuEnv();
    return config.babyTableId || requiredTableId("FEISHU_BABY_TABLE_ID");
  }
}

function requiredTableId(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function stringifyField(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);

  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyField(item?.text || item?.name || item?.record_ids?.[0] || item))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    if ("text" in value) return stringifyField(value.text);
    if ("value" in value) return stringifyField(value.value);
    if ("name" in value) return stringifyField(value.name);
    if ("record_ids" in value && Array.isArray(value.record_ids)) return stringifyField(value.record_ids[0]);
  }

  return String(value);
}

function extractRelationRecordId(value) {
  if (!Array.isArray(value)) return "";
  for (const item of value) {
    if (Array.isArray(item?.record_ids) && item.record_ids[0]) {
      return String(item.record_ids[0]);
    }
  }
  return "";
}

async function parseJsonResponse(response, debugFileName) {
  const rawText = await response.text();
  await writeDebugFile(debugFileName, rawText);

  try {
    return JSON.parse(rawText);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown parse error";
    throw new Error(`上游接口返回的不是合法 JSON，请检查 outputs/${debugFileName}。原始错误: ${detail}`);
  }
}

async function writeDebugFile(fileName, content) {
  try {
    await fs.mkdir(env.outputDir, { recursive: true });
    await fs.writeFile(path.join(env.outputDir, fileName), content, "utf8");
  } catch {
    // Ignore debug write failures.
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
