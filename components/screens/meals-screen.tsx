"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { BudgetAdvice } from "@/components/budget-advice";
import { RecipeVideoButton } from "@/components/recipe-player";
import { YouTubeCookButton } from "@/components/youtube-button";
import { getRecipe, recipes } from "@/lib/catalog";
import { planChangeNote, sourceKey, useApp } from "@/components/app-state";
import { BootScreen, SectionTitle, Yen } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { addDays, planDayLabel, weekIsOver } from "@/lib/dates";
import {
  MODE_LABEL,
  budgetHint,
  mealLabel,
  modeHint,
  percent,
  yen,
} from "@/lib/format";
import { cookingMethod } from "@/lib/advice";
import { StockUseDialog } from "@/components/stock-use-dialog";
import {
  describeHousehold,
  householdServings,
  OPTIONAL_EGG_RECIPES,
  avoidsFish,
  displayRecipeName,
  recipeCopy,
  TOME_PRESET,
  usedItems,
  weeklyFromMonthly,
} from "@/lib/household";
import { isRecipeAllowed, recipeCost, recipeNutrition } from "@/lib/optimizer";
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
  const [monthlyFocus, setMonthlyFocus] = useState(false);
  const [budgetFocus, setBudgetFocus] = useState(false);
  const [cookDay, setCookDay] = useState<number | null>(null);
  if (!app.ready || !app.book || !app.today) return <BootScreen />;

  const plan = app.activePlan;
  const other = app.state.focus === "cheap" ? app.state.balanced : app.state.cheap;
  const servings = householdServings(app.state.adults, app.state.children, app.state.childStage);
  const hint = budgetHint(servings, app.state.mode);
  const tome = app.state.areaId === "tome";
  const eggsAside = app.state.excludes.includes("egg");
  const fishAside = avoidsFish(app.state.excludes);
  const presetOn =
    app.state.adults === TOME_PRESET.adults &&
    app.state.children === TOME_PRESET.children &&
    app.state.childStage === TOME_PRESET.childStage &&
    app.state.budget === TOME_PRESET.budget &&
    app.state.mode === TOME_PRESET.mode &&
    app.state.monthlyBudget === TOME_PRESET.monthlyBudget &&
    app.state.prefs.lessFat === true &&
    app.state.prefs.noMilk === true;
  const weekPresets = servings >= 3 || tome ? [15000, 18400, 22000, 28000] : [3000, 5000, 7000, 10000];
  const sliderMax = servings >= 3 || tome ? 30000 : 20000;
  const stocked = new Set(app.state.stock.map((item) => item.ingredientId));

  const run = () => {
    const result = app.generate();
    if (!result.ok) toast.error(result.error);
    else toast.success(`献立は ${yen(result.balanced.cost)}、残り ${yen(result.balanced.budget - result.balanced.cost)}`);
  };

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10">
      <p className="text-[11px] font-bold tracking-[0.16em] text-primary">予算献立</p>
      <h1 className="text-[1.7rem] font-black tracking-tight">今週の食費で組む</h1>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        予算を入れると、買う食材、調理法、7日の献立が出ます。
      </p>

      {tome ? (
        <section className="mt-4 rounded-3xl bg-card p-4">
          <h2 className="text-xl font-black">登米の家族設定</h2>
          <p className="mt-1 text-base leading-7">
            {describeHousehold(app.state.adults, app.state.children, app.state.childStage)}。月8万円を週にならすと約
            {yen(TOME_PRESET.budget)}。はじめは朝と夜で、脂身ひかえめと牛乳なしも入ります。
          </p>
          <p className="mt-2 text-base leading-7">子どもの年齢はまだ聞いていません。違ったらここで変えてください。</p>
          {presetOn ? (
            <p className="mt-3 text-base font-bold">この目安を入れています。</p>
          ) : (
            <Button type="button" className="mt-3 h-12 w-full text-base" onClick={() => app.applyTomePreset()}>
              登米の目安を入れる
            </Button>
          )}
        </section>
      ) : null}

      <section className="mt-4 rounded-3xl bg-card p-4">
        <label htmlFor="monthly" className="text-base font-bold">
          1か月の食費
        </label>
        <Input
          id="monthly"
          inputMode="numeric"
          value={
            monthlyFocus || app.state.monthlyBudget == null
              ? app.state.monthlyBudget == null
                ? ""
                : String(app.state.monthlyBudget)
              : `${app.state.monthlyBudget.toLocaleString("ja-JP")}円`
          }
          placeholder="80,000円"
          onFocus={() => setMonthlyFocus(true)}
          onBlur={() => setMonthlyFocus(false)}
          onChange={(event) => {
            const digits = event.target.value.replace(/[^\d]/g, "");
            if (!digits) {
              app.setMonthlyBudget(null);
              return;
            }
            app.setMonthlyBudget(Number(digits));
          }}
          className="mt-1 h-14 border-0 bg-transparent px-0 font-price text-4xl shadow-none focus-visible:ring-0"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={app.state.monthlyBudget === 80000}
            onClick={() => app.setMonthlyBudget(80000)}
            className={cn(
              "min-h-12 rounded-2xl text-base font-bold",
              app.state.monthlyBudget === 80000 ? "bg-accent" : "bg-muted",
            )}
          >
            月8万円
          </button>
          <button
            type="button"
            onClick={() => app.setMonthlyBudget(null)}
            className="min-h-12 rounded-2xl bg-muted text-base font-bold"
          >
            月の金額を消す
          </button>
        </div>
        <p className="mt-2 text-base leading-7">
          {app.state.monthlyBudget
            ? `月${app.state.monthlyBudget.toLocaleString("ja-JP")}円を週にならすと ${yen(weeklyFromMonthly(app.state.monthlyBudget))} です。30.4日で割って、7日分にしています。`
            : "月の金額を入れると、1週間の食費に直します。"}
        </p>

        <label htmlFor="budget" className="mt-4 block text-base font-bold">
          今週の食費
        </label>
        <div className="mt-1 flex items-end gap-2">
          <Input
            id="budget"
            inputMode="numeric"
            value={
              budgetFocus
                ? String(app.state.budget)
                : `${app.state.budget.toLocaleString("ja-JP")}円`
            }
            onFocus={() => setBudgetFocus(true)}
            onBlur={() => setBudgetFocus(false)}
            onChange={(event) => {
              const next = Number(event.target.value.replace(/[^\d]/g, ""));
              if (Number.isFinite(next)) app.setBudget(next || 0);
            }}
            className="h-14 border-0 bg-transparent px-0 font-price text-5xl shadow-none focus-visible:ring-0"
          />
        </div>
        <Slider
          min={2000}
          max={sliderMax}
          step={100}
            value={[Math.min(sliderMax, Math.max(2000, app.state.budget))]}
          onValueChange={(value) => {
            const next = Array.isArray(value) ? value[0] : value;
            app.setBudget(next);
          }}
          aria-label="今週の食費"
          className="mt-2"
        />
        <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label="今週の食費の目安">
          {weekPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={app.state.budget === preset}
              onClick={() => app.setBudget(preset)}
              className={cn(
                "min-h-11 rounded-xl py-2 text-sm font-bold",
                app.state.budget === preset ? "bg-accent" : "bg-muted",
              )}
            >
              {yen(preset)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-base leading-7">
          {describeHousehold(app.state.adults, app.state.children, app.state.childStage)}・{MODE_LABEL[app.state.mode]}の目安は {yen(hint)}。
          {modeHint(app.state.mode)}
          {tome ? " 朝と夜だと、月8万円の中に収まりやすいです。" : ""}
        </p>

        <HouseholdStepper
          label="大人"
          value={app.state.adults}
          onChange={app.setAdults}
        />
        <HouseholdStepper
          label="子ども"
          value={app.state.children}
          hint={app.state.childStage === "teen" ? "中学生以上は、大人と同じ量です。" : "小学生以下は、大人の0.6人分です。"}
          onChange={app.setChildren}
        />
        <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="子どもの年齢">
          <button
            type="button"
            aria-pressed={app.state.childStage === "young"}
            onClick={() => app.setChildStage("young")}
            className={cn(
              "min-h-11 rounded-2xl px-2 text-sm font-bold",
              app.state.childStage === "young" ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            小学生以下
          </button>
          <button
            type="button"
            aria-pressed={app.state.childStage === "teen"}
            onClick={() => app.setChildStage("teen")}
            className={cn(
              "min-h-11 rounded-2xl px-2 text-sm font-bold",
              app.state.childStage === "teen" ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            中学生以上
          </button>
        </div>
        <div className="mt-5 border-t border-track pt-4">
          <p className="text-base font-bold">納豆・冷奴に卵をのせる</p>
          <p className="mt-1 text-base leading-7">初期は「しない」です。切り替えると、献立と買い物を作り直します。</p>
          {eggsAside ? (
            <p id="egg-aside-note" className="mt-1 text-base leading-7">
              卵を除くが優先です。納豆と冷奴は卵なしで残します。卵を除くをやめると「
              {app.state.eggToppingPolicy === "allow" ? "する" : "しない"}
              」に戻ります。
            </p>
          ) : null}
          <div
            role="group"
            aria-label="納豆・冷奴に卵をのせる"
            aria-describedby={eggsAside ? "egg-aside-note" : undefined}
            className="mt-2 grid grid-cols-2 gap-2"
          >
            {(
              [
                ["avoid", "しない"],
                ["allow", "する"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={eggsAside ? false : app.state.eggToppingPolicy === id}
                disabled={eggsAside}
                aria-disabled={eggsAside}
                onClick={() => {
                  if (eggsAside || app.state.eggToppingPolicy === id) return;
                  const result = app.setEggTopping(id);
                  if (result && !result.ok) toast.error(result.error);
                  else if (result?.ok) {
                    toast.success(
                      id === "allow" ? "卵をのせる設定で作り直しました" : "卵をのせない設定で作り直しました",
                    );
                  }
                }}
                className={cn(
                  "min-h-11 rounded-2xl px-2 text-base font-bold",
                  eggsAside
                    ? "border-2 border-dashed border-foreground/40 bg-card text-foreground"
                    : app.state.eggToppingPolicy === id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 border-t border-track pt-4">
          <p className="text-base font-bold">朝と夜の範囲</p>
          <div role="group" aria-label="朝と夜の範囲" className="mt-2 grid grid-cols-3 gap-2">
            {MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={app.state.mode === mode}
                onClick={() => app.setMode(mode)}
                className={cn(
                  "min-h-11 rounded-2xl px-2 py-2 text-sm font-bold",
                  app.state.mode === mode ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {MODE_LABEL[mode]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="献立の好み">
          {PREFS.map((pref) => (
            <button
              key={pref.key}
              type="button"
              aria-pressed={app.state.prefs[pref.key]}
              onClick={() => app.togglePref(pref.key)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold",
                app.state.prefs[pref.key] ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {pref.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <button
            type="button"
            aria-pressed={app.state.prefs.lessFat}
            onClick={() => app.togglePref("lessFat")}
            className={cn(
              "min-h-14 rounded-2xl px-4 py-3 text-left",
              app.state.prefs.lessFat ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            <span className="block text-base font-bold">{app.state.prefs.lessFat ? "脂身ひかえめ" : "脂身ひかえめにする"}</span>
            <span className={cn("text-sm leading-6", app.state.prefs.lessFat ? "text-primary-foreground/80" : "text-muted-foreground")}>
              豚こま、豚ひき肉、鶏ももを外します。鶏むねと鶏ひき肉は残します。
            </span>
          </button>
          <button
            type="button"
            aria-pressed={app.state.prefs.noMilk}
            onClick={() => app.togglePref("noMilk")}
            className={cn(
              "min-h-14 rounded-2xl px-4 py-3 text-left",
              app.state.prefs.noMilk ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            <span className="block text-base font-bold">{app.state.prefs.noMilk ? "牛乳なし" : "牛乳なしにする"}</span>
            <span className={cn("text-sm leading-6", app.state.prefs.noMilk ? "text-primary-foreground/80" : "text-muted-foreground")}>
              牛乳を使う皿を外します。今のレシピと、鶏と豆腐のハンバーグに牛乳はありません。
            </span>
          </button>
        </div>
        <Link href="/stock" className="mt-3 flex min-h-12 items-center justify-center rounded-2xl bg-muted text-base font-bold">
          冷蔵庫・冷凍庫を入れる
        </Link>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="食べないもの">
          {EXCLUSIONS.map((group) => {
            const on = group.ids.every((id) => app.state.excludes.includes(id));
            return (
              <button
                key={group.label}
                type="button"
                aria-pressed={on}
                onClick={() => app.toggleExclusion(group.ids)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold",
                  on ? "bg-wait text-wait-foreground" : "bg-muted",
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
        <p className="mt-3 rounded-2xl bg-notice px-3 py-3 text-base leading-7 text-notice-foreground">
          {planChangeNote(plan.sourceKey, sourceKey(app.state))}
        </p>
      ) : null}

      {!plan ? (
        <p className="mt-6 rounded-3xl border border-dashed border-line p-4 text-sm leading-6">
          上の食費で作ると、おすすめの食材、調理法、7日の献立がここに出ます。
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="見ている献立">
            <FocusCard
              title="バランス"
              plan={app.state.balanced}
              active={app.state.focus === "balanced"}
              onClick={() => app.setFocus("balanced")}
            />
            <FocusCard
              title="いちばん安い献立"
              plan={app.state.cheap}
              active={app.state.focus === "cheap"}
              onClick={() => app.setFocus("cheap")}
            />
          </div>
          {other ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              いま見ているのは{app.state.focus === "balanced" ? "バランス" : "いちばん安い"}献立です。買い物リストもこちらに合わせます。
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            上の金額は、使う量で見た献立です。買い物は、袋の大きさや家にある分を数えた金額です。
          </p>
          <ul className="mt-3 space-y-2">
            {plan.notes.map((note) => (
              <li key={note} className="rounded-2xl bg-card px-3 py-2 text-sm leading-6">
                {note}
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="たんぱく質" value={percent(plan.nutrition.protein, plan.targets.protein)} />
            <Stat label="野菜" value={percent(plan.nutrition.veg, plan.targets.veg)} />
            <Stat label="食物繊維" value={percent(plan.nutrition.fiber, plan.targets.fiber)} />
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {trimPeople(plan.people)}人で1日あたり約{" "}
            {Math.round(plan.nutrition.kcal / plan.days).toLocaleString("ja-JP")}kcal、たんぱく質{" "}
            {Math.round(plan.nutrition.protein / plan.days)}g。
            {plan.nutrition.salt > plan.targets.salt
              ? ` 食塩は目標を ${Math.round((plan.nutrition.salt - plan.targets.salt) * 10) / 10}g 超えています。`
              : " 食塩は目標の範囲です。"}
          </p>

          <BudgetAdvice variant="full" />
          <div className="mt-6">
            <SectionTitle
              eyebrow="献立"
              title={plan.startedOn && weekIsOver(plan.startedOn, app.today) ? "この1週間は終わりました" : "始めた日から7日"}
            />
          </div>
          {plan.startedOn && weekIsOver(plan.startedOn, app.today) ? (
            <p className="mt-3 rounded-2xl bg-card px-3 py-3 text-base leading-7">
              新しい週の献立を作ると、買い物リストは来週の分になります。作った日の記録は、その週の中だけ残します。
            </p>
          ) : null}
          <ol className="mt-3 space-y-3">
            {Array.from({ length: plan.days }, (_, day) => {
              const start = plan.startedOn ?? app.today;
              const date = addDays(start, day);
              const cookedKey = `${start}:${day}`;
              const slots = plan.slots.filter((slot) => slot.dayIndex === day);
              return (
                <li key={date} className="rounded-3xl bg-card p-4">
                  <p className="text-base font-black">{planDayLabel(start, day, app.today)}</p>
                  <ul className="mt-2 space-y-3">
                    {slots.map((slot) => {
                      const recipe = getRecipe(slot.recipeId);
                      if (!recipe) return null;
                      const shown = recipeCopy(recipe, eggsAside, fishAside);
                      const nutrition = recipeNutrition(
                        recipe,
                        plan.people,
                        plan.portion,
                        app.state.eggToppingPolicy === "allow" && !eggsAside,
                      );
                      return (
                        <li key={`${slot.meal}-${slot.recipeId}`} className="border-t border-track pt-3 first:border-0 first:pt-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-bold text-primary">{mealLabel(slot.meal)}</p>
                              <p className="font-bold">{shown.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {cookingMethod(recipe.id)} · {recipe.minutes}分 · たんぱく質 {Math.round(nutrition.protein)}g · 野菜 {Math.round(nutrition.veg)}g
                              </p>
                            </div>
                            <Yen value={slot.cost} className="text-2xl" />
                          </div>
                          <p className="mt-1 text-base leading-7 text-foreground">{shown.summary}</p>
                          {OPTIONAL_EGG_RECIPES.includes(recipe.id) ? (
                            <p className="mt-1 text-base leading-7">
                              {eggsAside
                                ? "卵を除くが優先です。この皿の卵は使いません。"
                                : app.state.eggToppingPolicy === "allow"
                                  ? "卵はのせます。上の「納豆・冷奴に卵をのせる」でやめられます。"
                                  : "卵はのせません。上の「納豆・冷奴に卵をのせる」で足せます。"}
                            </p>
                          ) : null}
                          {recipe.usesMilk === false ? (
                            <p className="mt-1 text-sm font-bold text-primary">牛乳なし</p>
                          ) : null}
                          {usedItems(recipe.id, recipe.items, app.state.eggToppingPolicy === "allow" && !eggsAside).some((item) =>
                            stocked.has(item.ingredientId),
                          ) ? (
                            <p className="text-sm font-bold">在庫を使います</p>
                          ) : null}
                          <YouTubeCookButton name={shown.name ?? recipe.name} />
                          <RecipeVideoButton recipeId={recipe.id} />
                          <button
                            type="button"
                            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-2xl bg-muted text-base font-bold text-primary"
                            onClick={() => setSwap(slot)}
                          >
                            別の皿に変える
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    disabled={app.state.cookedKeys.includes(cookedKey) || (weekIsOver(start, app.today) && date < app.today)}
                    onClick={() => setCookDay(day)}
                    className="mt-3 flex min-h-11 w-full items-center justify-center rounded-2xl bg-muted text-base font-bold disabled:opacity-60"
                  >
                    {app.state.cookedKeys.includes(cookedKey)
                      ? "この日は作った"
                      : weekIsOver(start, app.today) && date < app.today
                        ? "この日は過ぎました"
                        : "この日を作った"}
                  </button>
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
              ? optionsFor(
                  swap.meal,
                  { ...app.state.prefs, allowSkinlessThigh: app.state.thighPolicy === "allow" },
                  app.state.excludes,
                  plan,
                  app.book.priceOf,
                  stocked,
                  app.state.eggToppingPolicy === "allow" && !app.state.excludes.includes("egg"),
                ).map((option) => (
                  <li key={option.recipe.id} className="rounded-2xl bg-muted px-3 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        app.replaceSlot(swap.dayIndex, swap.meal, option.recipe.id);
                        setSwap(null);
                      }}
                      className="flex min-h-11 w-full items-center justify-between text-left"
                    >
                      <span>
                        <span className="block text-base font-bold">
                          {displayRecipeName(option.recipe, fishAside)}
                          {option.recipe.id === swap.recipeId ? " · 今" : ""}
                          {option.usesStock ? " · 在庫" : ""}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {option.recipe.minutes}分 · たんぱく質 {Math.round(option.protein)}g
                        </span>
                      </span>
                      <Yen value={option.cost} className="text-xl" />
                    </button>
                    <YouTubeCookButton name={displayRecipeName(option.recipe, fishAside)} />
                  </li>
                ))
              : null}
          </ul>
        </SheetContent>
      </Sheet>
      <StockUseDialog
        fishAside={fishAside}
        open={cookDay != null}
        onOpenChange={(open) => {
          if (!open) setCookDay(null);
        }}
        onKeep={() => {
          if (cookDay != null) app.keepCookedDay(cookDay);
        }}
        onUse={() => {
          if (cookDay != null) app.consumeCookedDay(cookDay);
        }}
      />
      <OpenChoices />
    </div>
  );
}

function trimPeople(people: number): string {
  const rounded = Math.round(people * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function OpenChoices() {
  const app = useApp();
  return (
    <section className="mt-4 rounded-3xl bg-card p-4">
      <h2 className="text-lg font-black">まだ決めていないこと</h2>
      <p className="mt-1 text-sm leading-6">あとから変えられます。献立の計算は、選んだところだけ使います。</p>
      <p className="mt-2 text-base leading-7">納豆と冷奴の卵は、上の「納豆・冷奴に卵をのせる」で選びます。</p>
      <p className="mt-3 text-base font-bold">8万円に入っているもの</p>
      <div className="mt-2 grid grid-cols-1 gap-2" role="group" aria-label="8万円に入っているもの">
        {(
          [
            ["unset", "まだ決めていない"],
            ["food", "食材だけ（調味料・おやつは別）"],
            ["all", "調味料・お米・おやつも入る"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={app.state.budgetScope === id}
            onClick={() => app.setBudgetScope(id)}
            className={cn(
              "min-h-11 rounded-2xl px-3 text-left text-sm font-bold",
              app.state.budgetScope === id ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-base font-bold">脂身ひかえめのとき</p>
      <div className="mt-2 grid grid-cols-1 gap-2" role="group" aria-label="脂身ひかえめのとき">
        {(
          [
            ["unset", "まだ決めていない（鶏ももは外す）"],
            ["avoid", "鶏ももも外す"],
            ["allow", "皮なしの鶏ももは入れてよい"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={app.state.thighPolicy === id}
            onClick={() => app.setThighPolicy(id)}
            className={cn(
              "min-h-11 rounded-2xl px-3 text-left text-sm font-bold",
              app.state.thighPolicy === id ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-base font-bold">牛乳以外の乳製品</p>
      <p className="mt-1 text-sm leading-6">チーズやヨーグルトは、今のレシピにはありません。</p>
      <div className="mt-2 grid grid-cols-1 gap-2" role="group" aria-label="牛乳以外の乳製品">
        {(
          [
            ["unset", "まだ決めていない"],
            ["milkOnly", "牛乳だけ気をつける"],
            ["allDairy", "乳製品も避ける"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={app.state.dairyPolicy === id}
            onClick={() => app.setDairyPolicy(id)}
            className={cn(
              "min-h-11 rounded-2xl px-3 text-left text-sm font-bold",
              app.state.dairyPolicy === id ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function optionsFor(
  meal: MealType,
  prefs: Prefs,
  excludes: string[],
  plan: Plan,
  priceOf: (id: string) => number,
  stocked: Set<string>,
  allowOptionalEggs = false,
) {
  return recipes
    .filter((recipe) => isRecipeAllowed(recipe, meal, prefs, excludes))
    .map((recipe) => ({
      recipe,
      cost: recipeCost(recipe, plan.people, priceOf, plan.portion, allowOptionalEggs),
      protein: recipeNutrition(recipe, plan.people, plan.portion, allowOptionalEggs).protein,
      usesStock: usedItems(recipe.id, recipe.items, allowOptionalEggs).some((item) => stocked.has(item.ingredientId)),
    }))
    .sort(
      (a, b) =>
        Number(b.usesStock) - Number(a.usesStock) ||
        a.cost - b.cost ||
        a.recipe.name.localeCompare(b.recipe.name, "ja"),
    );
}

function HouseholdStepper({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  hint?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-base font-bold">{label}</span>
        <span className="flex items-center gap-2">
          <Button type="button" variant="outline" className="size-12 text-xl" onClick={() => onChange(value - 1)} aria-label={`${label}を減らす`}>
            −
          </Button>
          <span className="w-12 text-center text-xl font-bold">{value}</span>
          <Button type="button" variant="outline" className="size-12 text-xl" onClick={() => onChange(value + 1)} aria-label={`${label}を増やす`}>
            ＋
          </Button>
        </span>
      </div>
      {hint ? <p className="mt-1 text-base leading-7 text-muted-foreground">{hint}</p> : null}
    </div>
  );
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
      aria-pressed={active}
      onClick={onClick}
      className={cn("rounded-3xl px-3 py-3 text-left", active ? "bg-primary text-primary-foreground" : "bg-card")}
    >
      <p className="text-xs font-bold">{title}</p>
      <Yen value={plan.cost} className="mt-1 block text-3xl" />
      <p className={cn("mt-1 text-[11px]", active ? "text-panel-muted" : "text-muted-foreground")}>
        野菜 {percent(plan.nutrition.veg, plan.targets.veg)}% · たんぱく質 {percent(plan.nutrition.protein, plan.targets.protein)}%
      </p>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-price text-2xl font-semibold leading-none">{value}%</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-track">
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}
