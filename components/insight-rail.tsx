"use client";

import Link from "next/link";
import { getIngredient, getRecipe, getStore } from "@/lib/catalog";
import { useApp } from "@/components/app-state";
import { SignalMark, Yen } from "@/components/bits";
import { balanceScore, mealLabel, modeHint, percent } from "@/lib/format";
import { buildShoppingList } from "@/lib/shopping";
import { ingredients } from "@/lib/catalog";

export function InsightRail() {
  const app = useApp();
  if (!app.ready || !app.book || !app.today) {
    return <aside className="hidden lg:block" />;
  }
  const plan = app.activePlan;
  const buys = ingredients
    .map((item) => app.book?.quote(item.id))
    .filter((quote) => quote && quote.signal === "buy")
    .slice(0, 4);
  const shop = plan ? buildShoppingList(plan, app.book) : null;
  const dinner = plan?.slots.find((slot) => slot.dayIndex === 0 && slot.meal === "dinner");
  const dinnerRecipe = dinner ? getRecipe(dinner.recipeId) : undefined;

  return (
    <aside className="hidden min-h-0 overflow-y-auto bg-nav px-8 py-8 lg:block">
      <p className="text-[11px] font-bold tracking-[0.16em] text-primary">今週の見取り図</p>
      <h2 className="mt-1 text-2xl font-black tracking-tight">生活圏の底値で、食費と栄養を同時に見る</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        オンラインの最安値ではなく、歩ける店の値札です。献立は金額だけの最安と、栄養を戻した案を並べます。
      </p>

      {plan ? (
        <div className="mt-6 grid max-w-lg grid-cols-3 gap-3">
          <Metric label="食費" value={`${percent(plan.cost, plan.budget)}%`} note={<Yen value={plan.cost} />} />
          <Metric
            label="たんぱく質"
            value={`${percent(plan.nutrition.protein, plan.targets.protein)}%`}
            note="目標比"
          />
          <Metric label="野菜" value={`${percent(plan.nutrition.veg, plan.targets.veg)}%`} note="目標比" />
        </div>
      ) : (
        <Link href="/meals" className="mt-6 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-bold text-panel-foreground">
          今週の食費から献立を作る
        </Link>
      )}

      {dinner && dinnerRecipe ? (
        <div className="mt-6 max-w-lg rounded-3xl bg-card p-4">
          <p className="text-xs text-muted-foreground">今日の{mealLabel(dinner.meal)}</p>
          <p className="mt-1 text-lg font-black">{dinnerRecipe.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <Yen value={dinner.cost} /> · {dinnerRecipe.minutes}分 · バランス{" "}
            {balanceScore(plan!.nutrition, plan!.targets)}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{modeHint(plan!.mode)}</p>
        </div>
      ) : null}

      <div className="mt-6 max-w-lg">
        <p className="text-sm font-bold">いま買い時の品</p>
        <ul className="mt-2 space-y-2">
          {buys.map((quote) => {
            if (!quote) return null;
            const ingredient = getIngredient(quote.ingredientId);
            const store = getStore(quote.storeId);
            if (!ingredient || !store) return null;
            return (
              <li key={ingredient.id}>
                <Link href={`/prices/${ingredient.id}`} className="flex items-center justify-between rounded-2xl bg-card px-3 py-2">
                  <span>
                    <span className="block text-sm font-bold">{ingredient.name}</span>
                    <span className="text-xs text-muted-foreground">{store.name}</span>
                  </span>
                  <span className="text-right">
                    <Yen value={quote.unitPrice} className="text-xl" />
                    <SignalMark signal={quote.signal} delta={quote.delta} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {shop && shop.savings >= 80 ? (
        <p className="mt-6 max-w-lg text-sm leading-6">
          店を分けると、1店にまとめるより <Yen value={shop.savings} /> 安い計算です。
        </p>
      ) : null}
    </aside>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card px-3 py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-price text-3xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
