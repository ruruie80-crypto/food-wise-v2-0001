"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { getIngredient, getStore, ingredients, stores } from "@/lib/catalog";
import { useApp } from "@/components/app-state";
import { BootScreen, CategoryDot, PriceSticker, SignalMark, Yen } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatShort } from "@/lib/dates";
import { proteinYen } from "@/lib/prices";
import { yen } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PriceDetailScreen({ id }: { id: string }) {
  const app = useApp();
  const [recordOpen, setRecordOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "aoba");
  const [priceText, setPriceText] = useState("");
  if (!app.ready || !app.book || !app.today) return <BootScreen />;

  const ingredient = getIngredient(id);
  const quote = app.book.quote(id);
  if (!ingredient || !quote) {
    return (
      <div className="px-4 pt-8">
        <p>その品目は帳面にありません。</p>
        <Link href="/prices" className="mt-3 inline-block font-bold text-[#1b6b43]">
          底値帳へ
        </Link>
      </div>
    );
  }
  const store = getStore(quote.storeId);
  const forecast = app.book.forecast(id);
  const mine = app.state.observations.filter((row) => row.ingredientId === id);
  const alternatives = ingredients
    .filter((item) => item.altGroup === "protein" && item.id !== id && ingredient.altGroup === "protein")
    .map((item) => {
      const other = app.book?.quote(item.id);
      const per = other ? proteinYen(item, other.unitPrice) : null;
      return { item, other, per };
    })
    .filter((row) => row.other && row.per != null)
    .sort((a, b) => (a.per ?? 0) - (b.per ?? 0));
  const ownProtein = proteinYen(ingredient, quote.unitPrice);

  const save = () => {
    const price = Number(priceText);
    if (!Number.isFinite(price) || price <= 0 || price > 99999) {
      toast.error("税込の値段を入れてください。");
      return;
    }
    const lows = app.addObservations([{ ingredientId: id, storeId, price, source: "manual" }]);
    setRecordOpen(false);
    setPriceText("");
    if (lows.length > 0) toast.success(`${ingredient.name}の底値を ${yen(lows[0].price)} に更新しました`);
    else toast.success(`${ingredient.name}を ${yen(price)} で記録しました`);
  };

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10">
      <Link href="/prices" className="text-sm font-bold text-[#1b6b43]">
        底値帳へ戻る
      </Link>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <CategoryDot category={ingredient.category} />
          <h1 className="mt-1 text-[1.7rem] font-black tracking-tight">{ingredient.name}</h1>
          <p className="text-sm text-[#5e574c]">
            {store?.name} · {ingredient.unitLabel}
          </p>
        </div>
        <PriceSticker value={quote.unitPrice} unit={ingredient.unitLabel} />
      </div>
      <div className="mt-3">
        <SignalMark signal={quote.signal} delta={quote.delta} />
        <p className="mt-2 text-sm leading-6">
          {quote.signal === "buy"
            ? `直近の底値より安い週です。まとめ買いするなら、傷みにくい分だけ。`
            : quote.signal === "wait"
              ? `直近より高めです。代替のたんぱく質か、次の特売まで待てます。`
              : `直近の底値の範囲です。急いで買う週ではありません。`}
        </p>
      </div>

      <section className="mt-5 rounded-3xl bg-white p-4">
        <p className="text-sm font-bold">8週の底値</p>
        <HistoryChart series={quote.series} median={quote.median} />
        <p className="text-xs text-[#5e574c]">点線は直近の中央値 {yen(Math.round(quote.median))} です。</p>
      </section>

      <section className="mt-4 rounded-3xl bg-white p-4">
        <p className="text-sm font-bold">店ごとの今週</p>
        <ul className="mt-3 space-y-3">
          {quote.byStore.map((row) => {
            const shop = getStore(row.storeId);
            const width = Math.max(8, Math.round((quote.byStore[0].price / row.price) * 100));
            return (
              <li key={row.storeId}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-bold">{shop?.name}</span>
                  <Yen value={row.price} className="text-xl" />
                </div>
                <div className="mt-1 h-2 rounded-full bg-[#efe6d4]">
                  <div className="h-full rounded-full bg-[#1b6b43]" style={{ width: `${width}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {alternatives.length > 0 ? (
        <section className="mt-4 rounded-3xl bg-white p-4">
          <p className="text-sm font-bold">たんぱく質20gあたり</p>
          <p className="mt-1 text-xs leading-5 text-[#5e574c]">
            同じ役割の品を、値段ではなくたんぱく質の単価で並べています。
            {ownProtein != null ? ` この品は ${yen(Math.round(ownProtein))} です。` : ""}
          </p>
          <ul className="mt-3 divide-y divide-[#e3d8c6]">
            {alternatives.slice(0, 5).map((row) => (
              <li key={row.item.id}>
                <Link href={`/prices/${row.item.id}`} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-bold">{row.item.name}</span>
                  <span className="text-right">
                    <Yen value={row.per ?? 0} className="text-lg" />
                    <span className="block text-[11px] text-[#5e574c]">/20g</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-4 rounded-3xl bg-[#143026] p-4 text-[#f6f3ea]">
        <p className="text-[11px] font-bold tracking-[0.14em] text-[#ffe14a]">プレミアム · 価格予測</p>
        {app.state.premiumPreview && forecast ? (
          <>
            <p className="mt-2 text-lg font-black">{forecast.headline}</p>
            <p className="font-price mt-1 text-3xl font-semibold">
              {yen(forecast.low)}–{yen(forecast.high)}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#d7e4db]">{forecast.detail}</p>
          </>
        ) : (
          <>
            <p className="mt-2 text-lg font-black">来週の幅は、見本として開けます</p>
            <p className="mt-1 text-sm leading-6 text-[#d7e4db]">
              無料では今週の底値まで。予測は過去8週と特売の回り番からの見立てで、的中は保証しません。
            </p>
            <Button type="button" className="mt-3 h-11 bg-[#ffe14a] text-[#1c1915] hover:bg-[#ffe14a]/80" onClick={() => setPremiumOpen(true)}>
              予測の見本を見る
            </Button>
          </>
        )}
      </section>

      <Button type="button" className="mt-4 h-12 w-full text-base" onClick={() => setRecordOpen(true)}>
        この値段を記録する
      </Button>

      {mine.length > 0 ? (
        <section className="mt-4">
          <p className="text-sm font-bold">あなたの記録</p>
          <ul className="mt-2 divide-y divide-[#e3d8c6] rounded-3xl bg-white px-4">
            {mine.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="block font-bold">{getStore(row.storeId)?.name}</span>
                  <span className="text-xs text-[#5e574c]">{row.date}</span>
                </span>
                <span className="flex items-center gap-3">
                  <Yen value={row.price} className="text-xl" />
                  <button type="button" className="text-xs font-bold text-[#c5362c]" onClick={() => app.removeObservation(row.id)}>
                    消す
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Sheet open={recordOpen} onOpenChange={setRecordOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>{ingredient.name}を記録</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6">
            <div className="flex flex-wrap gap-2">
              {ingredient.stores.map((row) => (
                <button
                  key={row.storeId}
                  type="button"
                  onClick={() => setStoreId(row.storeId)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-bold",
                    storeId === row.storeId ? "bg-[#1b6b43] text-[#f6f3ea]" : "bg-[#f4efe4]",
                  )}
                >
                  {getStore(row.storeId)?.name}
                </button>
              ))}
            </div>
            <label className="block text-sm font-bold" htmlFor="manual-price">
              税込価格（{ingredient.unitLabel}）
            </label>
            <Input
              id="manual-price"
              inputMode="numeric"
              value={priceText}
              onChange={(event) => setPriceText(event.target.value.replace(/[^\d]/g, ""))}
              placeholder={String(quote.unitPrice)}
              className="h-12 bg-white font-price text-2xl"
            />
            <Button type="button" className="h-12 w-full text-base" onClick={save}>
              記録する
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={premiumOpen} onOpenChange={setPremiumOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>価格予測の見本</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6 text-sm leading-6">
            <p>
              想定は月額480円です。中身は、過去8週の底値の中央値と、4週ごとの特売ローテーションを重ねた幅だけです。
            </p>
            {forecast ? (
              <p className="rounded-2xl bg-[#fff4c2] px-3 py-3">
                {ingredient.name}の来週は {yen(forecast.low)} から {yen(forecast.high)}。{forecast.headline}。
              </p>
            ) : null}
            <p className="text-xs text-[#5e574c]">課金はつながっていません。この端末で見本を開くだけです。</p>
            <Button
              type="button"
              className="h-12 w-full text-base"
              onClick={() => {
                app.setPremiumPreview(true);
                setPremiumOpen(false);
              }}
            >
              この端末で見本を開く
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function HistoryChart({
  series,
  median,
}: {
  series: { date: string; price: number }[];
  median: number;
}) {
  const width = 320;
  const height = 132;
  const prices = series.map((point) => point.price);
  const min = Math.min(...prices, median) * 0.9;
  const max = Math.max(...prices, median) * 1.08;
  const x = (index: number) => (series.length <= 1 ? width / 2 : 12 + (index / (series.length - 1)) * (width - 24));
  const y = (price: number) => height - 22 - ((price - min) / (max - min || 1)) * (height - 40);
  const path = series.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.price)}`).join(" ");
  const medianY = y(median);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full" role="img" aria-label="底値の推移">
      <line x1="8" x2={width - 8} y1={medianY} y2={medianY} stroke="#cbbfaa" strokeDasharray="4 4" />
      <path d={path} fill="none" stroke="#1b6b43" strokeWidth="2.4" />
      {series.map((point, index) => (
        <g key={point.date}>
          <circle cx={x(index)} cy={y(point.price)} r={index === series.length - 1 ? 4 : 2.4} fill={index === series.length - 1 ? "#ffe14a" : "#1b6b43"} stroke="#1c1915" strokeWidth="1" />
          {index % 3 === 0 || index === series.length - 1 ? (
            <text x={x(index)} y={height - 4} textAnchor="middle" fontSize="10" fill="#5e574c">
              {formatShort(point.date)}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
