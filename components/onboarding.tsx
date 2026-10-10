"use client";

import { useState } from "react";
import { useApp } from "@/components/app-state";
import { AreaPicker } from "@/components/area-picker";
import { Button } from "@/components/ui/button";
import { budgetHint, MODE_LABEL, modeHint, yen } from "@/lib/format";
import type { MealMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MODES: MealMode[] = ["dinner_breakfast", "dinner", "full"];

export function Onboarding() {
  const { state, setArea, setPeople, setBudget, setMode, generate } = useApp();
  const [step, setStep] = useState(0);
  const hint = budgetHint(state.people, state.mode);

  const finish = () => {
    const result = generate();
    if (!result.ok) toast.error(result.error);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#143026]/80 p-3 sm:items-center">
      <div className="flex max-h-[min(42rem,92dvh)] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-[#f4efe4] p-5 shadow-2xl">
        <p className="text-[11px] font-bold tracking-[0.16em] text-[#1b6b43]">底値ごはん</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">値札が、献立になる。</h1>
        <p className="mt-2 text-sm leading-6 text-[#5e574c]">
          生活圏の底値を覚えて、今週の食費のなかで栄養が偏らない献立を作ります。公開用の試作で、相場は見本、記録はこの端末の外には出ません。
        </p>

        {step === 0 ? (
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
            <p className="text-sm font-bold">ふだん買う地域</p>
            <div className="mt-3">
              <AreaPicker selectedId={state.areaId} onSelect={setArea} />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-5">
            <p className="text-sm font-bold">何人分を作るか</p>
            <div className="mt-3 flex items-center gap-3">
              <Button type="button" variant="outline" className="size-11" onClick={() => setPeople(state.people - 1)}>
                −
              </Button>
              <p className="font-price text-4xl font-semibold">{state.people}人</p>
              <Button type="button" variant="outline" className="size-11" onClick={() => setPeople(state.people + 1)}>
                ＋
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMode(mode)}
                  className={cn(
                    "rounded-2xl px-2 py-3 text-sm font-bold",
                    state.mode === mode ? "bg-[#1b6b43] text-[#f6f3ea]" : "bg-[#efe6d2]",
                  )}
                >
                  {MODE_LABEL[mode]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-[#5e574c]">{modeHint(state.mode)}</p>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-5">
            <p className="text-sm font-bold">今週の食費</p>
            <p className="font-price text-5xl font-semibold leading-none">{yen(state.budget)}</p>
            <p className="mt-2 text-xs text-[#5e574c]">この人数と範囲なら、目安は {yen(hint)} です。</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[3000, 5000, 7000, 10000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBudget(preset * state.people)}
                  className={cn(
                    "rounded-xl py-2 text-sm font-bold",
                    state.budget === preset * state.people ? "bg-[#ffe14a]" : "bg-white",
                  )}
                >
                  {preset / 1000}千
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex gap-2">
          {step > 0 ? (
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={() => setStep(step - 1)}>
              戻る
            </Button>
          ) : (
            <Button type="button" variant="ghost" className="h-12 flex-1" onClick={finish}>
              5,000円ではじめる
            </Button>
          )}
          {step < 2 ? (
            <Button type="button" className="h-12 flex-1 text-base" onClick={() => setStep(step + 1)}>
              次へ
            </Button>
          ) : (
            <Button type="button" className="h-12 flex-1 text-base" onClick={finish}>
              献立を作る
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
