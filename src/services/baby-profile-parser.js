export function extractBabyCard(profileText = "") {
  const text = String(profileText || "");
  const babySection = sliceSection(text, "宝宝信息：", ["出生后是否住院：", "喂养史：", "第一次连线时间"]);

  const birthDate = normalizeDateText(captureField(babySection, "出生年月日：", ["昵称：", "性别："]));
  const ageText = normalizeAgeText(captureField(babySection, "目前月龄", ["目前体重", "目前身高", "带养人、带睡人："]));
  const feedingType = deriveFeedingType(text);
  const birthWeight = cleanValue(captureField(babySection, "出生体重", ["出生身高", "目前月龄"]));
  const birthHeight = cleanValue(captureField(babySection, "出生身高", ["目前月龄", "目前体重"]));
  const stool = summarizeDescriptiveField(captureField(babySection, "大便：", ["皮肤情况：", "出生后是否住院："]), "stool");
  const skin = summarizeDescriptiveField(captureField(babySection, "皮肤情况：", ["出生后是否住院：", "喂养史："]), "skin");

  return {
    birthDate,
    ageText,
    feedingType,
    birthWeight,
    birthHeight,
    stool,
    skin
  };
}

function deriveFeedingType(text) {
  const feedingHistoryBlock = captureField(text, "喂养史：", ["辅食添加：", "第一次", "第一次连线时间"]);
  const feedingHistory = matchFirst(feedingHistoryBlock, [/(母乳|混合|配方奶)/]);
  const formula = matchFirst(text, [/(适度水解|深度水解|低体重奶粉|配方奶)/]);
  const hasComplementary = !/辅食添加：\s*未/.test(text) && /辅食/.test(text);

  if (feedingHistory === "母乳") return hasComplementary ? "母乳+辅食" : "母乳";
  if (feedingHistory === "混合") return hasComplementary ? "混合+辅食" : "混合喂养";
  if (feedingHistory === "配方奶") return hasComplementary ? `${formula || "配方奶"}+辅食` : (formula || "配方奶");
  return formula || "";
}

function normalizeDateText(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const match = raw.match(/(\d{4})[.\/年](\d{1,2})[.\/月](\d{1,2})/);
  if (!match) return raw;

  return `${match[1]}/${match[2].padStart(2, "0")}/${match[3].padStart(2, "0")}`;
}

function normalizeAgeText(value) {
  const raw = String(value || "").replace(/\s+/g, "").trim();
  if (!raw) return "";

  const direct = raw.match(/(\d+)月(\d+)天/);
  if (direct) return `${direct[1]}月${direct[2]}天`;

  const ymd = raw.match(/(\d+)Y(\d+)M(\d+)D/i);
  if (ymd) return `${ymd[1]}Y${ymd[2]}M${ymd[3]}D`;

  return raw;
}

function cleanValue(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[。；，、]*$/, "")
    .trim();
}

function summarizeDescriptiveField(value, type) {
  const raw = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/（?大便、皮肤皮疹拍照发给助教老师）?/g, "")
    .replace(/拍照发给助教老师/g, "")
    .replace(/[。；，、]*$/, "")
    .trim();

  if (!raw) return "";

  const clauses = raw
    .split(/[。；]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => item.split(/(?=一天\d+次左右|一天\d+-\d+次|每日\d+次|大便|脸上|身上|四肢|肛周|下眼睑)/))
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/助教老师|拍照/.test(item));

  const normalized = dedupe(
    clauses.map((item) => item.replace(/^大便[:：]?\s*/g, "").replace(/^皮肤情况[:：]?\s*/g, "").trim())
  );

  if (type === "stool") {
    return normalized
      .sort((a, b) => scoreStoolClause(a) - scoreStoolClause(b))
      .join("，")
      .replace(/，+/g, "，")
      .trim();
  }

  return normalized
    .sort((a, b) => scoreSkinClause(a) - scoreSkinClause(b))
    .join("，")
    .replace(/，+/g, "，")
    .trim();
}

function scoreStoolClause(text) {
  if (/一天|每日|\d+次/.test(text)) return 0;
  if (/粘液|黏液|稀便|偏稀|偏干|裂纹|前干后软|不成型|软便|成型/.test(text)) return 1;
  return 2;
}

function scoreSkinClause(text) {
  if (/下眼睑|脸上|身上|四肢|肛周/.test(text)) return 0;
  if (/泛红|红疹|湿疹|结痂|反复/.test(text)) return 1;
  return 2;
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function matchFirst(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function captureField(text, startLabel, endLabels) {
  const source = String(text || "");
  const start = source.indexOf(startLabel);
  if (start === -1) return "";

  const from = start + startLabel.length;
  let end = source.length;

  for (const label of endLabels) {
    const index = source.indexOf(label, from);
    if (index !== -1 && index < end) end = index;
  }

  return source.slice(from, end).trim();
}

function sliceSection(text, startLabel, endLabels) {
  const source = String(text || "");
  const start = source.indexOf(startLabel);
  if (start === -1) return source;

  const from = start + startLabel.length;
  let end = source.length;

  for (const label of endLabels) {
    const index = source.indexOf(label, from);
    if (index !== -1 && index < end) end = index;
  }

  return source.slice(from, end);
}
