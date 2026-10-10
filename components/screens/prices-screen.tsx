"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { categoryLabel, categoryOrder, getArea, getStore, ingredients } from "@/lib/catalog";
import { useApp } from "@/components/app-state";
import { BootScreen, CategoryDot, SignalMark, Sparkline, Yen } from "@/components/bits";
import { signedPercent } from "@/lib/format";
import { Input } from "@/components/ui/input";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PricesScreen() {
  const app = useApp();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const rows = useMemo(() => {
    if (!app.book) return [];
    const needle = query.trim().toLowerCase();
    return ingredients
      .filter((item) => (category === "all" ? true : item.category === category))
      .filter((item) => {
        if (!needle) return true;
        return item.name.includes(query.trim()) || item.kana.includes(needle);
      })
      .map((item) => ({ item, quote: app.book?.quote(item.id) ?? null }))
      .filter((row) => row.quote);
  }, [app.book, category, query]);

  if (!app.ready || !app.book) return <BootScreen />;

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8">
      <p className="text-[11px] font-bold tracking-[0.16em] text-[#1b6b43]">底値帳</p>
      <h1 className="text-[1.7rem] font-black tracking-tight">生活圏のいま</h1>
      <p className="mt-1 text-sm leading-6 text-[#5e574c]">
        {getArea(app.state.areaId).priceBasis === "survey"
          ? getArea(app.state.areaId).priceNote
          : "各店の今週の値段のうち、いちばん安いものを底値にしています。自分の値札は21日で上書きします。"}
      </p>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="鶏むね、キャベツ、たまご"
        aria-label="品目を探す"
        className="mt-4 h-11 bg-white text-base"
      />
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
          すべて
        </FilterChip>
        {categoryOrder.map((item) => (
          <FilterChip key={item} active={category === item} onClick={() => setCategory(item)}>
            {categoryLabel[item]}
          </FilterChip>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="mt-8 rounded-3xl bg-white p-4 text-sm leading-6">その品目はまだ帳面にありません。</p>
      ) : (
        <ul className="mt-4 divide-y divide-[#e3d8c6] rounded-3xl bg-white px-3">
          {rows.map(({ item, quote }) => {
            if (!quote) return null;
            const store = getStore(quote.storeId);
            return (
              <li key={item.id}>
                <Link href={`/prices/${item.id}`} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{item.name}</span>
                      {quote.signal === "buy" ? <SignalMark signal="buy" /> : null}
                    </div>
                    <CategoryDot category={item.category} />
                    <p className="text-xs text-[#5e574c]">
                      {store?.name} · {item.unitLabel}
                    </p>
                  </div>
                  <Sparkline values={quote.series.map((point) => point.price)} />
                  <div className="text-right">
                    <Yen value={quote.unitPrice} className="text-2xl" />
                    <p className={cn("text-[11px] font-bold", quote.delta < 0 ? "text-[#c5362c]" : "text-[#5e574c]")}>
                      {signedPercent(quote.delta)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-xs leading-5 text-[#5e574c]">
        相場は周辺店の見本です。スキャンした値段だけが、あなたの記録です。
      </p>
    </div>
  );
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-sm font-bold",
        active ? "bg-[#1b6b43] text-[#f6f3ea]" : "bg-white text-[#1c1915]",
      )}
    >
      {children}
    </button>
  );
}
