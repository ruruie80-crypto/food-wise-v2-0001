import { categoryLabel } from "@/lib/catalog";
import { signedPercent, yen } from "@/lib/format";
import type { Category, Signal } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Yen({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <span className={cn("font-price font-semibold tracking-tight", className)}>
      <span className="mr-px text-[0.62em]">¥</span>
      {Math.round(value).toLocaleString("ja-JP")}
    </span>
  );
}

export function PriceSticker({
  value,
  unit,
}: {
  value: number;
  unit?: string;
}) {
  return (
    <span className="inline-flex items-end gap-1 rounded-[4px] bg-[#ffe14a] px-2 py-1 text-[#1c1915] shadow-[3px_3px_0_#1c1915]">
      <Yen value={value} className="text-[1.7rem] leading-none" />
      {unit ? <span className="mb-0.5 text-[10px] font-medium">{unit}</span> : null}
    </span>
  );
}

export function SignalMark({ signal, delta }: { signal: Signal; delta?: number }) {
  if (signal === "normal" && delta == null) return null;
  if (signal === "buy") {
    return (
      <span className="inline-flex items-center rounded-full bg-[#ffe14a] px-2 py-0.5 text-[11px] font-bold text-[#1c1915]">
        買い時{delta != null ? ` ${signedPercent(delta)}` : ""}
      </span>
    );
  }
  if (signal === "wait") {
    return (
      <span className="inline-flex items-center rounded-full bg-[#f3d2c8] px-2 py-0.5 text-[11px] font-bold text-[#7a2e24]">
        見送り{delta != null ? ` ${signedPercent(delta)}` : ""}
      </span>
    );
  }
  return (
    <span className="text-[11px] font-medium text-[#5e574c]">
      {delta != null ? `相場比 ${signedPercent(delta)}` : "ふつう"}
    </span>
  );
}

const DOT: Record<Category, string> = {
  vegetable: "#2f7d32",
  meat: "#c4473a",
  fish: "#2a6f97",
  egg_soy: "#c48a2a",
  staple: "#8a6a3b",
  seasoning: "#6b5b4b",
};

export function CategoryDot({ category }: { category: Category }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[#5e574c]">
      <span className="size-1.5 rounded-full" style={{ background: DOT[category] }} />
      {categoryLabel[category]}
    </span>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 72;
  const height = 28;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = max === min ? height / 2 : height - 3 - ((value - min) / (max - min)) * (height - 6);
      return `${x},${y}`;
    })
    .join(" ");
  const last = points.split(" ").at(-1)?.split(",") ?? ["0", "0"];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("h-7 w-16 text-[#1b6b43]", className)} aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.7" points={points} />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill="#ffe14a" stroke="#1c1915" strokeWidth="1" />
    </svg>
  );
}

export function BootScreen() {
  return (
    <div className="space-y-4 px-4 pt-8" aria-busy="true" aria-live="polite">
      <p className="text-sm text-[#5e574c]">底値を開いています</p>
      <div className="h-8 w-40 animate-pulse rounded-lg bg-[#e7dfd0]" />
      <div className="h-44 animate-pulse rounded-3xl bg-[#e7dfd0]" />
      <div className="h-28 animate-pulse rounded-3xl bg-[#e7dfd0]" />
    </div>
  );
}

export function SectionTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div>
      {eyebrow ? <p className="text-[11px] font-bold tracking-[0.16em] text-[#1b6b43]">{eyebrow}</p> : null}
      <h2 className="text-lg font-black tracking-tight">{title}</h2>
    </div>
  );
}

export function yenLabel(value: number): string {
  return yen(value);
}
