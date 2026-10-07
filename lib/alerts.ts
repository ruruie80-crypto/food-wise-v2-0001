import { categoryLabel, getIngredient, getRecipe, getStore, stores } from "./catalog";
import { addDays, formatWithWeekday, weekdayIndex, weekdayName } from "./dates";
import { yen } from "./format";
import type { PriceBook } from "./prices";
import type { AlertItem, Observation, Plan } from "./types";

export function buildAlerts(
  today: string,
  book: PriceBook,
  plan: Plan | null,
  observations: Observation[],
): AlertItem[] {
  const alerts: AlertItem[] = [];
  const ranked = ["chicken_b", "pork", "egg", "cabbage", "mackerel", "tofu", "salmon", "komatsuna", "sprouts"]
    .map((id) => book.quote(id))
    .filter((quote) => quote?.signal === "buy");

  for (const quote of ranked.slice(0, 3)) {
    if (!quote) continue;
    const ingredient = getIngredient(quote.ingredientId);
    const store = getStore(quote.storeId);
    if (!ingredient || !store) continue;
    alerts.push({
      id: `buy-${ingredient.id}`,
      tone: "buy",
      title: `${ingredient.name}は買い時`,
      body: `${store.name}の${ingredient.unitLabel}が${yen(quote.unitPrice)}。直近の底値より${Math.abs(Math.round(quote.delta * 100))}%安いです。`,
      href: `/prices/${ingredient.id}`,
    });
  }

  const tomorrow = addDays(today, 1);
  const dow = weekdayIndex(tomorrow);
  for (const store of stores) {
    if (store.closedWeekday === dow) {
      alerts.push({
        id: `closed-${store.id}`,
        tone: "sale",
        title: `明日は${store.name}が定休`,
        body: `${formatWithWeekday(tomorrow)}は休みです。野菜は前日までに。`,
        href: "/shop",
      });
      continue;
    }
    const sales = store.weekdaySales.find((sale) => sale.dow === dow);
    if (!sales) continue;
    const names = sales.categories.map((category) => categoryLabel[category]).join("・");
    alerts.push({
      id: `sale-${store.id}-${dow}`,
      tone: "sale",
      title: `明日は${store.name}の${names}`,
      body: `${weekdayName(tomorrow)}曜日のパターンです。${store.saleNote}。`,
      href: "/prices",
    });
  }

  if (plan) {
    const seen = new Set<string>();
    for (const slot of plan.slots) {
      const recipe = getRecipe(slot.recipeId);
      if (!recipe) continue;
      for (const item of recipe.items) {
        if (seen.has(item.ingredientId)) continue;
        const quote = book.quote(item.ingredientId);
        if (quote?.signal !== "wait") continue;
        const ingredient = getIngredient(item.ingredientId);
        if (!ingredient || ingredient.altGroup !== "protein") continue;
        seen.add(item.ingredientId);
        alerts.push({
          id: `wait-${ingredient.id}`,
          tone: "plan",
          title: `${ingredient.name}は見送り寄り`,
          body: "今週の献立に入っています。鶏むねや豆腐へ寄せると金額が下がりやすいです。",
          href: "/meals",
        });
      }
    }
  }

  if (observations.length === 0) {
    alerts.push({
      id: "scan-empty",
      tone: "scan",
      title: "値札がまだありません",
      body: "サンプルのレシートを読み取ると、生活圏の底値がどう動くか分かります。",
      href: "/scan",
    });
  }

  return alerts;
}
