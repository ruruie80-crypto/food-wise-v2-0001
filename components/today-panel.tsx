"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getIngredient, storesIn } from "@/lib/catalog";
import { yen } from "@/lib/format";
import type { MarketQuote } from "@/lib/market";
import { inSeason, monthOf, SEASON_SOURCE, SEASON_URL } from "@/lib/season";

type MarketOk = {
  ok: true;
  asOf: string;
  label: string;
  weather: string;
  note: string;
  sourceUrl: string;
  pageUrl: string;
  items: MarketQuote[];
};

type MarketState =
  | { status: "loading" }
  | { status: "error"; message: string; pageUrl?: string }
  | { status: "ready"; report: MarketOk };

let cached: Promise<MarketOk | { ok: false; error?: string; pageUrl?: string }> | null = null;

function loadMarket() {
  cached ??= fetch("/api/market")
    .then(async (response) => {
      const data = (await response.json()) as MarketOk | { ok: false; error?: string; pageUrl?: string };
      if (!response.ok || !data.ok) cached = null;
      return data;
    })
    .catch(() => {
      cached = null;
      return { ok: false as const, error: "日報を読めませんでした。" };
    });
  return cached;
}

export function useMarket(): MarketState {
  const [state, setState] = useState<MarketState>({ status: "loading" });
  useEffect(() => {
    let cancel = false;
    void loadMarket().then((data) => {
      if (cancel) return;
      if (data.ok) setState({ status: "ready", report: data });
      else setState({ status: "error", message: data.error ?? "日報を読めませんでした。", pageUrl: data.pageUrl });
    });
    return () => {
      cancel = true;
    };
  }, []);
  return state;
}

function rangeLabel(item: MarketQuote): string {
  if (item.mid != null) return `中値 ${yen(item.mid)}`;
  const parts = [
    item.high != null ? `高値 ${yen(item.high)}` : "",
    item.low != null ? `安値 ${yen(item.low)}` : "",
  ].filter(Boolean);
  return parts.join(" / ");
}

export function SeasonCard({ today }: { today: string }) {
  const month = monthOf(today);
  const items = inSeason(month);
  return (
    <section className="mt-6">
      <p className="text-[11px] font-bold tracking-[0.16em] text-[#1b6b43]">旬</p>
      <h2 className="text-lg font-black">{month}月の仙台周辺</h2>
      <p className="mt-1 text-xs leading-5 text-[#5e574c]">
        {SEASON_SOURCE}です。その日の入荷ではありません。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) =>
          item.ingredientId ? (
            <Link
              key={item.name}
              href={`/prices/${item.ingredientId}`}
              className="rounded-full bg-[#e5f2ea] px-3 py-1.5 text-sm font-bold"
            >
              {item.name}
            </Link>
          ) : (
            <span key={item.name} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold">
              {item.name}
            </span>
          ),
        )}
      </div>
      <a href={SEASON_URL} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-bold text-[#1b6b43]">
        東北農政局の旬の表
      </a>
    </section>
  );
}

export function MarketCard({ areaId }: { areaId: string }) {
  const market = useMarket();
  const stores = storesIn(areaId).filter((store) => store.sourceUrl);
  return (
    <section className="mt-6 rounded-3xl bg-white p-4">
      <p className="text-[11px] font-bold tracking-[0.16em] text-[#1b6b43]">卸売</p>
      <h2 className="text-lg font-black">きょうの仙台市場</h2>
      {market.status === "loading" ? <p className="mt-2 text-sm text-[#5e574c]">日報を開いています。</p> : null}
      {market.status === "error" ? (
        <p className="mt-2 text-sm leading-6 text-[#5e574c]">
          {market.message}
          {market.pageUrl ? (
            <>
              {" "}
              <a href={market.pageUrl} target="_blank" rel="noreferrer" className="font-bold text-[#1b6b43]">
                仙台市のページ
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {market.status === "ready" ? (
        <>
          <p className="mt-1 text-xs leading-5 text-[#5e574c]">
            {market.report.label}
            {market.report.weather ? ` · ${market.report.weather}` : ""}。{market.report.note}
          </p>
          <ul className="mt-3 divide-y divide-[#e3d8c6]">
            {market.report.items.map((item) => {
              const ingredient = getIngredient(item.ingredientId);
              return (
                <li key={item.ingredientId}>
                  <Link href={`/prices/${item.ingredientId}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                    <span>
                      <span className="font-bold">{item.marketName}</span>
                      <span className="mt-0.5 block text-xs text-[#5e574c]">
                        {item.origin} · {item.packLabel} · {rangeLabel(item)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="font-price text-xl font-semibold">{yen(item.appYen)}</span>
                      <span className="block text-[11px] text-[#5e574c]">/{ingredient?.unitLabel}の卸</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <a href={market.report.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-[#1b6b43]">
            青果部の日報（PDF）
          </a>
        </>
      ) : null}
      {stores.length > 0 ? (
        <p className="mt-3 text-xs leading-5 text-[#5e574c]">
          スーパーの棚の特売は、この卸値とは別です。各店の案内はこの下にあります。
        </p>
      ) : null}
    </section>
  );
}

export function MarketHint({ ingredientId }: { ingredientId: string }) {
  const market = useMarket();
  if (market.status !== "ready") return null;
  const item = market.report.items.find((row) => row.ingredientId === ingredientId);
  if (!item) return null;
  const ingredient = getIngredient(ingredientId);
  return (
    <section className="mt-4 rounded-3xl bg-[#e5f2ea] p-4">
      <p className="text-[11px] font-bold tracking-[0.14em] text-[#1b6b43]">きょうの仙台市場</p>
      <p className="mt-1 font-black">
        {item.origin} · {item.packLabel} · {rangeLabel(item)}
      </p>
      <p className="mt-1 text-sm leading-6">
        {ingredient?.unitLabel}に割ると卸値 {yen(item.appYen)}。{market.report.label}の日報で、棚の売価ではありません。
      </p>
    </section>
  );
}
