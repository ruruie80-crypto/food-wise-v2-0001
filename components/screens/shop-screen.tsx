"use client";

import { useState } from "react";
import { toast } from "sonner";
import { getArea, getIngredient, getStore, storesIn } from "@/lib/catalog";
import { AreaStores } from "@/components/area-stores";
import { FlyerLink } from "@/components/flyer-link";
import { planChangeNote, sourceKey, useApp } from "@/components/app-state";
import { BootScreen, Yen } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatUnits, yen } from "@/lib/format";
import { formatWithWeekday, weekIsOver } from "@/lib/dates";
import { buildShoppingList, cookedDaysOn, stockAside } from "@/lib/shopping";
import { readRiceKg, riceUnitsFromKg } from "@/lib/stock";
import { cn } from "@/lib/utils";
import type { Store } from "@/lib/types";

export function ShopScreen() {
  const app = useApp();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [riceKg, setRiceKg] = useState("");
  if (!app.ready || !app.book || !app.today) return <BootScreen />;
  const plan = app.activePlan;
  if (!plan) {
    return (
      <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <h1 className="text-[1.7rem] font-black">買い物</h1>
        <p className="mt-3 rounded-3xl bg-card p-4 text-sm leading-6">
          献立ができると、品目をいちばん安い店に振り分けます。
        </p>
        <AreaStores areaId={app.state.areaId} />
      </div>
    );
  }

  const planStart = plan.startedOn ?? app.today;
  const changeNote = planChangeNote(plan.sourceKey, sourceKey(app.state));
  const finished = weekIsOver(planStart, app.today);
  const list = buildShoppingList(
    plan,
    app.book,
    stockAside(app.state.stock, app.state.packAdded),
    app.state.preferredStoreId,
    cookedDaysOn(app.state.cookedKeys, planStart),
  );
  const foodSubtotal = list.multiTotal - list.seasoningYen;
  const area = getArea(app.state.areaId);
  const openStore = storeId ? getStore(storeId) : undefined;
  const localStores = storesIn(app.state.areaId);
  const checkedCount = list.groups
    .flatMap((group) => group.lines)
    .filter((line) => app.state.checks[line.ingredientId]).length;
  const totalLines = list.groups.reduce((sum, group) => sum + group.lines.length, 0);

  const copy = async () => {
    const lines = list.groups.flatMap((group) => {
      const store = getStore(group.storeId);
      return [
        `【${store?.name ?? group.storeId}】`,
        ...group.lines.map((line) => {
          const ingredient = getIngredient(line.ingredientId);
          const name = ingredient?.name ?? line.ingredientId;
          const qty = line.buyLabel ?? (ingredient ? formatUnits(line.units, ingredient) : "");
          return `- ${name} ${qty} ${yen(line.linePrice)}`;
        }),
      ];
    });
    if (list.covered.length > 0) {
      lines.push("【在庫でまかなう】");
      for (const row of list.covered) {
        const ingredient = getIngredient(row.ingredientId);
        const name = ingredient?.name ?? row.ingredientId;
        const qty = ingredient ? formatUnits(row.units, ingredient) : "";
        lines.push(`- ${name} ${qty}`);
      }
    }
    lines.push(`小計 ${yen(foodSubtotal)}`);
    lines.push(`調味料の見込み ${yen(list.seasoningYen)}`);
    lines.push(`合計 ${yen(list.multiTotal)}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("買い物リストをコピーしました");
    } catch {
      toast.error("コピーできませんでした");
    }
  };

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10">
      <p className="text-sm font-bold text-primary">{area.name}</p>
      <h1 className="text-[1.7rem] font-black tracking-tight">
        {app.state.preferredStoreId ? "ふだんの店で買う" : list.groups.length <= 1 ? "この店でそろいます" : "店ごとに買う"}
      </h1>
      <p className="mt-1 text-base leading-7 text-muted-foreground">
        {checkedCount === 0
          ? `まだカゴに入れていません。買うものは${totalLines}品です。`
          : `${totalLines}品のうち、カゴに入れたのは${checkedCount}品です。`}
      </p>
      <p className="mt-2 text-base leading-7">
        小計 <Yen value={foodSubtotal} className="text-base" />
        、調味料 <Yen value={list.seasoningYen} className="text-base" />
        、合計 <Yen value={list.multiTotal} className="text-base" />。
      </p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        買い物は、袋の大きさや家にある分を数えた金額です。献立の金額とは違います。
      </p>
      {changeNote ? (
        <p className="mt-3 rounded-2xl bg-notice px-3 py-3 text-base leading-7 text-notice-foreground">{changeNote}</p>
      ) : null}
      {finished ? (
        <p className="mt-3 rounded-2xl bg-card px-3 py-3 text-base leading-7">
          {formatWithWeekday(planStart)}から始めた1週間は終わりました。新しい献立を作ると、来週の買い物になります。
        </p>
      ) : null}
      {area.priceBasis === "survey" ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{area.priceNote}</p>
      ) : null}

      {list.covered.length > 0 ? (
        <section className="mt-4 rounded-3xl bg-card p-4">
          <p className="text-lg font-black">冷蔵庫・冷凍庫から出す</p>
          <p className="mt-1 text-base leading-7">この分は買い物リストに入れていません。</p>
          <ul className="mt-2 space-y-1">
            {list.covered.map((row) => {
              const ingredient = getIngredient(row.ingredientId);
              return (
                <li key={row.ingredientId} className="text-base font-bold">
                  {ingredient?.name} {ingredient ? formatUnits(row.units, ingredient) : ""}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {list.pantry.length > 0 ? (
        <section className="mt-4 rounded-3xl bg-card p-4">
          <p className="text-lg font-black">家にあれば不要</p>
          <p className="mt-1 text-base leading-7">
            わかめは40g入りの袋で、ふつうのスーパーだと約¥200〜¥500です。味噌は750gのパックです。家にあれば買いません。在庫にあれば、ここにも出ません。
          </p>
          <ul className="mt-2 space-y-1">
            {list.pantry.map((row) => (
              <li key={row.ingredientId} className="text-base font-bold">
                {row.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {list.groups.length === 0 ? (
        <p className="mt-4 rounded-3xl bg-card p-4 text-base leading-7">今週の食材は、冷蔵庫と冷凍庫で足ります。</p>
      ) : null}

      <section className="mt-4 rounded-3xl bg-card p-4">
        <p className="text-base font-bold">ふだん行く店</p>
        <p className="mt-1 text-sm leading-6">
          {app.state.preferredStoreId
            ? "選んだ店に、買うものをまとめます。ほかの店の方が安い品があっても、この店で買います。"
            : "まだ決めていないときは、いちばん安い店に入れます。値段が同じときは、一つの店にまとめます。"}
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2" role="group" aria-label="ふだん行く店">
          <button
            type="button"
            aria-pressed={app.state.preferredStoreId == null}
            onClick={() => app.setPreferredStore(null)}
            className={cn(
              "min-h-11 rounded-2xl px-3 text-left text-sm font-bold",
              app.state.preferredStoreId == null ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            まだ決めていない
          </button>
          {localStores.map((store) => (
            <button
              key={store.id}
              type="button"
              aria-pressed={app.state.preferredStoreId === store.id}
              onClick={() => app.setPreferredStore(store.id)}
              className={cn(
                "min-h-11 rounded-2xl px-3 text-left text-sm font-bold",
                app.state.preferredStoreId === store.id ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {store.name}
            </button>
          ))}
        </div>
      </section>

      {list.groups.length > 1 && list.single && list.savings >= 120 ? (
        <div className="mt-4 rounded-3xl bg-notice text-notice-foreground p-4 text-sm leading-6">
          <p className="font-bold">2店以上はしごすると {yen(list.savings)} 安い</p>
          <p className="mt-1">
            {getStore(list.single.storeId)?.name} 1店にまとめると {yen(list.single.total)}。差額が小さい日は、1店で済ませてください。
          </p>
        </div>
      ) : list.groups.length > 1 && list.single ? (
        <div className="mt-4 rounded-3xl bg-card p-4 text-base leading-7">
          <p className="font-bold">1店にまとめても、金額はほぼ同じです</p>
          <p className="mt-1">
            分ける差額は {yen(list.savings)}。{getStore(list.single.storeId)?.name} にまとめると {yen(list.single.total)} です。
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {list.groups.map((group) => {
          const store = getStore(group.storeId);
          return (
            <section key={group.storeId} className="rounded-3xl bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black">{store?.name}</p>
                  <p className="text-xs text-muted-foreground">{store ? storePlace(store, app.state.areaId) : ""}</p>
                </div>
                <Yen value={group.total} className="text-2xl" />
              </div>
              <ul className="mt-3 space-y-2">
                {group.lines.map((line) => {
                  const ingredient = getIngredient(line.ingredientId);
                  const checked = Boolean(app.state.checks[line.ingredientId]);
                  return (
                    <li key={line.ingredientId}>
                      <label className="flex min-h-11 items-center gap-3 text-base">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => app.toggleCheck(line.ingredientId, Boolean(value))}
                          aria-label={ingredient?.name}
                          className="size-6"
                        />
                        <span className={checked ? "flex-1 text-muted-foreground line-through" : "flex-1"}>
                          <span className="font-bold">{ingredient?.name}</span>
                          <span className="ml-2 text-base text-muted-foreground">
                            {line.buyLabel ?? (ingredient ? formatUnits(line.units, ingredient) : "")}
                          </span>
                          {line.neededUnits != null && line.units - line.neededUnits > 0.05 ? (
                            <span className="mt-1 block text-sm leading-6">余りは、カゴに入れると在庫になります。</span>
                          ) : null}
                        </span>
                        <Yen value={line.linePrice} className="text-lg" />
                      </label>
                      {line.ingredientId === "rice" &&
                      (app.state.stock.find((item) => item.ingredientId === "rice")?.units ?? 0) <= 0 ? (
                        <RiceAtHome
                          value={riceKg}
                          onChange={setRiceKg}
                          onSave={(kg) => app.setStock("rice", "fridge", riceUnitsFromKg(kg))}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="mt-3 inline-flex min-h-11 items-center text-base font-bold text-primary" onClick={() => setStoreId(group.storeId)}>
                この店の情報
              </button>
            </section>
          );
        })}
      </div>

      {list.seasoningYen > 0 ? (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          醤油や油など、家にある前提の調味料を {yen(list.seasoningYen)} 見込んでいます。リストの品目には入っていません。
        </p>
      ) : null}

      {area.priceBasis === "survey" ? (
        <section className="mt-4 rounded-3xl bg-card p-4">
          <p className="text-sm font-bold">この生活圏の店</p>
          <ul className="mt-2 divide-y divide-border">
            {localStores.map((store) => (
              <li key={store.id}>
                <button type="button" className="min-h-11 w-full py-3 text-left text-base" onClick={() => setStoreId(store.id)}>
                  <span className="block font-bold">{store.name}</span>
                  <span className="text-xs leading-5 text-muted-foreground">
                    {store.branches[app.state.areaId]} · {store.hours}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="mt-4 rounded-3xl bg-panel p-4 text-panel-foreground">
          <p className="text-[11px] font-bold tracking-[0.14em] text-panel-accent">業務用への送客 · 見本</p>
          <p className="mt-2 text-lg font-black">卵と豆腐はビッグストックが底</p>
          <p className="mt-1 text-sm leading-6 text-panel-muted">
            プライベートブランドや業務用のまとめ買いは、ここから店の棚へ渡す想定です。在庫も決済も、まだつながっていません。
          </p>
          <Button
            type="button"
            className="mt-3 h-11 bg-accent text-accent-foreground hover:bg-accent/80"
            onClick={() => setStoreId("big")}
          >
            ビッグストックを見る
          </Button>
        </section>
      )}

      <Button type="button" variant="outline" className="mt-4 h-11 w-full" onClick={copy}>
        リストをコピー
      </Button>

      <Sheet open={openStore != null} onOpenChange={(open) => !open && setStoreId(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>{openStore?.name}</SheetTitle>
          </SheetHeader>
          {openStore ? (
            <div className="space-y-2 px-4 pb-6 text-sm leading-6">
              <p>
                {openStore.branches[app.state.areaId]} · {openStore.kind}
              </p>
              {openStore.address ? <p>{openStore.address}</p> : null}
              {openStore.phone ? (
                <p>
                  電話{" "}
                  <a href={`tel:${openStore.phone}`} className="inline-flex min-h-11 items-center font-bold text-primary">
                    {openStore.phone}
                  </a>
                </p>
              ) : null}
              <p>営業 {openStore.hours}</p>
              {openStore.walkMinutes != null ? <p>徒歩の目安 {openStore.walkMinutes}分</p> : null}
              <p>{openStore.blurb}</p>
              <p className="rounded-2xl bg-notice text-notice-foreground px-3 py-2">{openStore.saleNote}</p>
              {openStore.closedWeekday != null ? <p>定休日は週の途中に1日あります。通知で前日に出します。</p> : null}
              <FlyerLink store={openStore} />
              {openStore.sourceUrl && openStore.sourceUrl !== openStore.flyerUrl ? (
                <a href={openStore.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-flex min-h-11 items-center text-base font-bold text-primary">
                  店舗の案内を開く
                </a>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RiceAtHome({
  value,
  onChange,
  onSave,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: (kg: number) => void;
}) {
  const parsed = readRiceKg(value);
  const [notice, setNotice] = useState(parsed.hint);
  return (
    <div className="mt-1 pl-9 text-base leading-7">
      <p>米は家にありますか。何kgあるか入れてください。</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <input
          value={parsed.text}
          onChange={(event) => {
            const next = readRiceKg(event.target.value);
            onChange(next.text);
            setNotice(next.hint);
          }}
          inputMode="decimal"
          aria-label="家にある米（kg）"
          placeholder="例 5"
          className="h-11 w-24 rounded-xl border border-border bg-card px-3 text-base"
        />
        <span>kg</span>
        <button
          type="button"
          className="inline-flex min-h-11 items-center text-base font-bold text-primary disabled:opacity-40"
          disabled={parsed.kg == null}
          onClick={() => {
            if (parsed.kg != null) onSave(parsed.kg);
          }}
        >
          家にあります
        </button>
      </div>
      {notice ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{notice}</p> : null}
    </div>
  );
}

function storePlace(store: Store, areaId: string): string {
  const place = store.branches[areaId];
  const walk = store.walkMinutes != null ? `徒歩約${store.walkMinutes}分` : null;
  return [place, walk, store.kind].filter(Boolean).join(" · ");
}
