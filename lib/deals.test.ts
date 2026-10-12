import assert from "node:assert/strict";
import test from "node:test";
import { ingredients, storesIn } from "./catalog";
import { cheapestAtStore, cheapestStoreLabel, samePicks, type DealQuote } from "./deals";
import { createPriceBook } from "./prices";
import type { Category, Observation } from "./types";

const TODAY = "2026-10-07";

function quotesFor(areaId: string, observations: Observation[] = []): DealQuote[] {
  const book = createPriceBook(areaId, TODAY, observations);
  return ingredients.flatMap((item) => {
    const quote = book.quote(item.id);
    if (!quote) return [];
    return [{ ingredientId: item.id, category: item.category, byStore: quote.byStore }];
  });
}

function picks(areaId: string, storeId: string, observations: Observation[] = []) {
  return cheapestAtStore(storeId, quotesFor(areaId, observations));
}

test("Iwanuma stores share the survey ranking and have no exclusive deal", () => {
  const quotes = quotesFor("iwanuma");
  const boards = storesIn("iwanuma").map((store) => picks("iwanuma", store.id));
  assert.ok(boards.every((board) => samePicks(board, boards[0])));
  assert.equal(boards[0].some((pick) => pick.onlyHere), false);
  assert.equal(boards[0].some((pick) => pick.category === "seasoning"), false);
  const veg = boards[0].filter((pick) => pick.category === "vegetable");
  assert.deepEqual(
    veg.map((pick) => pick.ingredientId),
    ["cabbage", "daikon"],
  );
  assert.equal(veg[0]?.price, 22);
  assert.deepEqual(
    boards[0].filter((pick) => pick.category === "meat").map((pick) => pick.ingredientId),
    ["chicken_b", "chicken_hiki"],
  );
  assert.deepEqual(
    boards[0].filter((pick) => pick.category === "fish").map((pick) => pick.ingredientId),
    ["aji", "mackerel"],
  );
  assert.equal(boards[0].find((pick) => pick.category === "egg_soy")?.ingredientId, "egg");
  assert.equal(boards[0].find((pick) => pick.category === "staple")?.ingredientId, "rice");
  for (const category of ["vegetable", "meat", "fish", "egg_soy", "staple"] as Category[]) {
    assert.ok(boards[0].filter((pick) => pick.category === category).length <= 2);
  }
  assert.equal(quotes.some((quote) => quote.category === "seasoning"), true);
});

test("a scanned tag becomes that store's exclusive cheapest item", () => {
  const observations: Observation[] = [
    {
      id: "scan-1",
      ingredientId: "cabbage",
      storeId: "fresco-iwanuma-nishi",
      price: 15,
      date: "2026-10-01",
      source: "tag",
    },
  ];
  const fresco = picks("iwanuma", "fresco-iwanuma-nishi", observations);
  const york = picks("iwanuma", "york-iwanuma", observations);
  const frescoCabbage = fresco.find((pick) => pick.ingredientId === "cabbage");
  const yorkCabbage = york.find((pick) => pick.ingredientId === "cabbage");
  assert.equal(frescoCabbage?.price, 15);
  assert.equal(frescoCabbage?.onlyHere, true);
  assert.equal(yorkCabbage?.price, 22);
  assert.equal(yorkCabbage?.onlyHere, false);
  assert.equal(samePicks(fresco, york), false);
});

test("Tokyo sample stores each have some food only they sell cheapest", () => {
  const quotes = quotesFor("nakano");
  const winners = storesIn("nakano").flatMap((store) =>
    cheapestAtStore(store.id, quotes).filter((pick) => pick.onlyHere),
  );
  assert.ok(winners.length >= 1);
  for (const pick of winners) {
    const quote = quotes.find((item) => item.ingredientId === pick.ingredientId);
    assert.ok(quote);
    assert.equal(quote.byStore.some((row) => row.price < pick.price), false);
    assert.equal(quote.byStore.filter((row) => row.price === pick.price).length, 1);
  }
});

test("an exclusive item outside the cheapest two is still listed", () => {
  const quotes: DealQuote[] = ["a", "b", "c", "d", "e"].map((id, index) => ({
    ingredientId: id,
    category: "vegetable",
    byStore: [
      { storeId: "here", price: (index + 1) * 10 },
      { storeId: "there", price: (index + 1) * 10 + 5 },
    ],
  }));
  const picksHere = cheapestAtStore("here", quotes);
  assert.deepEqual(
    picksHere.map((pick) => pick.ingredientId),
    ["a", "b", "c"],
  );
  assert.ok(picksHere.every((pick) => pick.onlyHere));
});

test("cheapest store label names one winner and a full tie", () => {
  assert.equal(
    cheapestStoreLabel(
      [
        { storeId: "a", price: 20 },
        { storeId: "b", price: 30 },
      ],
      (id) => id,
    ),
    "a",
  );
  assert.equal(
    cheapestStoreLabel(
      [
        { storeId: "a", price: 20 },
        { storeId: "b", price: 20 },
      ],
      (id) => id,
    ),
    "どの店も同じ",
  );
  assert.equal(
    cheapestStoreLabel(
      [
        { storeId: "a", price: 20 },
        { storeId: "b", price: 20 },
        { storeId: "c", price: 30 },
      ],
      (id) => id,
    ),
    "2店が最安",
  );
});
