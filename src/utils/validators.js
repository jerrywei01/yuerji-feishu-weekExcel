import { z } from "zod";

export const generateRequestSchema = z.object({
  record_id: z.string().min(1)
});

export const aiResultSchema = z.object({
  baby: z.object({
    name: z.string().min(1),
    birth_info_text: z.string().min(1),
    age_text: z.string().min(1),
    feeding_type: z.string().min(1),
    body_text: z.string().optional().default("")
  }),
  weeks: z.array(
    z.object({
      week_no: z.number().int().positive(),
      title: z.string().min(1),
      start_date: z.string().min(1),
      end_date: z.string().min(1),
      routine_summary: z.string().min(1),
      focus_points: z.array(z.string().min(1)).min(1),
      card_items: z.object({
        feeding: z.array(z.string()),
        exercise: z.array(z.string()),
        sleep: z.array(z.string()),
        care: z.array(z.string())
      })
    })
  ).min(1)
});

export function validateWeekCount(weekCount) {
  const parsed = Number(weekCount);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) {
    throw new Error("生成周数必须为 1-4 的整数");
  }
  return parsed;
}

export function validateAIResult(payload, expectedWeekCount) {
  const parsed = aiResultSchema.parse(payload);
  if (parsed.weeks.length !== expectedWeekCount) {
    throw new Error(`AI输出周数 ${parsed.weeks.length} 与要求周数 ${expectedWeekCount} 不一致`);
  }

  parsed.weeks.forEach((week, index) => {
    if (week.week_no !== index + 1) {
      throw new Error("周数必须从第1周开始连续递增");
    }
  });

  return parsed;
}

export function validateRecordInput(record) {
  if (!record.babyName) throw new Error("缺少宝宝名称");
  if (!record.babyRecordId) throw new Error("缺少记录 ID");
  if (!record.babyProfile) throw new Error("缺少宝宝基本信息");
  if (!record.stageSummary) throw new Error("缺少阶段总结");
  if (!record.routinePlan) throw new Error("缺少作息表");
  if (!record.feedingPlan) throw new Error("缺少辅食安排");
  if (!record.bathPlan) throw new Error("缺少瑶浴月历");

  const normalizedPlanStartDate = normalizeDateInput(record.planStartDate || record.recordDate);
  if (!normalizedPlanStartDate) throw new Error("缺少方案开始日期");

  const normalizedWeekCount = inferWeekCount(record);

  return {
    ...record,
    planStartDate: normalizedPlanStartDate,
    weekCount: validateWeekCount(normalizedWeekCount)
  };
}

function normalizeDateInput(value) {
  if (!value) return "";

  const raw = String(value).trim();
  if (!raw) return "";

  if (/^\d{13}$/.test(raw)) {
    return new Date(Number(raw)).toISOString().slice(0, 10);
  }

  if (/^\d{10}$/.test(raw)) {
    return new Date(Number(raw) * 1000).toISOString().slice(0, 10);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return raw;
}

function inferWeekCount(record) {
  const directValue = Number(record.weekCount || 0);
  if (Number.isInteger(directValue) && directValue >= 1) {
    return directValue;
  }

  const text = [record.feedingPlan, record.bathPlan, record.stageSummary]
    .filter(Boolean)
    .join("\n");

  const matches = [...text.matchAll(/第\s*([1-4])\s*周/g)];
  if (matches.length > 0) {
    return Math.max(...matches.map((match) => Number(match[1])));
  }

  return 1;
}
