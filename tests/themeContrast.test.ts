declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import { theme } from "../src/ui/theme";

const AA_NORMAL_TEXT_RATIO = 4.5;

function relativeLuminance(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error("Tema rengi #RRGGBB biçiminde olmalı.");
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  const [red = 0, green = 0, blue = 0] = linear;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function assertAaNormalText(foreground: string, background: string, label: string): void {
  const ratio = contrastRatio(foreground, background);
  assert.ok(
    ratio >= AA_NORMAL_TEXT_RATIO,
    `${label} kontrastı ${ratio.toFixed(2)}:1; en az ${AA_NORMAL_TEXT_RATIO}:1 olmalı.`
  );
}

test("ana metinler ve buton yazıları WCAG AA normal metin kontrastını geçer", () => {
  assertAaNormalText(theme.color.text, theme.color.background, "Ana metin / arka plan");
  assertAaNormalText(theme.color.textMuted, theme.color.background, "İkincil metin / arka plan");
  assertAaNormalText(theme.color.textMuted, theme.color.surface, "İkincil metin / kart");
  assertAaNormalText("#FFFFFF", theme.color.primary, "Ana buton");
  assertAaNormalText("#FFFFFF", theme.color.income, "Gelir butonu");
  assertAaNormalText("#FFFFFF", theme.color.expense, "Gider butonu");
  assertAaNormalText(theme.color.income, theme.color.surface, "Gelir metni / kart");
  assertAaNormalText(theme.color.expense, theme.color.surface, "Gider metni / kart");
});
