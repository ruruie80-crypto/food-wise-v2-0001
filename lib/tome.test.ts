import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getIngredient, getRecipe, getStore, ingredients, recipes, storesIn } from "./catalog";
import { expenseRangeLabel, lunchMoneyHint, planDayLabel, resolvePlanStart, weekIsOver, weekRangeLabel } from "./dates";
import { CHEAP_EGG_DISHES, CHILD_PORTION, EGGS_PER_PACK, householdServings, MAX_WEEKLY_EGG_PACKS, TOME_PRESET, TWICE_A_WEEK_DISHES, usedItems, weeklyFromMonthly } from "./household";
import { formatUnits, marketHeading, seasonHeading } from "./format";
import { consumeStock, MAX_STOCK_UNITS, readRiceKg, riceUnitsFromKg } from "./stock";
import { buildPlan, dropDuplicateCookedDishes, ensureWeeklyDishes, isRecipeAllowed, keepCookedDays, recipeCost, syncLeftoverNote } from "./optimizer";
import { planChangeNote, samePlanAsideFromStock } from "../components/app-state";
import { createPriceBook } from "./prices";
import { buildShoppingList, cookedDaysOn, retailBuy, stockAside } from "./shopping";
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

test("monthly 80000 yen becomes about 18400 yen a week", () => {
  assert.equal(CHILD_PORTION, 0.6);
  assert.equal(weeklyFromMonthly(80_000), 18_400);
  assert.equal(TOME_PRESET.budget, 18_400);
  assert.equal(TOME_PRESET.childStage, "teen");
  assert.equal(TOME_PRESET.lessFat, true);
  assert.equal(TOME_PRESET.noMilk, true);
  assert.equal(householdServings(2, 2), 3.2);
  assert.equal(householdServings(2, 2, "teen"), 4);
  assert.equal(householdServings(1, 0), 1);
});

test("wakame is priced as one bowl of miso soup, and miso stays one spoon", () => {
  const wakame = getIngredient("wakame");
  const miso = getIngredient("miso");
  assert.equal(wakame?.gramsPerUnit, 1.5);
  assert.equal(surveyUnitYen("wakame"), Math.round((2431 * 1.5) / 100));
  assert.ok((surveyUnitYen("wakame") ?? 0) < 50);
  assert.equal(miso?.gramsPerUnit, 18);
  assert.equal(surveyUnitYen("miso"), Math.round((490 * 18) / 750));
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

test("a Tome family plan stays inside budget and includes the home dishes", () => {
  const result = buildPlan(
    {
      budget: 18_400,
      people: householdServings(2, 2, "teen"),
      days: 7,
      mode: "dinner_breakfast",
      prefs: { ...prefs, lessFat: true, noMilk: true },
      excludes: [],
      weeklyDishes: ["hamburg", "soboro"],
    },
    createPriceBook("tome", TODAY, []),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.balanced.people, 4);
  assert.ok(result.balanced.cost <= 18_400, String(result.balanced.cost));
  const dinners = result.balanced.slots.filter((slot) => slot.meal === "dinner").map((slot) => slot.recipeId);
  assert.ok(dinners.includes("hamburg"), dinners.join(","));
  assert.ok(dinners.includes("soboro"), dinners.join(","));
  const dinnerCounts: Record<string, number> = {};
  for (const id of dinners) dinnerCounts[id] = (dinnerCounts[id] ?? 0) + 1;
  assert.ok(dinners.some((id) => CHEAP_EGG_DISHES.includes(id)), dinners.join(","));
  assert.equal(dinnerCounts.hamburg, 1);
  for (const [id, count] of Object.entries(dinnerCounts)) {
    assert.ok(count <= (TWICE_A_WEEK_DISHES.includes(id) ? 2 : 1), `${id}:${count}`);
  }
  const eggs = result.balanced.slots.reduce((sum, slot) => {
    const recipe = getRecipe(slot.recipeId);
    const units = recipe ? usedItems(recipe.id, recipe.items).find((item) => item.ingredientId === "egg")?.units ?? 0 : 0;
    return sum + units * result.balanced.people * result.balanced.portion;
  }, 0);
  assert.ok(eggs <= 40, String(eggs));
  assert.ok(eggs >= 26, String(eggs));
  assert.equal(usedItems("natto-set", [{ ingredientId: "egg", units: 1 }, { ingredientId: "natto", units: 1 }]).some((item) => item.ingredientId === "egg"), false);
  assert.equal(formatUnits(3.6, getIngredient("egg")!), "3個と少し");
  assert.equal(formatUnits(0.4, getIngredient("egg")!), "1個弱");
  assert.equal(formatUnits(0.5, getIngredient("tofu")!), "1丁弱");
  assert.equal(formatUnits(2, getIngredient("egg")!), "2個");
  assert.equal(lunchMoneyHint("2026-11-03", "2026-11-10", 2800), false);
  assert.equal(lunchMoneyHint("2026-11-03", "2026-11-04", 2800), true);
  const eggLine = buildShoppingList(result.balanced, createPriceBook("tome", TODAY, [])).groups
    .flatMap((group) => group.lines)
    .find((line) => line.ingredientId === "egg");
  const packs = eggLine ? eggLine.units / EGGS_PER_PACK : 0;
  assert.ok(packs <= MAX_WEEKLY_EGG_PACKS, eggLine?.buyLabel ?? "no eggs");
  assert.equal(getRecipe("soboro")?.name, "そぼろご飯");
  const veg = result.balanced.nutrition.veg / result.balanced.targets.veg;
  assert.ok(veg >= 0.4, `veg ${veg}`);
  const eggOnly = dinners.every((id) => id === "tamago-kake" || id === "tamago-don");
  assert.equal(eggOnly, false);
  for (const slot of result.balanced.slots) {
    const recipe = getRecipe(slot.recipeId);
    for (const item of recipe?.items ?? []) {
      assert.equal(["pork", "pork_hiki", "chicken_t", "milk"].includes(item.ingredientId), false, recipe?.name);
    }
  }
});

test("younger children keep age-sized portions and leave the spare money", () => {
  const book = createPriceBook("tome", TODAY, []);
  const shared = {
    budget: 18_400,
    days: 7,
    mode: "dinner_breakfast" as const,
    prefs: { ...prefs, lessFat: true, noMilk: true },
    excludes: [] as string[],
    weeklyDishes: ["hamburg", "soboro"],
  };
  const teen = buildPlan({ ...shared, people: householdServings(2, 2, "teen"), fullPortions: true }, book);
  const young = buildPlan({ ...shared, people: householdServings(2, 2, "young"), fullPortions: false }, book);
  assert.equal(teen.ok && young.ok, true);
  if (!teen.ok || !young.ok) return;
  assert.equal(young.balanced.people, 3.2);
  assert.equal(young.balanced.portion, 1);
  assert.ok(young.balanced.cost < teen.balanced.cost, `${young.balanced.cost} vs ${teen.balanced.cost}`);
  assert.ok(young.balanced.budget - young.balanced.cost > teen.balanced.budget - teen.balanced.cost);
});

test("a new week with rice at home still serves each dinner once", () => {
  const result = buildPlan(
    {
      budget: 18_400,
      people: 4,
      days: 7,
      mode: "dinner_breakfast",
      prefs: { ...prefs, lessFat: true, noMilk: true },
      excludes: [],
      fullPortions: true,
      weeklyDishes: ["hamburg", "soboro"],
      stock: [{ ingredientId: "rice", place: "fridge", units: 400 }],
    },
    createPriceBook("tome", "2026-11-10", []),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const counts: Record<string, number> = {};
  for (const slot of result.balanced.slots) {
    if (slot.meal !== "dinner") continue;
    counts[slot.recipeId] = (counts[slot.recipeId] ?? 0) + 1;
  }
  assert.equal(counts.hamburg, 1);
  assert.equal(counts.soboro, 1);
  for (const [id, count] of Object.entries(counts)) {
    assert.ok(count <= (TWICE_A_WEEK_DISHES.includes(id) ? 2 : 1), `${id}:${count}`);
  }
});

test("shopping list drops what is already in the fridge and keeps the store groups", () => {
  const book = createPriceBook("tome", TODAY, []);
  const result = buildPlan(
    {
      budget: 18_400,
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

test("a chosen store keeps the whole list when prices match", () => {
  const book = createPriceBook("tome", TODAY, []);
  const result = buildPlan(
    {
      budget: 18_400,
      people: 4,
      days: 7,
      mode: "dinner_breakfast",
      prefs,
      excludes: [],
    },
    book,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const list = buildShoppingList(result.balanced, book, [], "gyomu-minamikata");
  assert.deepEqual(
    list.groups.map((group) => group.storeId),
    ["gyomu-minamikata"],
  );
});

test("using the plan reduces fridge stock and leaves seasonings", () => {
  const plan = {
    focus: "balanced" as const,
    budget: 18400,
    people: 1,
    days: 1,
    mode: "dinner" as const,
    slots: [{ dayIndex: 0, meal: "dinner" as const, recipeId: "soboro", cost: 100 }],
    cost: 100,
    overBy: 0,
    portion: 1,
    nutrition: { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, salt: 0, veg: 0 },
    targets: { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, salt: 0, veg: 0 },
    notes: [],
    sourceKey: "",
  };
  const next = consumeStock(
    [
      { ingredientId: "chicken_hiki", place: "fridge", units: 3 },
      { ingredientId: "wakame", place: "fridge", units: 2 },
    ],
    plan,
  );
  const chicken = next.find((item) => item.ingredientId === "chicken_hiki");
  const wakame = next.find((item) => item.ingredientId === "wakame");
  assert.equal(chicken?.units, 1.5);
  assert.equal(wakame?.units, 2);
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

test("the shop list uses packs and keeps pantry items out of the store total", () => {
  assert.equal(retailBuy("egg", 46).label, "10個入り×5パック");
  assert.equal(retailBuy("egg", 46).chargeUnits, 50);
  assert.equal(retailBuy("aji", 7.4).label, "8尾");
  assert.equal(retailBuy("natto", 7.4).label, "8パック");
  assert.equal(retailBuy("wakame", 33.1).label, "乾燥わかめ 1袋");
  assert.equal(retailBuy("miso", 33.1).label, "味噌 1パック");
  assert.equal(retailBuy("chicken_hiki", 15).label, "300g×5パック");
  assert.equal(retailBuy("cabbage", 8.4).label, "1玉");
  assert.equal(retailBuy("cabbage", 8.4).chargeUnits, 10);
  assert.equal(retailBuy("rice", 56).label, "5kg袋");
  assert.ok(retailBuy("rice", 56).chargeUnits * 60 > 56 * 60);
  const book = createPriceBook("tome", TODAY, []);
  const result = buildPlan(
    {
      budget: 18_400,
      people: 4,
      days: 7,
      mode: "dinner_breakfast",
      prefs: { ...prefs, lessFat: true, noMilk: true },
      excludes: [],
      fullPortions: true,
      weeklyDishes: ["hamburg", "soboro"],
    },
    book,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.balanced.portion >= 1);
  assert.equal(result.balanced.notes.some((note) => note.includes("少なめに見積もって")), false);
  const withPantry = buildShoppingList(result.balanced, book);
  assert.ok(withPantry.groups.every((group) => group.lines.every((line) => line.ingredientId !== "wakame" && line.ingredientId !== "miso")));
  const wakameLine = withPantry.pantry.find((row) => row.ingredientId === "wakame");
  if (wakameLine) {
    assert.match(wakameLine.label, /40g/);
    assert.ok(wakameLine.approxYen < 1500, String(wakameLine.approxYen));
  }
  const misoLine = withPantry.pantry.find((row) => row.ingredientId === "miso");
  if (misoLine) {
    assert.match(misoLine.label, /750g/);
    assert.ok(misoLine.approxYen < 800, String(misoLine.approxYen));
  }
  const stocked = buildShoppingList(result.balanced, book, [
    { ingredientId: "wakame", place: "fridge", units: 100 },
    { ingredientId: "miso", place: "fridge", units: 100 },
  ]);
  assert.equal(stocked.pantry.some((row) => row.ingredientId === "wakame"), false);
  assert.equal(stocked.pantry.some((row) => row.ingredientId === "miso"), false);
});

test("cooking a day does not put that food back on the shopping list", () => {
  const book = createPriceBook("tome", TODAY, []);
  const result = buildPlan(
    {
      budget: 18_400,
      people: 4,
      days: 7,
      mode: "dinner_breakfast",
      prefs,
      excludes: [],
      fullPortions: true,
    },
    book,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const stock = [
    { ingredientId: "cabbage", place: "fridge" as const, units: 10 },
    { ingredientId: "chicken_hiki", place: "freezer" as const, units: 3 },
  ];
  const before = buildShoppingList(result.balanced, book, stock);
  const after = buildShoppingList(result.balanced, book, consumeStock(stock, result.balanced, 0), null, [0]);
  assert.ok(after.multiTotal <= before.multiTotal, `${after.multiTotal} vs ${before.multiTotal}`);
  const unitsOf = (list: typeof before, id: string) =>
    list.groups.flatMap((group) => group.lines).find((line) => line.ingredientId === id)?.units ?? 0;
  assert.ok(unitsOf(after, "chicken_hiki") <= unitsOf(before, "chicken_hiki"));
  assert.ok(unitsOf(after, "cabbage") <= unitsOf(before, "cabbage"));
});

const emptyNutrition = { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, salt: 0, veg: 0 };

test("a normal pantry bag is not priced as 100g", () => {
  const book = createPriceBook("tome", TODAY, []);
  const plan = {
    focus: "balanced" as const,
    budget: 18400,
    people: 4,
    days: 1,
    mode: "dinner" as const,
    slots: [{ dayIndex: 0, meal: "dinner" as const, recipeId: "sake-teishoku", cost: 100 }],
    cost: 100,
    overBy: 0,
    portion: 1,
    nutrition: emptyNutrition,
    targets: emptyNutrition,
    notes: [],
    sourceKey: "",
    startedOn: "2026-11-03",
  };
  const list = buildShoppingList(plan, book);
  const wakame = list.pantry.find((row) => row.ingredientId === "wakame");
  const miso = list.pantry.find((row) => row.ingredientId === "miso");
  assert.ok(wakame);
  assert.equal(wakame?.label, "乾燥わかめ 40g入り1袋（ないときは約¥200〜¥500）");
  assert.ok((wakame?.approxYen ?? 0) >= 200 && (wakame?.approxYen ?? 0) <= 500);
  assert.ok(miso);
  assert.equal(miso?.label, "味噌 750g 1パック（ないときは約¥490）");
  assert.equal(miso?.approxYen, 490);
  const rice = list.groups.flatMap((group) => group.lines).find((line) => line.ingredientId === "rice");
  assert.ok(rice);
  assert.equal(rice?.buyLabel, "5kg袋");
  assert.ok((rice?.neededUnits ?? 0) < (rice?.units ?? 0));
  const surplus = Math.round(((rice?.units ?? 0) - (rice?.neededUnits ?? 0)) * 10) / 10;
  const bought = [{ ingredientId: "rice", place: "fridge" as const, units: surplus }];
  const hidden = buildShoppingList(plan, book, bought);
  const still = buildShoppingList(plan, book, stockAside(bought, { rice: { units: surplus, place: "fridge" } }));
  assert.equal(hidden.groups.some((group) => group.lines.some((line) => line.ingredientId === "rice")), false);
  assert.equal(still.groups.some((group) => group.lines.some((line) => line.ingredientId === "rice")), true);
});

test("the next day keeps a cooked day off the shopping list", () => {
  const start = "2026-11-03";
  const next = "2026-11-04";
  assert.deepEqual(resolvePlanStart(start, next), { startedOn: start, continueWeek: true });
  assert.equal(weekIsOver(start, next), false);
  assert.equal(planDayLabel(start, 0, next), "きのう");
  assert.equal(planDayLabel(start, 1, next), "今日");
  assert.deepEqual(cookedDaysOn([`${start}:0`], start), [0]);
  assert.deepEqual(cookedDaysOn([`${start}:0`], next), []);
  assert.deepEqual(resolvePlanStart(start, "2026-11-10"), { startedOn: "2026-11-10", continueWeek: false });
  assert.equal(weekIsOver(start, "2026-11-10"), true);
  assert.equal(weekIsOver(start, "2026-11-09"), false);

  const book = createPriceBook("tome", start, []);
  const result = buildPlan(
    {
      budget: 18_400,
      people: 4,
      days: 7,
      mode: "dinner_breakfast",
      prefs: { ...prefs, lessFat: true, noMilk: true },
      excludes: [],
      fullPortions: true,
      weeklyDishes: ["hamburg", "soboro"],
    },
    book,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const stock = [
    { ingredientId: "cabbage", place: "fridge" as const, units: 10 },
    { ingredientId: "chicken_hiki", place: "freezer" as const, units: 3 },
    { ingredientId: "egg", place: "fridge" as const, units: 1 },
  ];
  const used = consumeStock(stock, result.balanced, 0);
  const remembered = buildShoppingList(result.balanced, book, used, null, cookedDaysOn([`${start}:0`], start));
  const forgotten = buildShoppingList(result.balanced, book, used, null, cookedDaysOn([`${start}:0`], next));
  assert.ok(remembered.multiTotal < forgotten.multiTotal, `${remembered.multiTotal} vs ${forgotten.multiTotal}`);
});

test("rebuilding a week does not serve a cooked weekly dish again", () => {
  const book = createPriceBook("tome", TODAY, []);
  const input = {
    budget: 18_400,
    people: 4,
    days: 7,
    mode: "dinner_breakfast" as const,
    prefs: { ...prefs, lessFat: true, noMilk: true },
    excludes: [] as string[],
    fullPortions: true,
    weeklyDishes: ["hamburg", "soboro"],
  };
  const first = buildPlan(input, book);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const cookedDay = first.balanced.slots.find((slot) => slot.recipeId === "hamburg")?.dayIndex;
  assert.equal(typeof cookedDay, "number");
  if (cookedDay == null) return;
  const second = buildPlan({ ...input, weeklyDishes: input.weeklyDishes.filter((id) => id !== "hamburg") }, book);
  assert.equal(second.ok, true);
  if (!second.ok) return;
  const locked = syncLeftoverNote(
    ensureWeeklyDishes(
      dropDuplicateCookedDishes(
        keepCookedDays(second.balanced, first.balanced, [cookedDay], book.priceOf),
        [cookedDay],
        ["hamburg", "soboro"],
        book.priceOf,
        input.prefs,
        input.excludes,
      ),
      ["hamburg", "soboro"],
      [cookedDay],
      book.priceOf,
      input.prefs,
      input.excludes,
    ),
  );
  for (const slot of locked.slots) {
    const recipe = getRecipe(slot.recipeId);
    assert.equal(recipe ? isRecipeAllowed(recipe, slot.meal, input.prefs, input.excludes) : false, true, slot.recipeId);
  }
  const days = [...new Set(locked.slots.filter((slot) => slot.recipeId === "hamburg").map((slot) => slot.dayIndex))];
  assert.deepEqual(days, [cookedDay]);
  const soboroDays = locked.slots.filter((slot) => slot.recipeId === "soboro").map((slot) => slot.dayIndex);
  assert.ok(soboroDays.some((day) => day !== cookedDay), soboroDays.join(","));
  const leftoverNote = locked.notes.find((note) => note.includes("残ります"));
  assert.equal(leftoverNote, `予算に¥${(locked.budget - locked.cost).toLocaleString("ja-JP")}残ります。予備費として置いてあります。`);
});

test("a bought pack's leftover is not eaten when a day is cooked", () => {
  const plan = {
    focus: "balanced" as const,
    budget: 18400,
    people: 4,
    days: 1,
    mode: "dinner_breakfast" as const,
    slots: [
      { dayIndex: 0, meal: "breakfast" as const, recipeId: "tamago-kake", cost: 50 },
      { dayIndex: 0, meal: "dinner" as const, recipeId: "sake-teishoku", cost: 100 },
    ],
    cost: 100,
    overBy: 0,
    portion: 1,
    nutrition: emptyNutrition,
    targets: emptyNutrition,
    notes: [],
    sourceKey: "",
  };
  const reserved = {
    rice: { units: 18.6, place: "fridge" as const },
    egg: { units: 6, place: "fridge" as const },
    cabbage: { units: 1.6, place: "fridge" as const },
  };
  const stock = [
    { ingredientId: "rice", place: "fridge" as const, units: 18.6 },
    { ingredientId: "egg", place: "fridge" as const, units: 7 },
    { ingredientId: "cabbage", place: "fridge" as const, units: 4 },
  ];
  const next = consumeStock(stock, plan, 0, reserved);
  assert.equal(next.find((item) => item.ingredientId === "rice")?.units, 18.6);
  assert.equal(next.find((item) => item.ingredientId === "egg")?.units, 6);
  assert.ok((next.find((item) => item.ingredientId === "cabbage")?.units ?? 0) >= 1.6);
  assert.equal(riceUnitsFromKg(5), 66.7);
  assert.equal(riceUnitsFromKg(2), 26.7);
  assert.equal(riceUnitsFromKg(0.01), 0);
  assert.equal(riceUnitsFromKg(30), 400);
  assert.equal(riceUnitsFromKg(40), 400);
  assert.equal(MAX_STOCK_UNITS, 400);
  assert.equal(readRiceKg("１０").kg, 10);
  assert.equal(readRiceKg("0.01").hint, "0.5kg以上にしてください。");
  assert.match(readRiceKg("abc").hint, /半角の数字/);
  assert.equal(readRiceKg("30").kg, 30);
  assert.equal(readRiceKg("40").text, "30");
  assert.equal(readRiceKg("40").kg, 30);
  assert.equal(riceUnitsFromKg(30), MAX_STOCK_UNITS);
  assert.equal(Math.min(MAX_STOCK_UNITS, 500), MAX_STOCK_UNITS);
  assert.equal(Math.min(MAX_STOCK_UNITS, 80), 80);
});

test("the expense week follows the plan start, and stock alone is not a new plan", () => {
  assert.equal(weekRangeLabel("2026-11-04"), "11/2–11/8");
  assert.equal(expenseRangeLabel("2026-11-03"), "11/3–11/9");
  assert.equal(expenseRangeLabel("2026-11-04", "2026-11-03"), "11/3–11/9");
  assert.equal(expenseRangeLabel("2026-11-10", "2026-11-03"), "11/3–11/9");
  assert.equal(samePlanAsideFromStock("a|b|fridge:rice:18.6|c", "a|b|c"), true);
  assert.equal(samePlanAsideFromStock("a|x|fridge:rice:18.6|c", "a|b|c"), false);
  assert.equal(planDayLabel("2026-11-03", 0, "2026-11-04"), "きのう");
  assert.equal(planDayLabel("2026-11-03", 0, "2026-11-10"), "11/3（火）");
});

test("cooking day 1 and rebuilding does not repeat that dinner", () => {
  const book = createPriceBook("tome", "2026-11-10", []);
  const input = {
    budget: 18_400,
    people: 4,
    days: 7,
    mode: "dinner_breakfast" as const,
    prefs: { ...prefs, lessFat: true, noMilk: true },
    excludes: [] as string[],
    fullPortions: true,
    weeklyDishes: ["hamburg", "soboro"],
  };
  const first = buildPlan(input, book);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const previous = {
    ...first.balanced,
    slots: first.balanced.slots.map((slot) =>
      slot.meal === "dinner" && slot.dayIndex === 0 ? { ...slot, recipeId: "tamago-don" } : slot,
    ),
  };
  const second = buildPlan(input, book);
  assert.equal(second.ok, true);
  if (!second.ok) return;
  const planted = {
    ...second.balanced,
    slots: second.balanced.slots.map((slot) =>
      slot.meal === "dinner" && slot.dayIndex === 2 ? { ...slot, recipeId: "tamago-don" } : slot,
    ),
  };
  const locked = syncLeftoverNote(
    ensureWeeklyDishes(
      dropDuplicateCookedDishes(
        keepCookedDays(planted, previous, [0], book.priceOf),
        [0],
        ["hamburg", "soboro"],
        book.priceOf,
        input.prefs,
        input.excludes,
      ),
      ["hamburg", "soboro"],
      [0],
      book.priceOf,
      input.prefs,
      input.excludes,
    ),
  );
  const dinners = locked.slots.filter((slot) => slot.meal === "dinner");
  assert.equal(dinners.find((slot) => slot.dayIndex === 0)?.recipeId, "tamago-don");
  const counts: Record<string, number> = {};
  for (const slot of dinners) counts[slot.recipeId] = (counts[slot.recipeId] ?? 0) + 1;
  assert.equal(counts["tamago-don"], 1);
  for (const [id, count] of Object.entries(counts)) {
    assert.ok(count <= (TWICE_A_WEEK_DISHES.includes(id) ? 2 : 1), `${id}:${count}`);
  }
  const twice = {
    ...planted,
    slots: planted.slots.map((slot) =>
      slot.meal === "dinner" && (slot.dayIndex === 2 || slot.dayIndex === 4) ? { ...slot, recipeId: "hiyayakko" } : slot,
    ),
  };
  const previousCold = {
    ...previous,
    slots: previous.slots.map((slot) =>
      slot.meal === "dinner" && slot.dayIndex === 0 ? { ...slot, recipeId: "hiyayakko" } : slot,
    ),
  };
  const cold = dropDuplicateCookedDishes(
    keepCookedDays(twice, previousCold, [0], book.priceOf),
    [0],
    ["hamburg", "soboro"],
    book.priceOf,
    input.prefs,
    input.excludes,
  );
  assert.equal(cold.slots.filter((slot) => slot.meal === "dinner" && slot.recipeId === "hiyayakko").length, 2);
  assert.equal(cold.slots.find((slot) => slot.dayIndex === 0 && slot.meal === "dinner")?.recipeId, "hiyayakko");
});

test("count labels never look smaller than the amount, and the price stays on the raw number", () => {
  const egg = getIngredient("egg");
  const tofu = getIngredient("tofu");
  assert.ok(egg && tofu);
  if (!egg || !tofu) return;
  assert.equal(formatUnits(0.4, egg), "1個弱");
  assert.equal(formatUnits(0.5, tofu), "1丁弱");
  assert.equal(formatUnits(3.6, egg), "3個と少し");
  assert.equal(formatUnits(10, egg), "10個");
  const book = createPriceBook("tome", TODAY, []);
  const result = buildPlan(
    {
      budget: 18_400,
      people: 4,
      days: 7,
      mode: "dinner_breakfast",
      prefs: { ...prefs, lessFat: true, noMilk: true },
      excludes: [],
      fullPortions: true,
      weeklyDishes: ["hamburg", "soboro"],
    },
    book,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const list = buildShoppingList(result.balanced, book, [{ ingredientId: "egg", place: "fridge", units: 0.4 }]);
  const covered = list.covered.find((row) => row.ingredientId === "egg");
  assert.ok(covered);
  assert.equal(covered?.units, 0.4);
  assert.equal(formatUnits(covered?.units ?? 0, egg), "1個弱");
  const price = book.priceOf("egg");
  assert.equal(Math.round(0.4 * price), Math.round(covered!.units * price));
});

test("optional eggs follow the setting and Tome quotes stay in Tome", () => {
  const book = createPriceBook("tome", TODAY, [
    { id: "foreign", ingredientId: "egg", storeId: "aoba", price: 1, date: TODAY, source: "manual" },
  ]);
  const quote = book.quote("egg");
  assert.ok(quote);
  for (const row of quote?.byStore ?? []) {
    assert.ok(TOME_STORES.includes(row.storeId), row.storeId);
    assert.match(getStore(row.storeId)?.address ?? "", /登米市/);
  }
  assert.equal(quote?.byStore.some((row) => row.storeId === "aoba"), false);
  const natto = getRecipe("natto-set");
  const cold = getRecipe("hiyayakko");
  assert.ok(natto && cold);
  if (!natto || !cold) return;
  assert.match(natto.summary, /納豆・冷奴に卵をのせる/);
  assert.match(cold.steps.join("\n"), /納豆・冷奴に卵をのせる/);
  assert.equal(natto.summary.includes("まだ決めていません"), false);
  assert.ok(recipeCost(natto, 4, book.priceOf, 1, true) > recipeCost(natto, 4, book.priceOf, 1, false));
  const shared = {
    budget: 18_400,
    people: 4,
    days: 7,
    mode: "dinner_breakfast" as const,
    prefs: { ...prefs, lessFat: true, noMilk: true },
    excludes: [] as string[],
    fullPortions: true,
    weeklyDishes: ["hamburg", "soboro"],
  };
  const off = buildPlan(shared, book);
  const on = buildPlan({ ...shared, allowOptionalEggs: true }, book);
  assert.equal(off.ok && on.ok, true);
  if (!off.ok || !on.ok) return;
  assert.equal(off.balanced.allowOptionalEggs, false);
  assert.equal(on.balanced.allowOptionalEggs, true);
  const eggs = (plan: typeof off.balanced) =>
    plan.slots.reduce((sum, slot) => {
      const recipe = getRecipe(slot.recipeId);
      const units = recipe
        ? (usedItems(recipe.id, recipe.items, plan.allowOptionalEggs === true).find((item) => item.ingredientId === "egg")
            ?.units ?? 0)
        : 0;
      return sum + units * plan.people * plan.portion;
    }, 0);
  const offEggs = eggs(off.balanced);
  const onEggs = eggs(on.balanced);
  assert.ok(onEggs >= offEggs, `${onEggs} vs ${offEggs}`);
  const shopOff = buildShoppingList(off.balanced, book);
  const shopOn = buildShoppingList({ ...off.balanced, allowOptionalEggs: true }, book);
  const line = (list: typeof shopOff) =>
    list.groups.flatMap((group) => group.lines).find((item) => item.ingredientId === "egg");
  const offLine = line(shopOff);
  const onLine = line(shopOn);
  if (off.balanced.slots.some((slot) => slot.recipeId === "natto-set" || slot.recipeId === "hiyayakko")) {
    assert.ok((onLine?.neededUnits ?? 0) > (offLine?.neededUnits ?? 0));
  }
  const stockScreen = readFileSync(new URL("../components/screens/stock-screen.tsx", import.meta.url), "utf8");
  assert.match(stockScreen, /登米市南方町/);
  assert.equal(stockScreen.includes("ヨークベニマル 仙台"), false);
  assert.equal(stockScreen.includes("イオン 仙台"), false);
  assert.equal(stockScreen.includes("仙台市青葉区"), false);
  for (const ingredient of ingredients) {
    const row = book.quote(ingredient.id);
    for (const store of row?.byStore ?? []) assert.ok(TOME_STORES.includes(store.storeId), `${ingredient.id}:${store.storeId}`);
  }
});

test("Tome home headings stay local, and the egg switch is labeled for reading aloud", () => {
  assert.equal(marketHeading("tome"), "きょうの宮城の市場（仙台市場の値段）");
  assert.equal(marketHeading("sendai"), "きょうの仙台市場");
  assert.equal(seasonHeading(11, "tome"), "11月の宮城の旬（仙台周辺の表）");
  assert.equal(seasonHeading(11, "nakano"), "11月の仙台周辺");
  const meals = readFileSync(new URL("../components/screens/meals-screen.tsx", import.meta.url), "utf8");
  assert.match(meals, /卵を除くが優先です/);
  assert.match(meals, /朝と夜の範囲/);
  assert.match(meals, /aria-pressed=\{app\.state\.eggToppingPolicy === id\}/);
  assert.match(meals, /aria-pressed=\{app\.state\.mode === mode\}/);
});

test("excluding eggs keeps natto and cold tofu, and stays inside the budget", () => {
  const book = createPriceBook("tome", TODAY, []);
  const family = { ...prefs, lessFat: true, noMilk: true };
  assert.equal(isRecipeAllowed(getRecipe("hiyayakko")!, "dinner", family, ["egg"]), true);
  assert.equal(isRecipeAllowed(getRecipe("natto-set")!, "breakfast", family, ["egg"]), true);
  assert.equal(isRecipeAllowed(getRecipe("tamago-don")!, "dinner", family, ["egg"]), false);
  assert.equal(isRecipeAllowed(getRecipe("hamburg")!, "dinner", family, ["egg"]), false);
  const result = buildPlan(
    {
      budget: 18_400,
      people: 4,
      days: 7,
      mode: "dinner_breakfast",
      prefs: family,
      excludes: ["egg"],
      fullPortions: true,
      weeklyDishes: ["hamburg", "soboro"],
      allowOptionalEggs: false,
    },
    book,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const plan = result.balanced;
  assert.ok(plan.cost <= 18_400, String(plan.cost));
  assert.ok(18_400 - plan.cost >= 800, `leftover ${18_400 - plan.cost}`);
  const dinners = plan.slots.filter((slot) => slot.meal === "dinner").map((slot) => slot.recipeId);
  assert.ok(dinners.includes("hiyayakko"), dinners.join(","));
  const counts: Record<string, number> = {};
  for (const id of dinners) counts[id] = (counts[id] ?? 0) + 1;
  for (const [id, count] of Object.entries(counts)) {
    assert.ok(count <= (TWICE_A_WEEK_DISHES.includes(id) ? 2 : 1), `${id}:${count}`);
  }
  const breakfasts = plan.slots.filter((slot) => slot.meal === "breakfast").map((slot) => slot.recipeId);
  assert.ok(breakfasts.includes("natto-set"), breakfasts.join(","));
  assert.ok(new Set(breakfasts).size >= 2, breakfasts.join(","));
  const eggUnits = plan.slots.reduce((sum, slot) => {
    const recipe = getRecipe(slot.recipeId);
    const units = recipe ? (usedItems(recipe.id, recipe.items, false).find((item) => item.ingredientId === "egg")?.units ?? 0) : 0;
    return sum + units;
  }, 0);
  assert.equal(eggUnits, 0);
  assert.equal(plan.notes.some((note) => note.includes("種類が足りません")), false);
  const shop = buildShoppingList(plan, book);
  assert.equal(shop.groups.some((group) => group.lines.some((line) => line.ingredientId === "egg")), false);
  const saved = "tome|2|2|teen|unset|unset|avoid|4|18400|80000|dinner_breakfast|false|false|false|false|true|true||";
  const next = "tome|2|2|teen|unset|unset|avoid|4|18400|80000|dinner_breakfast|false|false|false|false|true|true|egg|";
  assert.equal(planChangeNote(saved, next), "きらいな食べ物の設定が変わりました。献立を作り直してください。");
  assert.equal(planChangeNote(saved, saved), "");
});

test("YouTube button is a search for the dish name", () => {
  const url = youtubeCookUrl("鶏と豆腐のハンバーグ");
  assert.equal(url.startsWith("https://www.youtube.com/results?search_query="), true);
  assert.equal(decodeURIComponent(url.split("search_query=")[1] ?? ""), "鶏と豆腐のハンバーグ 作り方");
  assert.equal(url.includes("key="), false);
  assert.ok(getIngredient("chicken_hiki"));
});
