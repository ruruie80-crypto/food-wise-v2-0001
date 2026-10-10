"use client";

import { useState } from "react";
import { toast } from "sonner";
import { getArea, getIngredient, getStore, storesIn } from "@/lib/catalog";
import { useApp } from "@/components/app-state";
import { BootScreen, Yen } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatUnits, yen } from "@/lib/format";
import { buildShoppingList } from "@/lib/shopping";
import type { Store } from "@/lib/types";

export function ShopScreen() {
  const app = useApp();
  const [storeId, setStoreId] = useState<string | null>(null);
  if (!app.ready || !app.book || !app.today) return <BootScreen />;
  const plan = app.activePlan;
  if (!plan) {
    return (
      <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <h1 className="text-[1.7rem] font-black">買い物</h1>
        <p className="mt-3 rounded-3xl bg-white p-4 text-sm leading-6">
          献立ができると、品目をいちばん安い店に振り分けます。
        </p>
      </div>
    );
  }

  const list = buildShoppingList(plan, app.book);
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
          const qty = ingredient ? formatUnits(line.units, ingredient) : "";
          return `- ${name} ${qty} ${yen(line.linePrice)}`;
        }),
      ];
    });
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
      <p className="text-[11px] font-bold tracking-[0.16em] text-[#1b6b43]">{area.name}</p>
      <h1 className="text-[1.7rem] font-black tracking-tight">買う店が分かれる</h1>
      <p className="mt-1 text-sm leading-6 text-[#5e574c]">
        {checkedCount}/{totalLines} をカゴに入れました。合計 <Yen value={list.multiTotal} className="text-base" />。
      </p>
      {area.priceBasis === "survey" ? (
        <p className="mt-2 text-sm leading-6 text-[#5e574c]">{area.priceNote}</p>
      ) : null}

      {list.single && list.savings >= 120 ? (
        <div className="mt-4 rounded-3xl bg-[#fff4c2] p-4 text-sm leading-6">
          <p className="font-bold">2店以上はしごすると {yen(list.savings)} 安い</p>
          <p className="mt-1">
            {getStore(list.single.storeId)?.name} 1店にまとめると {yen(list.single.total)}。差額が小さい日は、1店で済ませてください。
          </p>
        </div>
      ) : list.single ? (
        <div className="mt-4 rounded-3xl bg-white p-4 text-sm leading-6">
          <p className="font-bold">今日は1店で足りる</p>
          <p className="mt-1">
            分ける差額は {yen(list.savings)}。{getStore(list.single.storeId)?.name} にまとめても {yen(list.single.total)} です。
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {list.groups.map((group) => {
          const store = getStore(group.storeId);
          return (
            <section key={group.storeId} className="rounded-3xl bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black">{store?.name}</p>
                  <p className="text-xs text-[#5e574c]">{store ? storePlace(store, app.state.areaId) : ""}</p>
                </div>
                <Yen value={group.total} className="text-2xl" />
              </div>
              <ul className="mt-3 space-y-2">
                {group.lines.map((line) => {
                  const ingredient = getIngredient(line.ingredientId);
                  const checked = Boolean(app.state.checks[line.ingredientId]);
                  return (
                    <li key={line.ingredientId}>
                      <label className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => app.toggleCheck(line.ingredientId, Boolean(value))}
                          aria-label={ingredient?.name}
                        />
                        <span className={checked ? "flex-1 text-[#8a8175] line-through" : "flex-1"}>
                          <span className="font-bold">{ingredient?.name}</span>
                          <span className="ml-2 text-xs text-[#5e574c]">
                            {ingredient ? formatUnits(line.units, ingredient) : ""}
                          </span>
                        </span>
                        <Yen value={line.linePrice} className="text-lg" />
                      </label>
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="mt-3 text-sm font-bold text-[#1b6b43]" onClick={() => setStoreId(group.storeId)}>
                この店の情報
              </button>
            </section>
          );
        })}
      </div>

      {list.seasoningYen > 0 ? (
        <p className="mt-4 text-sm leading-6 text-[#5e574c]">
          醤油や油など、家にある前提の調味料を {yen(list.seasoningYen)} 見込んでいます。リストの品目には入っていません。
        </p>
      ) : null}

      {area.priceBasis === "survey" ? (
        <section className="mt-4 rounded-3xl bg-white p-4">
          <p className="text-sm font-bold">この生活圏の店</p>
          <ul className="mt-2 divide-y divide-[#e3d8c6]">
            {localStores.map((store) => (
              <li key={store.id}>
                <button type="button" className="w-full py-3 text-left" onClick={() => setStoreId(store.id)}>
                  <span className="block font-bold">{store.name}</span>
                  <span className="text-xs leading-5 text-[#5e574c]">
                    {store.branches[app.state.areaId]} · {store.hours}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="mt-4 rounded-3xl bg-[#143026] p-4 text-[#f6f3ea]">
          <p className="text-[11px] font-bold tracking-[0.14em] text-[#ffe14a]">業務用への送客 · 見本</p>
          <p className="mt-2 text-lg font-black">卵と豆腐はビッグストックが底</p>
          <p className="mt-1 text-sm leading-6 text-[#d7e4db]">
            プライベートブランドや業務用のまとめ買いは、ここから店の棚へ渡す想定です。在庫も決済も、まだつながっていません。
          </p>
          <Button
            type="button"
            className="mt-3 h-11 bg-[#ffe14a] text-[#1c1915] hover:bg-[#ffe14a]/80"
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
              {openStore.phone ? <p>電話 {openStore.phone}</p> : null}
              <p>営業 {openStore.hours}</p>
              {openStore.walkMinutes != null ? <p>徒歩の目安 {openStore.walkMinutes}分</p> : null}
              <p>{openStore.blurb}</p>
              <p className="rounded-2xl bg-[#fff4c2] px-3 py-2">{openStore.saleNote}</p>
              {openStore.closedWeekday != null ? <p>定休日は週の途中に1日あります。通知で前日に出します。</p> : null}
              {openStore.sourceUrl ? (
                <a href={openStore.sourceUrl} target="_blank" rel="noreferrer" className="inline-block font-bold text-[#1b6b43]">
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

function storePlace(store: Store, areaId: string): string {
  const place = store.branches[areaId];
  const walk = store.walkMinutes != null ? `徒歩約${store.walkMinutes}分` : null;
  return [place, walk, store.kind].filter(Boolean).join(" · ");
}
