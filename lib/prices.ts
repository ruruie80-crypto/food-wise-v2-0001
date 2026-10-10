import { getArea, getIngredient, ingredients } from "./catalog";
import { addDays, daysBetween, weekId } from "./dates";
import type { Forecast, Ingredient, Observation, Quote, Signal } from "./types";

const SALE_CYCLE: { ingredientId: string; storeId: string }[][] = [
  [
    { ingredientId: "chicken_b", storeId: "aoba" },
    { ingredientId: "cabbage", storeId: "sato" },
    { ingredientId: "egg", storeId: "value" },
  ],
  [
    { ingredientId: "pork", storeId: "value" },
    { ingredientId: "sprouts", storeId: "sato" },
    { ingredientId: "tofu", storeId: "big" },
  ],
  [
    { ingredientId: "mackerel", storeId: "big" },
    { ingredientId: "daikon", storeId: "sato" },
    { ingredientId: "natto", storeId: "value" },
  ],
  [
    { ingredientId: "salmon", storeId: "aoba" },
    { ingredientId: "komatsuna", storeId: "sato" },
    { ingredientId: "potato", storeId: "big" },
  ],
];

export function isOnSale(ingredientId: string, storeId: string, week: number): boolean {
  const index = ((week % SALE_CYCLE.length) + SALE_CYCLE.length) % SALE_CYCLE.length;
  return SALE_CYCLE[index].some(
    (row) => row.ingredientId === ingredientId && row.storeId === storeId,
  );
}

export function hash01(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function seedUnitPrice(
  ingredient: Ingredient,
  storeId: string,
  areaMultiplier: number,
  week: number,
  asOfWeek: number,
  categoryFactor = 1,
): number | null {
  const store = ingredient.stores.find((item) => item.storeId === storeId);
  if (!store) return null;
  const noise = hash01(`${ingredient.id}:${storeId}:${week}`) * 2 - 1;
  let price = ingredient.basePrice * store.multiplier * areaMultiplier * categoryFactor * 1.72;
  price *= 1 + noise * ingredient.volatility;
  price *= 1 - (asOfWeek - week) * ingredient.inflation;
  if (isOnSale(ingredient.id, storeId, week)) price *= 0.74;
  return Math.max(1, Math.round(price));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function signalFor(price: number, pastMedian: number): Signal {
  if (pastMedian <= 0) return "normal";
  if (price <= pastMedian * 0.92) return "buy";
  if (price >= pastMedian * 1.08) return "wait";
  return "normal";
}

export type PriceBook = {
  quote(ingredientId: string): Quote | null;
  priceOf(ingredientId: string): number;
  isBuy(ingredientId: string): boolean;
  forecast(ingredientId: string): Forecast | null;
};

export function createPriceBook(
  areaId: string,
  today: string,
  observations: Observation[],
): PriceBook {
  const area = getArea(areaId);
  const asOfWeek = weekId(today);
  const cache = new Map<string, Quote | null>();

  function seeded(ingredient: Ingredient, storeId: string, week: number): number | null {
    const categoryFactor = area.categoryBias?.[ingredient.category] ?? 1;
    return seedUnitPrice(ingredient, storeId, area.multiplier, week, asOfWeek, categoryFactor);
  }

  function recentUserPrice(ingredientId: string, storeId: string): number | null {
    const recent = observations
      .filter(
        (item) =>
          item.ingredientId === ingredientId &&
          item.storeId === storeId &&
          daysBetween(item.date, today) >= 0 &&
          daysBetween(item.date, today) <= 21,
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return recent ? recent.price : null;
  }

  function quote(ingredientId: string): Quote | null {
    if (cache.has(ingredientId)) return cache.get(ingredientId) ?? null;
    const ingredient = getIngredient(ingredientId);
    if (!ingredient) {
      cache.set(ingredientId, null);
      return null;
    }

    const byStore = ingredient.stores
      .map((store) => {
        const user = recentUserPrice(ingredient.id, store.storeId);
        const price = user ?? seeded(ingredient, store.storeId, asOfWeek);
        return price == null ? null : { storeId: store.storeId, price };
      })
      .filter((row): row is { storeId: string; price: number } => row != null)
      .sort((a, b) => a.price - b.price || a.storeId.localeCompare(b.storeId));

    if (byStore.length === 0) {
      cache.set(ingredientId, null);
      return null;
    }

    const series = [];
    for (let week = asOfWeek - 9; week <= asOfWeek; week += 1) {
      let lowest = Number.POSITIVE_INFINITY;
      for (const store of ingredient.stores) {
        const user = observations
          .filter(
            (item) =>
              item.ingredientId === ingredient.id &&
              item.storeId === store.storeId &&
              weekId(item.date) === week,
          )
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        const price = user?.price ?? seeded(ingredient, store.storeId, week);
        if (price != null) lowest = Math.min(lowest, price);
      }
      if (Number.isFinite(lowest)) {
        series.push({
          date: addDays(today, (week - asOfWeek) * 7),
          price: Math.round(lowest),
        });
      }
    }

    if (series.length > 0) {
      series[series.length - 1] = {
        date: today,
        price: byStore[0].price,
      };
    }

    const past = series.slice(0, -1).map((point) => point.price);
    const pastMedian = median(past.length > 0 ? past : [byStore[0].price]);
    const unitPrice = byStore[0].price;
    const built: Quote = {
      ingredientId,
      unitPrice,
      storeId: byStore[0].storeId,
      median: pastMedian,
      delta: pastMedian > 0 ? (unitPrice - pastMedian) / pastMedian : 0,
      signal: signalFor(unitPrice, pastMedian),
      byStore,
      series,
    };
    cache.set(ingredientId, built);
    return built;
  }

  function forecast(ingredientId: string): Forecast | null {
    const current = quote(ingredientId);
    const ingredient = getIngredient(ingredientId);
    if (!current || !ingredient) return null;
    const nextWeek = asOfWeek + 1;
    const saleStore = ingredient.stores.find((store) =>
      isOnSale(ingredient.id, store.storeId, nextWeek),
    );
    if (saleStore) {
      return {
        low: Math.max(1, Math.round(current.median * 0.74)),
        high: Math.max(1, Math.round(current.median * 0.9)),
        headline: "来週は特売の番が回りやすい",
        detail:
          "過去8週の底値に、4週ごとの特売ローテーションを重ねた幅です。店頭の値段を約束するものではありません。",
      };
    }
    return {
      low: Math.max(1, Math.round(current.median * 0.97)),
      high: Math.max(1, Math.round(current.median * 1.07)),
      headline: "特売がなければ、このあたり",
      detail:
        "直近の底値の中央値から見た、特売なしの週の幅です。急な相場は別です。",
    };
  }

  return {
    quote,
    priceOf(ingredientId: string) {
      return quote(ingredientId)?.unitPrice ?? Number.POSITIVE_INFINITY;
    },
    isBuy(ingredientId: string) {
      return quote(ingredientId)?.signal === "buy";
    },
    forecast,
  };
}

export function proteinYen(ingredient: Ingredient, unitPrice: number): number | null {
  const protein = (ingredient.per100g.protein * ingredient.gramsPerUnit) / 100;
  if (protein < 2) return null;
  return (unitPrice / protein) * 20;
}

export function listQuotes(book: PriceBook): Quote[] {
  return ingredients
    .map((item) => book.quote(item.id))
    .filter((item): item is Quote => item != null);
}
