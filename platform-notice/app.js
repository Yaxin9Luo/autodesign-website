const command = "curl -fsSL https://designanything.ai/install.sh | bash";
const toast = document.querySelector("[data-toast]");
let hideToastTimer;

async function copyInstallCommand() {
  try {
    await navigator.clipboard.writeText(command);
  } catch {
    const input = document.createElement("textarea");
    input.value = command;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  if (!toast) return;
  window.clearTimeout(hideToastTimer);
  toast.hidden = false;
  hideToastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

document.querySelectorAll("[data-copy-command]").forEach((button) => {
  button.addEventListener("click", copyInstallCommand);
});
