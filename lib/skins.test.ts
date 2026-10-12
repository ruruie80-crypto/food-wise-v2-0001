import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isSkin, SKIN_BOOT, SKIN_IDS, SKINS, skinThemeColor } from "./skins";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("four wardrobe skins stay distinct", () => {
  assert.deepEqual(
    SKINS.map((skin) => skin.id),
    ["kami", "yoru", "akari", "yaoya"],
  );
  assert.equal(new Set(SKINS.map((skin) => skin.name)).size, SKINS.length);
  assert.equal(new Set(SKINS.map((skin) => skin.swatch.background)).size, SKINS.length);
  for (const skin of SKINS) {
    assert.equal(SKIN_IDS.includes(skin.id), true);
    assert.match(skin.swatch.primary, /^#[0-9a-f]{6}$/);
    assert.match(skin.swatch.accent, /^#[0-9a-f]{6}$/);
    assert.match(skin.radius, /^\d+(\.\d+)?rem$/);
    assert.equal(skinThemeColor(skin.id), skin.swatch.primary);
  }
});

test("night, lantern, and greengrocer skins bring their own scenery", () => {
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  const scenery = SKINS.filter((skin) => skin.motif);
  assert.deepEqual(
    scenery.map((skin) => skin.id),
    ["yoru", "akari", "yaoya"],
  );
  for (const skin of scenery) {
    const file = skin.motif!.replace(/^\//, "");
    assert.equal(fs.existsSync(path.join(root, "public", file)), true);
    assert.match(css, new RegExp(skin.motif!.replaceAll("/", "\\/")));
  }
  assert.equal(SKINS[0]?.motif, null);
  assert.match(css, /goldfish-left\.svg/);
});

test("unknown skins are refused and the boot script only accepts the wardrobe", () => {
  assert.equal(isSkin("kami"), true);
  assert.equal(isSkin("yoru"), true);
  assert.equal(isSkin("neon"), false);
  assert.equal(isSkin(1), false);
  assert.match(SKIN_BOOT, /sokone-gohan-v1/);
  assert.match(SKIN_BOOT, /yaoya/);
  assert.doesNotMatch(SKIN_BOOT, /neon/);
});
