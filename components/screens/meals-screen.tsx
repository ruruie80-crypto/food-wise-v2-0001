"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BudgetAdvice } from "@/components/budget-advice";
import { RecipeVideoButton } from "@/components/recipe-player";
import { getRecipe, recipes } from "@/lib/catalog";
import { useApp } from "@/components/app-state";
import { BootScreen, SectionTitle, Yen } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { addDays, formatWithWeekday } from "@/lib/dates";
import {
  MODE_LABEL,
  budgetHint,
  mealLabel,
  modeHint,
  percent,
  yen,
} from "@/lib/format";
import { cookingMethod } from "@/lib/advice";
import { recipeCost, recipeNutrition } from "@/lib/optimizer";
import type { MealMode, MealType, Plan, PlanSlot, Prefs } from "@/lib/types";
import { cn } from "@/lib/utils";

const PREFS: { key: keyof Prefs; label: string }[] = [
  { key: "quick", label: "20分以内" },
  { key: "moreVeg", label: "野菜多め" },
  { key: "highProtein", label: "高たんぱく" },
  { key: "washoku", label: "和食多め" },
];

const EXCLUSIONS = [
  { label: "豚肉", ids: ["pork", "pork_hiki"] },
  { label: "魚", ids: ["salmon", "aji", "sardine", "mackerel"] },
  { label: "卵", ids: ["egg"] },
  { label: "納豆", ids: ["natto"] },
];

const MODES: MealMode[] = ["dinner_breakfast", "dinner", "full"];

export function MealsScreen() {
  const app = useApp();
  const [swap, setSwap] = useState<PlanSlot | null>(null);
  if (!app.ready || !app.book || !app.today) return <BootScreen />;

  const plan = app.activePlan;
  const other = app.state.focus === "cheap" ? app.state.balanced : app.state.cheap;
  const hint = budgetHint(app.state.people, app.state.mode);

  const run = () => {
    const result = app.generate();
    if (!result.ok) toast.error(result.error);
    else toast.success(`献立は ${yen(result.balanced.cost)}、残り ${yen(result.balanced.budget - result.balanced.cost)}`);
  };

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10">
      <p className="text-[11px] font-bold tracking-[0.16em] text-[#1b6b43]">予算献立</p>
      <h1 className="text-[1.7rem] font-black tracking-tight">今週の食費で組む</h1>
      <p className="mt-1 text-sm leading-6 text-[#5e574c]">
        予算を入れると、買う食材、調理法、7日の献立が出ます。
      </p>

      <section className="mt-4 rounded-3xl bg-white p-4">
        <label htmlFor="budget" className="text-sm font-bold">
          今週の食費
        </label>
        <div className="mt-1 flex items-end gap-2">
          <Input
            id="budget"
            inputMode="numeric"
            value={String(app.state.budget)}
            onChange={(event) => {
              const next = Number(event.target.value.replace(/[^\d]/g, ""));
              if (Number.isFinite(next)) app.setBudget(next || 0);
            }}
            className="h-14 border-0 bg-transparent px-0 font-price text-5xl shadow-none focus-visible:ring-0"
          />
        </div>
        <Slider
          min={2000}
          max={15000}
          step={100}
          value={[Math.min(15000, Math.max(2000, app.state.budget))]}
          onValueChange={(value) => {
            const next = Array.isArray(value) ? value[0] : value;
            app.setBudget(next);
          }}
          aria-label="今週の食費"
          className="mt-2"
        />
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[3000, 5000, 7000, 10000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => app.setBudget(preset)}
              className={cn(
                "rounded-xl py-2 text-sm font-bold",
                app.state.budget === preset ? "bg-[#ffe14a]" : "bg-[#f4efe4]",
              )}
            >
              {yen(preset)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-[#5e574c]">
          {app.state.people}人・{MODE_LABEL[app.state.mode]}の目安は {yen(hint)}。{modeHint(app.state.mode)}
        </p>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm font-bold">人数</span>
          <span className="flex items-center gap-2">
            <Button type="button" variant="outline" className="size-9" onClick={() => app.setPeople(app.state.people - 1)}>
              −
            </Button>
            <span className="w-10 text-center font-bold">{app.state.people}人</span>
            <Button type="button" variant="outline" className="size-9" onClick={() => app.setPeople(app.state.people + 1)}>
              ＋
            </Button>
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => app.setMode(mode)}
              className={cn(
                "rounded-2xl px-2 py-2 text-sm font-bold",
                app.state.mode === mode ? "bg-[#1b6b43] text-[#f6f3ea]" : "bg-[#f4efe4]",
              )}
            >
              {MODE_LABEL[mode]}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PREFS.map((pref) => (
            <button
              key={pref.key}
              type="button"
              onClick={() => app.togglePref(pref.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-bold",
                app.state.prefs[pref.key] ? "bg-[#1b6b43] text-[#f6f3ea]" : "bg-[#f4efe4]",
              )}
            >
              {pref.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXCLUSIONS.map((group) => {
            const on = group.ids.every((id) => app.state.excludes.includes(id));
            return (
              <button
                key={group.label}
                type="button"
                onClick={() => app.toggleExclusion(group.ids)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-bold",
                  on ? "bg-[#f3d2c8] text-[#7a2e24]" : "bg-[#f4efe4]",
                )}
              >
                {on ? `${group.label}なし` : `${group.label}を除く`}
              </button>
            );
          })}
        </div>
        <Button type="button" className="mt-4 h-12 w-full text-base" onClick={run}>
          この予算で献立を作る
        </Button>
      </section>

      {app.stale && plan ? (
        <p className="mt-3 rounded-2xl bg-[#fff4c2] px-3 py-3 text-sm leading-6">
          条件が変わっています。上のボタンで組み直すと、買い物リストも追いつきます。
        </p>
      ) : null}

      {!plan ? (
        <p className="mt-6 rounded-3xl border border-dashed border-[#cbbfaa] p-4 text-sm leading-6">
          上の食費で作ると、おすすめの食材、調理法、7日の献立がここに出ます。
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <FocusCard
              title="バランス"
              plan={app.state.balanced}
              active={app.state.focus === "balanced"}
              onClick={() => app.setFocus("balanced")}
            />
            <FocusCard
              title="最安だけ"
              plan={app.state.cheap}
              active={app.state.focus === "cheap"}
              onClick={() => app.setFocus("cheap")}
            />
          </div>
          {other ? (
            <p className="mt-2 text-xs leading-5 text-[#5e574c]">
              いま見ているのは{app.state.focus === "balanced" ? "バランス" : "最安"}の献立です。買い物リストもこちらに従います。
            </p>
          ) : null}
          <ul className="mt-3 space-y-2">
            {plan.notes.map((note) => (
              <li key={note} className="rounded-2xl bg-white px-3 py-2 text-sm leading-6">
                {note}
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="たんぱく質" value={percent(plan.nutrition.protein, plan.targets.protein)} />
            <Stat label="野菜" value={percent(plan.nutrition.veg, plan.targets.veg)} />
            <Stat label="食物繊維" value={percent(plan.nutrition.fiber, plan.targets.fiber)} />
          </div>
          <p className="mt-2 text-xs leading-5 text-[#5e574c]">
            1日あたり約 {Math.round(plan.nutrition.kcal / plan.days)}kcal、たんぱく質{" "}
            {Math.round(plan.nutrition.protein / plan.days)}g。
            {plan.nutrition.salt > plan.targets.salt
              ? ` 食塩は目標を ${Math.round((plan.nutrition.salt - plan.targets.salt) * 10) / 10}g 超えています。`
              : " 食塩は目標の範囲です。"}
          </p>

          <BudgetAdvice variant="full" />
          <div className="mt-6">
            <SectionTitle eyebrow="献立" title="今日から7日" />
          </div>
          <ol className="mt-3 space-y-3">
            {Array.from({ length: plan.days }, (_, day) => {
              const date = addDays(app.today, day);
              const slots = plan.slots.filter((slot) => slot.dayIndex === day);
              return (
                <li key={date} className="rounded-3xl bg-white p-4">
                  <p className="text-sm font-black">{day === 0 ? "今日" : day === 1 ? "明日" : formatWithWeekday(date)}</p>
                  <ul className="mt-2 space-y-3">
                    {slots.map((slot) => {
                      const recipe = getRecipe(slot.recipeId);
                      if (!recipe) return null;
                      const nutrition = recipeNutrition(recipe, plan.people, plan.portion);
                      return (
                        <li key={`${slot.meal}-${slot.recipeId}`} className="border-t border-[#efe6d4] pt-3 first:border-0 first:pt-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-bold text-[#1b6b43]">{mealLabel(slot.meal)}</p>
                              <p className="font-bold">{recipe.name}</p>
                              <p className="text-xs text-[#5e574c]">
                                {cookingMethod(recipe.id)} · {recipe.minutes}分 · たんぱく質 {Math.round(nutrition.protein)}g · 野菜 {Math.round(nutrition.veg)}g
                              </p>
                            </div>
                            <Yen value={slot.cost} className="text-2xl" />
                          </div>
                          <p className="mt-1 text-sm leading-6 text-[#3d3830]">{recipe.summary}</p>
                          <RecipeVideoButton recipeId={recipe.id} />
                          <button
                            type="button"
                            className="mt-1 text-sm font-bold text-[#1b6b43]"
                            onClick={() => setSwap(slot)}
                          >
                            別の皿に変える
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <Sheet open={swap != null} onOpenChange={(open) => !open && setSwap(null)}>
        <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>{swap ? `${mealLabel(swap.meal)}を入れ替える` : "入れ替え"}</SheetTitle>
          </SheetHeader>
          <ul className="space-y-2 overflow-y-auto px-4 pb-6">
            {swap && plan
              ? optionsFor(swap.meal, app.state.excludes, plan, app.book.priceOf).map((option) => (
                  <li key={option.recipe.id}>
                    <button
                      type="button"
                      onClick={() => {
                        app.replaceSlot(swap.dayIndex, swap.meal, option.recipe.id);
                        setSwap(null);
                      }}
                      className="flex w-full items-center justify-between rounded-2xl bg-[#f4efe4] px-3 py-3 text-left"
                    >
                      <span>
                        <span className="block font-bold">
                          {option.recipe.name}
                          {option.recipe.id === swap.recipeId ? " · 今" : ""}
                        </span>
                        <span className="text-xs text-[#5e574c]">
                          {option.recipe.minutes}分 · たんぱく質 {Math.round(option.protein)}g
                        </span>
                      </span>
                      <Yen value={option.cost} className="text-xl" />
                    </button>
                  </li>
                ))
              : null}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function optionsFor(
  meal: MealType,
  excludes: string[],
  plan: Plan,
  priceOf: (id: string) => number,
) {
  return recipes
    .filter(
      (recipe) =>
        recipe.meals.includes(meal) && recipe.items.every((item) => !excludes.includes(item.ingredientId)),
    )
    .map((recipe) => ({
      recipe,
      cost: recipeCost(recipe, plan.people, priceOf, plan.portion),
      protein: recipeNutrition(recipe, plan.people, plan.portion).protein,
    }))
    .sort((a, b) => a.cost - b.cost || a.recipe.name.localeCompare(b.recipe.name, "ja"));
}

function FocusCard({
  title,
  plan,
  active,
  onClick,
}: {
  title: string;
  plan: Plan | null;
  active: boolean;
  onClick: () => void;
}) {
  if (!plan) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-3xl px-3 py-3 text-left", active ? "bg-[#1b6b43] text-[#f6f3ea]" : "bg-white")}
    >
      <p className="text-xs font-bold">{title}</p>
      <Yen value={plan.cost} className="mt-1 block text-3xl" />
      <p className={cn("mt-1 text-[11px]", active ? "text-[#d7e4db]" : "text-[#5e574c]")}>
        野菜 {percent(plan.nutrition.veg, plan.targets.veg)}% · たんぱく質 {percent(plan.nutrition.protein, plan.targets.protein)}%
      </p>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2">
      <p className="text-[11px] text-[#5e574c]">{label}</p>
      <p className="font-price text-2xl font-semibold leading-none">{value}%</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efe6d4]">
        <div className="h-full bg-[#1b6b43]" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}
