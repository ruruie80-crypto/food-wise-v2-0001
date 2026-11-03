import { getIngredient, getRecipe, getStore } from "./catalog";
import { formatUnits } from "./format";
import type { PriceLookup } from "./optimizer";
import type { Plan, ShopLine, ShopList, StockItem } from "./types";

const PANTRY_IDS = new Set(["wakame", "miso"]);

export function retailBuy(ingredientId: string, units: number): { chargeUnits: number; label: string; pantry: boolean } {
  const ingredient = getIngredient(ingredientId);
  if (!ingredient) return { chargeUnits: units, label: String(units), pantry: false };
  if (ingredientId === "wakame") return { chargeUnits: 0, label: "乾燥わかめ 1袋", pantry: true };
  if (ingredientId === "miso") return { chargeUnits: 0, label: "味噌 1パック", pantry: true };
  if (ingredientId === "egg") {
    const packs = Math.max(1, Math.ceil(units / 10 - 1e-9));
    return { chargeUnits: packs * 10, label: `10個入り×${packs}パック`, pantry: false };
  }
  if (ingredient.unitKind === "count") {
    const count = Math.max(1, Math.ceil(units - 1e-9));
    return { chargeUnits: count, label: `${count}${ingredient.unitSuffix}`, pantry: false };
  }
  return { chargeUnits: units, label: formatUnits(units, ingredient), pantry: false };
}

type Lookup = Pick<PriceLookup, "priceOf"> & {
  quote(ingredientId: string): { byStore: { storeId: string; price: number }[] } | null;
};

export function buildShoppingList(
  plan: Plan,
  lookup: Lookup,
  stock: StockItem[] = [],
  preferredStoreId?: string | null,
): ShopList {
  const have = new Map<string, number>();
  for (const item of stock) {
    if (item.units <= 0) continue;
    have.set(item.ingredientId, (have.get(item.ingredientId) ?? 0) + item.units);
  }
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

  const covered: { ingredientId: string; units: number }[] = [];
  const pantry: { ingredientId: string; label: string }[] = [];
  const lines: ShopLine[] = [];
  for (const [ingredientId, needed] of totals) {
    const fromStock = Math.min(have.get(ingredientId) ?? 0, needed);
    if (fromStock > 0.05) covered.push({ ingredientId, units: fromStock });
    const units = needed - fromStock;
    if (units <= 0.05) continue;
    const retail = retailBuy(ingredientId, units);
    if (retail.pantry || PANTRY_IDS.has(ingredientId)) {
      pantry.push({ ingredientId, label: retail.label });
      continue;
    }
    const quote = lookup.quote(ingredientId);
    if (!quote || quote.byStore.length === 0) continue;
    const preferred = preferredStoreId
      ? quote.byStore.find((row) => row.storeId === preferredStoreId)
      : undefined;
    const best = preferred ?? quote.byStore[0];
    lines.push({
      ingredientId,
      units: retail.chargeUnits,
      storeId: best.storeId,
      unitPrice: best.price,
      linePrice: Math.round(retail.chargeUnits * best.price),
      buyLabel: retail.label,
    });
  }
  covered.sort((a, b) => a.ingredientId.localeCompare(b.ingredientId));

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
  pantry.sort((a, b) => a.ingredientId.localeCompare(b.ingredientId));
  return { groups: groupList, seasoningYen, multiTotal, single, savings, covered, pantry };
}
