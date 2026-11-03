"use client";

import { areasByPrefecture } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export function AreaPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (areaId: string) => void;
}) {
  return (
    <div className="space-y-4" role="group" aria-label="ふだん買う地域">
      {areasByPrefecture().map((group) => (
        <div key={group.prefecture}>
          <p className="text-sm font-bold tracking-[0.14em] text-primary">{group.prefecture}</p>
          <div className="mt-2 space-y-2">
            {group.areas.map((area) => (
              <button
                key={area.id}
                type="button"
                aria-pressed={selectedId === area.id}
                onClick={() => onSelect(area.id)}
                className={cn(
                  "min-h-11 w-full rounded-2xl border px-3 py-3 text-left",
                  selectedId === area.id ? "border-primary bg-chip" : "border-transparent bg-secondary",
                )}
              >
                <span className="block font-bold">{area.name}</span>
                <span className="text-sm leading-6 text-muted-foreground">{area.note}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
