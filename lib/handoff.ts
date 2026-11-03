import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { getArea, getIngredient, getRecipe, getStore } from "./catalog";
import { avoidsFish, displayRecipeName, plainMisoText } from "./household";
import { addDays, expenseRangeLabel, formatWithWeekday } from "./dates";
import { formatUnits, mealLabel, yen } from "./format";
import { createPriceBook } from "./prices";
import { buildShoppingList, cookedDaysOn, stockAside } from "./shopping";
import type { MealMode, Observation, Plan, PlanFocus, Prefs, StockItem } from "./types";

export const HANDOFF_KIND = "sokone-gohan-handoff";
const MAX_BYTES = 200_000;
const MAX_ZIP_BYTES = 500_000;
const MAX_ZIP_FILES = 20;

const HOW_TO = [
  "底値ごはんの記録です。",
  "メモ.txt は献立と買い物です。このまま読めます。",
  "記録.json は底値ごはんが開くデータです。",
  "相手の画面で「受け取ったファイルを開く」を押し、この Zip を選んでください。",
  "アプリがこのファイルを相手へ送ることはありません。",
  "相場は見本と、書き出した端末で読んだ値札です。実在の店の本日の売価ではありません。",
].join("\n");

export type HandoffRecord = {
  v: 1;
  areaId: string;
  people: number;
  budget: number;
  mode: MealMode;
  prefs: Prefs;
  excludes: string[];
  observations: Observation[];
  balanced: Plan | null;
  cheap: Plan | null;
  focus: PlanFocus;
  checks: Record<string, boolean>;
  onboarded: boolean;
  readAlertIds: string[];
  premiumPreview: boolean;
  adults?: number;
  children?: number;
  monthlyBudget?: number | null;
  stock?: StockItem[];
  cookedKeys?: string[];
  packAdded?: Record<string, { units: number; place: StockItem["place"] }>;
};

export type HandoffFile = {
  kind: typeof HANDOFF_KIND;
  version: 1;
  exportedOn: string;
  text: string;
  record: HandoffRecord;
};

export function buildHandoff(record: HandoffRecord, today: string, stale: boolean): { filename: string; json: string; text: string } {
  const text = renderText(record, today, stale);
  const file: HandoffFile = {
    kind: HANDOFF_KIND,
    version: 1,
    exportedOn: today,
    text,
    record,
  };
  return {
    filename: `sokone-gohan-${today}.json`,
    json: JSON.stringify(file, null, 2),
    text,
  };
}

export function buildHandoffZip(record: HandoffRecord, today: string, stale: boolean): { filename: string; bytes: Uint8Array; text: string } {
  const handoff = buildHandoff(record, today, stale);
  const bytes = zipSync(
    {
      "よみかた.txt": strToU8(HOW_TO),
      "メモ.txt": strToU8(handoff.text),
      "記録.json": strToU8(handoff.json),
    },
    { level: 6 },
  );
  return { filename: `sokone-gohan-${today}.zip`, bytes, text: handoff.text };
}

export function readHandoffZip(bytes: Uint8Array): { ok: true; record: unknown; exportedOn: string; text: string } | { ok: false; error: string } {
  if (bytes.byteLength > MAX_ZIP_BYTES) return { ok: false, error: "ファイルが大きすぎます。" };
  let entries: Record<string, Uint8Array>;
  let tooBig = false;
  try {
    entries = unzipSync(bytes, {
      filter(file) {
        if (file.originalSize > MAX_ZIP_BYTES) {
          tooBig = true;
          return false;
        }
        return file.name.endsWith(".json") || file.name.endsWith(".txt");
      },
    });
  } catch {
    return { ok: false, error: "Zipとして読めません。" };
  }
  if (tooBig) return { ok: false, error: "ファイルが大きすぎます。" };
  const names = Object.keys(entries);
  if (names.length === 0 || names.length > MAX_ZIP_FILES) return { ok: false, error: "底値ごはんの記録ファイルではありません。" };
  const total = names.reduce((sum, name) => sum + entries[name].byteLength, 0);
  if (total > MAX_ZIP_BYTES) return { ok: false, error: "ファイルが大きすぎます。" };
  const jsonName = names.find((name) => name === "記録.json" || name.endsWith("/記録.json")) ?? names.find((name) => name.endsWith(".json"));
  if (!jsonName) return { ok: false, error: "記録.json が Zip の中にありません。" };
  return parseHandoff(strFromU8(entries[jsonName]));
}

export function parseHandoff(raw: string): { ok: true; record: unknown; exportedOn: string; text: string } | { ok: false; error: string } {
  if (raw.length > MAX_BYTES) return { ok: false, error: "ファイルが大きすぎます。" };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "JSONとして読めません。" };
  }
  if (!data || typeof data !== "object") return { ok: false, error: "底値ごはんの記録ファイルではありません。" };
  const file = data as Partial<HandoffFile>;
  if (file.kind !== HANDOFF_KIND || file.version !== 1 || !file.record || typeof file.record !== "object") {
    return { ok: false, error: "底値ごはんの記録ファイルではありません。" };
  }
  return {
    ok: true,
    record: file.record,
    exportedOn: typeof file.exportedOn === "string" ? file.exportedOn : "",
    text: typeof file.text === "string" ? file.text : "",
  };
}

function renderText(record: HandoffRecord, today: string, stale: boolean): string {
  const area = getArea(record.areaId);
  const plan = record.focus === "cheap" ? record.cheap : record.balanced;
  const lines = [
    "底値ごはんの記録",
    `書き出した日: ${today}`,
    "このファイルは人が渡すためのものです。アプリがサーバへ送ることはありません。",
    area.priceBasis === "survey"
      ? area.priceNote
      : "入っている相場は見本と、書き出した端末で読んだ値札です。実在の店の本日の売価ではありません。",
    "",
    `生活圏: ${area.prefecture} ${area.name}`,
    typeof record.adults === "number" && (record.children ?? 0) > 0
      ? `家族: 大人${record.adults}人・子ども${record.children}人（子どもは大人の0.6人分、合わせて${record.people}人分）`
      : `人数: ${record.people}人`,
    ...(typeof record.monthlyBudget === "number" ? [`1か月の食費: ${yen(record.monthlyBudget)}`] : []),
    `今週の食費: ${yen(record.budget)}`,
    expenseRangeLabel(today, plan?.startedOn),
  ];

  if (!plan) {
    lines.push("", "献立はまだありません。");
  } else {
    lines.push("", `献立: ${plan.focus === "cheap" ? "最安" : "バランス"} ${yen(plan.cost)}`);
    if (stale) lines.push("条件が変わったあとの献立です。受け取った側でも組み直せます。");
    const start = plan.startedOn ?? today;
    const fishAside = avoidsFish(record.excludes ?? []);
    lines.push("", "【献立】");
    for (let day = 0; day < plan.days; day += 1) {
      const slots = plan.slots.filter((slot) => slot.dayIndex === day);
      if (slots.length === 0) continue;
      lines.push(formatWithWeekday(addDays(start, day)));
      for (const slot of slots) {
        const recipe = getRecipe(slot.recipeId);
        lines.push(
          `${mealLabel(slot.meal)} ${recipe ? displayRecipeName(recipe, fishAside) : slot.recipeId} ${yen(slot.cost)}`,
        );
      }
    }
    const book = createPriceBook(record.areaId, today, record.observations);
    const shop = buildShoppingList(
      plan,
      book,
      stockAside(record.stock ?? [], record.packAdded),
      null,
      cookedDaysOn(record.cookedKeys ?? [], start),
    );
    lines.push("", "【買い物】");
    if (shop.covered.length > 0) {
      lines.push("冷蔵庫・冷凍庫にあるので買わないもの:");
      for (const row of shop.covered) {
        const ingredient = getIngredient(row.ingredientId);
        const name = plainMisoText(ingredient?.name ?? row.ingredientId, fishAside);
        const qty = ingredient ? formatUnits(row.units, ingredient) : "";
        lines.push(`- ${name} ${qty}`.replace(/\s+/g, " "));
      }
    }
    for (const group of shop.groups) {
      const store = getStore(group.storeId);
      lines.push(store?.name ?? group.storeId);
      for (const line of group.lines) {
        const ingredient = getIngredient(line.ingredientId);
        const name = plainMisoText(ingredient?.name ?? line.ingredientId, fishAside);
        const qty = line.buyLabel ?? (ingredient ? formatUnits(line.units, ingredient) : "");
        lines.push(`- ${name} ${qty} ${yen(line.linePrice)}`.replace(/\s+/g, " "));
      }
    }
    if (shop.pantry.length > 0) {
      lines.push("家にあれば不要:");
      for (const row of shop.pantry) lines.push(`- ${row.label}`);
    }
    lines.push(`小計 ${yen(shop.multiTotal - shop.seasoningYen)}`);
    if (shop.seasoningYen > 0) lines.push(`調味料の見込み ${yen(shop.seasoningYen)}`);
    lines.push(`合計 ${yen(shop.multiTotal)}`);
    if (shop.single && shop.savings > 0) {
      lines.push(`${getStore(shop.single.storeId)?.name ?? "1店"}にまとめると ${yen(shop.single.total)}。分けると ${yen(shop.savings)} 安い。`);
    }
  }

  lines.push("", "【読んだ値札】");
  if (record.observations.length === 0) {
    lines.push("まだありません。");
  } else {
    for (const row of record.observations) {
      const ingredient = getIngredient(row.ingredientId);
      const store = getStore(row.storeId);
      lines.push(`${row.date} ${store?.name ?? row.storeId} ${ingredient?.name ?? row.ingredientId} ${yen(row.price)}`);
    }
  }
  return lines.join("\n");
}
