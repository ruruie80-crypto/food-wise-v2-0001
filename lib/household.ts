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

/** 週に1回は入れたい料理。登米の献立だけで使う。ハンバーグはここだけ。 */
export const WEEKLY_DISHES = ["hamburg", "soboro"];

/**
 * 同じ夜の皿は週1回。この配列だけ週2回まで。
 * 今は冷奴のような、安い豆腐の定番。お姉さんの答えで、この配列だけ変える。
 */
export const TWICE_A_WEEK_DISHES = ["hiyayakko"];

/**
 * 卵は10個入り。お姉さんの答えが来るまでは、底値を優先してこのパック数まで。
 * 3だと卵丼やにら玉が外れ、買い物が高くなった。
 */
export const EGGS_PER_PACK = 10;
export const MAX_WEEKLY_EGG_PACKS = 5;

/** この中でいちばん安い皿を、週に1回は残す。 */
export const CHEAP_EGG_DISHES = ["niratama", "tamago-don"];

/** 卵を減らすとき、卵のない朝（豆腐と味噌汁）はここまで繰り返してよい。 */
export const EGG_FREE_MEAL_CAP = 4;

/**
 * 納豆定食と冷奴の卵。設定が「する」のときだけ、買い物と献立の金額に足す。
 * 初期は「しない」。
 */
export const INCLUDE_OPTIONAL_EGGS = false;
export const OPTIONAL_EGG_RECIPES = ["natto-set", "hiyayakko"];

const EGG_CHOICE_SENTENCE = "卵をのせるかは、献立の設定「納豆・冷奴に卵をのせる」で選びます。";

/** 献立の「魚を除く」が外す品。 */
export const FISH_IDS = ["salmon", "aji", "sardine", "mackerel"];

export function avoidsFish(excludes: string[]): boolean {
  return FISH_IDS.some((id) => excludes.includes(id));
}

/** だし入り味噌には魚が入っていることがある。魚を除くときだけ言い換える。 */
export function plainMisoText(text: string, fishAside: boolean): string {
  if (!fishAside || !text.includes("味噌")) return text;
  return text
    .replaceAll("味噌汁", "\u0000汁")
    .replaceAll("味噌", "だし入りでない味噌")
    .replaceAll("\u0000汁", "だし入りでない味噌の汁");
}

/** 魚を除くときの豆腐の朝ごはん。料理名はここだけ決める。 */
export const PLAIN_MISO_DISH_NAME = "豆腐の味噌汁（だし入りでない味噌）";

export function displayRecipeName(recipe: { id: string; name?: string }, fishAside: boolean): string {
  const name = recipe.name ?? "";
  if (!fishAside) return name;
  if (recipe.id === "tofu-morning") return PLAIN_MISO_DISH_NAME;
  return plainMisoText(name, true);
}

/** 卵を除いているときは、おまけの卵を「設定で選ぶ」と書かない。魚を除くときは味噌の書き方を変える。 */
export function recipeCopy<T extends { id: string; summary: string; steps: string[]; name?: string }>(
  recipe: T,
  eggsAside: boolean,
  fishAside = false,
): T {
  let summary = recipe.summary;
  let steps = recipe.steps;
  let name = recipe.name;
  if (eggsAside && OPTIONAL_EGG_RECIPES.includes(recipe.id)) {
    const swap = (text: string) => text.replaceAll(EGG_CHOICE_SENTENCE, "卵はのせません。");
    summary = swap(summary);
    steps = steps.map(swap);
  }
  if (fishAside) {
    summary = plainMisoText(summary, true);
    steps = steps.map((step) => plainMisoText(step, true));
    if (name != null) name = displayRecipeName(recipe, true);
  }
  return { ...recipe, summary, steps, name };
}

export type EggToppingPolicy = "avoid" | "allow";

/** 卵をのせないときの目安。5パックまでは許すが、初期の献立はここに収める。 */
export const QUIET_EGG_TARGET = 36;

export function usedItems<T extends { ingredientId: string }>(
  recipeId: string,
  items: T[],
  allowOptionalEggs = INCLUDE_OPTIONAL_EGGS,
): T[] {
  if (allowOptionalEggs || !OPTIONAL_EGG_RECIPES.includes(recipeId)) return items;
  return items.filter((item) => item.ingredientId !== "egg");
}

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
  if (stage === "teen") return `大人${adults}人・中学生以上${children}人（仮に大人と同じ量、合わせて${servings}人分）`;
  return `大人${adults}人・小学生以下${children}人（仮に大人の0.6人分、合わせて${servings}人分）`;
}

export function fattyIds(allowSkinlessThigh: boolean): string[] {
  return allowSkinlessThigh ? FATTY_MEAT_IDS.filter((id) => id !== "chicken_t") : [...FATTY_MEAT_IDS];
}
