export const SKIN_IDS = ["kami", "yoru", "akari", "yaoya"] as const;

export type SkinId = (typeof SKIN_IDS)[number];

export type SkinSwatch = {
  background: string;
  foreground: string;
  card: string;
  primary: string;
  accent: string;
  accentForeground: string;
};

export type Skin = {
  id: SkinId;
  name: string;
  short: string;
  blurb: string;
  /** Outer corner of this template, independent of the one currently worn. */
  radius: string;
  motif: string | null;
  motifPreview: string;
  motifPosition: string;
  swatch: SkinSwatch;
};

export const SKINS: readonly Skin[] = [
  {
    id: "kami",
    name: "紙の帳面",
    short: "帳面",
    blurb: "生成りの紙と、緑の値札。",
    radius: "1.5rem",
    motif: null,
    motifPreview: "auto",
    motifPosition: "center",
    swatch: {
      background: "#f4efe4",
      foreground: "#1c1915",
      card: "#fffdf8",
      primary: "#1b6b43",
      accent: "#ffe14a",
      accentForeground: "#1c1915",
    },
  },
  {
    id: "yoru",
    name: "夜のスーパー",
    short: "夜店",
    blurb: "金魚が泳ぐ夜の店。",
    radius: "0.55rem",
    motif: "/skins/goldfish.svg",
    motifPreview: "210px auto",
    motifPosition: "70% 42%",
    swatch: {
      background: "#10141c",
      foreground: "#f3f6f4",
      card: "#1a2130",
      primary: "#3dff9a",
      accent: "#ffe34a",
      accentForeground: "#1a1404",
    },
  },
  {
    id: "akari",
    name: "赤提灯",
    short: "提灯",
    blurb: "赤い提灯が並ぶ店先。",
    radius: "1.85rem",
    motif: "/skins/lanterns.svg",
    motifPreview: "210px auto",
    motifPosition: "center 28%",
    swatch: {
      background: "#2a1210",
      foreground: "#f8efe4",
      card: "#3d1c18",
      primary: "#ff4d3a",
      accent: "#f2c14e",
      accentForeground: "#2a1208",
    },
  },
  {
    id: "yaoya",
    name: "朝の八百屋",
    short: "八百屋",
    blurb: "野菜が並ぶ朝の店先。",
    radius: "0.7rem",
    motif: "/skins/vegetables.svg",
    motifPreview: "170px auto",
    motifPosition: "center 18%",
    swatch: {
      background: "#fff3c4",
      foreground: "#1c2a12",
      card: "#fffdf3",
      primary: "#e23d2b",
      accent: "#2f9e44",
      accentForeground: "#f3fff5",
    },
  },
];

const SKIN_SET = new Set<string>(SKIN_IDS);

export function isSkin(value: unknown): value is SkinId {
  return typeof value === "string" && SKIN_SET.has(value);
}

export function skinById(id: SkinId): Skin {
  const skin = SKINS.find((item) => item.id === id);
  if (!skin) return SKINS[0];
  return skin;
}

export function skinThemeColor(id: SkinId): string {
  return skinById(id).swatch.primary;
}

/** Runs before paint so a saved skin does not flash the paper ledger. */
export const SKIN_BOOT = `(function(){try{var raw=localStorage.getItem("sokone-gohan-v1");if(!raw)return;var skin=JSON.parse(raw).skin;if(skin==="kami"||skin==="yoru"||skin==="akari"||skin==="yaoya")document.documentElement.dataset.skin=skin;}catch(e){}})();`;
