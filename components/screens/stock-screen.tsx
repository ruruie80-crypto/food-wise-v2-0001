"use client";

import { useState } from "react";
import Link from "next/link";
import { categoryLabel, getIngredient, ingredients } from "@/lib/catalog";
import { useApp } from "@/components/app-state";
import { BootScreen } from "@/components/bits";
import { formatUnits, trimNum } from "@/lib/format";
import { MAX_RICE_KG, stockChoices } from "@/lib/stock";
import type { Category, StockPlace } from "@/lib/types";

const PLACES: { id: StockPlace; label: string; hint: string }[] = [
  { id: "fridge", label: "冷蔵庫", hint: "今夜から使うもの" },
  { id: "freezer", label: "冷凍庫", hint: "まとめ買いして凍らせたもの" },
];

const GROUPS: Category[] = ["vegetable", "meat", "fish", "egg_soy", "staple"];

export function StockScreen() {
  const app = useApp();
  const [place, setPlace] = useState<StockPlace>("fridge");
  const [group, setGroup] = useState<Category>("vegetable");
  if (!app.ready) return <BootScreen />;

  const mine = app.state.stock.filter((item) => item.place === place);
  const choices = ingredients.filter((item) => item.category === group);

  const unitsOf = (ingredientId: string) =>
    app.state.stock.find((item) => item.ingredientId === ingredientId && item.place === place)?.units ?? 0;

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-12">
      <p className="text-sm font-bold tracking-wide text-primary">在庫</p>
      <h1 className="text-3xl font-black tracking-tight">冷蔵庫・冷凍庫</h1>
      <p className="mt-2 text-base leading-7">
        ある食材を先に献立へ使います。足りない分だけ買い物リストに出ます。記録はこのiPhoneの中だけです。
      </p>
      {app.state.areaId === "tome" ? (
        <p className="mt-3 rounded-3xl bg-card p-4 text-base leading-7">
          業務スーパー南方店は、ひき肉・鶏肉・冷凍野菜のまとめ買いに向いています。冷凍庫に入れて、次の週も使えます。値段の初期値は仙台市の統計です。公式では年始を除き年中無休です。臨時休業は店に確認します。
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {PLACES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPlace(item.id)}
            className={
              place === item.id
                ? "min-h-16 rounded-2xl bg-primary px-3 py-3 text-left text-primary-foreground"
                : "min-h-16 rounded-2xl bg-card px-3 py-3 text-left"
            }
          >
            <span className="block text-lg font-black">{item.label}</span>
            <span className={place === item.id ? "text-sm text-primary-foreground/80" : "text-sm text-muted-foreground"}>
              {item.hint}
            </span>
          </button>
        ))}
      </div>

      <section className="mt-4 rounded-3xl bg-card p-4">
        <h2 className="text-xl font-black">{place === "fridge" ? "冷蔵庫にあるもの" : "冷凍庫にあるもの"}</h2>
        {mine.length === 0 ? (
          <p className="mt-2 text-base leading-7">まだ入っていません。下の食材を押すと、1つ入ります。</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {mine.map((item) => {
              const ingredient = getIngredient(item.ingredientId);
              if (!ingredient) return null;
              return (
                <li key={item.ingredientId} className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block text-lg font-bold">{ingredient.name}</span>
                    <span className="text-base text-muted-foreground">
                      {formatUnits(item.units, ingredient)}
                      {ingredient.id === "rice" ? `（${trimNum((item.units * 75) / 1000)}kg）` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      className="size-12 rounded-2xl bg-muted text-2xl font-bold"
                      aria-label={`${ingredient.name}を減らす`}
                      onClick={() => app.setStock(item.ingredientId, place, item.units - 1)}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="size-12 rounded-2xl bg-muted text-2xl font-bold"
                      aria-label={`${ingredient.name}を増やす`}
                      onClick={() => app.setStock(item.ingredientId, place, item.units + 1)}
                    >
                      ＋
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-4">
        <h2 className="text-xl font-black">食材を入れる</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          卵も肉も、米と同じ上限です。米なら{MAX_RICE_KG}kgまで入れられます。
        </p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {GROUPS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setGroup(id)}
              className={
                group === id
                  ? "shrink-0 rounded-full bg-primary px-4 py-3 text-base font-bold text-primary-foreground"
                  : "shrink-0 rounded-full bg-card px-4 py-3 text-base font-bold"
              }
            >
              {categoryLabel[id]}
            </button>
          ))}
        </div>
        <ul className="mt-3 space-y-2">
          {choices.map((ingredient) => {
            const have = unitsOf(ingredient.id);
            const choicesFor = stockChoices(ingredient);
            return (
              <li key={ingredient.id} className="rounded-2xl bg-card px-4 py-3">
                <p className="text-lg font-bold">
                  {ingredient.name}
                  {have > 0 ? <span className="ml-2 text-base text-primary">{formatUnits(have, ingredient)}</span> : null}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {choicesFor.map((choice) => (
                    <button
                      key={choice.label}
                      type="button"
                      onClick={() => app.setStock(ingredient.id, place, have + choice.units)}
                      className="min-h-11 rounded-2xl bg-muted px-3 text-base font-bold"
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
                {ingredient.unitKind === "grams100" ? (
                  <form
                    className="mt-2 flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      const grams = Number(String(data.get("grams") ?? "").replace(/[^\d]/g, ""));
                      if (!Number.isFinite(grams) || grams <= 0) return;
                      app.setStock(ingredient.id, place, have + grams / 100);
                      event.currentTarget.reset();
                    }}
                  >
                    <input
                      name="grams"
                      inputMode="numeric"
                      placeholder="グラム"
                      aria-label={`${ingredient.name}のグラム`}
                      className="h-11 min-w-0 flex-1 rounded-2xl bg-muted px-3 text-base"
                    />
                    <button type="submit" className="min-h-11 rounded-2xl bg-muted px-3 text-base font-bold">
                      グラムで入れる
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <Link href="/meals" className="mt-6 flex min-h-12 items-center justify-center rounded-2xl bg-primary text-base font-bold text-primary-foreground">
        献立に戻る
      </Link>
    </div>
  );
}
