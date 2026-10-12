"use client";

import { storesIn } from "@/lib/catalog";

export function AreaStores({ areaId }: { areaId: string }) {
  const stores = storesIn(areaId).filter((store) => store.address || store.sourceUrl);
  if (stores.length === 0) return null;
  return (
    <section className="mt-6">
      <p className="text-[11px] font-bold tracking-[0.16em] text-primary">店</p>
      <h2 className="text-lg font-black">この生活圏の店</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">住所と営業時間は、各店が発表している案内です。</p>
      <ul className="mt-3 space-y-3">
        {stores.map((store) => (
          <li key={store.id} className="rounded-3xl bg-card p-4">
            <p className="text-[11px] font-bold tracking-[0.14em] text-primary">{store.kind}</p>
            <p className="text-base font-black">{store.name}</p>
            {store.address ? <p className="mt-1 text-sm leading-6">{store.address}</p> : null}
            <p className="text-sm leading-6">営業 {store.hours}</p>
            {store.phone ? (
              <a href={`tel:${store.phone}`} className="text-sm font-bold text-primary">
                電話 {store.phone}
              </a>
            ) : null}
            {store.sourceUrl ? (
              <a
                href={store.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-sm font-bold text-primary"
              >
                店舗の案内を開く
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
