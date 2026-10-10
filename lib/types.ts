export type Category =
  | "vegetable"
  | "meat"
  | "fish"
  | "egg_soy"
  | "staple"
  | "seasoning";

export type MealType = "breakfast" | "lunch" | "dinner";

export type MealMode = "dinner" | "dinner_breakfast" | "full";

export type PlanFocus = "balanced" | "cheap";

export type Signal = "buy" | "wait" | "normal";

export type Tag = "washoku" | "quick" | "veggie" | "protein";

export type UnitKind = "grams100" | "count" | "halfGo" | "tbsp";

export type Nutrition = {
  kcal: number;
  protein: number;
  fat: number;
  carb: number;
  fiber: number;
  salt: number;
  veg: number;
};

export type Ingredient = {
  id: string;
  name: string;
  kana: string;
  category: Category;
  unitKind: UnitKind;
  /** Shown after the quantity, e.g. 個・袋. Ignored for grams and 合. */
  unitSuffix: string;
  unitLabel: string;
  gramsPerUnit: number;
  basePrice: number;
  volatility: number;
  inflation: number;
  stores: { storeId: string; multiplier: number }[];
  per100g: Nutrition;
  altGroup?: "protein";
};

export type Recipe = {
  id: string;
  name: string;
  meals: MealType[];
  minutes: number;
  tags: Tag[];
  summary: string;
  steps: string[];
  items: { ingredientId: string; units: number }[];
  extraYen: number;
  extraSalt: number;
};

export type Store = {
  id: string;
  name: string;
  kind: string;
  hours: string;
  saleNote: string;
  blurb: string;
  walkMinutes: number;
  closedWeekday?: number;
  weekdaySales: { dow: number; categories: Category[] }[];
  branches: Record<string, string>;
};

export type Area = {
  id: string;
  name: string;
  prefecture: string;
  multiplier: number;
  note: string;
  /** 1 を基準に、品目の分類だけ見本の傾きを足す。 */
  categoryBias?: Partial<Record<Category, number>>;
};

export type Observation = {
  id: string;
  ingredientId: string;
  storeId: string;
  price: number;
  date: string;
  source: "tag" | "receipt" | "manual";
};

export type Prefs = {
  quick: boolean;
  moreVeg: boolean;
  highProtein: boolean;
  washoku: boolean;
};

export type PlanSlot = {
  dayIndex: number;
  meal: MealType;
  recipeId: string;
  cost: number;
};

export type Plan = {
  focus: PlanFocus;
  budget: number;
  people: number;
  days: number;
  mode: MealMode;
  slots: PlanSlot[];
  cost: number;
  overBy: number;
  /** 1 = ふだんの一人前。予算に合わせて増減する。 */
  portion: number;
  nutrition: Nutrition;
  targets: Nutrition;
  notes: string[];
  sourceKey: string;
};

export type Quote = {
  ingredientId: string;
  unitPrice: number;
  storeId: string;
  median: number;
  delta: number;
  signal: Signal;
  byStore: { storeId: string; price: number }[];
  series: { date: string; price: number }[];
};

export type Forecast = {
  low: number;
  high: number;
  headline: string;
  detail: string;
};

export type ShopLine = {
  ingredientId: string;
  units: number;
  storeId: string;
  unitPrice: number;
  linePrice: number;
};

export type ShopStoreGroup = {
  storeId: string;
  lines: ShopLine[];
  total: number;
};

export type ShopList = {
  groups: ShopStoreGroup[];
  seasoningYen: number;
  multiTotal: number;
  single: { storeId: string; total: number } | null;
  savings: number;
};

export type AlertItem = {
  id: string;
  tone: "buy" | "sale" | "plan" | "scan";
  title: string;
  body: string;
  href: string;
};
