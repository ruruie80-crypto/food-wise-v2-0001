import { getIngredient } from "./catalog";

export const MARKET_PDF = "https://www.city.sendai.jp/chuo-gyomu/documents/seika.pdf";
export const MARKET_PAGE = "https://www.city.sendai.jp/chuo-kanri/kurashi/shizen/nogyo/nosanbutsu/oroshiuri/index.html";
export const MARKET_NOTE =
  "仙台市中央卸売市場の卸売価格です。スーパーの棚の値段ではなく、開市日の日報です。";

export const PDF_HOSTS = new Set(["www.city.sendai.jp", "city.sendai.jp"]);
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 16;
export const MAX_REPORT_TEXT = 400_000;

const MAX_ROWS = 8;
const MAX_PLACE = 16;
const MAX_WEATHER = 12;
const MAX_YEN = 10_000_000;

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
  if (token.length > 12) return null;
  const value = Number(token.replace(/,/g, ""));
  if (!Number.isInteger(value) || value < 0 || value > MAX_YEN) return null;
  return value;
}

function placeName(value: string): string | null {
  if (value.length < 1 || value.length > MAX_PLACE) return null;
  if (/[<>&"'\\\u0000-\u001f]/.test(value)) return null;
  return value;
}

function findRows(text: string, pattern: string): RawRow[] {
  const re = new RegExp(
    `${pattern}\\s+(\\S+)\\s+(\\d+(?:\\.\\d+)?)\\s*(Kg|g)\\s+([\\d,]+|－)\\s+([\\d,]+|－)\\s+([\\d,]+|－)`,
    "g",
  );
  const rows: RawRow[] = [];
  for (const match of text.matchAll(re)) {
    if (rows.length >= MAX_ROWS) break;
    const origin = placeName(match[1]);
    const amount = Number(match[2]);
    if (!origin || !Number.isFinite(amount) || amount <= 0 || amount > 1000) continue;
    rows.push({
      origin,
      amount,
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
  if (raw.length > MAX_REPORT_TEXT) return null;
  const text = normalize(raw);
  const dated = text.match(/令和\s*(\d+)年\s*(\d+)月\s*(\d+)日/);
  if (!dated || dated[1].length > 4) return null;
  const year = 2018 + Number(dated[1]);
  const month = Number(dated[2]);
  const day = Number(dated[3]);
  if (year < 2019 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const asOf = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (new Date(`${asOf}T00:00:00Z`).toISOString().slice(0, 10) !== asOf) return null;
  const weatherRaw = text.match(/天気\s*[（(]\s*([^)）]{0,24})\s*[)）]/)?.[1]?.trim() ?? "";
  const weather = weatherRaw.length <= MAX_WEATHER && !/[<>&"'\\\u0000-\u001f]/.test(weatherRaw) ? weatherRaw : "";
  const items: MarketQuote[] = [];

  for (const spec of SPECS) {
    const rows = findRows(text, spec.pattern);
    const row = rows.find((item) => item.origin === "宮城") ?? rows[0];
    const price = row ? representative(row) : null;
    const ingredient = getIngredient(spec.ingredientId);
    if (!row || price == null || !ingredient) continue;
    const grams = packGrams(row);
    const appYen = Math.round((price / grams) * ingredient.gramsPerUnit);
    if (grams <= 0 || !Number.isInteger(appYen) || appYen < 1 || appYen > 100_000) continue;
    items.push({
      ingredientId: spec.ingredientId,
      marketName: spec.marketName,
      origin: row.origin,
      packLabel: `${row.amount}${row.unit === "Kg" ? "kg" : "g"}`,
      high: row.high,
      mid: row.mid,
      low: row.low,
      appYen,
    });
  }

  if (items.length === 0) return null;
  return {
    asOf,
    label: `令和${dated[1]}年${month}月${day}日`,
    weather,
    items,
  };
}

export function isPdfContentType(header: string | null): boolean {
  if (!header) return false;
  return header.split(";")[0].trim().toLowerCase() === "application/pdf";
}

export function hasPdfHeader(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

export function nextPdfUrl(current: string, location: string | null): string | null {
  if (!location || location.length > 2048) return null;
  let next: URL;
  try {
    next = new URL(location, current);
  } catch {
    return null;
  }
  if (next.protocol !== "https:" || !PDF_HOSTS.has(next.hostname) || next.username || next.password) return null;
  return next.toString();
}

export async function readAtMost(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("pdf is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
