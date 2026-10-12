"use client";

import Link from "next/link";
import { getIngredient, getRecipe } from "@/lib/catalog";
import { useApp } from "@/components/app-state";
import { Yen } from "@/components/bits";
import { cookingMethod, methodsInPlan, plannedFoods } from "@/lib/advice";
import { formatUnits, mealLabel, yen } from "@/lib/format";

export function BudgetAdvice({ variant }: { variant: "compact" | "full" }) {
  const app = useApp();
  const plan = app.activePlan;
  if (!app.ready || !app.book || !plan) return null;
  const foods = plannedFoods(plan, app.book.priceOf);
  const methods = methodsInPlan(plan);
  if (variant === "compact") {
    const today = plan.slots.filter((slot) => slot.dayIndex === 0);
    return (
      <section className="mt-6">
        <p className="text-[11px] font-bold tracking-[0.16em] text-[#1b6b43]">この予算から</p>
        <h2 className="text-lg font-black">食材・調理・献立</h2>
        <p className="mt-1 text-xs leading-5 text-[#5e574c]">
          今週 {yen(plan.budget)} のうち、献立は {yen(plan.cost)} です。
        </p>
        <div className="mt-3 rounded-3xl bg-white p-4">
          <p className="text-[11px] font-bold tracking-[0.14em] text-[#1b6b43]">食材</p>
          <p className="mt-1 text-sm leading-6 font-bold">
            {foods
              .slice(0, 6)
              .map((food) => getIngredient(food.ingredientId)?.name)
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-3 text-[11px] font-bold tracking-[0.14em] text-[#1b6b43]">調理</p>
          <ul className="mt-1 space-y-1 text-sm leading-6">
            {today.map((slot) => {
              const recipe = getRecipe(slot.recipeId);
              return (
                <li key={`${slot.meal}-${slot.recipeId}`}>
                  <span className="text-[#5e574c]">{mealLabel(slot.meal)}</span> {recipe?.name} · {cookingMethod(slot.recipeId)}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] font-bold tracking-[0.14em] text-[#1b6b43]">献立</p>
          <p className="mt-1 text-sm leading-6">{plan.days}日分 · {methods.map((group) => group.method).join("、")}</p>
          <Link href="/meals" className="mt-3 inline-block text-sm font-bold text-[#1b6b43]">
            食材と作り方を見る
          </Link>
        </div>
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
                    <li key={recipeId}>
                      <p className="text-sm font-bold">{recipe.name}</p>
                      <p className="text-xs text-[#5e574c]">{recipe.minutes}分</p>
                      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-6">
                        {recipe.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
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
