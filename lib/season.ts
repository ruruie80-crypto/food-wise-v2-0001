/** 東北農政局「旬の食べ物」。時期は仙台市周辺が基準。 */
export const SEASON_SOURCE = "東北農政局「旬の食べ物」（仙台市周辺）";
export const SEASON_URL = "https://www.maff.go.jp/tohoku/monosiritai/syokutaku/tabemono.html";

export type SeasonItem = {
  name: string;
  months: number[];
  ingredientId?: string;
  note: string;
};

export const sendaiSeason: SeasonItem[] = [
  { name: "キャベツ", months: [4, 5, 6], ingredientId: "cabbage", note: "春" },
  { name: "たまねぎ", months: [4, 5, 6], ingredientId: "onion", note: "春" },
  { name: "じゃがいも", months: [4, 5, 6], ingredientId: "potato", note: "春" },
  { name: "レタス", months: [4, 5, 6], note: "春" },
  { name: "トマト", months: [7, 8, 9], ingredientId: "tomato", note: "夏" },
  { name: "にんじん", months: [7, 8, 9], ingredientId: "carrot", note: "夏" },
  { name: "なす", months: [7, 8, 9], note: "夏" },
  { name: "きゅうり", months: [7, 8, 9], note: "夏" },
  { name: "だいこん", months: [10, 11, 12], ingredientId: "daikon", note: "秋" },
  { name: "はくさい", months: [10, 11, 12], ingredientId: "hakusai", note: "秋" },
  { name: "小松菜", months: [10, 11, 12], ingredientId: "komatsuna", note: "秋" },
  { name: "長ねぎ", months: [10, 11, 12], ingredientId: "negi", note: "秋" },
  { name: "ごぼう", months: [10, 11, 12], ingredientId: "gobo", note: "秋" },
  { name: "かぼちゃ", months: [10, 11, 12], note: "秋" },
  { name: "さといも", months: [10, 11, 12], note: "秋" },
  { name: "りんご", months: [10, 11, 12], note: "秋" },
  { name: "さけ", months: [10, 11, 12], ingredientId: "salmon", note: "秋から冬" },
  { name: "にら", months: [1, 2, 3], ingredientId: "nira", note: "冬" },
  { name: "ほうれん草", months: [1, 2, 3], ingredientId: "spinach", note: "冬" },
  { name: "れんこん", months: [1, 2, 3], note: "冬" },
];

export function monthOf(iso: string): number {
  return Number(iso.slice(5, 7));
}

export function inSeason(month: number): SeasonItem[] {
  return sendaiSeason.filter((item) => item.months.includes(month));
}
