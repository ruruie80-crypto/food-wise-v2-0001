import assert from "node:assert/strict";
import test from "node:test";
import { inSeason, monthOf } from "./season";

test("October in Sendai is the autumn set from the Tohoku office", () => {
  assert.equal(monthOf("2026-10-10"), 10);
  const names = inSeason(10).map((item) => item.name);
  assert.ok(names.includes("だいこん"));
  assert.ok(names.includes("はくさい"));
  assert.ok(names.includes("小松菜"));
  assert.ok(names.includes("長ねぎ"));
  assert.ok(names.includes("ごぼう"));
  assert.ok(names.includes("さけ"));
  assert.equal(names.includes("トマト"), false);
  assert.equal(names.includes("ほうれん草"), false);
});
