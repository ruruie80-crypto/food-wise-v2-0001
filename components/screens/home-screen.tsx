"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { getArea, getIngredient, getRecipe, getStore, ingredients } from "@/lib/catalog";
import { AreaPicker } from "@/components/area-picker";
import { planChangeNote, sourceKey, useApp } from "@/components/app-state";
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
import { YouTubeCookButton } from "@/components/youtube-button";
import { avoidsFish, describeHousehold, displayRecipeName, recipeCopy, showChildAgeNotice, showUnaskedAge, todayDishTitle } from "@/lib/household";
import { BudgetAdvice } from "@/components/budget-advice";
import { SkinPicker } from "@/components/skin-picker";
import { StoreCheapest } from "@/components/store-cheapest";
import { MarketCard, SeasonCard } from "@/components/today-panel";
import { daysBetween, expenseRangeLabel, formatWithWeekday, homePlanStatus, lunchMoneyHint, mealsDayHref, planDayLabel, todayCardBody, todayCardTitle, weekIsOver } from "@/lib/dates";
import { CookedMark } from "@/components/cooked-mark";
import { HomeDishTitle } from "@/components/home-dish-title";
import { isMealCooked } from "@/lib/cooked";
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
  const planStart = plan?.startedOn ?? app.today;
  const todayIndex = plan ? daysBetween(planStart, app.today) : -1;
  const inPlanWeek = Boolean(plan && todayIndex >= 0 && todayIndex < plan.days);
  const spotlight = inPlanWeek ? pickSpotlight(plan?.slots ?? [], todayIndex, app.hour) : undefined;
  const recipe = spotlight ? getRecipe(spotlight.recipeId) : undefined;
  const planStatus = homePlanStatus(plan?.startedOn, app.today);
  const cookedToday = Boolean(
    plan &&
      spotlight &&
      isMealCooked(app.state.cookedKeys, plan.startedOn ?? app.today, spotlight.dayIndex, spotlight.meal),
  );
  const fishAside = avoidsFish(app.state.excludes);
  const dishName = recipe ? displayRecipeName(recipe, fishAside) : "";
  const dishTitle = todayDishTitle(dishName);
  const buys = ingredients
    .map((item) => app.book?.quote(item.id) ?? null)
    .filter((quote) => quote && quote.signal === "buy" && getIngredient(quote.ingredientId)?.category !== "seasoning")
    .sort((a, b) => (a?.delta ?? 0) - (b?.delta ?? 0))
    .slice(0, 6);
  const sale = app.alerts.find((alert) => alert.tone === "sale");
  const remaining = plan ? plan.budget - plan.cost : app.state.budget;

  return (
    <div className="home-screen px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] text-primary">生活圏の底値</p>
          <h1 className="text-[1.7rem] leading-none font-black tracking-tight">底値ごはん</h1>
          <button type="button" onClick={() => setSettings(true)} className="mt-2 min-h-11 text-left text-base text-muted-foreground">
            {greeting}。{area.prefecture} {area.name} · {formatWithWeekday(app.today)}
          </button>
        </div>
        <Link
          href="/alerts"
          aria-label="通知"
          className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-card"
        >
          <Bell className="size-5" />
          {app.unreadCount > 0 ? (
            <span className="absolute top-1 right-1 size-2.5 rounded-full bg-destructive" />
          ) : null}
        </Link>
      </header>

      <section className="receipt home-budget mt-3 rounded-b-3xl px-4 pt-3 pb-3 shadow-[0_10px_30px_rgba(28,25,21,0.05)]">
        <div className="home-budget-face">
        <div className="home-budget-top">
        <p className="text-sm text-muted-foreground">{expenseRangeLabel(app.today, plan?.startedOn)} の食費</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <p className="font-price text-4xl leading-none font-semibold">{yen(app.state.budget)}</p>
          <div className="text-right text-sm leading-6">
            <p>献立 {plan ? yen(plan.cost) : "まだない"}</p>
            <p className={remaining < 0 ? "font-bold text-destructive" : ""}>残り {yen(Math.max(0, remaining))}</p>
          </div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-track">
          <div
            className="h-full rounded-full bg-primary"
            style={{
              width: `${plan && plan.budget > 0 ? Math.min(100, (plan.cost / plan.budget) * 100) : 0}%`,
            }}
          />
        </div>
        </div>
        <p className="home-blurb-title mt-3 text-base font-black">{yen(app.state.budget)}の食費について</p>
        <p className="home-blurb mt-2 text-base leading-6 text-muted-foreground">
          {describeHousehold(app.state.adults, app.state.children, app.state.childStage)}。{modeHint(app.state.mode)}
        </p>
        <p className="home-blurb mt-1 text-sm leading-6 text-muted-foreground">
          {plan
            ? weekIsOver(plan.startedOn ?? app.today, app.today)
              ? "この表示は、前の献立の7日です。新しい献立を作ると、今日から7日になります。"
              : "献立は使う量の金額です。買い物は、袋の大きさや家にある分を数えた金額です。"
            : "献立を作ると、今日から7日で数えます。"}
        </p>
        <div className="home-budget-go">
        <div className="home-regen">
        <Button
          className="mt-2 h-11 w-full text-base"
          onClick={() => {
            const result = app.generate();
            if (!result.ok) toast.error(result.error);
            else toast.success(`今週の献立は ${yen(result.balanced.cost)} です`);
          }}
        >
          {plan ? "この予算で作り直す" : "今週の献立を作る"}
        </Button>
        </div>
        </div>
        </div>
      </section>

      <section className="home-today mt-3">
        <SectionTitle
          eyebrow={inPlanWeek ? "今日" : "献立"}
          title={
            spotlight && recipe
              ? todayCardTitle(planStatus, planStart, `${mealLabel(spotlight.meal)}は${dishTitle.title}`)
              : todayCardTitle(planStatus, planStart)
          }
        />
        {spotlight && recipe ? (
          <div className="home-today-card mt-2 rounded-3xl bg-card p-3">
            <Link href="/meals" className="block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {planDayLabel(planStart, spotlight.dayIndex, app.today)}の{mealLabel(spotlight.meal)} · {recipe.minutes}分
                    <CookedMark cooked={cookedToday} />
                  </p>
                  <HomeDishTitle title={dishTitle.title} note={dishTitle.note} />
                  <p className="mt-1 text-base leading-6 text-muted-foreground">
                    {recipeCopy(recipe, app.state.excludes.includes("egg"), fishAside).summary}
                  </p>
                </div>
                <PriceSticker value={spotlight.cost} />
              </div>
            </Link>
            <YouTubeCookButton name={dishTitle.title} />
            <Link
              href={mealsDayHref(spotlight.dayIndex)}
              className="inline-flex min-h-11 items-center text-base font-bold text-primary"
            >
              作った・減らすは献立の画面で
            </Link>
          </div>
        ) : (
          <p className="mt-2 rounded-3xl bg-card p-3 text-base leading-6">{todayCardBody(planStatus, planStart)}</p>
        )}
      </section>

      {plan && lunchMoneyHint(plan.startedOn, app.today, plan.budget - plan.cost) ? (
        <p className="home-aside mt-3 text-sm leading-6">
          残りは週{yen(plan.budget - plan.cost)}（月にならすと約
          {yen(Math.round(((plan.budget - plan.cost) / 7) * 30.4 / 100) * 100)}）です。お昼ごはん代には少なめかもしれません。
        </p>
      ) : null}
      {app.stale && plan ? (
        <p className="home-aside mt-3 rounded-xl bg-notice px-3 py-2 text-base leading-7 text-notice-foreground">
          {planChangeNote(plan.sourceKey, sourceKey(app.state))}
        </p>
      ) : null}

      {showChildAgeNotice(app.state) ? (
        <Link href="/meals" className="home-notice mt-4 block rounded-3xl bg-card p-4">
          <p className="text-lg font-black">登米の家族設定</p>
          <p className="mt-1 text-base leading-7">
            仮の目安は大人2人と子ども2人、月8万円（1週間 約18,400円）、朝と夜です。
            {showUnaskedAge(app.state.areaId, app.state.childAgeSet)
              ? "子どもの年齢はまだ聞いていません。"
              : ""}
            献立の画面で変えられます。
          </p>
        </Link>
      ) : null}

      <div className="home-actions mt-3 grid gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-11 w-full whitespace-normal py-2 text-base"
          onClick={() => {
            if (!app.today) return;
            saveHandoffZip(app.state, app.today, app.stale);
            toast.success("このスマホに保存しました。料金はかかりません");
          }}
        >
          記録をこのスマホに保存（無料）
        </Button>
        <Link
          href="/stock"
          className="flex min-h-11 items-center justify-center rounded-2xl bg-card text-base font-bold"
        >
          冷蔵庫・冷凍庫
        </Link>
      </div>

      <div className="home-after">
      <SkinPicker />

      <BudgetAdvice variant="compact" />
      <StoreCheapest />
      <SeasonCard today={app.today} areaId={app.state.areaId} />
      <MarketCard areaId={app.state.areaId} />
      <AreaStores areaId={app.state.areaId} />

      <section className="mt-6">
        <div className="flex items-end justify-between">
          <SectionTitle eyebrow="値札" title="今日の買い時" />
          <Link href="/prices" className="inline-flex min-h-11 items-center text-base font-bold text-primary">
            底値帳
          </Link>
        </div>
        <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
          {buys.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">
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
                  className="w-40 shrink-0 rounded-2xl bg-card p-3"
                >
                  <SignalMark signal="buy" delta={quote.delta} />
                  <p className="mt-2 font-bold">{ingredient.name}</p>
                  <Yen value={quote.unitPrice} className="mt-1 block text-2xl" />
                  <p className="text-xs text-muted-foreground">
                    {store.name} · {ingredient.unitLabel}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </section>

      {sale ? (
        <Link href={sale.href} className="mt-6 block rounded-3xl bg-panel px-4 py-4 text-panel-foreground">
          <p className="text-[11px] font-bold tracking-[0.14em] text-panel-accent">特売日</p>
          <p className="mt-1 text-lg font-black">{sale.title}</p>
          <p className="mt-1 text-sm leading-6 text-panel-muted">{sale.body}</p>
        </Link>
      ) : null}

      <section className="mt-6">
        <SectionTitle eyebrow="記録" title={app.state.observations.length ? "最近の値札" : "値札はまだありません"} />
        {app.state.observations.length === 0 ? (
          <Link href="/scan" className="mt-3 block rounded-3xl border border-dashed border-line p-4 text-sm leading-6">
            サンプルのレシートを読み取ると、底値がどう動くか分かります。写真は端末の外に出ません。
          </Link>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-3xl bg-card px-4">
            {app.state.observations.slice(0, 4).map((row) => {
              const ingredient = getIngredient(row.ingredientId);
              const store = getStore(row.storeId);
              return (
                <li key={row.id} className="flex items-center justify-between py-3 text-sm">
                  <span>
                    <span className="block font-bold">{ingredient?.name}</span>
                    <span className="text-xs text-muted-foreground">{store?.name}</span>
                  </span>
                  <Yen value={row.price} className="text-xl" />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button type="button" onClick={() => setHandoff(true)} className="mt-6 block w-full rounded-3xl bg-panel px-4 py-4 text-left text-panel-foreground">
        <p className="text-sm font-bold tracking-[0.14em] text-panel-accent">渡す</p>
        <p className="mt-1 font-black">記録をファイルにする</p>
        <p className="mt-1 text-sm leading-6 text-panel-muted">
          献立と値札を、このスマホのファイルにします。送信も料金もありません。
        </p>
      </button>

      <Link href="/about" className="mt-3 block rounded-3xl bg-card px-4 py-4">
        <p className="text-sm font-bold text-primary">このアプリについて</p>
        <p className="mt-1 font-black">作品ノート</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          値段は目安です。記録はこのスマホの中だけで、お店のレジとはつながっていません。
        </p>
      </Link>
      </div>

      <div className="home-overlays">
      <HandoffSheet open={handoff} onOpenChange={setHandoff} />

      <Sheet open={settings} onOpenChange={setSettings}>
        <SheetContent side="bottom" className="max-h-[80dvh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>生活圏</SheetTitle>
          </SheetHeader>
          <div className="max-h-[calc(80dvh-5rem)] overflow-y-auto px-4 pb-6">
            <SkinPicker className="mt-0" />
            <div className="mt-4">
              <AreaPicker selectedId={app.state.areaId} onSelect={app.setArea} />
            </div>
            <Link
              href="/about"
              onClick={() => setSettings(false)}
              className="mt-2 block rounded-2xl bg-muted px-3 py-3 text-sm font-bold"
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
    </div>
  );
}

function pickSpotlight(
  slots: { dayIndex: number; meal: "breakfast" | "lunch" | "dinner"; recipeId: string; cost: number }[],
  dayIndex: number,
  hour: number,
) {
  const today = slots.filter((slot) => slot.dayIndex === dayIndex);
  if (hour < 10) return today.find((slot) => slot.meal === "breakfast") ?? today.find((slot) => slot.meal === "dinner");
  if (hour < 15) return today.find((slot) => slot.meal === "lunch") ?? today.find((slot) => slot.meal === "dinner");
  return today.find((slot) => slot.meal === "dinner") ?? today[0];
}
