import assert from "node:assert/strict";
import test from "node:test";
import { getIngredient, getRecipe, ingredients, recipes, storesIn } from "./catalog";
import { CHILD_PORTION, householdServings, TOME_PRESET, weeklyFromMonthly } from "./household";
import { buildPlan } from "./optimizer";
import { createPriceBook } from "./prices";
import { buildShoppingList } from "./shopping";
import { surveyUnitYen } from "./survey";
import { youtubeCookUrl } from "./youtube";
import type { Prefs } from "./types";

const TODAY = "2026-10-07";
const prefs: Prefs = {
  quick: false,
  moreVeg: false,
  highProtein: false,
  washoku: false,
};

const TOME_STORES = ["ujie-sanuma", "dailyport-sanuma", "york-sanuma", "gyomu-minamikata"];

test("Tome lists the four real stores and uses Sendai survey prices", () => {
  assert.deepEqual(
    storesIn("tome").map((store) => store.id),
    TOME_STORES,
  );
  assert.deepEqual(
    storesIn("tome").map((store) => store.name),
    ["ウジエスーパー佐沼本店", "デイリーポート新鮮館 佐沼店", "ヨークベニマル佐沼店", "業務スーパー南方店"],
  );
  for (const store of storesIn("tome")) {
    assert.equal(store.areas.length, 1);
    assert.ok(store.flyerUrl?.startsWith("https://"), store.id);
    assert.equal(store.flyerUrl?.includes("tokubai"), false, store.id);
  }
  assert.equal(storesIn("sendai").some((store) => TOME_STORES.includes(store.id)), false);
  assert.equal(storesIn("nakano").some((store) => TOME_STORES.includes(store.id)), false);

  const tome = createPriceBook("tome", TODAY, []);
  const sendai = createPriceBook("sendai", TODAY, []);
  for (const item of ingredients) {
    assert.equal(tome.quote(item.id)?.unitPrice, surveyUnitYen(item.id), item.id);
    assert.equal(tome.quote(item.id)?.unitPrice, sendai.quote(item.id)?.unitPrice, item.id);
    assert.equal(tome.quote(item.id)?.byStore.length, 4, item.id);
    assert.ok(tome.quote(item.id)?.byStore.every((row) => row.price === surveyUnitYen(item.id)));
  }
});

test("monthly 80000 yen becomes a weekly budget of about 18700", () => {
  assert.equal(CHILD_PORTION, 0.6);
  assert.equal(weeklyFromMonthly(80_000), 18_700);
  assert.equal(TOME_PRESET.budget, weeklyFromMonthly(TOME_PRESET.monthlyBudget));
  assert.equal(TOME_PRESET.mode, "dinner_breakfast");
  assert.equal(householdServings(2, 2), 3.2);
  assert.equal(householdServings(1, 0), 1);
  assert.equal(householdServings(4, 0), 4);
});

test("milk-free hamburger avoids fatty meat and milk", () => {
  const hamburg = getRecipe("hamburg");
  assert.ok(hamburg);
  if (!hamburg) return;
  assert.equal(hamburg.usesMilk, false);
  assert.equal(hamburg.meals.includes("dinner"), true);
  const ids = hamburg.items.map((item) => item.ingredientId);
  for (const id of ["milk", "pork", "pork_hiki", "chicken_t"]) {
    assert.equal(ids.includes(id), false, id);
  }
  assert.ok(ids.includes("chicken_hiki"));
  assert.ok(ids.includes("tofu"));
  for (const recipe of recipes) {
    assert.equal(
      recipe.items.some((item) => item.ingredientId === "milk"),
      false,
      recipe.id,
    );
    assert.notEqual(recipe.usesMilk, true, recipe.id);
  }
});

test("less fat and no milk still build a plan without those foods", () => {
  const result = buildPlan(
    {
      budget: 18_700,
      people: householdServings(2, 2),
      days: 7,
      mode: "dinner_breakfast",
      prefs: { ...prefs, lessFat: true, noMilk: true },
      excludes: [],
    },
    createPriceBook("tome", TODAY, []),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.balanced.cost <= 18_700, String(result.balanced.cost));
  for (const slot of result.balanced.slots) {
    const recipe = getRecipe(slot.recipeId);
    assert.ok(recipe, slot.recipeId);
    for (const item of recipe?.items ?? []) {
      assert.equal(["pork", "pork_hiki", "chicken_t", "milk"].includes(item.ingredientId), false, recipe?.name);
    }
  }
});

test("shopping list drops what is already in the fridge and keeps the store groups", () => {
  const book = createPriceBook("tome", TODAY, []);
  const result = buildPlan(
    {
      budget: 18_700,
      people: 3.2,
      days: 7,
      mode: "dinner_breakfast",
      prefs,
      excludes: [],
      stock: [
        { ingredientId: "cabbage", place: "fridge", units: 40 },
        { ingredientId: "chicken_hiki", place: "freezer", units: 20 },
        { ingredientId: "tofu", place: "fridge", units: 8 },
      ],
    },
    book,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const withStock = buildShoppingList(result.balanced, book, [
    { ingredientId: "cabbage", place: "fridge", units: 40 },
    { ingredientId: "chicken_hiki", place: "freezer", units: 20 },
    { ingredientId: "tofu", place: "fridge", units: 8 },
  ]);
  const without = buildShoppingList(result.balanced, book);
  assert.equal(
    withStock.groups.some((group) => group.lines.some((line) => line.ingredientId === "cabbage")),
    false,
  );
  assert.ok(withStock.covered.some((row) => row.ingredientId === "cabbage"));
  assert.ok(withStock.multiTotal < without.multiTotal);
  assert.ok(withStock.groups.every((group) => TOME_STORES.includes(group.storeId)));
  assert.match(result.balanced.notes.join("\n"), /冷蔵庫・冷凍庫/);
  const chickenMeals = result.balanced.slots.filter((slot) =>
    getRecipe(slot.recipeId)?.items.some((item) => item.ingredientId === "chicken_hiki" || item.ingredientId === "tofu"),
  );
  assert.ok(chickenMeals.length >= 1, result.balanced.slots.map((slot) => slot.recipeId).join(","));
});

test("an unchanged household still matches the one-person plan", () => {
  const book = createPriceBook("nakano", TODAY, []);
  const input = {
    budget: 5000,
    people: 1,
    days: 7,
    mode: "dinner_breakfast" as const,
    prefs,
    excludes: [] as string[],
  };
  const plain = buildPlan(input, book);
  const explicit = buildPlan({ ...input, people: householdServings(1, 0), stock: [] }, book);
  assert.equal(plain.ok && explicit.ok, true);
  if (!plain.ok || !explicit.ok) return;
  assert.deepEqual(
    plain.balanced.slots.map((slot) => slot.recipeId),
    explicit.balanced.slots.map((slot) => slot.recipeId),
  );
});

test("YouTube button is a search for the dish name", () => {
  const url = youtubeCookUrl("鶏と豆腐のハンバーグ");
  assert.equal(url.startsWith("https://www.youtube.com/results?search_query="), true);
  assert.equal(decodeURIComponent(url.split("search_query=")[1] ?? ""), "鶏と豆腐のハンバーグ 作り方");
  assert.equal(url.includes("key="), false);
  assert.ok(getIngredient("chicken_hiki"));
});
