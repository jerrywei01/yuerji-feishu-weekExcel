const STOOL_LABEL = "大便情况";
const SKIN_LABEL = "皮肤情况";
const NOTES_LABEL = "备注\n（宝宝异常状况、\n其他想说的可以在这备注）";
const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function buildDynamicChecklistSections(week, input, babyCard) {
  const sections = [];
  const infantMode = isInfantMode(input, babyCard);
  const feedingRows = buildFeedingRows(week, input, infantMode);
  const exerciseRows = buildExerciseRows(week, input);
  const sleepRows = buildSleepRows(week, input);
  const careRows = buildCareRows(week, input);

  if (feedingRows.length) sections.push({ category: "喂养", rows: feedingRows });
  if (exerciseRows.length) sections.push({ category: "运动", rows: exerciseRows });
  if (sleepRows.length) sections.push({ category: "睡眠", rows: sleepRows });
  if (careRows.length) sections.push({ category: "护理", rows: careRows });
  if (babyCard.stool) sections.push({ category: "大便", rows: [{ text: STOOL_LABEL }] });
  if (babyCard.skin) sections.push({ category: "皮肤", rows: [{ text: SKIN_LABEL }] });

  return {
    taskSections: sections,
    noteText: NOTES_LABEL
  };
}

export function buildFoodReference(feedingPlan = "", weekCount = 7) {
  const days = parseDailyMeals(feedingPlan);
  const fallback = deriveGenericMealRows(feedingPlan);
  const weekdays = WEEKDAY_LABELS.slice(0, Math.max(1, Math.min(weekCount, 7)));
  const rows = ["morning", "noon", "evening"].map((mealKey) =>
    weekdays.map((_, index) => days[index]?.[mealKey] || fallback[mealKey] || "")
  );

  return {
    header: "辅食（参考）",
    weekdays,
    rowLabels: ["上午", "中午", "晚上"],
    rows
  };
}

export function buildRoutineLines(routineSummary = "", routinePlan = "") {
  const source = String(routinePlan || routineSummary || "")
    .replace(/\r/g, "\n")
    .replace(/[；;]/g, "\n")
    .replace(/^\s*[1-9][、.．]/gm, "");

  return source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/(作息和喂奶安排|作息安排|喂奶安排)$/.test(line))
    .map(normalizeRoutineLine)
    .filter(Boolean)
    .join("\n");
}

export function buildFocusPointText(stageSummary = "", aiPoints = []) {
  const stagePoints = splitStageSummary(stageSummary).map(summarizeFocusSentence).filter(Boolean);
  const merged = dedupe([
    ...stagePoints,
    ...aiPoints.map((item) => summarizeFocusSentence(item))
  ]).filter(Boolean);

  return merged.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function buildFeedingRows(week, input, infantMode) {
  if (infantMode) {
    return dedupeRows([
      /(按需喂养|按需喂奶)/.test(input.stageSummary) ? { text: "按需喂奶" } : { text: "规律喂奶" },
      /拍嗝/.test(input.routinePlan) ? { text: "拍嗝" } : null,
      /换尿布/.test(input.routinePlan) ? { text: "奶后换尿布" } : null,
      /(哭闹|喂养反应|分不清是饿)/.test(`${input.babyProfile}\n${input.stageSummary}`) ? { text: "观察喂养反应" } : null
    ].filter(Boolean));
  }

  const rawRows = normalizeRows(week.card_items?.feeding);
  const rows = [];

  if (hasMealSchedule(rawRows, input.feedingPlan)) {
    rows.push(
      { text: "三餐辅食", slotLabel: "早", mealGroup: true },
      { text: "三餐辅食", slotLabel: "中", mealGroup: true },
      { text: "三餐辅食", slotLabel: "晚", mealGroup: true }
    );
  }

  const extraRows = dedupe([
    ...rawRows.map((row) => normalizeFeedingTask(row.text)),
    ...extractFeedingHints(input)
  ])
    .filter(Boolean)
    .filter((text) => !isMealLikeText(text))
    .map((text) => ({ text }));

  return [...rows, ...extraRows];
}

function buildExerciseRows(week, input) {
  const fromAI = normalizeRows(week.card_items?.exercise).map((row) => normalizeExerciseTask(row.text));
  const morningOutdoor = /8:00.*户外|上午.*户外|上午户外/.test(input.routinePlan) ? "户外活动（上午）" : "";
  const afternoonOutdoor = /15:00.*户外|下午.*户外|傍晚.*户外/.test(input.routinePlan) ? "户外活动（下午）" : "";

  let items = [
    ...fromAI,
    /(按摩|抚触)/.test(`${input.stageSummary}\n${input.routinePlan}`) ? "抚触按摩" : "",
    /俯趴/.test(`${input.stageSummary}\n${input.routinePlan}`) ? "俯趴练习" : "",
    /(生长痛|肌肉僵紧|被动操|蹬腿)/.test(`${input.stageSummary}\n${input.routinePlan}`) ? "被动操" : "",
    morningOutdoor,
    afternoonOutdoor
  ].filter(Boolean);

  if (morningOutdoor || afternoonOutdoor) {
    items = items.filter((item) => item !== "户外活动");
  }

  return dedupeRows(items.map((text) => ({ text }))).slice(0, 5);
}

function buildSleepRows(week, input) {
  const source = `${input.routinePlan || ""}\n${week.routine_summary || ""}`;
  const rows = [];

  if (/回笼觉/.test(source)) rows.push({ text: "回笼觉" });
  if (/(晨觉|上午小睡|9:00\s*-\s*9:30喂奶.*哄睡)/.test(source)) rows.push({ text: "上午小睡" });
  if (/(午觉|13:00\s*-\s*15:00|睡约2小时)/.test(source)) rows.push({ text: "午觉（约2小时）" });
  if (/16:00.*1\.5-2|16:00.*1.5-2/.test(source)) rows.push({ text: "黄昏小睡1.5-2小时" });
  else if (/(16:00.*哄睡|下午小睡|黄昏觉)/.test(source)) rows.push({ text: "下午小睡" });
  if (/18:30.*哄睡/.test(source)) rows.push({ text: "夜间哄睡" });

  const merged = dedupeRows([
    ...rows,
    ...normalizeRows(week.card_items?.sleep).map((row) => ({ text: normalizeSleepTask(row.text) }))
  ]);

  return merged.slice(0, 6);
}

function buildCareRows(week, input) {
  const rawRows = normalizeRows(week.card_items?.care).map((row) => row.text);
  const rows = [];

  const bathTask = buildBathTask(input.bathPlan, week.week_no) || findFirst(rawRows, /(泡瑶浴|瑶浴)/);
  if (bathTask) rows.push({ text: bathTask });

  const careHints = dedupe([
    ...rawRows.map(normalizeCareTask),
    ...extractCareHints(input)
  ]).filter(Boolean);

  for (const text of careHints) {
    if (text === bathTask || text === STOOL_LABEL || text === SKIN_LABEL) continue;
    rows.push({ text });
  }

  const ordered = dedupeRows(rows);
  const sortOrder = ["泡健瑶浴", "泡瑶浴", "薄涂山茶油保湿", "温敷肚子", "益生菌 · 调理肠道", "乳糖酶 · 观察大便"];
  return ordered.sort((a, b) => orderScore(a.text, sortOrder) - orderScore(b.text, sortOrder));
}

function buildBathTask(bathPlan, weekNo) {
  const text = String(bathPlan || "");
  const weekMatch = text.match(new RegExp(`第\\s*${weekNo}\\s*周[:：]?([^\\n]+)`));
  if (weekMatch?.[1]) {
    return `泡健瑶浴`;
  }

  const genericMatch = text.match(/泡[^，。\n]*[包次天]/);
  return genericMatch?.[0]?.trim() || "";
}

function hasMealSchedule(rows, feedingPlan) {
  return rows.some((row) => isMealLikeText(row.text)) || /(早餐|午餐|晚餐|上午|中午|晚上|7点|10点|12点|18点)/.test(String(feedingPlan || ""));
}

function extractFeedingHints(input) {
  const text = `${input.feedingPlan || ""}\n${input.stageSummary || ""}`;
  const hints = [];

  if (/(啃咬|磨牙|骨头|玉米)/.test(text)) hints.push("啃咬硬物 · 长牙");
  if (/(小米油|五果粉|芝麻糊|玉米汁)/.test(text)) hints.push("加餐 · 小米油/五果粉/芝麻糊/玉米汁");
  if (/辅食宝/.test(text)) hints.push("辅食宝");

  return hints;
}

function extractCareHints(input) {
  const text = `${input.stageSummary || ""}\n${input.babyProfile || ""}\n${input.bathPlan || ""}`;
  const hints = [];

  if (/益生菌/.test(text)) hints.push("益生菌 · 调理肠道");
  if (/乳糖酶/.test(text)) hints.push("乳糖酶 · 观察大便");
  if (/(温敷|热敷)/.test(text)) hints.push("温敷肚子");
  if (/山茶油/.test(text)) hints.push("薄涂山茶油保湿");

  return hints;
}

function deriveGenericMealRows(feedingPlan) {
  const text = String(feedingPlan || "");

  return {
    morning: generalizeMeal(findMatchingSentence(text, /(早餐|上午|10点|7点)/)),
    noon: generalizeMeal(findMatchingSentence(text, /(中午|午餐|12点|15点|下午)/)),
    evening: generalizeMeal(findMatchingSentence(text, /(晚上|晚餐|18点|20点)/))
  };
}

function findMatchingSentence(text, pattern) {
  return String(text || "")
    .split(/[\n。；;]/)
    .map((item) => item.trim())
    .find((item) => pattern.test(item)) || "";
}

function parseDailyMeals(text) {
  const source = String(text || "");
  const matches = [...source.matchAll(/第\s*(\d+)\s*天[:：]?([\s\S]*?)(?=第\s*\d+\s*天[:：]?|$)/g)];
  return matches.map((match) => classifyMealBlock(match[2]));
}

function classifyMealBlock(block) {
  const result = { morning: "", noon: "", evening: "" };
  const segments = String(block)
    .split(/[\n；;。，,]/)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const segment of segments) {
    if (/(早餐|上午|7点|10点|^10[-:：])/.test(segment)) {
      result.morning = generalizeMeal(segment);
      continue;
    }
    if (/(中午|午餐|下午|12点|15点|^15[-:：])/.test(segment)) {
      result.noon = generalizeMeal(segment);
      continue;
    }
    if (/(晚上|晚餐|18点|20点|^18[-:：])/.test(segment)) {
      result.evening = generalizeMeal(segment);
    }
  }

  return result;
}

function generalizeMeal(segment) {
  const text = String(segment || "")
    .replace(/^\d{1,2}(?:[:：]\d{0,2})?(?:\s*-\s*\d{1,2}(?:[:：]\d{0,2})?)?/, "")
    .replace(/^(早餐|午餐|晚餐|上午|中午|晚上|下午)[:：]?/, "")
    .replace(/^第\d+天[:：]?/, "")
    .replace(/^吃几口/, "")
    .trim();

  if (!text) return "";

  const combinedExample = text.match(/粥\/面（例：([^/]+)\/([^)）]+)）/);
  if (combinedExample) {
    return `粥（例：${combinedExample[1].trim()}） / 面（例：${combinedExample[2].trim()}）`;
  }

  const preformatted = [...text.matchAll(/(面（例：[^）]+）|粥（例：[^）]+）|土豆泥\/蔬菜泥|啃咬|小米油|五果粉|芝麻糊|玉米汁)/g)]
    .map((match) => match[1]);
  if (preformatted.length) {
    return dedupe(preformatted).join(" / ");
  }

  if (/粥或面/.test(text)) return "粥/面";

  const parts = [];
  if (/(粥|米糊)/.test(text)) parts.push(extractCategoryExample(text, "粥"));
  if (/面/.test(text)) parts.push(extractCategoryExample(text, "面"));
  if (/(土豆泥|南瓜泥|泥)/.test(text)) parts.push("土豆泥/蔬菜泥");
  if (/小米油/.test(text)) parts.push("小米油");
  if (/五果粉/.test(text)) parts.push("五果粉");
  if (/芝麻糊/.test(text)) parts.push("芝麻糊");
  if (/玉米汁/.test(text)) parts.push("玉米汁");
  if (/啃咬/.test(text)) parts.push("啃咬");

  return dedupe(parts).join(" / ");
}

function extractCategoryExample(text, category) {
  const examples = String(text)
    .split(/[+、，,\s/]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.includes(category))
    .slice(0, 2);

  if (!examples.length) return category;
  return `${category}（例：${examples.join("/")}）`;
}

function normalizeRoutineLine(line) {
  const clean = normalizeRoutineSource(String(line || "").replace(/\s+/g, " ").trim());
  if (!clean) return "";

  const directHalfHourRangeMatch = clean.match(
    /^(约|大约)?\s*(早上|上午|中午|下午|晚上|夜间|夜里|凌晨)?\s*(\d{1,2})点?\s*-\s*(\d{1,2})点半(.*)$/i
  );
  if (directHalfHourRangeMatch) {
    const startHour = inferRoutineHour(
      adjustHourByPeriod(Number(directHalfHourRangeMatch[3]), directHalfHourRangeMatch[2]),
      directHalfHourRangeMatch[5] || "",
      directHalfHourRangeMatch[2]
    );
    const endHour = inferRoutineHour(
      adjustHourByPeriod(Number(directHalfHourRangeMatch[4]), directHalfHourRangeMatch[2], startHour),
      directHalfHourRangeMatch[5] || "",
      directHalfHourRangeMatch[2]
    );
    const action = summarizeRoutineAction(directHalfHourRangeMatch[5] || "");
    return action
      ? `${formatTime(startHour, 0)}-${formatTime(endHour, 30)} ${action}`
      : `${formatTime(startHour, 0)}-${formatTime(endHour, 30)}`;
  }

  const parsed = extractRoutineTime(clean);
  if (!parsed) {
    return summarizeRoutineAction(clean.replace(/[›>]+/g, "").trim());
  }

  const action = summarizeRoutineAction(parsed.action);
  return action ? `${parsed.time} ${action}` : parsed.time;
}

function normalizeRoutineSource(line) {
  return String(line || "")
    .replace(/(\d{1,2})-(\d{1,2})点半/g, "$1点-$2点半")
    .replace(/(\d{1,2})-(\d{1,2})点(?!半)/g, "$1点-$2点")
    .replace(/(\d{1,2})点半左右/g, "$1点半")
    .replace(/(\d{1,2})点左右/g, "$1点");
}

function extractRoutineTime(line) {
  const source = String(line || "")
    .replace(/[›>]+/g, "")
    .replace(/^(\d{1,2})\s*-\s*(\d{1,2})\s*点半/, "$1点-$2点半")
    .replace(/^(\d{1,2})\s*-\s*(\d{1,2})\s*点(?!半)/, "$1点-$2点")
    .trim();
  const halfHourRangeMatch = source.match(
    /^(约|大约)?\s*(早上|上午|中午|下午|晚上|夜间|夜里|凌晨)?\s*(\d{1,2})点\s*[-~到至]\s*(\d{1,2})点半\s*(左右)?(.*)$/i
  );
  if (halfHourRangeMatch) {
    const startHour = inferRoutineHour(
      adjustHourByPeriod(Number(halfHourRangeMatch[3]), halfHourRangeMatch[2]),
      halfHourRangeMatch[6] || "",
      halfHourRangeMatch[2]
    );
    const endHour = inferRoutineHour(
      adjustHourByPeriod(Number(halfHourRangeMatch[4]), halfHourRangeMatch[2], startHour),
      halfHourRangeMatch[6] || "",
      halfHourRangeMatch[2]
    );
    return {
      time: `${formatTime(startHour, 0)}-${formatTime(endHour, 30)}`,
      action: halfHourRangeMatch[6] || ""
    };
  }

  const rangeMatch = source.match(
    /^(约|大约)?\s*(早上|上午|中午|下午|晚上|夜间|夜里|凌晨)?\s*(\d{1,2})(?::|：)?(\d{0,2})?\s*(点半|点)?\s*[-~到至]\s*(\d{1,2})(?::|：)?(\d{0,2})?\s*(点半|点)?\s*(左右)?(.*)$/i
  );
  if (rangeMatch) {
    const startHour = inferRoutineHour(
      adjustHourByPeriod(Number(rangeMatch[3]), rangeMatch[2]),
      rangeMatch[10] || "",
      rangeMatch[2]
    );
    const startMinute = resolveMinute(rangeMatch[4], rangeMatch[5]);
    const endHour = inferRoutineHour(
      adjustHourByPeriod(Number(rangeMatch[6]), rangeMatch[2], startHour),
      rangeMatch[10] || "",
      rangeMatch[2]
    );
    const endMinute = resolveMinute(rangeMatch[7], rangeMatch[8]);
    return {
      time: `${formatTime(startHour, startMinute)}-${formatTime(endHour, endMinute)}`,
      action: rangeMatch[10] || ""
    };
  }

  const singleMatch = source.match(
    /^(约|大约)?\s*(早上|上午|中午|下午|晚上|夜间|夜里|凌晨)?\s*(\d{1,2})(?::|：)?(\d{0,2})?\s*(点半|点)?\s*(左右)?(.*)$/i
  );
  if (!singleMatch) return null;

  return {
    time: formatTime(
      inferRoutineHour(
        adjustHourByPeriod(Number(singleMatch[3]), singleMatch[2]),
        singleMatch[7] || "",
        singleMatch[2]
      ),
      resolveMinute(singleMatch[4], singleMatch[5])
    ),
    action: singleMatch[7] || ""
  };
}

function summarizeRoutineAction(action) {
  const clean = String(action || "")
    .replace(/^[，。；、:：\-\s]+/, "")
    .replace(/[。；]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return "";

  const sentence = clean.split(/[。；]/)[0].trim();
  const clauses = sentence.split(/，/).map((item) => item.trim()).filter(Boolean);
  if (clauses.length === 0) return sentence;

  const selected = [clauses[0]];
  if (clauses[1] && /^(饭后午觉|午觉约|饭后睡|哄睡|拍拍睡|夜里其他时间醒来拍拍睡为主)/.test(clauses[1])) {
    selected.push(clauses[1].replace(/（如果宝宝要喝奶，可以喂点）/g, ""));
  }

  return selected
    .join("，")
    .replace(/（如果宝宝要喝奶，可以喂点）/g, "")
    .replace(/，?(比如|那么|一直加到|一直到|发现宝宝|这餐奶不定量|不吃太饱|锻炼口腔|刺激长牙).*/g, "")
    .replace(/喝完奶后可以在床上和宝宝聊天、读绘本、按摩等/g, "")
    .replace(/左右左右/g, "左右")
    .replace(/ +/g, " ")
    .trim();
}

function resolveMinute(rawMinute, rawSuffix) {
  if (rawMinute != null && rawMinute !== "") return Number(rawMinute);
  if (rawSuffix === "点半") return 30;
  return 0;
}

function adjustHourByPeriod(hour, period, _referenceHour = hour) {
  if (!period) return hour;
  if (period === "凌晨") return hour;
  if ((period === "下午" || period === "晚上" || period === "夜间" || period === "夜里") && hour < 12) return hour + 12;
  if (period === "中午" && hour < 11) return hour + 12;
  return hour;
}

function inferRoutineHour(hour, action, period) {
  if (period) return hour;
  if (hour > 8) return hour;

  const text = String(action || "");
  if (/(哄睡|读绘本|床上|这餐奶|潮汐|夜里|拍拍睡)/.test(text)) {
    return hour + 12;
  }

  return hour;
}

function formatTime(hour, minute) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function splitStageSummary(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .split(/[\n。]/)
    .map((item) => cleanSentence(item))
    .filter((item) => item.length >= 6)
    .filter((item) => !/(御儿记|母婴健康管理中心|全国连锁|老店|支持|供应)/.test(item));
}

function summarizeFocusSentence(value) {
  const sentence = cleanSentence(value);
  if (!sentence) return "";

  if (/(山茶油|保湿)/.test(sentence)) return "皮肤问题以外排为主，薄涂山茶油保湿";
  if (/(泡药浴|泡瑶浴|肤包|寒包|退包|健包|健方)/.test(sentence)) return "坚持泡健瑶浴，提升阳气，帮助皮肤外排";
  if (/温敷肚子/.test(sentence)) return "";
  if (/(按到手冒烟|足量.*按摩|抚触按摩)/.test(sentence)) return "每日足量抚触按摩，按到手冒烟";
  if (/(趴睡|侧躺睡|侧躺|趴着睡)/.test(sentence)) return "可趴睡或侧躺睡，减少惊跳反射";
  if (/(白噪音|暗光)/.test(sentence)) return "用白噪音+暗光环境哄睡";
  if (/(户外|自然光|晒太阳)/.test(sentence)) return "坚持户外活动或阳台接触自然光";
  if (/(大便|皮肤).*观察/.test(sentence)) return "观察大便和皮肤情况，有异常及时反馈";
  if (/(42天|按需喂养)/.test(sentence)) return "42天左右猛长期按需喂养";
  if (/(肠道|大便有点稀|稍寒凉)/.test(sentence)) return "关注肠道调理和大便变化";
  return sentence;
}

function normalizeRows(values) {
  return dedupeRows(
    (Array.isArray(values) ? values : [])
      .map((item) => ({ text: cleanTask(item) }))
      .filter((item) => item.text)
  );
}

function normalizeFeedingTask(text) {
  if (!text) return "";
  if (/(啃咬|磨牙|骨头|玉米)/.test(text)) return "啃咬硬物 · 长牙";
  if (/(小米油|五果粉|芝麻糊|玉米汁)/.test(text)) return "加餐 · 小米油/五果粉/芝麻糊/玉米汁";
  if (/辅食宝/.test(text)) return "辅食宝";
  return cleanTask(text);
}

function normalizeCareTask(text) {
  if (!text) return "";
  if (/(泡瑶浴|瑶浴)/.test(text)) return "泡健瑶浴";
  if (/益生菌/.test(text)) return "益生菌 · 调理肠道";
  if (/乳糖酶/.test(text)) return "乳糖酶 · 观察大便";
  if (/山茶油/.test(text)) return "薄涂山茶油保湿";
  if (/(按摩|抚触|洗澡)/.test(text)) return "";
  if (/(大便|皮肤|湿疹|红疹)/.test(text)) return "";
  return cleanTask(text);
}

function normalizeExerciseTask(text) {
  if (/(按摩|抚触)/.test(text)) return "抚触按摩";
  if (/俯趴/.test(text)) return "俯趴练习";
  if (/户外/.test(text)) return "户外活动";
  return cleanTask(text);
}

function normalizeSleepTask(text) {
  if (/回笼觉/.test(text)) return "回笼觉";
  if (/(晨觉|上午)/.test(text)) return "上午小睡";
  if (/(午觉|午睡)/.test(text)) return "午觉（约2小时）";
  if (/(黄昏觉|下午)/.test(text)) return "黄昏小睡1.5-2小时";
  if (/(夜|哄睡)/.test(text)) return "夜间哄睡";
  return cleanTask(text);
}

function isInfantMode(input, babyCard) {
  const ageText = babyCard.ageText || "";
  const months = parseAgeMonths(ageText);
  return months < 6 || /辅食添加：未/.test(String(input.babyProfile || ""));
}

function parseAgeMonths(value) {
  const text = String(value || "");
  const ymd = text.match(/(\d+)Y(\d+)M/i);
  if (ymd) return Number(ymd[1]) * 12 + Number(ymd[2]);
  const month = text.match(/(\d+)月/);
  if (month) return Number(month[1]);
  const m = text.match(/(\d+)M/i);
  if (m) return Number(m[1]);
  return 99;
}

function isMealLikeText(text) {
  return /(早餐|午餐|晚餐|上午|中午|晚上|三餐辅食|7点|10点|12点|15点|18点|20点)/.test(String(text || ""));
}

function cleanTask(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^第\s*\d+\s*天[:：]?\s*/, "")
    .replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "")
    .replace(/[。；].*$/, "")
    .trim();
}

function cleanSentence(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "")
    .replace(/^\d+[.、]\s*/, "")
    .trim();
}

function dedupe(values) {
  return [...new Set(values)];
}

function dedupeRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row.slotLabel || ""}|${row.text}`;
    if (!row.text || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findFirst(values, regex) {
  return values.find((item) => regex.test(item)) || "";
}

function orderScore(text, order) {
  const index = order.findIndex((item) => text.startsWith(item));
  return index === -1 ? order.length + 1 : index;
}
