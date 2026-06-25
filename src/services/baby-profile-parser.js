export function extractBabyCard(profileText = "") {
  const text = String(profileText || "");
  const babySection = sliceSection(text, "宝宝信息：", ["出生后是否住院：", "喂养史：", "第一次连线时间"]);

  const birthDate = normalizeDateText(captureField(babySection, "出生年月日：", ["昵称：", "性别："]));
  const ageText = normalizeAgeText(captureField(babySection, "目前月龄", ["目前体重", "目前身高", "带养人、带睡人："]));
  const feedingType = deriveFeedingType(text);
  const birthWeight = cleanValue(captureField(babySection, "出生体重", ["出生身高", "目前月龄"]));
  const birthHeight = cleanValue(captureField(babySection, "出生身高", ["目前月龄", "目前体重"]));
  const stool = cleanSummary(captureField(babySection, "大便：", ["皮肤情况：", "出生后是否住院："]));
  const skin = cleanSummary(captureField(babySection, "皮肤情况：", ["出生后是否住院：", "喂养史："]));

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

  const match = raw.match(/(\d{4})[.\/年-](\d{1,2})[.\/月-](\d{1,2})/);
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
    .replace(/[。；，,]*$/, "")
    .trim();
}

function cleanSummary(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[。]*$/, "")
    .trim();
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
