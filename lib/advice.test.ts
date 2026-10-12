import assert from "node:assert/strict";
import test from "node:test";
import { cookingMethod, methodsInPlan, plannedFoods } from "./advice";
import { getIngredient, recipes } from "./catalog";
import { buildPlan } from "./optimizer";
import { createPriceBook } from "./prices";
import type { Prefs } from "./types";

const TODAY = "2026-10-07";
const prefs: Prefs = { quick: false, moreVeg: false, highProtein: false, washoku: false };

test("every recipe has a cooking method", () => {
  for (const recipe of recipes) {
    const method = cookingMethod(recipe.id);
    assert.notEqual(method, "調理", recipe.id);
    assert.ok(method.length >= 2, recipe.id);
  }
});

test("a 5000 yen plan names foods, methods, and dishes", () => {
  const book = createPriceBook("iwanuma", TODAY, []);
  const result = buildPlan(
    { budget: 5000, people: 1, days: 7, mode: "dinner_breakfast", prefs, excludes: [] },
    book,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const foods = plannedFoods(result.balanced, book.priceOf);
  assert.ok(foods.length >= 5);
  const firstSeasoning = foods.findIndex((food) => getIngredient(food.ingredientId)?.category === "seasoning");
  assert.ok(firstSeasoning > 0);
  assert.ok(foods.slice(0, firstSeasoning).every((food) => getIngredient(food.ingredientId)?.category !== "seasoning"));
  for (let index = 1; index < firstSeasoning; index += 1) {
    assert.ok(foods[index - 1].linePrice >= foods[index].linePrice);
  }
  const rice = foods.find((food) => food.ingredientId === "rice");
  assert.ok(rice && rice.units > 0 && rice.recipeIds.length >= 1);
  const methods = methodsInPlan(result.balanced);
  assert.ok(methods.length >= 2);
  const covered = new Set(methods.flatMap((group) => group.recipeIds));
  for (const slot of result.balanced.slots) assert.ok(covered.has(slot.recipeId));
});
