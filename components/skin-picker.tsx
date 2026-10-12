"use client";

import { useId } from "react";
import { useApp } from "@/components/app-state";
import { SKINS, type SkinId } from "@/lib/skins";
import { cn } from "@/lib/utils";

export function SkinPicker({ className }: { className?: string }) {
  const { state, setSkin } = useApp();
  const headingId = useId();
  return (
    <section className={cn("mt-5", className)} aria-labelledby={headingId}>
      <h2 id={headingId} className="text-[11px] font-bold tracking-[0.16em] text-primary">
        着せ替え
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">見た目だけが変わります。献立と値札はそのままです。</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {SKINS.map((skin) => (
          <SkinCard key={skin.id} id={skin.id} selected={state.skin === skin.id} onSelect={setSkin} />
        ))}
      </div>
    </section>
  );
}

function SkinCard({
  id,
  selected,
  onSelect,
}: {
  id: SkinId;
  selected: boolean;
  onSelect: (id: SkinId) => void;
}) {
  const skin = SKINS.find((item) => item.id === id)!;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${skin.name}。${skin.blurb}`}
      onClick={() => onSelect(skin.id)}
      className={cn(
        "overflow-hidden p-2 text-left ring-2 ring-offset-2 ring-offset-background",
        selected ? "ring-primary" : "ring-transparent",
      )}
      style={{ background: skin.swatch.background, color: skin.swatch.foreground, borderRadius: skin.radius }}
    >
      <span
        aria-hidden
        className="mb-1.5 block h-11 w-full"
        style={{
          backgroundColor: skin.swatch.background,
          backgroundImage: skin.motif ? `url(${skin.motif})` : undefined,
          backgroundSize: skin.motifPreview,
          backgroundPosition: skin.motifPosition,
          backgroundRepeat: "repeat",
          borderRadius: `calc(${skin.radius} * 0.4)`,
        }}
      />
      <span className="block px-2 py-2" style={{ background: skin.swatch.card, borderRadius: `calc(${skin.radius} * 0.62)` }}>
        <span className="block text-[10px] font-bold tracking-[0.14em]" style={{ color: skin.swatch.primary }}>
          底値
        </span>
        <span className="mt-1 flex items-end justify-between gap-1">
          <span className="text-sm leading-none font-black">{skin.short}</span>
          <span
            className="rounded-[4px] px-1.5 font-price text-lg leading-none font-semibold"
            style={{ background: skin.swatch.accent, color: skin.swatch.accentForeground }}
          >
            ¥128
          </span>
        </span>
      </span>
      <span className="mt-1.5 block text-[10px] leading-4">{selected ? "着用中 · " : ""}{skin.blurb}</span>
    </button>
  );
}
