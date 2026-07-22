import { getLocale, setLocale } from "./i18n.js?v=20260722c";
import { LOCALES } from "./locales.js?v=20260722c";

export function bindLanguageMenu({ documentObject = document, page = window } = {}) {
  const root = documentObject.querySelector("[data-language-menu-root]");
  const trigger = documentObject.querySelector("#language-menu-trigger");
  const label = documentObject.querySelector("[data-language-current]");
  const menu = documentObject.querySelector("#language-menu");
  if (!root || !trigger || !label || !menu) return () => {};

  const options = [...menu.querySelectorAll("[data-locale]")];
  let open = false;

  const sync = () => {
    const locale = getLocale();
    label.textContent = LOCALES[locale].short;
    options.forEach((option) => {
      option.setAttribute("aria-checked", String(option.dataset.locale === locale));
    });
  };

  const closeMenu = ({ restoreFocus = false } = {}) => {
    if (!open) return;
    open = false;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus();
  };

  const openMenu = (focusIndex = null) => {
    open = true;
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    if (focusIndex !== null) options.at(focusIndex)?.focus();
  };

  const moveFocus = (offset) => {
    const activeIndex = options.indexOf(documentObject.activeElement);
    const current = activeIndex === -1 ? (offset > 0 ? -1 : 0) : activeIndex;
    options[(current + offset + options.length) % options.length]?.focus();
  };

  const onTriggerClick = () => {
    if (open) closeMenu();
    else openMenu();
  };

  const onTriggerKeydown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(event.key === "ArrowDown" ? 0 : -1);
    } else if (event.key === "Escape") {
      closeMenu({ restoreFocus: true });
    }
  };

  const onMenuClick = (event) => {
    const option = event.target.closest("[data-locale]");
    if (!option) return;
    setLocale(option.dataset.locale);
    closeMenu({ restoreFocus: true });
  };

  const onMenuKeydown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      options.at(event.key === "Home" ? 0 : -1)?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      const option = event.target.closest("[data-locale]");
      if (!option) return;
      event.preventDefault();
      setLocale(option.dataset.locale);
      closeMenu({ restoreFocus: true });
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    }
  };

  const onOutsidePointer = (event) => {
    if (open && !root.contains(event.target)) closeMenu();
  };

  const onLocaleChange = () => sync();

  trigger.addEventListener("click", onTriggerClick);
  trigger.addEventListener("keydown", onTriggerKeydown);
  menu.addEventListener("click", onMenuClick);
  menu.addEventListener("keydown", onMenuKeydown);
  documentObject.addEventListener("pointerdown", onOutsidePointer);
  page.addEventListener("autodesign:localechange", onLocaleChange);
  sync();

  return () => {
    trigger.removeEventListener("click", onTriggerClick);
    trigger.removeEventListener("keydown", onTriggerKeydown);
    menu.removeEventListener("click", onMenuClick);
    menu.removeEventListener("keydown", onMenuKeydown);
    documentObject.removeEventListener("pointerdown", onOutsidePointer);
    page.removeEventListener("autodesign:localechange", onLocaleChange);
  };
}

if (typeof window !== "undefined" && typeof document !== "undefined") bindLanguageMenu();
