"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { getRecipe } from "@/lib/catalog";
import { cookingMethod } from "@/lib/advice";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const STEP_MS = 7000;

export function RecipeVideoButton({ recipeId }: { recipeId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="text-sm font-bold text-[#1b6b43]" onClick={() => setOpen(true)}>
        動画で見る
      </button>
      {open ? <RecipePlayer recipeId={recipeId} onOpenChange={setOpen} /> : null}
    </>
  );
}

function RecipePlayer({
  recipeId,
  onOpenChange,
}: {
  recipeId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const recipe = getRecipe(recipeId);
  const steps = recipe?.steps ?? [];
  const total = Math.max(steps.length, 1) * STEP_MS;
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [session, setSession] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setElapsed((value) => {
        const next = Math.min(total, value + 100);
        if (next >= total) window.clearInterval(timer);
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, total, session]);

  if (!recipe) return null;
  const step = Math.min(steps.length - 1, Math.floor(elapsed / STEP_MS));
  const done = elapsed >= total;
  const method = cookingMethod(recipe.id);

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] rounded-t-3xl bg-[#1c1915] text-[#f6f3ea]">
        <SheetHeader>
          <SheetTitle className="pr-10 text-[#f6f3ea]">{recipe.name}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <p className="text-xs text-[#d7e4db]">
            {method} · 調理の目安 {recipe.minutes}分 · 手順 {step + 1}/{steps.length}
          </p>
          <MethodStage method={method} playing={playing} />
          <p className="min-h-24 text-lg leading-8 font-bold">{steps[step]}</p>
          <input
            type="range"
            min={0}
            max={total}
            step={100}
            value={elapsed}
            aria-label="手順の位置"
            onChange={(event) => setElapsed(Number(event.target.value))}
            className="w-full accent-[#ffe14a]"
          />
          <div className="flex flex-wrap gap-2">
            {steps.map((text, index) => (
              <button
                key={text}
                type="button"
                aria-label={`手順 ${index + 1}`}
                onClick={() => setElapsed(index * STEP_MS)}
                className={index === step ? "rounded-full bg-[#ffe14a] px-3 py-1 text-xs font-bold text-[#1c1915]" : "rounded-full bg-[#143026] px-3 py-1 text-xs font-bold"}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ffe14a] text-base font-bold text-[#1c1915]"
            onClick={() => {
              if (done) {
                setElapsed(0);
                setPlaying(true);
                setSession((value) => value + 1);
                return;
              }
              setPlaying((value) => !value);
            }}
          >
            {done ? <RotateCcw className="size-5" /> : playing ? <Pause className="size-5" /> : <Play className="size-5" />}
            {done ? "もう一度" : playing ? "一時停止" : "再生"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MethodStage({ method, playing }: { method: string; playing: boolean }) {
  const boil = method === "煮る" || method === "煮込む" || method === "ゆでる" || method === "煮て絡める" || method === "炒り煮";
  const fry = method === "炒める" || method === "焼く";
  return (
    <div className="flex h-28 items-end justify-center rounded-3xl bg-[#143026]" aria-hidden="true">
      <svg viewBox="0 0 160 90" className={`h-24 w-40 ${fry && playing ? "cook-pan" : ""}`}>
        <ellipse cx="80" cy="62" rx="46" ry="14" fill="#efe6d4" />
        <path d="M34 58h92" stroke="#cbbfaa" strokeWidth="6" strokeLinecap="round" />
        {boil ? (
          <>
            <circle className={playing ? "cook-bubble" : ""} cx="62" cy="48" r="4" fill="#ffe14a" />
            <circle className={playing ? "cook-bubble" : ""} cx="80" cy="44" r="5" fill="#fff4c2" style={{ animationDelay: "0.3s" }} />
            <circle className={playing ? "cook-bubble" : ""} cx="98" cy="50" r="3" fill="#ffe14a" style={{ animationDelay: "0.6s" }} />
          </>
        ) : null}
        {fry ? <path d="M48 50c10-8 18-8 28 0s18 8 28 0" fill="none" stroke="#ffe14a" strokeWidth="3" /> : null}
        {!boil && !fry ? <rect x="58" y="36" width="44" height="22" rx="6" fill="#efe6d4" /> : null}
      </svg>
    </div>
  );
}
