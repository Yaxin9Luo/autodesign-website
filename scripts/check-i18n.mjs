import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { LOCALES, MESSAGES, SUPPORTED_LOCALES } from "../locales.js";
import { formatMessage, normalizeLocale, resolveLocale } from "../i18n.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const index = readFileSync(resolve(root, "index.html"), "utf8");
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

expect(
  JSON.stringify(SUPPORTED_LOCALES) === JSON.stringify(["en", "zh-CN", "ar"]),
  "supported locale order must be English, Simplified Chinese, Arabic",
);
expect(LOCALES.ar?.dir === "rtl", "Arabic must declare RTL direction");
expect(LOCALES.en?.dir === "ltr" && LOCALES["zh-CN"]?.dir === "ltr", "English and Chinese must be LTR");

expect(normalizeLocale("zh") === "zh-CN", "zh must normalize to zh-CN");
expect(normalizeLocale("zh-Hans-CN") === "zh-CN", "zh-Hans-CN must normalize to zh-CN");
expect(normalizeLocale("ar-SA") === "ar", "ar-SA must normalize to ar");
expect(normalizeLocale("fr-FR") === null, "unsupported locales must normalize to null");

expect(
  resolveLocale({ search: "?lang=ar", stored: "zh-CN", languages: ["en-US"] }) === "ar",
  "query locale must take priority",
);
expect(
  resolveLocale({ search: "", stored: "zh-CN", languages: ["ar-SA"] }) === "zh-CN",
  "stored locale must take priority over browser language",
);
expect(
  resolveLocale({ search: "", stored: null, languages: ["fr-FR", "ar-AE"] }) === "ar",
  "browser language fallback must scan all preferred languages",
);
expect(
  resolveLocale({ search: "?lang=xx", stored: null, languages: ["fr-FR"] }) === "en",
  "unsupported preferences must fall back to English",
);

const englishKeys = Object.keys(MESSAGES.en).sort();
for (const locale of SUPPORTED_LOCALES) {
  const keys = Object.keys(MESSAGES[locale] ?? {}).sort();
  expect(JSON.stringify(keys) === JSON.stringify(englishKeys), `${locale} catalog must match English keys`);
  expect(keys.every((key) => String(MESSAGES[locale][key]).trim()), `${locale} catalog must not contain empty messages`);
}

expect(
  formatMessage("zh-CN", "viewer.slideAlt", { index: 3, count: 12, title: "LongCat-Next" })
    === "LongCat-Next 生成演示文稿的第 3 张，共 12 张",
  "Chinese interpolation must preserve the paper title",
);
expect(
  formatMessage("ar", "viewer.slideAlt", { index: 3, count: 12, title: "LongCat-Next" })
    .includes("LongCat-Next"),
  "Arabic interpolation must preserve the paper title",
);

for (const locale of ["zh-CN", "ar"]) {
  const catalog = Object.values(MESSAGES[locale]).join("\n");
  for (const term of ["AutoDesign", "PosterHarness", "Meta-Harness", "AutoPosterBench", "Code Agent"]) {
    expect(catalog.includes(term), `${locale} catalog must preserve ${term}`);
  }
}

expect(index.includes("data-language-switcher"), "page must include a language switcher");
for (const locale of SUPPORTED_LOCALES) {
  expect(index.includes(`data-locale=\"${locale}\"`), `language switcher must include ${locale}`);
}
expect(index.includes("./i18n.js?v=20260722a"), "page must load the versioned i18n runtime");

if (failures.length) {
  console.error(`i18n checks failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`i18n checks passed (${SUPPORTED_LOCALES.length} locales, ${englishKeys.length} messages).`);
