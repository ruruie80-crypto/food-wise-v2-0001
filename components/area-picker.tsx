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
    <div className="space-y-4">
      {areasByPrefecture().map((group) => (
        <div key={group.prefecture}>
          <p className="text-[11px] font-bold tracking-[0.14em] text-[#1b6b43]">{group.prefecture}</p>
          <div className="mt-2 space-y-2">
            {group.areas.map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => onSelect(area.id)}
                className={cn(
                  "w-full rounded-2xl border px-3 py-3 text-left",
                  selectedId === area.id ? "border-[#1b6b43] bg-[#e5f2ea]" : "border-transparent bg-[#efe6d2]",
                )}
              >
                <span className="block font-bold">{area.name}</span>
                <span className="text-xs leading-5 text-[#5e574c]">{area.note}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
