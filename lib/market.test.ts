import assert from "node:assert/strict";
import test from "node:test";
import { parseMarketReport } from "./market";

const FIXTURE = `
仙台市中央卸売市場日報（青果部）
令和8年10月10日 （土） 天気(晴れ)
だいこん　Ｌ 北海道 10 Kg 2,160 － 1,512
にんじん　Ｍ 北海道 10 Kg 1,728 － 1,512
ごぼう　Ｍ 青森 4 Kg 1,080 648 324
はくさい　４玉 北海道 10 Kg － 2,592 －
はくさい　４玉 長野 12 Kg － 2,592 －
小松菜 宮城 250 g 162 151 130
キャベツ　Ｌ 岩手 10 Kg － 2,592 －
キャベツ　Ｌ 群馬 10 Kg － 2,700 －
ほうれん草　Ｍ 宮城 170 g － 216 －
長ねぎ　Ｌ 宮城 5 Kg 2,160 － 1,944
にら　Ｌ 宮城 100 g 119 － 108
トマト　Ｍ 北海道 4 Kg 2,484 － 2,160
トマト　Ｍ 宮城 4 Kg 2,376 － 1,944
ミニトマト　Ｍ 茨城 3 Kg 2,484 － 2,376
ばれいしょ　Ｌ 北海道 10 Kg 2,700 － 2,160
たまねぎ　Ｌ 北海道 20 Kg 2,700 － 2,376
鶏卵　ＡＭ 岩手 10 Kg 4,050 － 3,942
`;

test("market report keeps the Sendai date and prefers Miyagi rows", () => {
  const report = parseMarketReport(FIXTURE);
  assert.ok(report);
  assert.equal(report.asOf, "2026-10-10");
  assert.equal(report.label, "令和8年10月10日");
  assert.equal(report.weather, "晴れ");
  const price = (id: string) => report.items.find((item) => item.ingredientId === id);
  assert.equal(price("komatsuna")?.origin, "宮城");
  assert.equal(price("komatsuna")?.appYen, 121);
  assert.equal(price("tomato")?.origin, "宮城");
  assert.equal(price("tomato")?.appYen, 81);
  assert.equal(price("cabbage")?.origin, "岩手");
  assert.equal(price("cabbage")?.mid, 2592);
  assert.equal(price("cabbage")?.appYen, 26);
  assert.equal(price("daikon")?.appYen, 18);
  assert.equal(price("egg")?.appYen, 24);
  assert.equal(price("gobo")?.appYen, 13);
  assert.equal(report.items.some((item) => item.marketName === "ミニトマト"), false);
});
