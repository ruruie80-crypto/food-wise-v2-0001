"use client";

import { FlyerLink } from "@/components/flyer-link";
import { storesIn } from "@/lib/catalog";

export function AreaStores({ areaId }: { areaId: string }) {
  const stores = storesIn(areaId).filter((store) => store.address || store.sourceUrl);
  if (stores.length === 0) return null;
  const tome = areaId === "tome";
  return (
    <section className="mt-6">
      <p className="text-sm font-bold tracking-wide text-primary">店</p>
      <h2 className={tome ? "text-2xl font-black" : "text-lg font-black"}>この生活圏の店</h2>
      <p className={tome ? "mt-1 text-base leading-7" : "mt-1 text-xs leading-5 text-muted-foreground"}>
        住所と営業時間は、各店が発表している案内です。
        {tome ? "チラシはボタンで開きます。アプリは中身を取りません。" : ""}
      </p>
      <ul className="mt-3 space-y-3">
        {stores.map((store) => (
          <li key={store.id} className="rounded-3xl bg-card p-4">
            <p className="text-sm font-bold tracking-wide text-primary">{store.kind}</p>
            <p className={tome ? "text-xl font-black" : "text-base font-black"}>{store.name}</p>
            {store.address ? (
              <p className={tome ? "mt-1 text-base leading-7" : "mt-1 text-sm leading-6"}>{store.address}</p>
            ) : null}
            <p className={tome ? "text-base leading-7" : "text-sm leading-6"}>営業 {store.hours}</p>
            {store.phone ? (
              <a href={`tel:${store.phone}`} className="inline-flex min-h-11 items-center text-base font-bold text-primary">
                電話 {store.phone}
              </a>
            ) : null}
            <FlyerLink store={store} />
            {store.sourceUrl && store.sourceUrl !== store.flyerUrl ? (
              <a
                href={store.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className="mt-2 inline-flex min-h-11 items-center text-base font-bold text-primary"
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
