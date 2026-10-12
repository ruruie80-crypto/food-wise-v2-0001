import assert from "node:assert/strict";
import test from "node:test";
import { hasPdfHeader, isPdfContentType, MARKET_PDF, nextPdfUrl, parseMarketReport, readAtMost } from "./market";

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

test("a long report is refused before the line patterns run", () => {
  const started = Date.now();
  const report = parseMarketReport(`${"だいこん Ｌ ".repeat(80_000)}令和8年10月10日`);
  assert.equal(report, null);
  assert.ok(Date.now() - started < 500);
});

test("an oversized place name is dropped and the rest of the row is kept", () => {
  const report = parseMarketReport(`
令和8年10月10日 天気(晴れ)
キャベツ　Ｌ ${"岩".repeat(40)} 10 Kg － 2,592 －
キャベツ　Ｌ 岩手 10 Kg － 2,592 －
`);
  assert.equal(report?.items.find((item) => item.ingredientId === "cabbage")?.origin, "岩手");
});

test("pdf redirects stay on the Sendai city host", () => {
  assert.equal(nextPdfUrl(MARKET_PDF, "https://www.city.sendai.jp/chuo-gyomu/documents/seika.pdf"), "https://www.city.sendai.jp/chuo-gyomu/documents/seika.pdf");
  assert.equal(nextPdfUrl(MARKET_PDF, "/chuo-gyomu/documents/other.pdf")?.startsWith("https://www.city.sendai.jp/"), true);
  assert.equal(nextPdfUrl(MARKET_PDF, "https://evil.example/seika.pdf"), null);
  assert.equal(nextPdfUrl(MARKET_PDF, "http://www.city.sendai.jp/seika.pdf"), null);
  assert.equal(nextPdfUrl(MARKET_PDF, "https://www.city.sendai.jp.evil.example/seika.pdf"), null);
  assert.equal(nextPdfUrl(MARKET_PDF, null), null);
});

test("only a pdf content type and header are accepted", () => {
  assert.equal(isPdfContentType("application/pdf"), true);
  assert.equal(isPdfContentType("application/pdf; charset=binary"), true);
  assert.equal(isPdfContentType("text/html"), false);
  assert.equal(isPdfContentType(null), false);
  assert.equal(hasPdfHeader(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), true);
  assert.equal(hasPdfHeader(new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c])), false);
});

test("a stream larger than the cap is cut off", async () => {
  const chunk = new Uint8Array(8);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(chunk);
      controller.enqueue(chunk);
      controller.close();
    },
  });
  await assert.rejects(readAtMost(stream, 8), /too large/);
});
