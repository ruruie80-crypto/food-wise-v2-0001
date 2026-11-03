import type { MealMode } from "./types";

/** 子どもの量。大人1人分に対する割合。年齢が分かるまで仮の値。 */
export const CHILD_PORTION = 0.6;

export const TOME_MONTHLY_BUDGET = 80_000;

/** 週の食費の上限。月8万円は約18,700円なので、これまでの2万円より少し広く取る。 */
export const MAX_WEEKLY_BUDGET = 40_000;

export const FATTY_MEAT_IDS = ["pork", "pork_hiki", "chicken_t"];

export const TOME_PRESET: {
  adults: number;
  children: number;
  monthlyBudget: number;
  budget: number;
  mode: MealMode;
} = {
  adults: 2,
  children: 2,
  monthlyBudget: TOME_MONTHLY_BUDGET,
  budget: 18_700,
  mode: "dinner_breakfast",
};

/** 月の食費を、30日で割って7日分にし、100円単位にそろえる。 */
export function weeklyFromMonthly(monthly: number): number {
  if (!Number.isFinite(monthly) || monthly <= 0) return 0;
  return Math.round(((monthly / 30) * 7) / 100) * 100;
}

export function householdServings(adults: number, children: number): number {
  const value = adults + children * CHILD_PORTION;
  return Math.round(value * 10) / 10;
}

export function describeHousehold(adults: number, children: number): string {
  const servings = householdServings(adults, children);
  if (children <= 0) return `大人${adults}人`;
  return `大人${adults}人・子ども${children}人（合わせて${servings}人分）`;
}
