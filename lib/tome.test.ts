import assert from "node:assert/strict";
import test from "node:test";
import { getIngredient, getRecipe, ingredients, recipes, storesIn } from "./catalog";
import { planDayLabel, resolvePlanStart, weekIsOver } from "./dates";
import { CHILD_PORTION, householdServings, TOME_PRESET, weeklyFromMonthly } from "./household";
import { consumeStock } from "./stock";
import { buildPlan, dropDuplicateCookedDishes, ensureWeeklyDishes, keepCookedDays, syncLeftoverNote } from "./optimizer";
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
  assert.equal(wakame?.label, "乾燥わかめ 40g入り1袋（ないときは約¥972）");
  assert.equal(wakame?.approxYen, 972);
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
      ),
      ["hamburg", "soboro"],
      [cookedDay],
      book.priceOf,
    ),
  );
  const days = [...new Set(locked.slots.filter((slot) => slot.recipeId === "hamburg").map((slot) => slot.dayIndex))];
  assert.deepEqual(days, [cookedDay]);
  const soboroDays = locked.slots.filter((slot) => slot.recipeId === "soboro").map((slot) => slot.dayIndex);
  assert.ok(soboroDays.some((day) => day !== cookedDay), soboroDays.join(","));
  const leftoverNote = locked.notes.find((note) => note.includes("残ります"));
  assert.equal(leftoverNote, `予算に¥${(locked.budget - locked.cost).toLocaleString("ja-JP")}残ります。予備費として置いてあります。`);
});

test("YouTube button is a search for the dish name", () => {
  const url = youtubeCookUrl("鶏と豆腐のハンバーグ");
  assert.equal(url.startsWith("https://www.youtube.com/results?search_query="), true);
  assert.equal(decodeURIComponent(url.split("search_query=")[1] ?? ""), "鶏と豆腐のハンバーグ 作り方");
  assert.equal(url.includes("key="), false);
  assert.ok(getIngredient("chicken_hiki"));
});
