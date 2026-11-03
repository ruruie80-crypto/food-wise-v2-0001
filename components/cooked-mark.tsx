import type { MealType } from "@/lib/types";

export function CookedMark({ cooked }: { cooked: boolean }) {
  if (!cooked) return null;
  return <span className="ml-2 text-sm font-bold text-primary">作った</span>;
}

export function cookControl(cooked: boolean, meal: MealType): { label: string; disabled: boolean } {
  return {
    label: cooked ? "作ったを取り消す" : cookActionLabel(meal),
    disabled: false,
  };
}

export function cookActionLabel(meal: MealType): string {
  if (meal === "breakfast") return "この朝を作った";
  if (meal === "lunch") return "この昼を作った";
  return "この夜を作った";
}
