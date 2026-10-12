import { getIngredient, getRecipe } from "./catalog";
import { percent } from "./format";
import type { Ingredient, Nutrition, Plan } from "./types";

export const NUTRIENT_META = [
  { key: "kcal", label: "エネルギー", unit: "kcal" },
  { key: "protein", label: "たんぱく質", unit: "g" },
  { key: "fat", label: "脂質", unit: "g" },
  { key: "carb", label: "炭水化物", unit: "g" },
  { key: "fiber", label: "食物繊維", unit: "g" },
  { key: "veg", label: "野菜", unit: "g" },
  { key: "salt", label: "食塩", unit: "g" },
] as const;

export type NutrientKey = (typeof NUTRIENT_META)[number]["key"];

export type NutrientSource = {
  ingredientId: string;
  sharePercent: number;
  targetPercent: number;
};

export type NutrientRow = {
  key: NutrientKey;
  label: string;
  unit: string;
  amount: number;
  targetPercent: number;
  sources: NutrientSource[];
};

function zero(): Nutrition {
  return { kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, salt: 0, veg: 0 };
}

function scale(nutrition: Nutrition, factor: number): Nutrition {
  return {
    kcal: nutrition.kcal * factor,
    protein: nutrition.protein * factor,
    fat: nutrition.fat * factor,
    carb: nutrition.carb * factor,
    fiber: nutrition.fiber * factor,
    salt: nutrition.salt * factor,
    veg: nutrition.veg * factor,
  };
}

export function nutritionFromGrams(ingredient: Ingredient, grams: number): Nutrition {
  return scale(ingredient.per100g, grams / 100);
}

export function planIngredientNutrition(plan: Plan): Map<string, Nutrition> {
  const grams = new Map<string, number>();
  for (const slot of plan.slots) {
    const recipe = getRecipe(slot.recipeId);
    if (!recipe) continue;
    for (const item of recipe.items) {
      const ingredient = getIngredient(item.ingredientId);
      if (!ingredient) continue;
      const next = item.units * ingredient.gramsPerUnit * plan.people * plan.portion;
      grams.set(item.ingredientId, (grams.get(item.ingredientId) ?? 0) + next);
    }
  }
  const totals = new Map<string, Nutrition>();
  for (const [id, amount] of grams) {
    const ingredient = getIngredient(id);
    if (!ingredient) continue;
    totals.set(id, nutritionFromGrams(ingredient, amount));
  }
  return totals;
}

export function nutrientRows(plan: Plan): NutrientRow[] {
  const byIngredient = planIngredientNutrition(plan);
  const ingredientSalt = [...byIngredient.values()].reduce((sum, nutrition) => sum + nutrition.salt, 0);
  return NUTRIENT_META.map((meta) => {
    const amount = plan.nutrition[meta.key];
    const target = plan.targets[meta.key];
    const sources = [...byIngredient.entries()]
      .map(([ingredientId, nutrition]) => ({
        ingredientId,
        sharePercent: percent(nutrition[meta.key], amount),
        targetPercent: percent(nutrition[meta.key], target),
      }))
      .filter((source) => source.sharePercent > 0 || source.targetPercent > 0)
      .sort((a, b) => b.sharePercent - a.sharePercent || a.ingredientId.localeCompare(b.ingredientId));
    if (meta.key === "salt") {
      const covered = sources.reduce((sum, source) => sum + source.sharePercent, 0);
      if (covered <= 98) {
        sources.push({
          ingredientId: "seasoning",
          sharePercent: 100 - covered,
          targetPercent: percent(Math.max(0, amount - ingredientSalt), target),
        });
        sources.sort((a, b) => b.sharePercent - a.sharePercent || a.ingredientId.localeCompare(b.ingredientId));
      }
    }
    return {
      key: meta.key,
      label: meta.label,
      unit: meta.unit,
      amount,
      targetPercent: percent(amount, target),
      sources,
    };
  });
}

export function ingredientTargetPercents(plan: Plan, ingredientId: string): { label: string; targetPercent: number }[] {
  const nutrition = planIngredientNutrition(plan).get(ingredientId) ?? zero();
  return NUTRIENT_META.map((meta) => ({
    label: meta.label,
    targetPercent: percent(nutrition[meta.key], plan.targets[meta.key]),
  }))
    .filter((row) => row.targetPercent > 0)
    .sort((a, b) => b.targetPercent - a.targetPercent || a.label.localeCompare(b.label, "ja"))
    .slice(0, 3);
}

export function unitTargetPercents(ingredient: Ingredient, day: Nutrition): { label: string; percent: number }[] {
  const nutrition = nutritionFromGrams(ingredient, ingredient.gramsPerUnit);
  return NUTRIENT_META.map((meta) => ({
    label: meta.label,
    percent: percent(nutrition[meta.key], day[meta.key]),
  })).filter((row) => row.percent > 0);
}
