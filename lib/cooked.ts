import { getIngredient, getRecipe } from "./catalog";
import { usedItems } from "./household";
import { MAX_STOCK_UNITS } from "./stock";
import type { MealType, Plan, StockItem, StockPlace } from "./types";

const MEALS = new Set<MealType>(["breakfast", "lunch", "dinner"]);

export type CookedMeal = { dayIndex: number; meal: MealType };

export type StockTake = { ingredientId: string; place: StockPlace; units: number };

/** 朝・夜ごとの記録。古い「日付:日」は、その日の全部を作った印として残す。 */
export function cookedMealKey(start: string, dayIndex: number, meal: MealType): string {
  return `${start}:${dayIndex}:${meal}`;
}

export function readCookedKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const keys: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    if (parseCookedKey(item)) keys.push(item);
  }
  return keys;
}

export function readCookedUses(raw: unknown): Record<string, StockTake[]> {
  if (!raw || typeof raw !== "object") return {};
  const uses: Record<string, StockTake[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!parseCookedKey(key)) continue;
    if (!Array.isArray(value)) continue;
    const takes = value.filter(isStockTake);
    if (takes.length > 0) uses[key] = takes;
  }
  return uses;
}

/** 1日まとめの古い記録だけ、日にちを返す。朝だけの記録では夜を外さない。 */
export function cookedDaysOn(keys: string[], start: string): number[] {
  const days: number[] = [];
  for (const key of keys) {
    const parsed = parseCookedKey(key);
    if (!parsed || parsed.start !== start || parsed.meal != null) continue;
    days.push(parsed.dayIndex);
  }
  return days;
}

export function cookedMealsOn(keys: string[], start: string): CookedMeal[] {
  const meals: CookedMeal[] = [];
  for (const key of keys) {
    const parsed = parseCookedKey(key);
    if (!parsed || parsed.start !== start || parsed.meal == null) continue;
    meals.push({ dayIndex: parsed.dayIndex, meal: parsed.meal });
  }
  return meals;
}

export function isMealCooked(keys: string[], start: string, dayIndex: number, meal: MealType): boolean {
  return keys.includes(cookedMealKey(start, dayIndex, meal)) || keys.includes(`${start}:${dayIndex}`);
}

export function mealIsLocked(
  dayIndex: number,
  meal: MealType,
  dayIndexes: number[],
  meals: CookedMeal[],
): boolean {
  return dayIndexes.includes(dayIndex) || meals.some((item) => item.dayIndex === dayIndex && item.meal === meal);
}

/** 同じ週の作り直しでは印を残し、週が終わったあとは消す。 */
export function cookedKeysAfterRebuild<T>(keys: T[], continueWeek: boolean): T[] {
  return continueWeek ? keys : [];
}

export function stockTaken(before: StockItem[], after: StockItem[]): StockTake[] {
  const left = new Map(after.map((item) => [`${item.ingredientId}:${item.place}`, item.units]));
  const takes: StockTake[] = [];
  for (const item of before) {
    const remain = left.get(`${item.ingredientId}:${item.place}`) ?? 0;
    const used = Math.round((item.units - remain) * 10) / 10;
    if (used > 0.05) takes.push({ ingredientId: item.ingredientId, place: item.place, units: used });
  }
  return takes;
}

export function restoreStock(stock: StockItem[], takes: StockTake[]): StockItem[] {
  const next = stock.map((item) => ({ ...item }));
  for (const take of takes) {
    const row = next.find((item) => item.ingredientId === take.ingredientId && item.place === take.place);
    const added = Math.min(MAX_STOCK_UNITS, take.units);
    if (row) row.units = Math.min(MAX_STOCK_UNITS, Math.round((row.units + added) * 10) / 10);
    else next.push({ ingredientId: take.ingredientId, place: take.place, units: added });
  }
  return next.filter((item) => item.units > 0.05);
}

/** その食事で減らす量。調味料は家にある前提なので入れない。 */
export function mealStockNeed(plan: Plan, dayIndex: number, meal: MealType): StockTake[] {
  const slot = plan.slots.find((item) => item.dayIndex === dayIndex && item.meal === meal);
  if (!slot) return [];
  const recipe = getRecipe(slot.recipeId);
  if (!recipe) return [];
  const takes: StockTake[] = [];
  for (const item of usedItems(recipe.id, recipe.items, plan.allowOptionalEggs === true)) {
    const ingredient = getIngredient(item.ingredientId);
    if (!ingredient || ingredient.category === "seasoning") continue;
    const units = Math.round(item.units * plan.people * plan.portion * 10) / 10;
    if (units <= 0.05) continue;
    const place: StockPlace = ingredient.category === "meat" || ingredient.category === "fish" ? "freezer" : "fridge";
    const existing = takes.find((take) => take.ingredientId === item.ingredientId && take.place === place);
    if (existing) existing.units = Math.round((existing.units + units) * 10) / 10;
    else takes.push({ ingredientId: item.ingredientId, place, units });
  }
  return takes;
}

/** 1日まとめの減らし分を、取り消す食事と残りの食事に分ける。 */
export function splitDayTakes(
  takes: StockTake[],
  mineNeed: StockTake[],
  restNeed: StockTake[],
): { mine: StockTake[]; rest: StockTake[] } {
  const want = new Map(mineNeed.map((take) => [`${take.ingredientId}:${take.place}`, take.units]));
  const later = new Map(restNeed.map((take) => [`${take.ingredientId}:${take.place}`, take.units]));
  const mine: StockTake[] = [];
  const rest: StockTake[] = [];
  for (const take of takes) {
    const key = `${take.ingredientId}:${take.place}`;
    const give = Math.min(take.units, want.get(key) ?? 0);
    const left = Math.round((take.units - give) * 10) / 10;
    if (give > 0.05) mine.push({ ...take, units: Math.round(give * 10) / 10 });
    if (left > 0.05 && (later.get(key) ?? 0) > 0) rest.push({ ...take, units: Math.min(left, later.get(key) ?? left) });
  }
  return { mine, rest };
}

export type CookedMode = "used" | "kept" | "legacy";

export type CookUndoState = {
  keys: string[];
  uses: Record<string, StockTake[]>;
  stock: StockItem[];
  modes?: Record<string, CookedMode>;
  start: string;
  dayIndex: number;
  meal: MealType;
  otherMeals: MealType[];
  mealNeed: StockTake[];
  otherNeeds: StockTake[][];
};

export function applyCookUndo(input: CookUndoState): CookUndoState & { modes: Record<string, CookedMode> } {
  const inputModes = input.modes ?? {};
  const undone = keysAfterUndo(input.keys, input.start, input.dayIndex, input.meal, input.otherMeals);
  if (undone.removed.length === 0) return { ...input, modes: inputModes };
  let stock = input.stock;
  const uses = { ...input.uses };
  const modes = { ...inputModes };
  const mealKey = cookedMealKey(input.start, input.dayIndex, input.meal);
  const dayKey = `${input.start}:${input.dayIndex}`;
  if (undone.removed.includes(mealKey)) {
    const taken = uses[mealKey];
    if (taken) stock = restoreStock(stock, taken);
    delete uses[mealKey];
    delete modes[mealKey];
  }
  if (undone.removed.includes(dayKey)) {
    const taken = uses[dayKey];
    delete uses[dayKey];
    delete modes[dayKey];
    if (taken && taken.length > 0) {
      const { mine, rest } = splitDayTakes(taken, input.mealNeed, input.otherNeeds.flat());
      if (mine.length > 0) stock = restoreStock(stock, mine);
      let leftover = rest;
      input.otherMeals.forEach((other, index) => {
        const key = cookedMealKey(input.start, input.dayIndex, other);
        const part = splitDayTakes(leftover, input.otherNeeds[index] ?? [], []);
        modes[key] = "used";
        if (part.mine.length > 0) uses[key] = part.mine;
        leftover = part.rest;
      });
    } else {
      for (const other of input.otherMeals) {
        const key = cookedMealKey(input.start, input.dayIndex, other);
        if (!modes[key]) modes[key] = "legacy";
      }
    }
  }
  return { ...input, keys: undone.keys, uses, stock, modes };
}

/** 献立画面の「取り消す」と同じ手順。印がなければ何もしない。 */
export function undoCookedMealState(input: {
  plan: Plan | null;
  today: string;
  dayIndex: number;
  meal: MealType;
  keys: string[];
  uses: Record<string, StockTake[]>;
  modes?: Record<string, CookedMode>;
  stock: StockItem[];
}): { keys: string[]; uses: Record<string, StockTake[]>; modes: Record<string, CookedMode>; stock: StockItem[] } | null {
  if (!input.plan || !input.today) return null;
  const start = input.plan.startedOn ?? input.today;
  const others = input.plan.slots
    .filter((slot) => slot.dayIndex === input.dayIndex && slot.meal !== input.meal)
    .map((slot) => slot.meal);
  const undone = applyCookUndo({
    keys: input.keys,
    uses: input.uses,
    stock: input.stock,
    modes: input.modes,
    start,
    dayIndex: input.dayIndex,
    meal: input.meal,
    otherMeals: others,
    mealNeed: mealStockNeed(input.plan, input.dayIndex, input.meal),
    otherNeeds: others.map((other) => mealStockNeed(input.plan as Plan, input.dayIndex, other)),
  });
  if (undone.keys === input.keys) return null;
  return { keys: undone.keys, uses: undone.uses, modes: undone.modes, stock: undone.stock };
}

export const LEGACY_UNDO_NOTE = "前の版で付けた印なので、在庫は戻りません。";
export const KEPT_UNDO_NOTE = "在庫を減らさずに付けた印なので、在庫は変わりません。";

export function readCookedModes(raw: unknown): Record<string, CookedMode> {
  if (!raw || typeof raw !== "object") return {};
  const modes: Record<string, CookedMode> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!parseCookedKey(key)) continue;
    if (value === "used" || value === "kept" || value === "legacy") modes[key] = value;
  }
  return modes;
}

/** この版の「そのまま」と、使った量のある印と、前の版の印を分ける。 */
export function undoStockKind(
  keys: string[],
  uses: Record<string, StockTake[] | undefined>,
  modes: Record<string, CookedMode | undefined>,
  start: string,
  dayIndex: number,
  meal: MealType,
): CookedMode {
  const mealKey = cookedMealKey(start, dayIndex, meal);
  const dayKey = `${start}:${dayIndex}`;
  const key = keys.includes(mealKey) ? mealKey : keys.includes(dayKey) ? dayKey : "";
  if (!key) return "legacy";
  const mode = modes[key];
  if (mode === "kept" || mode === "legacy" || mode === "used") return mode;
  if ((uses[key]?.length ?? 0) > 0) return "used";
  return "legacy";
}

export function undoConfirmDetail(kind: CookedMode): string {
  if (kind === "used") return "印を外します。在庫を減らしていたときは、その分だけ戻します。";
  if (kind === "kept") return `印を外します。${KEPT_UNDO_NOTE}`;
  return `印を外します。${LEGACY_UNDO_NOTE}`;
}

/** やめるなら印も在庫もそのまま。取り消すときだけ印を外す。 */
export function resolveUndo(action: "cancel" | "confirm", input: CookUndoState): CookUndoState & { modes: Record<string, CookedMode> } {
  const modes = input.modes ?? {};
  if (action === "cancel") return { ...input, modes };
  return applyCookUndo({ ...input, modes });
}

/** 1日まとめの印を外すときは、取り消した食事以外の印を残す。 */
export function keysAfterUndo(
  keys: string[],
  start: string,
  dayIndex: number,
  meal: MealType,
  otherMeals: MealType[],
): { keys: string[]; removed: string[] } {
  const mealKey = cookedMealKey(start, dayIndex, meal);
  const dayKey = `${start}:${dayIndex}`;
  const removed: string[] = [];
  const next = keys.filter((key) => {
    if (key === mealKey || key === dayKey) {
      removed.push(key);
      return false;
    }
    return true;
  });
  if (removed.includes(dayKey)) {
    for (const other of otherMeals) {
      const key = cookedMealKey(start, dayIndex, other);
      if (!next.includes(key)) next.push(key);
    }
  }
  return { keys: next, removed };
}

function parseCookedKey(key: string): { start: string; dayIndex: number; meal: MealType | null } | null {
  const parts = key.split(":");
  if (parts.length !== 2 && parts.length !== 3) return null;
  const [start, index, meal] = parts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? "")) return null;
  const dayIndex = Number(index);
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) return null;
  if (parts.length === 2) return { start: start!, dayIndex, meal: null };
  if (!MEALS.has(meal as MealType)) return null;
  return { start: start!, dayIndex, meal: meal as MealType };
}

function isStockTake(value: unknown): value is StockTake {
  if (!value || typeof value !== "object") return false;
  const take = value as StockTake;
  return (
    typeof take.ingredientId === "string" &&
    (take.place === "fridge" || take.place === "freezer") &&
    typeof take.units === "number" &&
    take.units > 0
  );
}
