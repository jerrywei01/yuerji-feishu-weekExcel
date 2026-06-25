import { AIGenerator } from "./ai-generator.js";
import { FeishuClient, extractSheetTokenFromUrl } from "./feishu-client.js";
import { SheetRenderer } from "./sheet-renderer.js";
import { logger } from "../utils/logger.js";
import { buildDisplayTitle, buildFileBaseName } from "../utils/plan-title.js";
import { env } from "../utils/env.js";
import { validateRecordInput } from "../utils/validators.js";

const FEISHU_FIELDS = {
  status: "生成状态",
  error: "错误信息",
  resultUrl: "结果链接",
  lastGeneratedAt: "最近生成时间"
};

const FEISHU_STATUS = {
  generating: "生成中",
  done: "已完成",
  failed: "失败"
};

export class JobService {
  constructor(options = {}) {
    this.feishuClient = options.feishuClient || new FeishuClient();
    this.aiGenerator = options.aiGenerator || new AIGenerator();
    this.sheetRenderer = options.sheetRenderer || new SheetRenderer();
  }

  async run(recordId) {
    await this.feishuClient.updateWeeklyRecord(recordId, {
      [FEISHU_FIELDS.status]: FEISHU_STATUS.generating,
      [FEISHU_FIELDS.error]: ""
    });

    try {
      const weeklyRecord = await this.feishuClient.getWeeklyRecord(recordId);
      const babyRecord = await this.feishuClient.getBabyRecord(weeklyRecord.babyRecordId);
      const record = validateRecordInput({
        ...babyRecord,
        ...weeklyRecord,
        planTitle: weeklyRecord.planTitle || babyRecord.planTitle,
        babyName: weeklyRecord.babyName || babyRecord.babyName,
        babyProfile: babyRecord.babyProfile,
        motherName: babyRecord.motherName,
        babyStars: babyRecord.babyStars,
        recordDate: weeklyRecord.recordDate || babyRecord.recordDate,
        stageSummary: weeklyRecord.stageSummary || babyRecord.stageSummary,
        routinePlan: weeklyRecord.routinePlan || babyRecord.routinePlan,
        feedingPlan: weeklyRecord.feedingPlan || babyRecord.feedingPlan,
        bathPlan: weeklyRecord.bathPlan || babyRecord.bathPlan,
        babyRecordId: weeklyRecord.babyRecordId || babyRecord.babyRecordId
      });

      const displayTitle = buildDisplayTitle(record.babyName, record.babyStars);
      const fileBaseName = buildFileBaseName(record.babyName, record.babyStars);
      const resolvedRecord = {
        ...record,
        displayTitle,
        fileBaseName,
        planTitle: displayTitle
      };
      const targetFolderToken = await this.feishuClient.ensureChildFolder(
        process.env.FEISHU_TARGET_FOLDER_TOKEN,
        record.motherName
      );

      const aiResult = await this.aiGenerator.generate(resolvedRecord);
      const localFilePath = await this.sheetRenderer.render(resolvedRecord, aiResult);
      const uploaded = await this.feishuClient.uploadFile(localFilePath, targetFolderToken);
      const imported = await this.feishuClient.importExcelAsSheet(
        uploaded.file_token || uploaded.file_token_list?.[0] || uploaded.token,
        fileBaseName,
        targetFolderToken
      );
      await this.transferGeneratedSheetOwner(imported);

      await this.feishuClient.updateWeeklyRecord(recordId, {
        [FEISHU_FIELDS.status]: FEISHU_STATUS.done,
        [FEISHU_FIELDS.resultUrl]: {
          text: displayTitle,
          link: imported.url
        },
        [FEISHU_FIELDS.error]: "",
        [FEISHU_FIELDS.lastGeneratedAt]: Date.now()
      });

      return {
        success: true,
        record_id: recordId,
        week_count: record.weekCount,
        local_file_path: localFilePath,
        sheet_url: imported.url,
        title: displayTitle
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Weekly sheet generation failed", { recordId, message });

      await this.feishuClient.updateWeeklyRecord(recordId, {
        [FEISHU_FIELDS.status]: FEISHU_STATUS.failed,
        [FEISHU_FIELDS.error]: message,
        [FEISHU_FIELDS.lastGeneratedAt]: Date.now()
      });

      throw error;
    }
  }

  async transferGeneratedSheetOwner(imported) {
    const email = env.feishuTransferOwnerEmail;
    const mobile = env.feishuTransferOwnerMobile;
    if (!email && !mobile) return;

    const userId = await this.feishuClient.getUserIdByEmailOrMobile({ email, mobile });
    if (!userId) {
      throw new Error("未找到要转让的飞书用户，请检查 FEISHU_TRANSFER_OWNER_EMAIL 或 FEISHU_TRANSFER_OWNER_MOBILE");
    }

    const sheetToken = imported.token || extractSheetTokenFromUrl(imported.url);
    if (!sheetToken) {
      throw new Error("未能识别生成表格的 sheet token，无法转让所有权");
    }

    await this.feishuClient.transferSheetOwner(sheetToken, userId);
  }
}
