import assert from "node:assert/strict";
import test from "node:test";
import { areas, getIngredient, getRecipe, ingredients, recipes, stores } from "./catalog";
import { buildPlan, dinnerRepeats, recipeNutrition } from "./optimizer";
import { createPriceBook, isOnSale } from "./prices";
import { buildShoppingList } from "./shopping";
import { weekId } from "./dates";
import { percent } from "./format";
import type { Prefs } from "./types";

const TODAY = "2026-10-07";

const prefs: Prefs = {
  quick: false,
  moreVeg: false,
  highProtein: false,
  washoku: false,
};

function book() {
  return createPriceBook("nakano", TODAY, []);
}

function planAt(budget: number, people = 1) {
  return buildPlan(
    {
      budget,
      people,
      days: 7,
      mode: "dinner_breakfast",
      prefs,
      excludes: [],
    },
    book(),
  );
}

test("every recipe points at a real ingredient", () => {
  for (const recipe of recipes) {
    assert.ok(recipe.steps.length >= 2, recipe.id);
    for (const item of recipe.items) {
      assert.ok(getIngredient(item.ingredientId), `${recipe.id} missing ${item.ingredientId}`);
      assert.ok(item.units > 0);
    }
    const nutrition = recipeNutrition(recipe, 1);
    assert.ok(nutrition.kcal > 200 && nutrition.kcal < 1400, `${recipe.id} kcal ${nutrition.kcal}`);
  }
});

test("sale items are cheaper than their recent median", () => {
  const prices = book();
  const week = weekId(TODAY);
  const onSale = ingredients.filter((item) =>
    item.stores.some((store) => isOnSale(item.id, store.storeId, week)),
  );
  assert.ok(onSale.length >= 3);
  for (const item of onSale) {
    const quote = prices.quote(item.id);
    assert.ok(quote, item.id);
    assert.equal(quote?.signal, "buy", `${item.name} ${quote?.unitPrice} vs ${quote?.median}`);
  }
});

test("5000 yen balanced plan hits nutrition inside budget", () => {
  const result = planAt(5000);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const names = result.balanced.slots
    .map((slot) => `${slot.meal}:${getRecipe(slot.recipeId)?.name}:${slot.cost}`)
    .join(" | ");
  assert.ok(result.balanced.cost <= 5000, `${names} cost ${result.balanced.cost}`);
  assert.ok(result.balanced.overBy === 0, names);
  const protein = percent(result.balanced.nutrition.protein, result.balanced.targets.protein);
  const veg = percent(result.balanced.nutrition.veg, result.balanced.targets.veg);
  assert.ok(protein >= 90, `protein ${protein} ${names}`);
  assert.ok(veg >= 85, `veg ${veg} ${names}`);
  assert.ok(result.cheap.cost <= result.balanced.cost, names);
  const cheapVeg = percent(result.cheap.nutrition.veg, result.cheap.targets.veg);
  assert.ok(veg >= cheapVeg + 8, `veg gap ${veg} vs ${cheapVeg} / costs ${result.balanced.cost} vs ${result.cheap.cost}`);
  const repeats = dinnerRepeats(result.balanced);
  assert.ok(Object.keys(repeats).length >= 4, names);
  for (const count of Object.values(repeats)) assert.ok(count <= 2, names);
});

test("tighter budget costs less and stays near the cap", () => {
  const wide = planAt(5000);
  const tight = planAt(3200);
  assert.equal(wide.ok, true);
  assert.equal(tight.ok, true);
  if (!wide.ok || !tight.ok) return;
  assert.ok(tight.balanced.cost < wide.balanced.cost);
  assert.ok(tight.balanced.cost <= 3200, String(tight.balanced.cost));
});

test("two people cost more than one", () => {
  const one = planAt(5000, 1);
  const two = planAt(10000, 2);
  assert.equal(one.ok && two.ok, true);
  if (!one.ok || !two.ok) return;
  assert.ok(two.balanced.cost > one.balanced.cost * 1.7);
});

test("same input builds the same plan", () => {
  const a = planAt(5000);
  const b = planAt(5000);
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) return;
  assert.deepEqual(
    a.balanced.slots.map((slot) => slot.recipeId),
    b.balanced.slots.map((slot) => slot.recipeId),
  );
});

test("every store names a branch in every living area", () => {
  for (const store of stores) {
    for (const area of areas) {
      const branch = store.branches[area.id];
      assert.equal(typeof branch, "string", `${store.name} ${area.name}`);
      assert.ok(branch && branch.length > 0);
    }
  }
});

test("Miyagi samples price fish cheaper on the coast and vegetables inland", () => {
  const tokyo = createPriceBook("nakano", TODAY, []);
  const sendai = createPriceBook("sendai", TODAY, []);
  const ishinomaki = createPriceBook("ishinomaki", TODAY, []);
  const osaki = createPriceBook("osaki", TODAY, []);
  const price = (book: ReturnType<typeof createPriceBook>, id: string) => {
    const quote = book.quote(id);
    assert.ok(quote, id);
    return quote.unitPrice;
  };
  assert.ok(price(sendai, "cabbage") < price(tokyo, "cabbage"));
  assert.ok(price(ishinomaki, "aji") < price(osaki, "aji"));
  assert.ok(price(ishinomaki, "aji") < price(tokyo, "aji"));
  assert.ok(price(osaki, "cabbage") < price(ishinomaki, "cabbage"));
  assert.ok(price(osaki, "rice") < price(sendai, "rice"));
});

test("shopping total matches the priced ingredients", () => {
  const result = planAt(5000);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const prices = book();
  const list = buildShoppingList(result.balanced, prices);
  assert.ok(Math.abs(list.multiTotal - result.balanced.cost) <= 3, `${list.multiTotal} vs ${result.balanced.cost}`);
  assert.ok(list.savings >= 0);
  assert.ok(list.groups.length >= 2);
});
