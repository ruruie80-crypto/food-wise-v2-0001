import { getIngredient, getRecipe } from "./catalog";
import { usedItems } from "./household";
import type { Ingredient, MealType, Plan, StockItem } from "./types";

/** 在庫の上限。米は1単位が75gなので、400単位で30kg。読み込みも保存もこの数。 */
export const MAX_STOCK_UNITS = 400;
export const MIN_RICE_KG = 0.5;
export const MAX_RICE_KG = 30;

export function stockChoices(ingredient: Ingredient): { units: number; label: string }[] {
  if (ingredient.unitKind === "grams100") {
    const named: Record<string, { units: number; label: string }> = {
      cabbage: { units: 10, label: "1玉（1kg）" },
      hakusai: { units: 10, label: "1/4株（1kg）" },
      daikon: { units: 8, label: "1本（800g）" },
      chicken_b: { units: 3, label: "1パック（300g）" },
      chicken_t: { units: 3, label: "1パック（300g）" },
      chicken_hiki: { units: 3, label: "1パック（300g）" },
      pork: { units: 2, label: "1パック（200g）" },
      pork_hiki: { units: 3, label: "1パック（300g）" },
    };
    const pack = named[ingredient.id];
    return pack ? [pack, { units: 1, label: "100g" }] : [
      { units: 3, label: "300g" },
      { units: 1, label: "100g" },
    ];
  }
  if (ingredient.unitKind === "halfGo") {
    return [
      { units: 2, label: "1合" },
      { units: 1, label: "0.5合" },
    ];
  }
  return [{ units: 1, label: ingredient.unitLabel }];
}

/** 米のkgを、0.5合単位に直す。1合は150g。0.5kg未満は0。30kgを超えた分は30kgにする。 */
export function riceUnitsFromKg(kg: number): number {
  if (!Number.isFinite(kg) || kg < MIN_RICE_KG) return 0;
  const capped = Math.min(MAX_RICE_KG, kg);
  return Math.round(((capped * 1000) / 75) * 10) / 10;
}

/** 全角数字を半角にする。小さすぎる数と、数字でない入力は理由を返す。 */
export function readRiceKg(raw: string): { text: string; kg: number | null; hint: string } {
  const text = raw.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).replace(/[．。]/g, ".");
  const trimmed = text.trim();
  if (!trimmed) return { text, kg: null, hint: "kgを入れてください。" };
  if (!/^\d+(\.\d*)?$/.test(trimmed)) return { text, kg: null, hint: "半角の数字で入れてください。" };
  const kg = Number(trimmed);
  if (!Number.isFinite(kg)) return { text, kg: null, hint: "半角の数字で入れてください。" };
  if (kg < MIN_RICE_KG) return { text, kg: null, hint: "0.5kg以上にしてください。" };
  if (kg > MAX_RICE_KG) return { text: String(MAX_RICE_KG), kg: MAX_RICE_KG, hint: "30kgまでです。30kgで入れます。" };
  return { text, kg, hint: "" };
}

/** 献立で使う量を、冷蔵庫から先に引く。調味料は家にある前提なので減らさない。dayIndex があるときは、その日だけ。reserved は今週買った袋の余りで、ここからは引かない。 */
export function consumeStock(
  stock: StockItem[],
  plan: Plan,
  dayIndex?: number,
  reserved: Record<string, { units: number; place: StockItem["place"] }> = {},
  meal?: MealType,
): StockItem[] {
  const need = new Map<string, number>();
  const slots = plan.slots.filter((slot) => {
    if (dayIndex != null && slot.dayIndex !== dayIndex) return false;
    if (meal && slot.meal !== meal) return false;
    return true;
  });
  for (const slot of slots) {
    const recipe = getRecipe(slot.recipeId);
    if (!recipe) continue;
    for (const item of usedItems(recipe.id, recipe.items, plan.allowOptionalEggs === true)) {
      const ingredient = getIngredient(item.ingredientId);
      if (!ingredient || ingredient.category === "seasoning") continue;
      need.set(
        item.ingredientId,
        (need.get(item.ingredientId) ?? 0) + item.units * plan.people * plan.portion,
      );
    }
  }
  const next = stock.map((item) => ({ ...item }));
  for (const [ingredientId, amount] of need) {
    let left = amount;
    for (const place of ["fridge", "freezer"] as const) {
      const row = next.find((item) => item.ingredientId === ingredientId && item.place === place);
      if (!row || left <= 0) continue;
      const hold = reserved[ingredientId]?.place === place ? reserved[ingredientId].units : 0;
      const available = Math.max(0, Math.round((row.units - hold) * 10) / 10);
      const take = Math.min(available, left);
      row.units = Math.round((row.units - take) * 10) / 10;
      left -= take;
    }
  }
  return next.filter((item) => item.units > 0.05);
}
