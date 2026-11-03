"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { areas } from "@/lib/catalog";
import { tokyoHour, tokyoToday } from "@/lib/dates";
import { buildAlerts } from "@/lib/alerts";
import { householdServings, MAX_WEEKLY_BUDGET, TOME_PRESET, weeklyFromMonthly } from "@/lib/household";
import { buildPlan, replacePlanSlot, type PlanResult } from "@/lib/optimizer";
import { createPriceBook, type PriceBook } from "@/lib/prices";
import { isBrightSkin, isSkin, skinThemeColor, type SkinId } from "@/lib/skins";
import type {
  AlertItem,
  MealMode,
  MealType,
  Observation,
  Plan,
  PlanFocus,
  Prefs,
  StockItem,
  StockPlace,
} from "@/lib/types";

const STORAGE_KEY = "sokone-gohan-v1";
const STORAGE_EVENT = "sokone-storage";

let memorySnapshot: string | null = null;

function subscribeStorage(callback: () => void) {
  window.addEventListener(STORAGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STORAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function readStorage(): string {
  if (memorySnapshot != null) return memorySnapshot;
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStorage(next: Persisted) {
  const json = JSON.stringify(next);
  memorySnapshot = json;
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // 容量オーバーでも、この画面のあいだはメモリの記録を使う。
  }
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function subscribeClock(callback: () => void) {
  const timer = window.setInterval(callback, 60_000);
  return () => window.clearInterval(timer);
}

function readClock(): string {
  return `${tokyoToday()}|${tokyoHour()}`;
}

export type Persisted = {
  v: 1;
  areaId: string;
  people: number;
  budget: number;
  mode: MealMode;
  prefs: Prefs;
  excludes: string[];
  adults: number;
  children: number;
  monthlyBudget: number | null;
  stock: StockItem[];
  observations: Observation[];
  balanced: Plan | null;
  cheap: Plan | null;
  focus: PlanFocus;
  checks: Record<string, boolean>;
  onboarded: boolean;
  readAlertIds: string[];
  premiumPreview: boolean;
  skin: SkinId;
};

export type ObservationDraft = {
  ingredientId: string;
  storeId: string;
  price: number;
  source: Observation["source"];
};

type AppContextValue = {
  ready: boolean;
  today: string;
  hour: number;
  state: Persisted;
  book: PriceBook | null;
  activePlan: Plan | null;
  stale: boolean;
  alerts: AlertItem[];
  unreadCount: number;
  setBudget: (value: number) => void;
  setMonthlyBudget: (value: number | null) => void;
  setPeople: (value: number) => void;
  setAdults: (value: number) => void;
  setChildren: (value: number) => void;
  applyTomePreset: () => void;
  setMode: (mode: MealMode) => void;
  setArea: (areaId: string) => void;
  setStock: (ingredientId: string, place: StockPlace, units: number) => void;
  togglePref: (key: keyof Prefs) => void;
  toggleExclusion: (ids: string[]) => void;
  setFocus: (focus: PlanFocus) => void;
  generate: () => PlanResult;
  addObservations: (rows: ObservationDraft[]) => { ingredientId: string; price: number }[];
  removeObservation: (id: string) => void;
  toggleCheck: (ingredientId: string, checked: boolean) => void;
  replaceSlot: (dayIndex: number, meal: MealType, recipeId: string) => void;
  markAlertsRead: () => void;
  setPremiumPreview: (on: boolean) => void;
  setSkin: (skin: SkinId) => void;
  reset: () => void;
  acceptHandoff: (record: unknown) => string;
};

const AppContext = createContext<AppContextValue | null>(null);

function defaultState(): Persisted {
  return {
    v: 1,
    areaId: "nakano",
    people: 1,
    budget: 5000,
    mode: "dinner_breakfast",
    prefs: { quick: false, moreVeg: false, highProtein: false, washoku: false, lessFat: false, noMilk: false },
    excludes: [],
    adults: 1,
    children: 0,
    monthlyBudget: null,
    stock: [],
    observations: [],
    balanced: null,
    cheap: null,
    focus: "balanced",
    checks: {},
    onboarded: false,
    readAlertIds: [],
    premiumPreview: false,
    skin: "kami",
  };
}

function isPlan(value: unknown): value is Plan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Plan;
  return Array.isArray(plan.slots) && typeof plan.portion === "number" && typeof plan.cost === "number";
}

function sanitize(raw: unknown): Persisted {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<Persisted>;
  const areaId = areas.some((area) => area.id === data.areaId) ? data.areaId! : base.areaId;
  const mode: MealMode =
    data.mode === "dinner" || data.mode === "full" || data.mode === "dinner_breakfast"
      ? data.mode
      : base.mode;
  const legacyPeople = clampCount(data.people, 1, 4, 1);
  const adults = clampCount(data.adults, 1, 4, legacyPeople);
  const children = clampCount(data.children, 0, 4, 0);
  const people = householdServings(adults, children);
  const budget = typeof data.budget === "number" ? Math.min(MAX_WEEKLY_BUDGET, Math.max(500, Math.round(data.budget))) : 5000;
  const monthlyBudget =
    typeof data.monthlyBudget === "number" && data.monthlyBudget > 0
      ? Math.min(300_000, Math.round(data.monthlyBudget))
      : null;
  const prefs = {
    ...base.prefs,
    ...(data.prefs ?? {}),
    lessFat: Boolean(data.prefs?.lessFat),
    noMilk: Boolean(data.prefs?.noMilk),
  };
  let skin = isSkin(data.skin) ? data.skin : base.skin;
  if (areaId === "tome" && !isBrightSkin(skin)) skin = "kami";
  return {
    ...base,
    areaId,
    people,
    adults,
    children,
    budget,
    monthlyBudget,
    mode,
    prefs,
    excludes: Array.isArray(data.excludes) ? data.excludes.filter((id) => typeof id === "string") : [],
    stock: Array.isArray(data.stock) ? data.stock.filter(isStockItem) : [],
    observations: Array.isArray(data.observations) ? data.observations.filter(isObservation) : [],
    balanced: isPlan(data.balanced) ? data.balanced : null,
    cheap: isPlan(data.cheap) ? data.cheap : null,
    focus: data.focus === "cheap" ? "cheap" : "balanced",
    checks: data.checks && typeof data.checks === "object" ? data.checks : {},
    onboarded: Boolean(data.onboarded),
    readAlertIds: Array.isArray(data.readAlertIds) ? data.readAlertIds.filter((id) => typeof id === "string") : [],
    premiumPreview: Boolean(data.premiumPreview),
    skin,
  };
}

function clampCount(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function isStockItem(value: unknown): value is StockItem {
  if (!value || typeof value !== "object") return false;
  const row = value as StockItem;
  return (
    typeof row.ingredientId === "string" &&
    (row.place === "fridge" || row.place === "freezer") &&
    typeof row.units === "number" &&
    Number.isFinite(row.units) &&
    row.units > 0 &&
    row.units <= 80
  );
}

function isObservation(value: unknown): value is Observation {
  if (!value || typeof value !== "object") return false;
  const row = value as Observation;
  return (
    typeof row.id === "string" &&
    typeof row.ingredientId === "string" &&
    typeof row.storeId === "string" &&
    typeof row.price === "number" &&
    typeof row.date === "string"
  );
}

export function sourceKey(state: Persisted): string {
  return [
    state.areaId,
    state.adults,
    state.children,
    state.people,
    state.budget,
    state.monthlyBudget ?? "",
    state.mode,
    state.prefs.quick,
    state.prefs.moreVeg,
    state.prefs.highProtein,
    state.prefs.washoku,
    state.prefs.lessFat,
    state.prefs.noMilk,
    state.excludes.slice().sort().join(","),
    state.stock
      .map((item) => `${item.place}:${item.ingredientId}:${item.units}`)
      .sort()
      .join(","),
    state.observations.map((row) => row.id).join(","),
  ].join("|");
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribeStorage, readStorage, () => "");
  const clock = useSyncExternalStore(subscribeClock, readClock, () => "");
  const state = useMemo(() => (raw ? sanitize(safeParse(raw)) : defaultState()), [raw]);
  const ready = clock !== "";
  const [today = "", hourText = "12"] = clock.split("|");
  const hour = Number(hourText);
  const update = useCallback((recipe: (current: Persisted) => Persisted) => {
    const next = recipe(state);
    if (next === state) return;
    writeStorage(next);
  }, [state]);

  const book = useMemo(
    () => (today ? createPriceBook(state.areaId, today, state.observations) : null),
    [today, state.areaId, state.observations],
  );

  const activePlan = state.focus === "cheap" ? state.cheap : state.balanced;
  const stale = Boolean(activePlan && activePlan.sourceKey !== sourceKey(state));
  const alerts = useMemo(
    () => (book && today ? buildAlerts(today, book, activePlan, state.observations, state.areaId) : []),
    [book, today, activePlan, state.observations, state.areaId],
  );
  const unreadCount = alerts.filter((alert) => !state.readAlertIds.includes(alert.id)).length;

  const patch = (partial: Partial<Persisted>) => update((current) => ({ ...current, ...partial }));

  const generate = (): PlanResult => {
    if (!today) return { ok: false, error: "日付を取得しています。" };
    const lookup = createPriceBook(state.areaId, today, state.observations);
    const key = sourceKey(state);
    const result = buildPlan(
      {
        budget: state.budget,
        people: householdServings(state.adults, state.children),
        days: 7,
        mode: state.mode,
        prefs: state.prefs,
        excludes: state.excludes,
        stock: state.stock,
        sourceKey: key,
      },
      lookup,
    );
    if (!result.ok) return result;
    update((current) => ({
      ...current,
      balanced: { ...result.balanced, sourceKey: key },
      cheap: { ...result.cheap, sourceKey: key },
      focus: "balanced",
      checks: {},
      onboarded: true,
    }));
    return result;
  };

  const value: AppContextValue = {
    ready,
    today,
    hour,
    state,
    book,
    activePlan,
    stale,
    alerts,
    unreadCount,
    setBudget: (budget) =>
      patch({
        budget: Math.min(MAX_WEEKLY_BUDGET, Math.max(0, Math.round(Number.isFinite(budget) ? budget : 0))),
      }),
    setMonthlyBudget: (monthly) => {
      if (monthly == null || !Number.isFinite(monthly) || monthly <= 0) {
        patch({ monthlyBudget: null });
        return;
      }
      const rounded = Math.min(300_000, Math.round(monthly));
      const weekly = weeklyFromMonthly(rounded);
      patch({
        monthlyBudget: rounded,
        budget: Math.min(MAX_WEEKLY_BUDGET, Math.max(500, weekly)),
      });
    },
    setPeople: (people) => {
      const adults = Math.min(4, Math.max(1, Math.round(people)));
      patch({ adults, children: 0, people: adults });
    },
    setAdults: (adults) =>
      update((current) => {
        const next = Math.min(4, Math.max(1, Math.round(adults)));
        return { ...current, adults: next, people: householdServings(next, current.children) };
      }),
    setChildren: (children) =>
      update((current) => {
        const next = Math.min(4, Math.max(0, Math.round(children)));
        return { ...current, children: next, people: householdServings(current.adults, next) };
      }),
    applyTomePreset: () =>
      patch({
        adults: TOME_PRESET.adults,
        children: TOME_PRESET.children,
        people: householdServings(TOME_PRESET.adults, TOME_PRESET.children),
        monthlyBudget: TOME_PRESET.monthlyBudget,
        budget: TOME_PRESET.budget,
        mode: TOME_PRESET.mode,
      }),
    setMode: (mode) => patch({ mode }),
    setArea: (areaId) =>
      update((current) => ({
        ...current,
        areaId,
        skin: areaId === "tome" && !isBrightSkin(current.skin) ? "kami" : current.skin,
      })),
    setStock: (ingredientId, place, units) =>
      update((current) => {
        const nextUnits = Math.round(units * 10) / 10;
        const stock = current.stock.filter((item) => !(item.ingredientId === ingredientId && item.place === place));
        if (nextUnits > 0) stock.push({ ingredientId, place, units: Math.min(80, nextUnits) });
        return { ...current, stock };
      }),
    togglePref: (key) =>
      update((current) => ({ ...current, prefs: { ...current.prefs, [key]: !current.prefs[key] } })),
    toggleExclusion: (ids) =>
      update((current) => {
        const has = ids.every((id) => current.excludes.includes(id));
        const excludes = has
          ? current.excludes.filter((id) => !ids.includes(id))
          : [...new Set([...current.excludes, ...ids])];
        return { ...current, excludes };
      }),
    setFocus: (focus) => update((current) => ({ ...current, focus, checks: {} })),
    generate,
    addObservations: (rows) => {
      const created: Observation[] = rows.map((row) => ({
        id: uid(),
        date: today,
        ingredientId: row.ingredientId,
        storeId: row.storeId,
        price: Math.round(row.price),
        source: row.source,
      }));
      const before = createPriceBook(state.areaId, today, state.observations);
      const observations = [...created, ...state.observations].slice(0, 180);
      const after = createPriceBook(state.areaId, today, observations);
      const lows = created.flatMap((row) => {
        const prev = before.quote(row.ingredientId);
        const next = after.quote(row.ingredientId);
        if (!prev || !next || next.unitPrice >= prev.unitPrice - 0.5) return [];
        return [{ ingredientId: row.ingredientId, price: next.unitPrice }];
      });
      update((current) => ({ ...current, observations }));
      return lows;
    },
    removeObservation: (id) =>
      update((current) => ({
        ...current,
        observations: current.observations.filter((row) => row.id !== id),
      })),
    toggleCheck: (ingredientId, checked) =>
      update((current) => ({ ...current, checks: { ...current.checks, [ingredientId]: checked } })),
    replaceSlot: (dayIndex, meal, recipeId) => {
      if (!today) return;
      const lookup = createPriceBook(state.areaId, today, state.observations);
      update((current) => {
        const plan = current.focus === "cheap" ? current.cheap : current.balanced;
        if (!plan) return current;
        const next = replacePlanSlot(plan, dayIndex, meal, recipeId, lookup);
        return current.focus === "cheap" ? { ...current, cheap: next, checks: {} } : { ...current, balanced: next, checks: {} };
      });
    },
    markAlertsRead: useCallback(() => {
      update((current) => {
        const ids = alerts.map((alert) => alert.id);
        if (ids.every((id) => current.readAlertIds.includes(id))) return current;
        return {
          ...current,
          readAlertIds: [...new Set([...current.readAlertIds, ...ids])],
        };
      });
    }, [alerts, update]),
    setPremiumPreview: (on) => patch({ premiumPreview: on }),
    setSkin: (skin) => update((current) => (current.skin === skin ? current : { ...current, skin })),
    reset: () => {
      writeStorage({ ...defaultState(), skin: state.skin });
    },
    acceptHandoff: (record: unknown) => {
      const next = sanitize(record);
      const incoming = record && typeof record === "object" ? (record as { skin?: unknown }).skin : undefined;
      if (!isSkin(incoming)) next.skin = state.skin;
      next.onboarded = true;
      writeStorage(next);
      const area = areas.find((item) => item.id === next.areaId);
      const plan = next.focus === "cheap" ? next.cheap : next.balanced;
      const planLabel = plan ? `献立 ${plan.cost.toLocaleString("ja-JP")}円` : "献立なし";
      return `${area?.name ?? "生活圏"} · 値札${next.observations.length}件 · ${planLabel}`;
    },
  };

  return (
    <AppContext.Provider value={value}>
      <SkinSync skin={state.skin} />
      {children}
    </AppContext.Provider>
  );
}

function SkinSync({ skin }: { skin: SkinId }) {
  useLayoutEffect(() => {
    document.documentElement.dataset.skin = skin;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", skinThemeColor(skin));
  }, [skin]);
  return null;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp はアプリの中で使ってください");
  return value;
}
