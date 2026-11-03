import { getIngredient, getRecipe, recipes } from "./catalog";
import { percent, yen } from "./format";
import { fattyIds } from "./household";
import type {
  MealMode,
  MealType,
  Nutrition,
  Plan,
  PlanSlot,
  Prefs,
  Recipe,
  StockItem,
} from "./types";

export type PriceLookup = {
  priceOf(ingredientId: string): number;
  isBuy(ingredientId: string): boolean;
};

export type PlanInput = {
  budget: number;
  people: number;
  days: number;
  mode: MealMode;
  prefs: Prefs;
  excludes: string[];
  sourceKey?: string;
  /** 冷蔵庫・冷凍庫。空なら献立の選び方はこれまでと同じ。 */
  stock?: StockItem[];
  /** 週に1回は入れる料理。空なら献立の中身はこれまでと同じ。 */
  weeklyDishes?: string[];
  /** 中学生以上がいるとき、一人前を1未満にしない。 */
  fullPortions?: boolean;
};

const ZERO: Nutrition = {
  kcal: 0,
  protein: 0,
  fat: 0,
  carb: 0,
  fiber: 0,
  salt: 0,
  veg: 0,
};

const PER_MEAL: Record<MealType, Nutrition> = {
  breakfast: { kcal: 380, protein: 12, fat: 12, carb: 55, fiber: 2, salt: 1.7, veg: 0 },
  lunch: { kcal: 520, protein: 16, fat: 14, carb: 75, fiber: 4, salt: 2.2, veg: 80 },
  dinner: { kcal: 650, protein: 24, fat: 18, carb: 85, fiber: 5.5, salt: 3.1, veg: 140 },
};

const FILL_ORDER: Record<MealMode, MealType[]> = {
  dinner: ["dinner"],
  dinner_breakfast: ["dinner", "breakfast"],
  full: ["dinner", "lunch", "breakfast"],
};

const DISPLAY_RANK: Record<MealType, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
};

function add(a: Nutrition, b: Nutrition): Nutrition {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carb: a.carb + b.carb,
    fiber: a.fiber + b.fiber,
    salt: a.salt + b.salt,
    veg: a.veg + b.veg,
  };
}

function scale(nutrition: Nutrition, factor: number): Nutrition {
  return {
    kcal: nutrition.kcal * factor,
    protein: nutrition.protein * factor,
    fat: nutrition.fat * factor,
    carb: nutrition.carb * factor,
    fiber: nutrition.fiber * factor,
    salt: nutrition.salt * factor,
    veg: nutrition.veg * factor,
  };
}

export function recipeNutrition(recipe: Recipe, people: number, portion = 1): Nutrition {
  let total = scale(ZERO, 0);
  for (const item of recipe.items) {
    const ingredient = getIngredient(item.ingredientId);
    if (!ingredient) continue;
    const grams = item.units * ingredient.gramsPerUnit * people * portion;
    const factor = grams / 100;
    total = add(total, scale(ingredient.per100g, factor));
  }
  total.salt += recipe.extraSalt * people * portion;
  return total;
}

export function recipeCost(
  recipe: Recipe,
  people: number,
  priceOf: PriceLookup["priceOf"],
  portion = 1,
): number {
  const food = recipe.items.reduce((sum, item) => {
    const price = priceOf(item.ingredientId);
    const units = item.units * people * portion;
    if (!Number.isFinite(price)) return sum + Math.round(100000 * units);
    return sum + Math.round(price * units);
  }, 0);
  return food + Math.round(recipe.extraYen * people * portion);
}

function anchorBudget(people: number, mode: MealMode): number {
  const perPerson = mode === "full" ? 9800 : mode === "dinner" ? 4200 : 5000;
  return perPerson * people;
}

function portionFor(budget: number, people: number, mode: MealMode, fullPortions = false): number {
  const ratio = budget / anchorBudget(people, mode);
  const floor = fullPortions ? 1 : 0.78;
  return Math.round(Math.min(1.28, Math.max(floor, ratio)) * 100) / 100;
}

function zeroNutrition(): Nutrition {
  return { ...ZERO };
}

type Slot = { dayIndex: number; meal: MealType };

function buildSlots(days: number, mode: MealMode): Slot[] {
  const slots: Slot[] = [];
  for (const meal of FILL_ORDER[mode]) {
    for (let day = 0; day < days; day += 1) slots.push({ dayIndex: day, meal });
  }
  return slots;
}

function targetsFor(slots: Slot[], people: number): Nutrition {
  return slots.reduce(
    (total, slot) => add(total, scale(PER_MEAL[slot.meal], people)),
    zeroNutrition(),
  );
}

export function dayTarget(mode: MealMode, people = 1): Nutrition {
  return FILL_ORDER[mode].reduce(
    (total, meal) => add(total, scale(PER_MEAL[meal], people)),
    zeroNutrition(),
  );
}

export function isRecipeAllowed(
  recipe: Recipe,
  meal: MealType,
  prefs: Prefs,
  excludes: string[],
): boolean {
  if (!recipe.meals.includes(meal)) return false;
  if (recipe.items.some((item) => excludes.includes(item.ingredientId))) return false;
  if (prefs.lessFat && recipe.items.some((item) => fattyIds(Boolean(prefs.allowSkinlessThigh)).includes(item.ingredientId))) {
    return false;
  }
  if (
    prefs.noMilk &&
    (recipe.usesMilk === true || recipe.items.some((item) => item.ingredientId === "milk"))
  ) {
    return false;
  }
  return true;
}

function allowedRecipes(meal: MealType, prefs: Prefs, excludes: string[]): Recipe[] {
  let list = recipes.filter((recipe) => isRecipeAllowed(recipe, meal, prefs, excludes));
  if (prefs.quick && meal === "dinner") {
    const quick = list.filter((recipe) => recipe.minutes <= 20);
    if (quick.length >= 4) list = quick;
  }
  return list;
}

function repeatCap(meal: MealType, poolSize: number, goal: "balanced" | "cheap"): number {
  if (poolSize <= 2) return 99;
  if (meal === "breakfast") return 2;
  if (goal === "cheap") return 3;
  return 2;
}

type Beam = {
  picks: string[];
  cost: number;
  nutrition: Nutrition;
  used: Record<string, number>;
  score: number;
};

function nutritionPoints(nutrition: Nutrition, meal: MealType, prefs: Prefs): number {
  const target = PER_MEAL[meal];
  const part = (value: number, goal: number, weight: number) => {
    if (goal <= 0) return 0;
    const ratio = value / goal;
    if (ratio >= 1) return weight * Math.min(1.12, 1 + (ratio - 1) * 0.12);
    return weight * ratio;
  };
  let score = part(nutrition.protein, target.protein, prefs.highProtein ? 48 : 36);
  score += part(nutrition.veg, target.veg, prefs.moreVeg ? 50 : 40);
  score += part(nutrition.fiber, target.fiber, 16);
  score += part(nutrition.kcal, target.kcal, 14);
  if (nutrition.salt > target.salt * 1.2) score -= (nutrition.salt - target.salt) * 5;
  return score;
}

function stockOf(items: StockItem[] | undefined): Map<string, number> {
  const stock = new Map<string, number>();
  for (const item of items ?? []) {
    if (item.units <= 0) continue;
    stock.set(item.ingredientId, (stock.get(item.ingredientId) ?? 0) + item.units);
  }
  return stock;
}

function stockPoints(recipe: Recipe, stock: Map<string, number>): number {
  if (stock.size === 0) return 0;
  let points = 0;
  for (const item of recipe.items) {
    const have = stock.get(item.ingredientId) ?? 0;
    if (have <= 0) continue;
    const ingredient = getIngredient(item.ingredientId);
    if (!ingredient || ingredient.category === "seasoning") continue;
    const cover = Math.min(1, have / Math.max(item.units, 0.01));
    points += 28 * cover;
  }
  return points;
}

function marginalScore(
  recipe: Recipe,
  nutrition: Nutrition,
  cost: number,
  meal: MealType,
  goal: "balanced" | "cheap",
  prefs: Prefs,
  isBuy: PriceLookup["isBuy"],
  coeff: number,
  stock: Map<string, number>,
): number {
  const fromStock = stockPoints(recipe, stock);
  if (goal === "cheap") {
    const floor = meal === "breakfast" ? 250 : meal === "lunch" ? 380 : 420;
    return -cost - (nutrition.kcal < floor ? 400 : 0) + fromStock;
  }
  let score = nutritionPoints(nutrition, meal, prefs) - cost * coeff + fromStock;
  if (prefs.washoku && recipe.tags.includes("washoku")) score += 8;
  if (prefs.quick && recipe.minutes <= 15) score += 8;
  const buyCount = recipe.items.filter((item) => isBuy(item.ingredientId)).length;
  score += buyCount * 11;
  return score;
}

function search(
  slots: Slot[],
  budget: number,
  people: number,
  prefs: Prefs,
  excludes: string[],
  lookup: PriceLookup,
  goal: "balanced" | "cheap",
  portion: number,
  coeff: number,
  stock: Map<string, number>,
): { picks: string[]; cost: number } | null {
  const pools = new Map<MealType, Recipe[]>();
  for (const meal of new Set(slots.map((slot) => slot.meal))) {
    const pool = allowedRecipes(meal, prefs, excludes);
    if (pool.length === 0) return null;
    pools.set(meal, pool);
  }

  const costOf = (recipe: Recipe) => recipeCost(recipe, people, lookup.priceOf, portion);

  let beam: Beam[] = [
    { picks: [], cost: 0, nutrition: zeroNutrition(), used: {}, score: 0 },
  ];

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const pool = pools.get(slot.meal) ?? [];
    const cap = repeatCap(slot.meal, pool.length, goal);
    const futureMin = slots.slice(index + 1).reduce((sum, future) => {
      const futurePool = pools.get(future.meal) ?? [];
      const cheapest = Math.min(...futurePool.map(costOf));
      return sum + (Number.isFinite(cheapest) ? cheapest : 0);
    }, 0);
    const next: Beam[] = [];

    for (const state of beam) {
      const fitting: Recipe[] = [];
      const fallback: Recipe[] = [];
      for (const recipe of pool) {
        const times = state.used[recipe.id] ?? 0;
        if (times >= cap) continue;
        fallback.push(recipe);
        const cost = costOf(recipe);
        if (state.cost + cost + futureMin <= budget + 0.5) fitting.push(recipe);
      }
      const options = fitting.length > 0 ? fitting : fallback.sort((a, b) => costOf(a) - costOf(b)).slice(0, 2);
      for (const recipe of options) {
        const cost = costOf(recipe);
        const nutrition = recipeNutrition(recipe, people, portion);
        const times = state.used[recipe.id] ?? 0;
        const sameAsPrevious = state.picks[state.picks.length - 1] === recipe.id;
        next.push({
          picks: [...state.picks, recipe.id],
          cost: state.cost + cost,
          nutrition: add(state.nutrition, nutrition),
          used: { ...state.used, [recipe.id]: times + 1 },
          score:
            state.score +
            marginalScore(recipe, nutrition, cost, slot.meal, goal, prefs, lookup.isBuy, coeff, stock) -
            (goal === "balanced" && sameAsPrevious ? 18 : 0),
        });
      }
    }

    if (next.length === 0) return null;
    next.sort(
      (a, b) => b.score - a.score || a.cost - b.cost || a.picks.join(".").localeCompare(b.picks.join(".")),
    );
    beam = next.slice(0, 24);
  }

  const best = beam[0];
  return { picks: best.picks, cost: best.cost };
}

function repair(
  picks: string[],
  slots: Slot[],
  budget: number,
  people: number,
  prefs: Prefs,
  excludes: string[],
  lookup: PriceLookup,
  portion: number,
): string[] {
  const pools = new Map<MealType, Recipe[]>();
  for (const meal of new Set(slots.map((slot) => slot.meal))) {
    pools.set(meal, allowedRecipes(meal, prefs, excludes));
  }
  const costOf = (recipeId: string) => {
    const recipe = getRecipe(recipeId);
    return recipe ? recipeCost(recipe, people, lookup.priceOf, portion) : 100000;
  };
  const current = [...picks];
  let cost = current.reduce((sum, id) => sum + costOf(id), 0);
  for (let guard = 0; guard < 48 && cost > budget; guard += 1) {
    let best: { index: number; id: string; cost: number } | null = null;
    for (let index = 0; index < current.length; index += 1) {
      const pool = pools.get(slots[index].meal) ?? [];
      for (const recipe of pool) {
        if (recipe.id === current[index]) continue;
        const trial = [...current];
        trial[index] = recipe.id;
        const trialCost = trial.reduce((sum, id) => sum + costOf(id), 0);
        if (trialCost < cost && (best == null || trialCost < best.cost)) {
          best = { index, id: recipe.id, cost: trialCost };
        }
      }
    }
    if (!best) break;
    current[best.index] = best.id;
    cost = best.cost;
  }
  return current;
}

function materialize(
  picks: string[],
  slots: Slot[],
  input: PlanInput,
  lookup: PriceLookup,
  focus: "balanced" | "cheap",
  targets: Nutrition,
  portion: number,
): Plan {
  const people = input.people;
  const planSlots: PlanSlot[] = picks.map((recipeId, index) => {
    const recipe = getRecipe(recipeId);
    return {
      dayIndex: slots[index].dayIndex,
      meal: slots[index].meal,
      recipeId,
      cost: recipe ? recipeCost(recipe, people, lookup.priceOf, portion) : 0,
    };
  });
  planSlots.sort(
    (a, b) => a.dayIndex - b.dayIndex || DISPLAY_RANK[a.meal] - DISPLAY_RANK[b.meal],
  );
  const nutrition = planSlots.reduce((total, slot) => {
    const recipe = getRecipe(slot.recipeId);
    return recipe ? add(total, recipeNutrition(recipe, people, portion)) : total;
  }, zeroNutrition());
  const cost = planSlots.reduce((sum, slot) => sum + slot.cost, 0);
  return {
    focus,
    budget: input.budget,
    people,
    days: input.days,
    mode: input.mode,
    slots: planSlots,
    cost,
    overBy: Math.max(0, cost - input.budget),
    nutrition,
    targets,
    notes: [],
    sourceKey: input.sourceKey ?? "",
    portion,
  };
}

function buildNotes(balanced: Plan, cheap: Plan, lookup: PriceLookup): string[] {
  const notes: string[] = [];
  const vegBalanced = percent(balanced.nutrition.veg, balanced.targets.veg);
  const vegCheap = percent(cheap.nutrition.veg, cheap.targets.veg);
  const gap = balanced.cost - cheap.cost;
  if (gap >= 80 && vegBalanced >= vegCheap + 8) {
    notes.push(
      `金額だけの最安献立より${yen(gap)}高いぶん、野菜は目標の${vegCheap}%から${vegBalanced}%まで戻しています。`,
    );
  }
  const buyNames: string[] = [];
  const seen = new Set<string>();
  for (const slot of balanced.slots) {
    const recipe = getRecipe(slot.recipeId);
    if (!recipe) continue;
    for (const item of recipe.items) {
      if (seen.has(item.ingredientId) || !lookup.isBuy(item.ingredientId)) continue;
      const ingredient = getIngredient(item.ingredientId);
      if (!ingredient || ingredient.category === "seasoning") continue;
      seen.add(item.ingredientId);
      buyNames.push(ingredient.name);
    }
  }
  if (buyNames.length > 0) {
    notes.push(`買い時の${buyNames.slice(0, 3).join("、")}を優先しています。`);
  }
  const leftover = balanced.budget - balanced.cost;
  if (balanced.portion < 0.98 && leftover < 800) {
    notes.push("予算に合わせて、一人前を少なめに見積もっています。");
  } else if (balanced.portion > 1.05) {
    notes.push("予算に余裕があるので、一人前を少し大きくしています。");
  }
  if (balanced.overBy > 0) {
    notes.push(`この条件では予算を${yen(balanced.overBy)}超えます。人数か、食べないものを見直してください。`);
  } else if (balanced.budget - balanced.cost >= 800) {
    notes.push(`予算に${yen(balanced.budget - balanced.cost)}残ります。予備費として置いてあります。`);
  }
  if (balanced.mode === "full") notes.push("朝昼夕の合計です。");
  else if (balanced.mode === "dinner") notes.push("夕食だけの合計です。");
  else notes.push("朝と夜の合計です。昼は入っていません。");
  notes.push("栄養は一般的な目安で、医療上の指導ではありません。");
  return notes;
}

function placeWeeklyDishes(
  picks: string[],
  slots: Slot[],
  dishIds: string[],
  prefs: Prefs,
  excludes: string[],
): { picks: string[]; names: string[] } {
  if (dishIds.length === 0) return { picks, names: [] };
  const next = [...picks];
  const names: string[] = [];
  for (const dishId of dishIds) {
    const recipe = getRecipe(dishId);
    if (!recipe || !isRecipeAllowed(recipe, "dinner", prefs, excludes)) continue;
    const indexes = slots.flatMap((slot, index) => (slot.meal === "dinner" ? [index] : []));
    if (indexes.length === 0) continue;
    if (indexes.some((index) => next[index] === dishId)) {
      names.push(recipe.name);
      continue;
    }
    const counts: Record<string, number> = {};
    for (const index of indexes) counts[next[index]] = (counts[next[index]] ?? 0) + 1;
    let replaceAt = indexes[0];
    for (const index of indexes) {
      const count = counts[next[index]] ?? 0;
      const best = counts[next[replaceAt]] ?? 0;
      if (count > best || (count === best && index > replaceAt)) replaceAt = index;
    }
    next[replaceAt] = dishId;
    names.push(recipe.name);
  }
  return { picks: next, names };
}

export type PlanResult =
  | { ok: true; balanced: Plan; cheap: Plan }
  | { ok: false; error: string };

export function buildPlan(input: PlanInput, lookup: PriceLookup): PlanResult {
  if (input.budget < 500) {
    return { ok: false, error: "予算は500円以上にしてください。" };
  }
  if (input.people < 1 || input.days < 1) {
    return { ok: false, error: "人数と日数を確認してください。" };
  }
  const slots = buildSlots(input.days, input.mode);
  const targets = targetsFor(slots, input.people);
  const portion = portionFor(input.budget, input.people, input.mode, input.fullPortions);
  const slack = input.budget / anchorBudget(input.people, input.mode);
  const coeff = slack >= 1.05 ? 0.012 : 0.02 + (1.05 - slack) * 0.55;
  const stock = stockOf(input.stock);
  const balancedSearch = search(
    slots,
    input.budget,
    input.people,
    input.prefs,
    input.excludes,
    lookup,
    "balanced",
    portion,
    coeff,
    stock,
  );
  const cheapSearch = search(
    slots,
    input.budget,
    input.people,
    input.prefs,
    input.excludes,
    lookup,
    "cheap",
    portion,
    coeff,
    stock,
  );
  if (!balancedSearch || !cheapSearch) {
    return {
      ok: false,
      error: "この条件だと作れる献立が足りません。食べないものを減らしてください。",
    };
  }
  const weekly = input.weeklyDishes ?? [];
  const balancedPlaced = placeWeeklyDishes(
    repair(
      balancedSearch.picks,
      slots,
      input.budget,
      input.people,
      input.prefs,
      input.excludes,
      lookup,
      portion,
    ),
    slots,
    weekly,
    input.prefs,
    input.excludes,
  );
  const cheapPlaced = placeWeeklyDishes(
    repair(
      cheapSearch.picks,
      slots,
      input.budget,
      input.people,
      input.prefs,
      input.excludes,
      lookup,
      portion,
    ),
    slots,
    weekly,
    input.prefs,
    input.excludes,
  );
  const balanced = materialize(balancedPlaced.picks, slots, input, lookup, "balanced", targets, portion);
  const cheap = materialize(cheapPlaced.picks, slots, input, lookup, "cheap", targets, portion);
  const notes = buildNotes(balanced, cheap, lookup);
  if (balancedPlaced.names.length > 0) {
    notes.unshift(`${balancedPlaced.names.join("と")}を、週に1回は入れています。`);
  }
  if (stock.size > 0) {
    const used = new Set<string>();
    for (const slot of balanced.slots) {
      const recipe = getRecipe(slot.recipeId);
      if (!recipe) continue;
      for (const item of recipe.items) {
        if ((stock.get(item.ingredientId) ?? 0) > 0) used.add(item.ingredientId);
      }
    }
    const names = [...used]
      .map((id) => getIngredient(id)?.name)
      .filter((name): name is string => Boolean(name));
    if (names.length > 0) {
      notes.unshift(
        `冷蔵庫・冷凍庫の${names.slice(0, 3).join("、")}を先に使う献立です。足りない分だけ買い物に出します。`,
      );
    }
  }
  balanced.notes = notes;
  cheap.notes = notes;
  return { ok: true, balanced, cheap };
}

export function replacePlanSlot(
  plan: Plan,
  dayIndex: number,
  meal: MealType,
  recipeId: string,
  lookup: PriceLookup,
): Plan {
  const recipe = getRecipe(recipeId);
  if (!recipe || !recipe.meals.includes(meal)) return plan;
  const slots = plan.slots.map((slot) => {
    if (slot.dayIndex !== dayIndex || slot.meal !== meal) return slot;
    return {
      ...slot,
      recipeId,
      cost: recipeCost(recipe, plan.people, lookup.priceOf, plan.portion),
    };
  });
  const nutrition = slots.reduce((total, slot) => {
    const chosen = getRecipe(slot.recipeId);
    return chosen ? add(total, recipeNutrition(chosen, plan.people, plan.portion)) : total;
  }, zeroNutrition());
  const cost = slots.reduce((sum, slot) => sum + slot.cost, 0);
  const notes = [
    "一部を手で入れ替えています。",
    ...plan.notes.filter((note) => !note.startsWith("一部を手で")),
  ];
  return {
    ...plan,
    slots,
    nutrition,
    cost,
    overBy: Math.max(0, cost - plan.budget),
    notes,
  };
}

export function dinnerRepeats(plan: Plan): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const slot of plan.slots) {
    if (slot.meal !== "dinner") continue;
    counts[slot.recipeId] = (counts[slot.recipeId] ?? 0) + 1;
  }
  return counts;
}
