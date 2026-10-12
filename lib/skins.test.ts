import assert from "node:assert/strict";
import test from "node:test";
import { isSkin, SKIN_BOOT, SKIN_IDS, SKINS, skinThemeColor } from "./skins";

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

test("unknown skins are refused and the boot script only accepts the wardrobe", () => {
  assert.equal(isSkin("kami"), true);
  assert.equal(isSkin("yoru"), true);
  assert.equal(isSkin("neon"), false);
  assert.equal(isSkin(1), false);
  assert.match(SKIN_BOOT, /sokone-gohan-v1/);
  assert.match(SKIN_BOOT, /yaoya/);
  assert.doesNotMatch(SKIN_BOOT, /neon/);
});
