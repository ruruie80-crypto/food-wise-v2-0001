"use client";

import Link from "next/link";
import { getIngredient, getRecipe } from "@/lib/catalog";
import { useApp } from "@/components/app-state";
import { Yen } from "@/components/bits";
import { RecipeVideoButton } from "@/components/recipe-player";
import { cookingMethod, methodsInPlan, plannedFoods } from "@/lib/advice";
import { addDays, formatWithWeekday } from "@/lib/dates";
import { formatUnits, mealLabel, yen } from "@/lib/format";

export function BudgetAdvice({ variant }: { variant: "compact" | "full" }) {
  const app = useApp();
  const plan = app.activePlan;
  if (!app.ready || !app.book || !app.today || !plan) return null;
  const foods = plannedFoods(plan, app.book.priceOf);
  const methods = methodsInPlan(plan);
  if (variant === "compact") {
    return (
      <section className="mt-6">
        <p className="text-[11px] font-bold tracking-[0.16em] text-[#1b6b43]">この予算から</p>
        <h2 className="text-lg font-black">1週間の献立</h2>
        <p className="mt-1 text-xs leading-5 text-[#5e574c]">
          今週 {yen(plan.budget)} のうち、献立は {yen(plan.cost)} です。作り方は各皿の動画です。
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {foods.slice(0, 6).map((food) => (
            <li key={food.ingredientId} className="rounded-full bg-white px-3 py-1 text-sm font-bold">
              {getIngredient(food.ingredientId)?.name}
            </li>
          ))}
        </ul>
        <ol className="mt-3 space-y-2">
          {Array.from({ length: plan.days }, (_, day) => {
            const slots = plan.slots.filter((slot) => slot.dayIndex === day);
            const label = day === 0 ? "今日" : day === 1 ? "明日" : formatWithWeekday(addDays(app.today, day));
            return (
              <li key={day} className="rounded-3xl bg-white p-4">
                <p className="text-sm font-black">{label}</p>
                <ul className="mt-2 space-y-2">
                  {slots.map((slot) => {
                    const recipe = getRecipe(slot.recipeId);
                    return (
                      <li key={`${slot.meal}-${slot.recipeId}`} className="flex items-center justify-between gap-3 text-sm">
                        <span>
                          <span className="text-[#5e574c]">{mealLabel(slot.meal)}</span> {recipe?.name}
                          <span className="mt-0.5 block text-xs text-[#5e574c]">{cookingMethod(slot.recipeId)}</span>
                        </span>
                        <RecipeVideoButton recipeId={slot.recipeId} />
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
        <Link href="/meals" className="mt-3 inline-block text-sm font-bold text-[#1b6b43]">
          食材と7日分を見る
        </Link>
      </section>
    );
  }

  return (
    <>
      <section className="mt-6" id="foods">
        <p className="text-[11px] font-bold tracking-[0.16em] text-[#1b6b43]">食材</p>
        <h2 className="text-lg font-black">この予算で買うもの</h2>
        <ul className="mt-3 divide-y divide-[#e3d8c6] rounded-3xl bg-white px-3">
          {foods.map((food) => {
            const ingredient = getIngredient(food.ingredientId);
            const names = food.recipeIds.map((id) => getRecipe(id)?.name).filter((name): name is string => Boolean(name));
            const dishes = names.length <= 2 ? names.join("、") : `${names.slice(0, 2).join("、")} ほか${names.length - 2}品`;
            return (
              <li key={food.ingredientId}>
                <Link href={`/prices/${food.ingredientId}`} className="flex items-start justify-between gap-3 py-3">
                  <span>
                    <span className="font-bold">{ingredient?.name ?? food.ingredientId}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-[#5e574c]">
                      {ingredient ? formatUnits(food.units, ingredient) : ""} · {dishes}
                    </span>
                  </span>
                  <Yen value={food.linePrice} className="text-xl" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="mt-6" id="methods">
        <p className="text-[11px] font-bold tracking-[0.16em] text-[#1b6b43]">調理法</p>
        <h2 className="text-lg font-black">この週の作り方</h2>
        <ul className="mt-3 space-y-2">
          {methods.map((group) => (
            <li key={group.method} className="rounded-3xl bg-white p-4">
              <p className="font-black">{group.method}</p>
              <ul className="mt-2 space-y-3">
                {group.recipeIds.map((recipeId) => {
                  const recipe = getRecipe(recipeId);
                  if (!recipe) return null;
                  return (
                    <li key={recipeId} className="flex items-center justify-between gap-3">
                      <span>
                        <span className="block text-sm font-bold">{recipe.name}</span>
                        <span className="text-xs text-[#5e574c]">{recipe.minutes}分 · {recipe.steps.length}手順</span>
                      </span>
                      <RecipeVideoButton recipeId={recipeId} />
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
