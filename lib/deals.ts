import type { Category } from "./types";

/** 調味料は大さじ単位で金額が小さく見えるので、店の最安には入れない。 */
export const dealCategories = ["vegetable", "meat", "fish", "egg_soy", "staple"] as const satisfies readonly Category[];

const PER_CATEGORY = 2;

export type DealQuote = {
  ingredientId: string;
  category: Category;
  byStore: { storeId: string; price: number }[];
};

export type StorePick = {
  ingredientId: string;
  category: Category;
  price: number;
  onlyHere: boolean;
};

function rowsAt(storeId: string, quotes: DealQuote[], category: Category): StorePick[] {
  return quotes
    .filter((quote) => quote.category === category)
    .flatMap((quote) => {
      const mine = quote.byStore.find((row) => row.storeId === storeId);
      if (!mine || quote.byStore.length === 0) return [];
      const lowest = Math.min(...quote.byStore.map((row) => row.price));
      const winners = quote.byStore.filter((row) => row.price === lowest);
      return [
        {
          ingredientId: quote.ingredientId,
          category,
          price: mine.price,
          onlyHere: mine.price === lowest && winners.length === 1,
        },
      ];
    })
    .sort((a, b) => a.price - b.price || a.ingredientId.localeCompare(b.ingredientId));
}

/** 分類ごとに、その店の安い順を最大2品。安い順から漏れた「この店だけ最安」が1品あれば足す。 */
export function cheapestAtStore(storeId: string, quotes: DealQuote[]): StorePick[] {
  const picks: StorePick[] = [];
  for (const category of dealCategories) {
    const rows = rowsAt(storeId, quotes, category);
    const top = rows.slice(0, PER_CATEGORY);
    const extra = rows.find((row) => row.onlyHere && top.every((item) => item.ingredientId !== row.ingredientId));
    const chosen = extra ? [...top, extra] : top;
    chosen.sort((a, b) => a.price - b.price || a.ingredientId.localeCompare(b.ingredientId));
    picks.push(...chosen);
  }
  return picks;
}

export function samePicks(left: StorePick[], right: StorePick[]): boolean {
  if (left.length !== right.length) return false;
  return left.every(
    (pick, index) =>
      pick.ingredientId === right[index]?.ingredientId &&
      pick.price === right[index]?.price &&
      pick.category === right[index]?.category,
  );
}

export function cheapestStoreLabel(
  byStore: { storeId: string; price: number }[],
  nameOf: (storeId: string) => string,
): string {
  if (byStore.length === 0) return "";
  const lowest = Math.min(...byStore.map((row) => row.price));
  const winners = byStore.filter((row) => row.price === lowest);
  if (winners.length === 1) return nameOf(winners[0].storeId);
  if (winners.length === byStore.length) return "どの店も同じ";
  return `${winners.length}店が最安`;
}
