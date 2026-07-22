import { LOCALES, MESSAGES, SUPPORTED_LOCALES } from "./locales.js";

const STORAGE_KEY = "autodesign.locale";
let activeLocale = "en";
let initialized = false;

export function normalizeLocale(value) {
  if (!value || typeof value !== "string") return null;
  const normalized = value.trim().replaceAll("_", "-").toLowerCase();
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
  if (normalized === "ar" || normalized.startsWith("ar-")) return "ar";
  return null;
}

export function resolveLocale({ search = "", stored = null, languages = [] } = {}) {
  const requested = new URLSearchParams(search).get("lang");
  return normalizeLocale(requested)
    ?? normalizeLocale(stored)
    ?? languages.map(normalizeLocale).find(Boolean)
    ?? "en";
}

export function formatMessage(locale, key, params = {}) {
  const resolved = normalizeLocale(locale) ?? "en";
  const template = MESSAGES[resolved]?.[key] ?? MESSAGES.en[key] ?? key;
  return String(template).replace(/\{([a-zA-Z][\w]*)\}/g, (match, name) => (
    Object.hasOwn(params, name) ? String(params[name]) : match
  ));
}

export function t(key, params = {}) {
  return formatMessage(activeLocale, key, params);
}

export function getLocale() {
  return activeLocale;
}

export function applyTranslations(root = document) {
  root.querySelectorAll?.("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  root.querySelectorAll?.("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
  root.querySelectorAll?.("[data-i18n-title]").forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
  root.querySelectorAll?.("[data-i18n-alt]").forEach((element) => {
    element.alt = t(element.dataset.i18nAlt);
  });
}

function updateDocumentMetadata() {
  if (typeof document === "undefined") return;
  document.title = t("meta.title");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t("meta.description"));
}

function updateSwitcher() {
  if (typeof document === "undefined") return;
  document.querySelectorAll("[data-locale]").forEach((button) => {
    const selected = button.dataset.locale === activeLocale;
    button.setAttribute("aria-pressed", String(selected));
  });
}

export function setLocale(locale, { persist = true, updateUrl = true, announce = true } = {}) {
  const next = normalizeLocale(locale) ?? "en";
  activeLocale = next;
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
    document.documentElement.dir = LOCALES[next].dir;
    applyTranslations(document);
    updateDocumentMetadata();
    updateSwitcher();
  }
  if (typeof window !== "undefined") {
    if (persist) window.localStorage?.setItem(STORAGE_KEY, next);
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (next === "en") url.searchParams.delete("lang");
      else url.searchParams.set("lang", next);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    if (announce) window.dispatchEvent(new CustomEvent("autodesign:localechange", { detail: { locale: next } }));
  }
  return next;
}

export function initI18n() {
  if (typeof window === "undefined" || typeof document === "undefined") return activeLocale;
  if (!initialized) {
    document.querySelector("[data-language-switcher]")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-locale]");
      if (button) setLocale(button.dataset.locale);
    });
    initialized = true;
  }
  const locale = resolveLocale({
    search: window.location.search,
    stored: window.localStorage?.getItem(STORAGE_KEY),
    languages: navigator.languages ?? [navigator.language],
  });
  return setLocale(locale, { persist: true, updateUrl: false, announce: false });
}

if (typeof window !== "undefined" && typeof document !== "undefined") initI18n();
