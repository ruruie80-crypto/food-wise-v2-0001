import { getIngredient, getRecipe, getStore } from "./catalog";
import { usedItems } from "./household";
import { formatUnits, yen } from "./format";
import type { PriceLookup } from "./optimizer";
import type { Plan, ShopLine, ShopList, StockItem } from "./types";

export function cookedDaysOn(keys: string[], start: string): number[] {
  const days: number[] = [];
  for (const key of keys) {
    const [date, index] = key.split(":");
    if (date !== start) continue;
    const day = Number(index);
    if (Number.isInteger(day)) days.push(day);
  }
  return days;
}

function sellByWeight(ingredientId: string, units: number): { chargeUnits: number; label: string } | null {
  const ingredient = getIngredient(ingredientId);
  if (!ingredient) return null;
  if (ingredientId === "rice") {
    const grams = units * ingredient.gramsPerUnit;
    const bags = Math.max(1, Math.ceil(grams / 5000 - 1e-9));
    return {
      chargeUnits: bags * (5000 / ingredient.gramsPerUnit),
      label: bags === 1 ? "5kg袋" : `5kg×${bags}袋`,
    };
  }
  if (ingredient.unitKind !== "grams100") return null;
  const packs: Record<string, { units: number; one: string; many: (count: number) => string }> = {
    cabbage: { units: 10, one: "1玉", many: (count) => `1玉×${count}` },
    hakusai: { units: 10, one: "1/4株", many: (count) => `1/4株×${count}` },
    daikon: { units: 8, one: "1本", many: (count) => `1本×${count}` },
    chicken_b: { units: 3, one: "300g×1パック", many: (count) => `300g×${count}パック` },
    chicken_t: { units: 3, one: "300g×1パック", many: (count) => `300g×${count}パック` },
    chicken_hiki: { units: 3, one: "300g×1パック", many: (count) => `300g×${count}パック` },
    pork: { units: 2, one: "200g×1パック", many: (count) => `200g×${count}パック` },
    pork_hiki: { units: 3, one: "300g×1パック", many: (count) => `300g×${count}パック` },
  };
  const pack = packs[ingredientId] ?? {
    units: 3,
    one: "300g×1パック",
    many: (count: number) => `300g×${count}パック`,
  };
  const count = Math.max(1, Math.ceil(units / pack.units - 1e-9));
  return { chargeUnits: count * pack.units, label: count === 1 ? pack.one : pack.many(count) };
}

const PANTRY_IDS = new Set(["wakame", "miso"]);

/** 家にある前提の品。統計の大袋ではなく、ふつうに買う大きさで示す。 */
const PANTRY_BAGS: Record<string, { grams: number; name: string; surveyGrams: number; surveyYen: number; shelfLabel?: string }> = {
  wakame: {
    grams: 40,
    name: "乾燥わかめ 40g入り1袋",
    surveyGrams: 100,
    surveyYen: 2431,
    shelfLabel: "ないときは約¥200〜¥500",
  },
  miso: { grams: 750, name: "味噌 750g 1パック", surveyGrams: 750, surveyYen: 490 },
};

/** カゴに入れたパックの余りは、今週のリストからは引かない。来週の在庫として残す。 */
export function stockAside(
  stock: StockItem[],
  packAdded: Record<string, { units: number; place: StockItem["place"] }> = {},
): StockItem[] {
  return stock
    .map((item) => {
      const added = packAdded[item.ingredientId];
      if (!added || added.place !== item.place) return item;
      return { ...item, units: Math.round((item.units - added.units) * 10) / 10 };
    })
    .filter((item) => item.units > 0.05);
}

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
  const weighed = sellByWeight(ingredientId, units);
  if (weighed) return { ...weighed, pantry: false };
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
  cookedDayIndexes: number[] = [],
): ShopList {
  const have = new Map<string, number>();
  for (const item of stock) {
    if (item.units <= 0) continue;
    have.set(item.ingredientId, (have.get(item.ingredientId) ?? 0) + item.units);
  }
  const skipDays = new Set(cookedDayIndexes);
  const totals = new Map<string, number>();
  let seasoningYen = 0;
  for (const slot of plan.slots) {
    if (skipDays.has(slot.dayIndex)) continue;
    const recipe = getRecipe(slot.recipeId);
    if (!recipe) continue;
    seasoningYen += Math.round(recipe.extraYen * plan.people * plan.portion);
    for (const item of usedItems(recipe.id, recipe.items)) {
      totals.set(
        item.ingredientId,
        (totals.get(item.ingredientId) ?? 0) + item.units * plan.people * plan.portion,
      );
    }
  }

  const covered: { ingredientId: string; units: number }[] = [];
  const pantry: ShopList["pantry"] = [];
  const lines: ShopLine[] = [];
  for (const [ingredientId, needed] of totals) {
    const fromStock = Math.min(have.get(ingredientId) ?? 0, needed);
    if (fromStock > 0.05) covered.push({ ingredientId, units: fromStock });
    const units = needed - fromStock;
    if (units <= 0.05) continue;
    const retail = retailBuy(ingredientId, units);
    if (retail.pantry || PANTRY_IDS.has(ingredientId)) {
      const bag = PANTRY_BAGS[ingredientId] ?? {
        grams: 40,
        name: "1袋",
        surveyGrams: 100,
        surveyYen: 0,
      };
      const quote = lookup.quote(ingredientId);
      const unit = quote?.byStore[0]?.price ?? 0;
      const perUnit = getIngredient(ingredientId)?.gramsPerUnit ?? 1;
      const surveyUnit = bag.surveyGrams > 0 ? (bag.surveyYen * perUnit) / bag.surveyGrams : unit;
      const bagYen = bag.surveyYen * (bag.grams / bag.surveyGrams);
      const scale = surveyUnit > 0 ? unit / surveyUnit : 1;
      const approxYen = bag.shelfLabel
        ? 350
        : Math.abs(unit - surveyUnit) < 0.51
          ? Math.round(bagYen)
          : Math.round(bagYen * scale);
      pantry.push({
        ingredientId,
        label: `${bag.name}（${bag.shelfLabel ?? `ないときは約${yen(approxYen)}`}）`,
        approxYen,
      });
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
      neededUnits: units,
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
