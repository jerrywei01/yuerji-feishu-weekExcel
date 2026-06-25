export function buildWeeklyPlanPrompt(input) {
  return `
你要根据中文原始资料，生成“宝宝周打卡表”的结构化 JSON。

硬性要求：
1. 只输出合法 JSON，不要输出 Markdown，不要加解释。
2. 必须生成恰好 ${input.weekCount} 个 week 对象。
3. week_no 从 1 开始连续递增。
4. start_date 从 ${input.planStartDate} 开始，每周跨度 7 天。
5. 不要编造医疗建议，不要超出原始资料。
6. card_items 必须是“适合每天打卡的任务”，不能直接摘抄长句。
7. card_items 每项尽量控制在 6-18 个字，像“户外活动（上午）”“午觉”“泡瑶浴”“大便观察”“皮肤观察”这种短标签。
8. 如果某个模块本周没有明确任务，可以返回空数组，不要为了凑数硬写。
9. focus_points 必须覆盖阶段总结中的所有关键执行重点，不能漏掉。
10. routine_summary 可以写成按时间顺序整理后的整天节律，适合直接放进 Excel 单元格。
11. feeding 模块优先提炼为：三餐辅食、啃咬、加餐、辅食宝等“能勾选”的项目，而不是具体食谱长句。
12. exercise / sleep / care 模块都要按“每天是否执行”来提炼，而不是照抄建议段落。

原始资料：
- 方案标题：${input.planTitle || ""}
- 妈妈名称：${input.motherName || ""}
- 宝宝名称：${input.babyName}
- 宝宝基本信息：${input.babyProfile}
- 阶段总结：${input.stageSummary}
- 作息表：${input.routinePlan}
- 辅食安排：${input.feedingPlan}
- 瑶浴月历：${input.bathPlan}

输出 JSON 结构：
{
  "baby": {
    "name": "string",
    "birth_info_text": "string",
    "age_text": "string",
    "feeding_type": "string",
    "body_text": "string"
  },
  "weeks": [
    {
      "week_no": 1,
      "title": "第1周",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "routine_summary": "string",
      "focus_points": ["string"],
      "card_items": {
        "feeding": ["short label"],
        "exercise": ["short label"],
        "sleep": ["short label"],
        "care": ["short label"]
      }
    }
  ]
}
`;
}
