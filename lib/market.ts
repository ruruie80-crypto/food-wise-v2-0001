import { getIngredient } from "./catalog";

export const MARKET_PDF = "https://www.city.sendai.jp/chuo-gyomu/documents/seika.pdf";
export const MARKET_PAGE = "https://www.city.sendai.jp/chuo-kanri/kurashi/shizen/nogyo/nosanbutsu/oroshiuri/index.html";
export const MARKET_NOTE =
  "仙台市中央卸売市場の卸売価格です。スーパーの棚の値段ではなく、開市日の日報です。";

export type MarketQuote = {
  ingredientId: string;
  marketName: string;
  origin: string;
  packLabel: string;
  high: number | null;
  mid: number | null;
  low: number | null;
  appYen: number;
};

export type MarketReport = {
  asOf: string;
  label: string;
  weather: string;
  items: MarketQuote[];
};

const SPECS: { ingredientId: string; pattern: string; marketName: string }[] = [
  { ingredientId: "daikon", pattern: "だいこん\\s*[LＬ]", marketName: "だいこん" },
  { ingredientId: "carrot", pattern: "にんじん\\s*[MＭ]", marketName: "にんじん" },
  { ingredientId: "gobo", pattern: "ごぼう\\s*[MＭ]", marketName: "ごぼう" },
  { ingredientId: "hakusai", pattern: "はくさい\\s*[4４]玉", marketName: "はくさい" },
  { ingredientId: "komatsuna", pattern: "小松菜", marketName: "小松菜" },
  { ingredientId: "cabbage", pattern: "キャベツ\\s*[LＬ]", marketName: "キャベツ" },
  { ingredientId: "spinach", pattern: "ほうれん草\\s*[MＭ]", marketName: "ほうれん草" },
  { ingredientId: "negi", pattern: "長ねぎ\\s*[LＬ]", marketName: "長ねぎ" },
  { ingredientId: "nira", pattern: "にら\\s*[LＬ]", marketName: "にら" },
  { ingredientId: "tomato", pattern: "(?<!ミニ)トマト\\s*[MＭ]", marketName: "トマト" },
  { ingredientId: "potato", pattern: "ばれいしょ\\s*[LＬ]", marketName: "じゃがいも" },
  { ingredientId: "onion", pattern: "たまねぎ\\s*[LＬ]", marketName: "たまねぎ" },
  { ingredientId: "egg", pattern: "鶏卵\\s*ＡＭ", marketName: "鶏卵" },
];

type RawRow = {
  origin: string;
  amount: number;
  unit: "Kg" | "g";
  high: number | null;
  mid: number | null;
  low: number | null;
};

function normalize(text: string): string {
  return text.replace(/\u3000/g, " ").replace(/[ \t]+/g, " ");
}

function money(token: string): number | null {
  if (token === "－" || token === "-" || token === "—") return null;
  const value = Number(token.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function findRows(text: string, pattern: string): RawRow[] {
  const re = new RegExp(
    `${pattern}\\s+(\\S+)\\s+(\\d+(?:\\.\\d+)?)\\s*(Kg|g)\\s+([\\d,]+|－)\\s+([\\d,]+|－)\\s+([\\d,]+|－)`,
    "g",
  );
  const rows: RawRow[] = [];
  for (const match of text.matchAll(re)) {
    rows.push({
      origin: match[1],
      amount: Number(match[2]),
      unit: match[3] === "Kg" ? "Kg" : "g",
      high: money(match[4]),
      mid: money(match[5]),
      low: money(match[6]),
    });
  }
  return rows;
}

function representative(row: RawRow): number | null {
  if (row.mid != null) return row.mid;
  if (row.high != null && row.low != null) return (row.high + row.low) / 2;
  return row.high ?? row.low;
}

function packGrams(row: RawRow): number {
  return row.unit === "Kg" ? row.amount * 1000 : row.amount;
}

export function parseMarketReport(raw: string): MarketReport | null {
  const text = normalize(raw);
  const dated = text.match(/令和\s*(\d+)年\s*(\d+)月\s*(\d+)日/);
  if (!dated) return null;
  const year = 2018 + Number(dated[1]);
  const month = Number(dated[2]);
  const day = Number(dated[3]);
  const weather = text.match(/天気\s*[（(]\s*([^)）]+)\s*[)）]/)?.[1] ?? "";
  const items: MarketQuote[] = [];

  for (const spec of SPECS) {
    const rows = findRows(text, spec.pattern);
    const row = rows.find((item) => item.origin === "宮城") ?? rows[0];
    const price = row ? representative(row) : null;
    const ingredient = getIngredient(spec.ingredientId);
    if (!row || price == null || !ingredient) continue;
    const grams = packGrams(row);
    if (grams <= 0) continue;
    items.push({
      ingredientId: spec.ingredientId,
      marketName: spec.marketName,
      origin: row.origin,
      packLabel: `${row.amount}${row.unit === "Kg" ? "kg" : "g"}`,
      high: row.high,
      mid: row.mid,
      low: row.low,
      appYen: Math.max(1, Math.round((price / grams) * ingredient.gramsPerUnit)),
    });
  }

  return {
    asOf: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    label: `令和${dated[1]}年${month}月${day}日`,
    weather,
    items,
  };
}
