import test from "node:test";
import assert from "node:assert/strict";

import { JobService } from "../src/services/job-service.js";

test("JobService deletes uploaded xlsx after importing sheet", async () => {
  const calls = [];
  const feishuClient = {
    updateWeeklyRecord: async () => {},
    getWeeklyRecord: async () => ({
      recordId: "rec_weekly_1",
      babyRecordId: "rec_baby_1",
      planTitle: "",
      babyName: "",
      stageSummary: "",
      routinePlan: "",
      feedingPlan: "",
      bathPlan: "",
      recordDate: "2026-06-25",
      planStartDate: "2026-06-25",
      weekCount: 1
    }),
    getBabyRecord: async () => ({
      recordId: "rec_baby_1",
      motherName: "洪钱蓉",
      babyName: "小满",
      babyProfile: "宝宝基本信息",
      babyStars: "3",
      planTitle: "",
      stageSummary: "阶段总结",
      routinePlan: "作息安排",
      feedingPlan: "辅食安排",
      bathPlan: "瑶浴月历",
      recordDate: "2026-06-25",
      babyRecordId: "rec_baby_1"
    }),
    ensureChildFolder: async () => "folder_token_1",
    uploadFile: async () => ({ file_token: "file_token_1" }),
    importExcelAsSheet: async () => ({ url: "https://bql5w17omzx.feishu.cn/sheets/abc123", token: "abc123" }),
    deleteFile: async (fileToken) => {
      calls.push(["deleteFile", fileToken]);
    },
    getUserIdByEmailOrMobile: async () => "user_open_id_1",
    transferSheetOwner: async () => {}
  };

  const aiGenerator = {
    generate: async () => ({
      baby: {
        name: "小满",
        birth_info_text: "2025/07/11",
        age_text: "1Y1M14D",
        feeding_type: "母乳",
        body_text: "17斤 / 72cm"
      },
      weeks: [
        {
          week_no: 1,
          title: "第1周",
          start_date: "2026-06-25",
          end_date: "2026-07-01",
          routine_summary: "作息摘要",
          focus_points: ["重点1"],
          card_items: {
            feeding: [],
            exercise: [],
            sleep: [],
            care: []
          }
        }
      ]
    })
  };

  const sheetRenderer = {
    render: async () => "E:/tmp/test.xlsx"
  };

  const service = new JobService({
    feishuClient,
    aiGenerator,
    sheetRenderer
  });

  await service.run("rec_weekly_1");

  assert.deepEqual(calls, [["deleteFile", "file_token_1"]]);
});
