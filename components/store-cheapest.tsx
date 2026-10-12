"use client";

import Link from "next/link";
import { useState } from "react";
import { categoryLabel, getArea, getIngredient, ingredients, storesIn } from "@/lib/catalog";
import { useApp } from "@/components/app-state";
import { Yen } from "@/components/bits";
import { cheapestAtStore, samePicks, type DealQuote, type StorePick } from "@/lib/deals";
import { cn } from "@/lib/utils";

function dealQuotes(book: { quote(id: string): { byStore: { storeId: string; price: number }[] } | null }): DealQuote[] {
  return ingredients.flatMap((item) => {
    if (item.category === "seasoning") return [];
    const quote = book.quote(item.id);
    if (!quote) return [];
    return [{ ingredientId: item.id, category: item.category, byStore: quote.byStore }];
  });
}

export function StoreCheapest() {
  const app = useApp();
  const [picked, setPicked] = useState<string | null>(null);
  if (!app.ready || !app.book) return null;
  const area = getArea(app.state.areaId);
  const stores = storesIn(area.id);
  if (stores.length === 0) return null;
  const quotes = dealQuotes(app.book);
  const boards = stores.map((store) => ({ store, picks: cheapestAtStore(store.id, quotes) }));
  const identical = boards.every((board) => samePicks(board.picks, boards[0].picks));
  const selected = boards.find((board) => board.store.id === picked) ?? boards[0];
  const picks = identical ? boards[0].picks : selected.picks;

  return (
    <section className="mt-6">
      <p className="text-[11px] font-bold tracking-[0.16em] text-[#1b6b43]">最安</p>
      <h2 className="text-lg font-black">店ごとの最安</h2>
      <p className="mt-1 text-xs leading-5 text-[#5e574c]">
        分類ごとに、安い順です。
        {area.priceBasis === "survey" ? "宮城の数字は、仙台市の2026年8月の小売物価統計です。" : "東京の数字は見本の今週の値段です。"}
        値札を読むと、その店の記録に替わります。
      </p>
      {identical ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {stores.map((store) => (
            <li key={store.id} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold">
              {store.name}
            </li>
          ))}
        </ul>
      ) : (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {boards.map((board) => {
            const active = board.store.id === selected.store.id;
            const wins = board.picks.filter((pick) => pick.onlyHere).length;
            return (
              <button
                key={board.store.id}
                type="button"
                aria-pressed={active}
                onClick={() => setPicked(board.store.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-sm font-bold",
                  active ? "bg-[#1b6b43] text-[#f6f3ea]" : "bg-white",
                )}
              >
                {board.store.name}
                {wins > 0 ? (
                  <span className="ml-1 rounded-full bg-[#ffe14a] px-1.5 text-[11px] text-[#1c1915]">{wins}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      {identical ? <p className="mt-2 text-xs font-bold text-[#1b6b43]">この{stores.length}店は同じ値段です。</p> : null}
      <PickList picks={picks} />
    </section>
  );
}

function PickList({ picks }: { picks: StorePick[] }) {
  if (picks.length === 0) {
    return <p className="mt-3 rounded-3xl bg-white p-4 text-sm leading-6">この店の食材はまだありません。</p>;
  }
  return (
    <ul className="mt-3 divide-y divide-[#e3d8c6] rounded-3xl bg-white px-3">
      {picks.map((pick, index) => {
        const ingredient = getIngredient(pick.ingredientId);
        const showCategory = index === 0 || picks[index - 1]?.category !== pick.category;
        return (
          <li key={pick.ingredientId}>
            {showCategory ? (
              <p className="pt-3 text-[11px] font-bold tracking-[0.14em] text-[#1b6b43]">{categoryLabel[pick.category]}</p>
            ) : null}
            <Link href={`/prices/${pick.ingredientId}`} className="flex items-center justify-between gap-3 py-2.5">
              <span>
                <span className="font-bold">{ingredient?.name ?? pick.ingredientId}</span>
                {pick.onlyHere ? (
                  <span className="ml-2 rounded-full bg-[#ffe14a] px-2 py-0.5 text-[11px] font-bold">この店が最安</span>
                ) : null}
                <span className="mt-0.5 block text-xs text-[#5e574c]">{ingredient?.unitLabel}</span>
              </span>
              <Yen value={pick.price} className="text-2xl" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
