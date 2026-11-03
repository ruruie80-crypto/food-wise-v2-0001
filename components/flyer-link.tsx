import type { Store } from "@/lib/types";

export function FlyerLink({ store }: { store: Store }) {
  if (!store.flyerUrl) return null;
  return (
    <div className="mt-3">
      <a
        href={store.flyerUrl}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className="flex min-h-12 items-center justify-center rounded-2xl bg-primary px-3 text-center text-base font-bold text-primary-foreground"
      >
        {store.flyerLabel ?? "チラシのページを開く"}
      </a>
      {store.flyerNote ? <p className="mt-2 text-base leading-7">{store.flyerNote}</p> : null}
    </div>
  );
}
