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
  JSON.stringify(SUPPORTED_LOCALES) === JSON.stringify(["en", "zh-CN", "ko", "ar", "ja", "es", "fr", "de", "ru", "it"]),
  "supported locale order must match the approved ten-language menu",
);
expect(LOCALES.ar?.dir === "rtl", "Arabic must declare RTL direction");
for (const locale of ["en", "zh-CN", "ko", "ja", "es", "fr", "de", "ru", "it"]) {
  expect(LOCALES[locale]?.dir === "ltr", `${locale} must declare LTR direction`);
}

expect(normalizeLocale("zh") === "zh-CN", "zh must normalize to zh-CN");
expect(normalizeLocale("zh-Hans-CN") === "zh-CN", "zh-Hans-CN must normalize to zh-CN");
expect(normalizeLocale("ar-SA") === "ar", "ar-SA must normalize to ar");
for (const [regional, locale] of [
  ["ko-KR", "ko"],
  ["ja-JP", "ja"],
  ["es-MX", "es"],
  ["fr-CA", "fr"],
  ["de-AT", "de"],
  ["ru-RU", "ru"],
  ["it-CH", "it"],
]) {
  expect(normalizeLocale(regional) === locale, `${regional} must normalize to ${locale}`);
}
expect(normalizeLocale("pt-BR") === null, "unsupported locales must normalize to null");

expect(
  resolveLocale({ search: "?lang=ar", stored: "zh-CN", languages: ["en-US"] }) === "ar",
  "query locale must take priority",
);
expect(
  resolveLocale({ search: "", stored: "zh-CN", languages: ["ar-SA"] }) === "zh-CN",
  "stored locale must take priority over browser language",
);
expect(
  resolveLocale({ search: "", stored: null, languages: ["pt-BR", "ko-KR", "ar-AE"] }) === "ko",
  "browser language fallback must scan all preferred languages",
);
expect(
  resolveLocale({ search: "?lang=xx", stored: null, languages: ["pt-BR"] }) === "en",
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

for (const locale of SUPPORTED_LOCALES.filter((locale) => locale !== "en")) {
  const catalog = Object.values(MESSAGES[locale]).join("\n");
  for (const term of ["AutoDesign", "PosterHarness", "Meta-Harness", "AutoPosterBench", "Code Agent"]) {
    expect(catalog.includes(term), `${locale} catalog must preserve ${term}`);
  }
}

for (const locale of ["ko", "ja", "es", "fr", "de", "ru", "it"]) {
  expect(Boolean(MESSAGES[locale]), `${locale} must provide a message catalog`);
  for (const key of ["hero.dek", "suite.title", "resources.title", "viewer.close"]) {
    expect(Boolean(MESSAGES[locale]) && MESSAGES[locale][key] !== MESSAGES.en[key], `${locale} must translate representative key ${key}`);
  }
  for (const prefix of ["record.", "metric.", "evolutionData.", "harnessData."]) {
    for (const key of englishKeys.filter((candidate) => candidate.startsWith(prefix))) {
      expect(MESSAGES[locale][key] === MESSAGES.en[key], `${locale} must preserve professional detail ${key} in English`);
    }
  }
}

expect(index.includes("data-language-switcher"), "page must include a language switcher");
for (const locale of SUPPORTED_LOCALES) {
  expect(index.includes(`data-locale=\"${locale}\"`), `language switcher must include ${locale}`);
}
expect(index.includes("./i18n.js?v=20260722c"), "page must load the current versioned i18n runtime");
expect(readFileSync(resolve(root, "i18n.js"), "utf8").includes("./locales.js?v=20260722c"), "i18n runtime must version its locale catalog import");
expect(readFileSync(resolve(root, "language-menu.js"), "utf8").includes("./locales.js?v=20260722c"), "language menu must version its locale metadata import");

if (failures.length) {
  console.error(`i18n checks failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`i18n checks passed (${SUPPORTED_LOCALES.length} locales, ${englishKeys.length} messages).`);
