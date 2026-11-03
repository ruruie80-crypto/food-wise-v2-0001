import { getIngredient, getRecipe } from "./catalog";
import type { Ingredient, Plan, StockItem } from "./types";

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

/** 米のkgを、0.5合単位に直す。1合は150g。 */
export function riceUnitsFromKg(kg: number): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return Math.round(((kg * 1000) / 75) * 10) / 10;
}

/** 献立で使う量を、冷蔵庫から先に引く。調味料は家にある前提なので減らさない。dayIndex があるときは、その日だけ。reserved は今週買った袋の余りで、ここからは引かない。 */
export function consumeStock(
  stock: StockItem[],
  plan: Plan,
  dayIndex?: number,
  reserved: Record<string, { units: number; place: StockItem["place"] }> = {},
): StockItem[] {
  const need = new Map<string, number>();
  const slots = dayIndex == null ? plan.slots : plan.slots.filter((slot) => slot.dayIndex === dayIndex);
  for (const slot of slots) {
    const recipe = getRecipe(slot.recipeId);
    if (!recipe) continue;
    for (const item of recipe.items) {
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
