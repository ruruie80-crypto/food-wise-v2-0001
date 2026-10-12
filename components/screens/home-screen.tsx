"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { getArea, getIngredient, getRecipe, getStore, ingredients } from "@/lib/catalog";
import { AreaPicker } from "@/components/area-picker";
import { useApp } from "@/components/app-state";
import { BootScreen, PriceSticker, SectionTitle, SignalMark, Yen } from "@/components/bits";
import { HandoffSheet, saveHandoffZip } from "@/components/handoff-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AreaStores } from "@/components/area-stores";
import { BudgetAdvice } from "@/components/budget-advice";
import { StoreCheapest } from "@/components/store-cheapest";
import { MarketCard, SeasonCard } from "@/components/today-panel";
import { formatWithWeekday, weekRangeLabel } from "@/lib/dates";
import { mealLabel, modeHint, yen } from "@/lib/format";

export function HomeScreen() {
  const app = useApp();
  const [settings, setSettings] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  if (!app.ready || !app.book || !app.today) return <BootScreen />;

  const area = getArea(app.state.areaId);
  const plan = app.activePlan;
  const greeting = app.hour < 11 ? "おはようございます" : app.hour < 17 ? "こんにちは" : "こんばんは";
  const spotlight = pickSpotlight(plan?.slots ?? [], app.hour);
  const recipe = spotlight ? getRecipe(spotlight.recipeId) : undefined;
  const buys = ingredients
    .map((item) => app.book?.quote(item.id) ?? null)
    .filter((quote) => quote && quote.signal === "buy" && getIngredient(quote.ingredientId)?.category !== "seasoning")
    .sort((a, b) => (a?.delta ?? 0) - (b?.delta ?? 0))
    .slice(0, 6);
  const sale = app.alerts.find((alert) => alert.tone === "sale");
  const remaining = plan ? plan.budget - plan.cost : app.state.budget;

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#1b6b43]">生活圏の底値</p>
          <h1 className="text-[1.7rem] leading-none font-black tracking-tight">底値ごはん</h1>
          <button type="button" onClick={() => setSettings(true)} className="mt-2 text-left text-sm text-[#5e574c]">
            {greeting}。{area.prefecture} {area.name} · {formatWithWeekday(app.today)}
          </button>
        </div>
        <Link
          href="/alerts"
          aria-label="通知"
          className="relative flex size-11 items-center justify-center rounded-full bg-white"
        >
          <Bell className="size-5" />
          {app.unreadCount > 0 ? (
            <span className="absolute top-1 right-1 size-2.5 rounded-full bg-[#c5362c]" />
          ) : null}
        </Link>
      </header>

      <section className="receipt mt-5 rounded-b-3xl px-4 pt-5 pb-4 shadow-[0_10px_30px_rgba(28,25,21,0.05)]">
        <p className="text-xs text-[#5e574c]">{weekRangeLabel(app.today)} の食費</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="font-price text-5xl leading-none font-semibold">{yen(app.state.budget)}</p>
          <div className="text-right text-sm leading-6">
            <p>献立 {plan ? yen(plan.cost) : "まだない"}</p>
            <p className={remaining < 0 ? "font-bold text-[#c5362c]" : ""}>残り {yen(Math.max(0, remaining))}</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#efe6d4]">
          <div
            className="h-full rounded-full bg-[#1b6b43]"
            style={{
              width: `${plan && plan.budget > 0 ? Math.min(100, (plan.cost / plan.budget) * 100) : 0}%`,
            }}
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-[#5e574c]">{modeHint(app.state.mode)}</p>
        {app.stale ? (
          <p className="mt-2 rounded-xl bg-[#fff4c2] px-3 py-2 text-xs leading-5">
            予算か値札が変わりました。献立を組み直すと、底値の計算が追いつきます。
          </p>
        ) : null}
        <Button
          className="mt-3 h-11 w-full text-base"
          onClick={() => {
            const result = app.generate();
            if (!result.ok) toast.error(result.error);
            else toast.success(`今週の献立は ${yen(result.balanced.cost)} です`);
          }}
        >
          {plan ? "この予算で作り直す" : "今週の献立を作る"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="mt-2 h-11 w-full text-base"
          onClick={() => {
            if (!app.today) return;
            saveHandoffZip(app.state, app.today, app.stale);
            toast.success("Zipをダウンロードしました");
          }}
        >
          Zipをダウンロード
        </Button>
      </section>

      <BudgetAdvice variant="compact" />
      <StoreCheapest />
      <SeasonCard today={app.today} />
      <MarketCard areaId={app.state.areaId} />
      <AreaStores areaId={app.state.areaId} />

      <section className="mt-6">
        <SectionTitle
          eyebrow="今日"
          title={spotlight && recipe ? `${mealLabel(spotlight.meal)}は${recipe.name}` : "献立はまだありません"}
        />
        {spotlight && recipe ? (
          <Link href="/meals" className="mt-3 block rounded-3xl bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-[#5e574c]">
                  {spotlight.dayIndex === 0 ? "今日" : "明日"}の{mealLabel(spotlight.meal)} · {recipe.minutes}分
                </p>
                <p className="mt-1 text-xl font-black">{recipe.name}</p>
                <p className="mt-1 text-sm text-[#5e574c]">{recipe.summary}</p>
              </div>
              <PriceSticker value={spotlight.cost} />
            </div>
          </Link>
        ) : (
          <p className="mt-3 rounded-3xl bg-white p-4 text-sm leading-6 text-[#5e574c]">
            「今週の食費 5,000円」のように予算を入れると、朝と夜の献立と買い物リストが出ます。
          </p>
        )}
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between">
          <SectionTitle eyebrow="値札" title="今日の買い時" />
          <Link href="/prices" className="text-sm font-bold text-[#1b6b43]">
            底値帳
          </Link>
        </div>
        <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
          {buys.length === 0 ? (
            <p className="px-1 text-sm text-[#5e574c]">
              {area.priceBasis === "survey"
                ? "宮城の初期値は市内平均です。特売の番は入っていません。"
                : "特売の番が空いている日です。"}
            </p>
          ) : (
            buys.map((quote) => {
              if (!quote) return null;
              const ingredient = getIngredient(quote.ingredientId);
              const store = getStore(quote.storeId);
              if (!ingredient || !store) return null;
              return (
                <Link
                  key={ingredient.id}
                  href={`/prices/${ingredient.id}`}
                  className="w-40 shrink-0 rounded-2xl bg-white p-3"
                >
                  <SignalMark signal="buy" delta={quote.delta} />
                  <p className="mt-2 font-bold">{ingredient.name}</p>
                  <Yen value={quote.unitPrice} className="mt-1 block text-2xl" />
                  <p className="text-xs text-[#5e574c]">
                    {store.name} · {ingredient.unitLabel}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </section>

      {sale ? (
        <Link href={sale.href} className="mt-6 block rounded-3xl bg-[#143026] px-4 py-4 text-[#f6f3ea]">
          <p className="text-[11px] font-bold tracking-[0.14em] text-[#ffe14a]">特売日</p>
          <p className="mt-1 text-lg font-black">{sale.title}</p>
          <p className="mt-1 text-sm leading-6 text-[#d7e4db]">{sale.body}</p>
        </Link>
      ) : null}

      <section className="mt-6">
        <SectionTitle eyebrow="記録" title={app.state.observations.length ? "最近の値札" : "値札はまだありません"} />
        {app.state.observations.length === 0 ? (
          <Link href="/scan" className="mt-3 block rounded-3xl border border-dashed border-[#cbbfaa] p-4 text-sm leading-6">
            サンプルのレシートを読み取ると、底値がどう動くか分かります。写真は端末の外に出ません。
          </Link>
        ) : (
          <ul className="mt-3 divide-y divide-[#e3d8c6] rounded-3xl bg-white px-4">
            {app.state.observations.slice(0, 4).map((row) => {
              const ingredient = getIngredient(row.ingredientId);
              const store = getStore(row.storeId);
              return (
                <li key={row.id} className="flex items-center justify-between py-3 text-sm">
                  <span>
                    <span className="block font-bold">{ingredient?.name}</span>
                    <span className="text-xs text-[#5e574c]">{store?.name}</span>
                  </span>
                  <Yen value={row.price} className="text-xl" />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button type="button" onClick={() => setHandoff(true)} className="mt-6 block w-full rounded-3xl bg-[#143026] px-4 py-4 text-left text-[#f6f3ea]">
        <p className="text-[11px] font-bold tracking-[0.14em] text-[#ffe14a]">渡す</p>
        <p className="mt-1 font-black">記録を Zip にする</p>
        <p className="mt-1 text-sm leading-6 text-[#d7e4db]">
          献立と値札を1つの Zip にして渡せます。送信はしません。
        </p>
      </button>

      <Link href="/about" className="mt-3 block rounded-3xl bg-white px-4 py-4">
        <p className="text-[11px] font-bold tracking-[0.14em] text-[#1b6b43]">公開用の試作</p>
        <p className="mt-1 font-black">作品ノート</p>
        <p className="mt-1 text-sm leading-6 text-[#5e574c]">
          相場は見本です。記録は端末の中だけで、決済も在庫もつながっていません。
        </p>
      </Link>

      <HandoffSheet open={handoff} onOpenChange={setHandoff} />

      <Sheet open={settings} onOpenChange={setSettings}>
        <SheetContent side="bottom" className="max-h-[80dvh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>生活圏</SheetTitle>
          </SheetHeader>
          <div className="max-h-[calc(80dvh-5rem)] overflow-y-auto px-4 pb-6">
            <AreaPicker selectedId={app.state.areaId} onSelect={app.setArea} />
            <Link
              href="/about"
              onClick={() => setSettings(false)}
              className="mt-2 block rounded-2xl bg-[#f4efe4] px-3 py-3 text-sm font-bold"
            >
              作品ノートを読む
            </Link>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={() => {
                setSettings(false);
                setConfirmReset(true);
              }}
            >
              記録を消す
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>記録を消しますか</DialogTitle>
            <DialogDescription>この端末の値札と献立だけを消します。サンプルの相場は残ります。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                app.reset();
                setConfirmReset(false);
              }}
            >
              消す
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function pickSpotlight(
  slots: { dayIndex: number; meal: "breakfast" | "lunch" | "dinner"; recipeId: string; cost: number }[],
  hour: number,
) {
  const today = slots.filter((slot) => slot.dayIndex === 0);
  if (hour < 10) return today.find((slot) => slot.meal === "breakfast") ?? today.find((slot) => slot.meal === "dinner");
  if (hour < 15) return today.find((slot) => slot.meal === "lunch") ?? today.find((slot) => slot.meal === "dinner");
  return today.find((slot) => slot.meal === "dinner") ?? today[0];
}
