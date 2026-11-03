"use client";

import Link from "next/link";
import { getIngredient, getRecipe } from "@/lib/catalog";
import { useApp } from "@/components/app-state";
import { Yen } from "@/components/bits";
import { RecipeVideoButton } from "@/components/recipe-player";
import { cookingMethod, methodsInPlan, plannedFoods } from "@/lib/advice";
import { ingredientTargetPercents, nutrientRows } from "@/lib/nutrients";
import { formatWithWeekday, planDayLabel } from "@/lib/dates";
import { formatUnits, mealLabel, trimNum, yen } from "@/lib/format";
import { CookedMark } from "@/components/cooked-mark";
import { isMealCooked } from "@/lib/cooked";
import { avoidsFish, plainMisoText, recipeCopy } from "@/lib/household";
import type { Plan } from "@/lib/types";

export function BudgetAdvice({ variant }: { variant: "compact" | "full" }) {
  const app = useApp();
  const plan = app.activePlan;
  if (!app.ready || !app.book || !app.today || !plan) return null;
  const foods = plannedFoods(plan, app.book.priceOf);
  const methods = methodsInPlan(plan);
  const fishAside = avoidsFish(app.state.excludes);
  const eggsAside = app.state.excludes.includes("egg");
  const dishName = (recipe: { id: string; name: string; summary: string; steps: string[] }) =>
    recipeCopy(recipe, eggsAside, fishAside).name ?? recipe.name;
  const foodName = (name: string | undefined, id: string) => plainMisoText(name ?? id, fishAside);
  if (variant === "compact") {
    return (
      <section className="mt-6">
        <p className="text-[11px] font-bold tracking-[0.16em] text-primary">この予算から</p>
        <h2 className="text-lg font-black">1週間の献立</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          今週 {yen(plan.budget)} のうち、献立は {yen(plan.cost)} です。
          {formatWithWeekday(plan.startedOn ?? app.today)}から7日です。作り方は各皿の動画です。
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {foods.slice(0, 6).map((food) => (
            <li key={food.ingredientId} className="rounded-full bg-card px-3 py-1 text-sm font-bold">
              {foodName(getIngredient(food.ingredientId)?.name, food.ingredientId)}
            </li>
          ))}
        </ul>
        <ol className="mt-3 space-y-2">
          {Array.from({ length: plan.days }, (_, day) => {
            const slots = plan.slots.filter((slot) => slot.dayIndex === day);
            const label = planDayLabel(plan.startedOn ?? app.today, day, app.today);
            return (
              <li key={day} className="rounded-3xl bg-card p-4">
                <p className="text-sm font-black">{label}</p>
                <ul className="mt-2 space-y-2">
                  {slots.map((slot) => {
                    const recipe = getRecipe(slot.recipeId);
                    return (
                      <li key={`${slot.meal}-${slot.recipeId}`} className="text-sm">
                        <p className="break-keep text-base leading-7">
                          <span className="text-muted-foreground">{mealLabel(slot.meal)}</span>{" "}
                          {recipe ? dishName(recipe) : slot.recipeId}
                          <CookedMark cooked={isMealCooked(app.state.cookedKeys, plan.startedOn ?? app.today, day, slot.meal)} />
                        </p>
                        <p className="text-sm text-muted-foreground">{cookingMethod(slot.recipeId)}</p>
                        <RecipeVideoButton recipeId={slot.recipeId} />
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
        <Link href="/meals" className="mt-3 inline-flex min-h-11 items-center text-base font-bold text-primary">
          食材と7日分を見る
        </Link>
      </section>
    );
  }

  return (
    <>
      <section className="mt-6" id="foods">
        <p className="text-[11px] font-bold tracking-[0.16em] text-primary">食材</p>
        <h2 className="text-lg font-black">この予算で買うもの</h2>
        <ul className="mt-3 divide-y divide-border rounded-3xl bg-card px-3">
          {foods.map((food) => {
            const ingredient = getIngredient(food.ingredientId);
            const names = food.recipeIds
              .map((id) => getRecipe(id))
              .filter((recipe): recipe is NonNullable<typeof recipe> => Boolean(recipe))
              .map((recipe) => dishName(recipe));
            const dishes = names.length <= 2 ? names.join("、") : `${names.slice(0, 2).join("、")} ほか${names.length - 2}品`;
            const marks = ingredientTargetPercents(plan, food.ingredientId);
            return (
              <li key={food.ingredientId}>
                <Link href={`/prices/${food.ingredientId}`} className="flex items-start justify-between gap-3 py-3">
                  <span>
                    <span className="font-bold">{foodName(ingredient?.name, food.ingredientId)}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      {ingredient ? formatUnits(food.units, ingredient) : ""} · {dishes}
                    </span>
                    {marks.length > 0 ? (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {marks.map((mark) => (
                          <span key={mark.label} className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-bold text-primary">
                            {mark.label} {mark.targetPercent}%
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  <Yen value={food.linePrice} className="text-xl" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      <NutrientBoard plan={plan} fishAside={fishAside} />
      <section className="mt-6" id="methods">
        <p className="text-[11px] font-bold tracking-[0.16em] text-primary">調理法</p>
        <h2 className="text-lg font-black">この週の作り方</h2>
        <ul className="mt-3 space-y-2">
          {methods.map((group) => (
            <li key={group.method} className="rounded-3xl bg-card p-4">
              <p className="font-black">{group.method}</p>
              <ul className="mt-2 space-y-3">
                {group.recipeIds.map((recipeId) => {
                  const recipe = getRecipe(recipeId);
                  if (!recipe) return null;
                  return (
                    <li key={recipeId} className="flex items-center justify-between gap-3">
                      <span>
                        <span className="block text-sm font-bold">{dishName(recipe)}</span>
                        <span className="text-xs text-muted-foreground">{recipe.minutes}分 · {recipe.steps.length}手順</span>
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

function NutrientBoard({ plan, fishAside }: { plan: Plan; fishAside: boolean }) {
  const rows = nutrientRows(plan);
  return (
    <section className="mt-6">
      <p className="text-[11px] font-bold tracking-[0.16em] text-primary">栄養素</p>
      <h2 className="text-lg font-black">食材ごとの割合</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        見出しは今週の目標に対する割合です。食材の数字は、その栄養素のうち何%をその食材から取っているかです。
      </p>
      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li key={row.key} className="rounded-3xl bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-bold">{row.label}</p>
              <p className="text-right">
                <span className="font-price text-2xl font-semibold">{row.targetPercent}%</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {row.key === "kcal" ? `${Math.round(row.amount)}kcal` : `${row.key === "salt" ? trimNum(row.amount) : Math.round(row.amount)}${row.unit}`}
                </span>
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-track">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, row.targetPercent)}%` }} />
            </div>
            <ul className="mt-3 space-y-1">
              {row.sources.slice(0, 4).map((source) => (
                <li key={source.ingredientId} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {source.ingredientId === "seasoning"
                      ? "調味"
                      : plainMisoText(getIngredient(source.ingredientId)?.name ?? source.ingredientId, fishAside)}
                  </span>
                  <span className="font-bold text-primary">{source.sharePercent}%</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
