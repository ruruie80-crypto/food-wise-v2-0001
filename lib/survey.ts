import { storesIn, type SampleReceipt } from "./catalog";

/** 総務省統計局「小売物価統計調査」仙台市・2026年8月。店頭の売価ではない。 */
export const SURVEY_SOURCE = "総務省統計局 小売物価統計調査（仙台市・2026年8月）";

type Row = { yen: number; caption: string };

function perKg(officialYen: number, grams: number, item: string, unitLabel: string): Row {
  return {
    yen: Math.max(1, Math.round((officialYen * grams) / 1000)),
    caption: `${item}は1kg ${officialYen.toLocaleString("ja-JP")}円。${unitLabel}（${grams}g）に換算しています。`,
  };
}

function per100(officialYen: number, grams: number, item: string, unitLabel: string): Row {
  return {
    yen: Math.max(1, Math.round((officialYen * grams) / 100)),
    caption: `${item}は100g ${officialYen.toLocaleString("ja-JP")}円。${unitLabel}（${grams}g）に換算しています。`,
  };
}

const rows: Record<string, Row> = {
  cabbage: perKg(221, 100, "キャベツ", "100g"),
  sprouts: perKg(172, 200, "もやし", "1袋"),
  carrot: perKg(513, 150, "にんじん", "1本"),
  onion: perKg(372, 200, "たまねぎ", "1個"),
  spinach: perKg(1793, 180, "ほうれんそう", "1袋"),
  daikon: perKg(278, 100, "だいこん", "100g"),
  tomato: perKg(784, 150, "トマト", "1個"),
  potato: perKg(505, 120, "じゃがいも", "1個"),
  nira: {
    yen: Math.max(1, Math.round((818 * 100) / 1000)),
    caption: "統計に「にら」はありません。ねぎ1kg 818円を、1束100gに換算しています。",
  },
  komatsuna: {
    yen: Math.max(1, Math.round((1793 * 200) / 1000)),
    caption: "統計に「小松菜」はありません。ほうれんそう1kg 1,793円を、1袋200gに換算しています。",
  },
  hakusai: perKg(336, 100, "はくさい", "100g"),
  gobo: perKg(1183, 80, "ごぼう", "1/2本"),
  negi: perKg(818, 100, "ねぎ", "1本"),
  chicken_b: {
    yen: 185,
    caption: "統計の「鶏肉」は部位を分けていません。100g 185円を鶏むねに使っています。",
  },
  chicken_t: {
    yen: 185,
    caption: "統計の「鶏肉」は部位を分けていません。100g 185円を鶏ももに使っています。",
  },
  pork: {
    yen: 315,
    caption: "統計に「豚こま切れ」はありません。豚肉（国産、バラ）100g 315円で代用しています。",
  },
  pork_hiki: {
    yen: 315,
    caption: "統計に「豚ひき肉」はありません。豚肉（国産、バラ）100g 315円で代用しています。",
  },
  chicken_hiki: {
    yen: 185,
    caption: "統計の「鶏肉」はひき肉を分けていません。100g 185円を使っています。",
  },
  sardine: {
    yen: Math.round((152 * 140) / 70),
    caption: "魚介缶詰は1缶70gで152円です。いわし缶140gに換算し、さば缶と区別していません。",
  },
  mackerel: {
    yen: Math.round((152 * 140) / 70),
    caption: "魚介缶詰は1缶70gで152円です。さば缶140gに換算し、いわし缶と区別していません。",
  },
  salmon: per100(562, 80, "さけ", "1切れ"),
  aji: per100(210, 90, "あじ", "1尾"),
  egg: {
    yen: Math.round(325 / 10),
    caption: "鶏卵は10個325円です。1個に割っています。",
  },
  tofu: perKg(354, 300, "豆腐", "1丁"),
  natto: {
    yen: Math.round(124 / 3),
    caption: "納豆は3パック124円です。1パックに割っています。",
  },
  rice: {
    yen: Math.round((3995 * 75) / 5000),
    caption: "うるち米（コシヒカリ）は5kg 3,995円です。0.5合を75gとして割っています。小分けの袋とは違います。",
  },
  pasta: perKg(678, 100, "スパゲッティ", "100g"),
  udon: perKg(445, 200, "ゆでうどん", "1玉"),
  wakame: {
    yen: Math.round((2431 * 5) / 100),
    caption: "わかめは100g 2,431円です。1食を乾燥5gとして割っています。",
  },
  miso: {
    yen: Math.round((490 * 18) / 750),
    caption: "みそは750g 490円です。大さじ1を18gとして割っています。",
  },
};

export function surveyUnitYen(ingredientId: string): number | null {
  return rows[ingredientId]?.yen ?? null;
}

export function surveyCaption(ingredientId: string): string | null {
  const row = rows[ingredientId];
  if (!row) return null;
  return `${row.caption}出典は${SURVEY_SOURCE}です。`;
}

export function surveyReceipt(areaId: string): SampleReceipt | null {
  const store = storesIn(areaId)[0];
  if (!store) return null;
  const lines = [
    { ingredientId: "cabbage", label: "キャベツ 100g" },
    { ingredientId: "egg", label: "卵 1個" },
    { ingredientId: "aji", label: "あじ 1尾" },
  ].flatMap((line) => {
    const price = surveyUnitYen(line.ingredientId);
    return price == null ? [] : [{ ...line, price }];
  });
  if (lines.length === 0) return null;
  return {
    id: `survey-${areaId}`,
    storeId: store.id,
    title: "統計の平均で試す",
    note: "このレシートは店の売価ではなく、仙台市の統計を単位換算したものです。",
    lines,
  };
}
