import { getRecipe, getStore } from "./catalog";
import type { PriceLookup } from "./optimizer";
import type { Plan, ShopLine, ShopList } from "./types";

type Lookup = Pick<PriceLookup, "priceOf"> & {
  quote(ingredientId: string): { byStore: { storeId: string; price: number }[] } | null;
};

export function buildShoppingList(plan: Plan, lookup: Lookup): ShopList {
  const totals = new Map<string, number>();
  let seasoningYen = 0;
  for (const slot of plan.slots) {
    const recipe = getRecipe(slot.recipeId);
    if (!recipe) continue;
    seasoningYen += Math.round(recipe.extraYen * plan.people * plan.portion);
    for (const item of recipe.items) {
      totals.set(
        item.ingredientId,
        (totals.get(item.ingredientId) ?? 0) + item.units * plan.people * plan.portion,
      );
    }
  }

  const lines: ShopLine[] = [];
  for (const [ingredientId, units] of totals) {
    const quote = lookup.quote(ingredientId);
    if (!quote || quote.byStore.length === 0) continue;
    const best = quote.byStore[0];
    lines.push({
      ingredientId,
      units,
      storeId: best.storeId,
      unitPrice: best.price,
      linePrice: Math.round(units * best.price),
    });
  }

  const groups = new Map<string, ShopLine[]>();
  for (const line of lines) {
    const list = groups.get(line.storeId) ?? [];
    list.push(line);
    groups.set(line.storeId, list);
  }

  const groupList = [...groups.entries()]
    .map(([storeId, storeLines]) => ({
      storeId,
      lines: storeLines.sort((a, b) => b.linePrice - a.linePrice),
      total: storeLines.reduce((sum, line) => sum + line.linePrice, 0),
    }))
    .sort((a, b) => b.total - a.total);

  const multiTotal = groupList.reduce((sum, group) => sum + group.total, 0) + seasoningYen;

  const storeIds = new Set<string>();
  for (const line of lines) {
    const quote = lookup.quote(line.ingredientId);
    quote?.byStore.forEach((row) => storeIds.add(row.storeId));
  }

  let single: { storeId: string; total: number } | null = null;
  for (const storeId of storeIds) {
    if (!getStore(storeId)) continue;
    let total = seasoningYen;
    let complete = true;
    for (const line of lines) {
      const quote = lookup.quote(line.ingredientId);
      const row = quote?.byStore.find((item) => item.storeId === storeId);
      if (!row) {
        complete = false;
        break;
      }
      total += Math.round(line.units * row.price);
    }
    if (!complete) continue;
    if (single == null || total < single.total) single = { storeId, total };
  }

  const savings = single ? Math.max(0, single.total - multiTotal) : 0;
  return { groups: groupList, seasoningYen, multiTotal, single, savings };
}
