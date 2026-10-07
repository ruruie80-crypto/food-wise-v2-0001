import assert from "node:assert/strict";
import test from "node:test";
import { unzipSync, strFromU8 } from "fflate";
import { buildHandoff, buildHandoffZip, parseHandoff, readHandoffZip } from "./handoff";
import type { HandoffRecord } from "./handoff";
import type { Nutrition, Plan } from "./types";

const TODAY = "2026-10-07";

const nutrition: Nutrition = { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, salt: 0, veg: 0 };

function plan(): Plan {
  return {
    focus: "balanced",
    budget: 5000,
    people: 1,
    days: 7,
    mode: "dinner_breakfast",
    slots: [{ dayIndex: 0, meal: "dinner", recipeId: "curry", cost: 492 }],
    cost: 492,
    overBy: 0,
    portion: 1,
    nutrition,
    targets: nutrition,
    notes: [],
    sourceKey: "test",
  };
}

function record(): HandoffRecord {
  return {
    v: 1,
    areaId: "nakano",
    people: 1,
    budget: 5000,
    mode: "dinner_breakfast",
    prefs: { quick: false, moreVeg: false, highProtein: false, washoku: false },
    excludes: [],
    observations: [
      { id: "obs-1", ingredientId: "cabbage", storeId: "aoba", price: 21, date: TODAY, source: "receipt" },
    ],
    balanced: plan(),
    cheap: null,
    focus: "balanced",
    checks: {},
    onboarded: true,
    readAlertIds: [],
    premiumPreview: false,
  };
}

test("handoff text names the meal, the shop, and the scanned price", () => {
  const file = buildHandoff(record(), TODAY, false);
  assert.match(file.text, /豚カレー/);
  assert.match(file.text, /キャベツ/);
  assert.match(file.text, /見本/);
  assert.match(file.filename, /2026-10-07/);
  const parsed = parseHandoff(file.json);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const saved = parsed.record as HandoffRecord;
  assert.equal(saved.observations[0]?.price, 21);
  assert.equal(saved.balanced?.slots[0]?.recipeId, "curry");
});

test("zip holds the note, the memo, and a record the app can open", () => {
  const zip = buildHandoffZip(record(), TODAY, false);
  assert.match(zip.filename, /\.zip$/);
  assert.equal(zip.bytes[0], 0x50);
  assert.equal(zip.bytes[1], 0x4b);
  const entries = unzipSync(zip.bytes);
  assert.match(strFromU8(entries["メモ.txt"]), /豚カレー/);
  assert.match(strFromU8(entries["よみかた.txt"]), /Zip/);
  const parsed = readHandoffZip(zip.bytes);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal((parsed.record as HandoffRecord).observations[0]?.price, 21);
});

test("other json is refused", () => {
  const parsed = parseHandoff(JSON.stringify({ hello: "world" }));
  assert.equal(parsed.ok, false);
});

test("oversized files are refused", () => {
  const parsed = parseHandoff("x".repeat(200_001));
  assert.equal(parsed.ok, false);
});
