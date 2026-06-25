const DEFAULT_STAR = "⭐";

export function normalizeBabyStars(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return DEFAULT_STAR;

  if (/^[⭐]+$/.test(raw)) {
    return raw;
  }

  const numberMatch = raw.match(/\d+/);
  if (numberMatch) {
    const count = Math.max(1, Math.min(Number(numberMatch[0]), 5));
    return "⭐".repeat(count);
  }

  return raw.includes("⭐") ? raw : DEFAULT_STAR;
}

export function buildDisplayTitle(babyName, babyStars) {
  return `御儿记VIP宝宝带养 · ${babyName}专属作息打卡表${normalizeBabyStars(babyStars)}`;
}

export function buildFileBaseName(babyName, babyStars) {
  return buildDisplayTitle(babyName, babyStars);
}
