import type { MealMode } from "./types";

/** 小学生以下。大人1人分に対する割合。 */
export const YOUNG_CHILD_PORTION = 0.6;

/** 中学生以上。大人と同じ量。 */
export const TEEN_CHILD_PORTION = 1;

/** これまでの呼び方。小学生以下の 0.6。 */
export const CHILD_PORTION = YOUNG_CHILD_PORTION;

export type ChildStage = "young" | "teen";

export type BudgetScope = "unset" | "food" | "all";

export type ThighPolicy = "unset" | "avoid" | "allow";

export type DairyPolicy = "unset" | "milkOnly" | "allDairy";

export const OTHER_DAIRY_IDS = ["cheese", "yogurt", "butter", "cream"];

export const TOME_MONTHLY_BUDGET = 80_000;

/** 月を週にならすときの日数。30日だと少し多くなる。 */
export const DAYS_PER_MONTH = 30.4;

/** 週の食費の上限。家族の月8万円が収まる幅。 */
export const MAX_WEEKLY_BUDGET = 40_000;

export const FATTY_MEAT_IDS = ["pork", "pork_hiki", "chicken_t"];

/** 週に1回は入れたい料理。登米の献立だけで使う。 */
export const WEEKLY_DISHES = ["hamburg", "soboro"];

export const TOME_PRESET: {
  adults: number;
  children: number;
  childStage: ChildStage;
  monthlyBudget: number;
  budget: number;
  mode: MealMode;
  lessFat: boolean;
  noMilk: boolean;
} = {
  adults: 2,
  children: 2,
  childStage: "teen",
  monthlyBudget: TOME_MONTHLY_BUDGET,
  budget: 0,
  mode: "dinner_breakfast",
  lessFat: true,
  noMilk: true,
};

TOME_PRESET.budget = weeklyFromMonthly(TOME_PRESET.monthlyBudget);

export function childPortion(stage: ChildStage): number {
  return stage === "teen" ? TEEN_CHILD_PORTION : YOUNG_CHILD_PORTION;
}

/** 月の食費を、30.4日で割って7日分にし、100円単位にそろえる。 */
export function weeklyFromMonthly(monthly: number): number {
  if (!Number.isFinite(monthly) || monthly <= 0) return 0;
  return Math.round(((monthly / DAYS_PER_MONTH) * 7) / 100) * 100;
}

export function householdServings(adults: number, children: number, stage: ChildStage = "young"): number {
  const value = adults + children * childPortion(stage);
  return Math.round(value * 10) / 10;
}

export function describeHousehold(adults: number, children: number, stage: ChildStage = "young"): string {
  const servings = householdServings(adults, children, stage);
  if (children <= 0) return `大人${adults}人`;
  if (stage === "teen") return `大人${adults}人・中学生${children}人（大人と同じ量、合わせて${servings}人分）`;
  return `大人${adults}人・子ども${children}人（小学生以下は大人の0.6人分、合わせて${servings}人分）`;
}

export function fattyIds(allowSkinlessThigh: boolean): string[] {
  return allowSkinlessThigh ? FATTY_MEAT_IDS.filter((id) => id !== "chicken_t") : [...FATTY_MEAT_IDS];
}
