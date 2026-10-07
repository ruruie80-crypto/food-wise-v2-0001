import type { Ingredient, MealMode, MealType, Nutrition } from "./types";

export function yen(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export function trimNum(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatUnits(units: number, ingredient: Ingredient): string {
  if (ingredient.unitKind === "grams100") {
    return `${Math.round(units * 100)}g`;
  }
  if (ingredient.unitKind === "halfGo") {
    return `${trimNum(units * 0.5)}合`;
  }
  if (ingredient.unitKind === "tbsp") {
    return `大さじ${trimNum(units)}`;
  }
  return `${trimNum(units)}${ingredient.unitSuffix}`;
}

export function formatNutrition(nutrition: Nutrition): string {
  return `${Math.round(nutrition.kcal)}kcal · たんぱく質${trimNum(nutrition.protein)}g`;
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function signedPercent(delta: number): string {
  const points = Math.round(delta * 100);
  if (points === 0) return "±0%";
  return `${points > 0 ? "+" : ""}${points}%`;
}

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "朝",
  lunch: "昼",
  dinner: "夜",
};

export function mealLabel(meal: MealType): string {
  return MEAL_LABEL[meal];
}

export const MODE_LABEL: Record<MealMode, string> = {
  dinner: "夕食のみ",
  dinner_breakfast: "朝と夕食",
  full: "朝昼夕",
};

export function modeHint(mode: MealMode): string {
  if (mode === "dinner") return "夕食だけの食費です。";
  if (mode === "full") return "朝昼夕をすべてこの予算で組みます。";
  return "朝と夜の食費です。昼は入っていません。";
}

export function budgetHint(people: number, mode: MealMode): number {
  const perPerson = mode === "full" ? 8500 : mode === "dinner" ? 4000 : 5500;
  return Math.round((people * perPerson) / 100) * 100;
}

export function balanceScore(nutrition: Nutrition, targets: Nutrition): number {
  const keys = ["protein", "veg", "fiber", "kcal"] as const;
  const weights = { protein: 0.34, veg: 0.34, fiber: 0.16, kcal: 0.16 };
  let score = 0;
  let weight = 0;
  for (const key of keys) {
    if (targets[key] <= 0) continue;
    const ratio = nutrition[key] / targets[key];
    const fit = key === "kcal" ? 1 - Math.min(1, Math.abs(ratio - 1)) : Math.min(1, ratio);
    score += fit * weights[key];
    weight += weights[key];
  }
  if (targets.salt > 0) {
    const saltFit =
      nutrition.salt <= targets.salt
        ? 1
        : Math.max(0, 1 - (nutrition.salt - targets.salt) / targets.salt);
    score += saltFit * 0.1;
    weight += 0.1;
  }
  if (weight === 0) return 0;
  return Math.round((score / weight) * 100);
}
