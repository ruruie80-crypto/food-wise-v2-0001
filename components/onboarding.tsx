"use client";

import { useState } from "react";
import { useApp } from "@/components/app-state";
import { AreaPicker } from "@/components/area-picker";
import { Button } from "@/components/ui/button";
import { budgetHint, MODE_LABEL, modeHint, yen } from "@/lib/format";
import { describeHousehold, TOME_PRESET } from "@/lib/household";
import type { MealMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MODES: MealMode[] = ["dinner_breakfast", "dinner", "full"];

export function Onboarding() {
  const { state, setArea, setPeople, setAdults, setChildren, setChildStage, setBudget, setMode, generate } = useApp();
  const [step, setStep] = useState(0);
  const tome = state.areaId === "tome";
  const hint = budgetHint(state.people, state.mode);

  const finish = () => {
    const result = generate();
    if (!result.ok) toast.error(result.error);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-panel/80 p-3 sm:items-center">
      <div className="flex max-h-[min(42rem,92dvh)] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-card p-5 shadow-2xl">
        <p className="text-sm font-bold text-primary">底値ごはん</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">値札が、献立になる。</h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          ふだん買う地域の値段で、1週間のごはんを考えます。これは試しの画面です。値段は目安で、記録はこのスマホの中だけに残ります。
        </p>

        {step === 0 ? (
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
            <p className="text-base font-bold">ふだん買う地域</p>
            <div className="mt-3">
              <AreaPicker selectedId={state.areaId} onSelect={setArea} />
            </div>
            {tome ? (
              <p className="mt-3 text-base leading-7">
                登米は、大人2人と中学生2人、月8万円（1週間 {yen(TOME_PRESET.budget)}）から始まります。脂の多い肉と牛乳は、最初から控えます。
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
            <p className="text-base font-bold">何人分を作るか</p>
            {tome ? (
              <>
                <p className="mt-2 text-base leading-7">{describeHousehold(state.adults, state.children, state.childStage)}</p>
                <CountRow label="大人" value={state.adults} onChange={setAdults} />
                <CountRow label="子ども" value={state.children} onChange={setChildren} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChildStage("young")}
                    className={cn(
                      "min-h-11 rounded-2xl px-2 text-sm font-bold",
                      state.childStage === "young" ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                  >
                    小学生以下
                  </button>
                  <button
                    type="button"
                    onClick={() => setChildStage("teen")}
                    className={cn(
                      "min-h-11 rounded-2xl px-2 text-sm font-bold",
                      state.childStage === "teen" ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                  >
                    中学生以上
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-3 flex items-center gap-3">
                <Button type="button" variant="outline" className="size-11" onClick={() => setPeople(state.people - 1)}>
                  −
                </Button>
                <p className="font-price text-4xl font-semibold">{state.people}人</p>
                <Button type="button" variant="outline" className="size-11" onClick={() => setPeople(state.people + 1)}>
                  ＋
                </Button>
              </div>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMode(mode)}
                  className={cn(
                    "min-h-11 rounded-2xl px-2 py-3 text-sm font-bold",
                    state.mode === mode ? "bg-primary text-primary-foreground" : "bg-secondary",
                  )}
                >
                  {MODE_LABEL[mode]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{modeHint(state.mode)}</p>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-5">
            <p className="text-base font-bold">{tome ? "1か月の食費" : "今週の食費"}</p>
            <p className="font-price text-5xl font-semibold leading-none">
              {tome && state.monthlyBudget ? `${state.monthlyBudget.toLocaleString("ja-JP")}円` : yen(state.budget)}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {tome
                ? `月8万円を週にならすと ${yen(state.budget)} です。30.4日で割って、7日分にしています。`
                : `この人数と範囲なら、目安は ${yen(hint)} です。`}
            </p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {(tome ? [15000, 18400, 22000, 28000] : [3000, 5000, 7000, 10000]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBudget(tome ? preset : preset * state.people)}
                  className={cn(
                    "min-h-11 rounded-xl py-2 text-sm font-bold",
                    state.budget === (tome ? preset : preset * state.people) ? "bg-accent" : "bg-card",
                  )}
                >
                  {tome ? yen(preset) : `${preset / 1000}千`}
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
              {tome ? "この家族ではじめる" : "5,000円ではじめる"}
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

function CountRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="mt-3 flex items-center justify-between">
      <span className="text-base font-bold">{label}</span>
      <span className="flex items-center gap-2">
        <Button type="button" variant="outline" className="size-11 text-xl" onClick={() => onChange(value - 1)} aria-label={`${label}を減らす`}>
          −
        </Button>
        <span className="w-8 text-center text-xl font-bold">{value}</span>
        <Button type="button" variant="outline" className="size-11 text-xl" onClick={() => onChange(value + 1)} aria-label={`${label}を増やす`}>
          ＋
        </Button>
      </span>
    </div>
  );
}
