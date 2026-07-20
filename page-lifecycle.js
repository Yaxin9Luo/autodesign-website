export function bindPageLifecycle({ page, controller, headerController, focusController }) {
  let bound = true;

  const unbind = () => {
    if (!bound) return;
    bound = false;
    page.removeEventListener("pagehide", handlePageHide);
    page.removeEventListener("pageshow", handlePageShow);
  };

  const handlePageHide = (event) => {
    if (event.persisted) return;
    controller?.destroy();
    headerController?.destroy();
    focusController?.destroy();
    unbind();
  };

  const handlePageShow = (event) => {
    if (!event.persisted) return;
    controller?.resume();
    headerController?.refresh();
    focusController?.refresh();
  };

  page.addEventListener("pagehide", handlePageHide);
  page.addEventListener("pageshow", handlePageShow);
  return unbind;
}
