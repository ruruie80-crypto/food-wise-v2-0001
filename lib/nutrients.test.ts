import assert from "node:assert/strict";
import test from "node:test";
import { getIngredient } from "./catalog";
import { ingredientTargetPercents, nutrientRows, unitTargetPercents } from "./nutrients";
import { buildPlan, dayTarget } from "./optimizer";
import { createPriceBook } from "./prices";
import type { Prefs } from "./types";

const TODAY = "2026-10-07";
const prefs: Prefs = { quick: false, moreVeg: false, highProtein: false, washoku: false };

test("ingredient nutrient shares explain the week's protein", () => {
  const book = createPriceBook("iwanuma", TODAY, []);
  const result = buildPlan(
    { budget: 5000, people: 1, days: 7, mode: "dinner_breakfast", prefs, excludes: [] },
    book,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const rows = nutrientRows(result.balanced);
  const protein = rows.find((row) => row.key === "protein");
  assert.ok(protein && protein.sources.length >= 2);
  assert.ok(protein.targetPercent > 0);
  const share = protein.sources.reduce((sum, source) => sum + source.sharePercent, 0);
  assert.ok(share >= 95 && share <= 105, `${share}`);
  const top = protein.sources[0];
  assert.ok(top);
  const marks = ingredientTargetPercents(result.balanced, top.ingredientId);
  assert.ok(marks.some((row) => row.targetPercent > 0));
  const salt = rows.find((row) => row.key === "salt");
  assert.ok(salt?.sources.some((source) => source.ingredientId === "seasoning" || source.sharePercent > 0));
});

test("one unit of cabbage covers part of a day's vegetables", () => {
  const cabbage = getIngredient("cabbage");
  assert.ok(cabbage);
  const day = dayTarget("dinner_breakfast", 1);
  const rows = unitTargetPercents(cabbage, day);
  const veg = rows.find((row) => row.label === "野菜");
  assert.equal(veg?.percent, 71);
});
