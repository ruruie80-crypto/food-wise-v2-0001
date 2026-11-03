import type { MealType, StockItem, StockPlace } from "./types";

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
    if (!parseCookedKey(key) || parseCookedKey(key)?.meal == null) continue;
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
    if (row) row.units = Math.round((row.units + take.units) * 10) / 10;
    else next.push({ ingredientId: take.ingredientId, place: take.place, units: take.units });
  }
  return next.filter((item) => item.units > 0.05);
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
