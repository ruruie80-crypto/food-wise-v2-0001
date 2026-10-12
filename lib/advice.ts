import { getIngredient, getRecipe } from "./catalog";
import type { Plan } from "./types";

const METHODS: Record<string, string> = {
  "shio-dare": "炒める",
  "shoga-yaki": "焼く",
  "saba-daikon": "煮る",
  "iwashi-tomato": "煮て絡める",
  soboro: "炒り煮",
  mapo: "煮る",
  niratama: "炒める",
  "komatsu-egg": "炒める",
  "yasai-itame": "炒める",
  curry: "煮込む",
  "sake-teishoku": "焼く",
  "aji-teishoku": "焼く",
  tonjiru: "煮る",
  hiyayakko: "冷やす",
  nabe: "煮る",
  thigh: "焼く",
  "tamago-don": "のせる",
  "pork-don": "炒める",
  "natto-set": "のせる",
  "tamago-kake": "のせる",
  "tamagoyaki-set": "焼く",
  "tofu-morning": "煮る",
  onigiri: "にぎる",
  udon: "ゆでる",
  "pasta-lunch": "炒める",
  "tofu-salad": "和える",
};

export function cookingMethod(recipeId: string): string {
  return METHODS[recipeId] ?? "調理";
}

export type PlannedFood = {
  ingredientId: string;
  units: number;
  linePrice: number;
  recipeIds: string[];
};

export function plannedFoods(plan: Plan, priceOf: (ingredientId: string) => number): PlannedFood[] {
  const totals = new Map<string, { units: number; recipeIds: string[] }>();
  for (const slot of plan.slots) {
    const recipe = getRecipe(slot.recipeId);
    if (!recipe) continue;
    for (const item of recipe.items) {
      const row = totals.get(item.ingredientId) ?? { units: 0, recipeIds: [] };
      row.units += item.units * plan.people * plan.portion;
      if (!row.recipeIds.includes(recipe.id)) row.recipeIds.push(recipe.id);
      totals.set(item.ingredientId, row);
    }
  }
  return [...totals.entries()]
    .map(([ingredientId, row]) => {
      const unit = priceOf(ingredientId);
      return {
        ingredientId,
        units: row.units,
        linePrice: Number.isFinite(unit) ? Math.round(row.units * unit) : 0,
        recipeIds: row.recipeIds,
      };
    })
    .sort((a, b) => {
      const seasoning = Number(getIngredient(a.ingredientId)?.category === "seasoning") - Number(getIngredient(b.ingredientId)?.category === "seasoning");
      return seasoning || b.linePrice - a.linePrice || a.ingredientId.localeCompare(b.ingredientId);
    });
}

export type MethodGroup = {
  method: string;
  recipeIds: string[];
};

export function methodsInPlan(plan: Plan): MethodGroup[] {
  const order: string[] = [];
  const groups = new Map<string, string[]>();
  for (const slot of plan.slots) {
    const method = cookingMethod(slot.recipeId);
    const list = groups.get(method);
    if (!list) {
      groups.set(method, [slot.recipeId]);
      order.push(method);
    } else if (!list.includes(slot.recipeId)) {
      list.push(slot.recipeId);
    }
  }
  return order.map((method) => ({ method, recipeIds: groups.get(method) ?? [] }));
}
