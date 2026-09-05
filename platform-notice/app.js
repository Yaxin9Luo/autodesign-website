const command = "curl -fsSL https://designanything.ai/install.sh | bash";
const toast = document.querySelector("[data-toast]");
const languageToggle = document.querySelector("[data-language-toggle]");
const installGuide = document.querySelector("[data-install-guide]");
let hideToastTimer;
let currentLanguage = "en";

const copy = {
  en: {
    title: "AutoDesign — Local installation only",
    eyebrow: "SERVICE UPDATE",
    bannerTitle: "Run AutoDesign locally for the complete experience",
    bannerSummary: "The public online demo has been retired. AutoDesign is now available for local installation only, with generation, editing, and exports running on your own machine.",
    actionsLabel: "Local installation links",
    tutorial: "Watch tutorial",
    installGuide: "Installation guide",
    copyCommand: "Copy install command",
    noticeTitle: "Online generation is no longer available here.",
    noticeBody: "The project remains actively maintained, and its source code, documentation, and local releases are still available. Your papers, API keys, and generated results stay in your own environment.",
    commandLabel: "AutoDesign installation command",
    copyShort: "Copy",
    resourcesLabel: "AutoDesign resources",
    sourceCode: "GitHub source",
    researchSite: "Research site",
    footerNote: "The hosted platform is offline. AutoDesign continues as a local-first open-source project.",
    copied: "Install command copied",
    toggleLabel: "切换至中文",
    toggleText: "中文",
    guideHref: "https://github.com/Yaxin9Luo/AutoDesign/blob/main/README.md#quickstart",
  },
  zh: {
    title: "AutoDesign — 请在本地安装运行",
    eyebrow: "服务调整",
    bannerTitle: "在本地运行 AutoDesign，获得完整体验",
    bannerSummary: "公开在线 Demo 已停止服务；AutoDesign 现仅支持本地安装运行。生成、编辑与导出均在你自己的电脑上完成。",
    actionsLabel: "本地安装入口",
    tutorial: "观看教程",
    installGuide: "安装说明",
    copyCommand: "复制安装命令",
    noticeTitle: "这里不再接受在线生成任务。",
    noticeBody: "项目继续维护，代码、文档和本地安装包仍然开放。你的论文、API Key 和生成结果都留在自己的本地环境中。",
    commandLabel: "AutoDesign 安装命令",
    copyShort: "复制",
    resourcesLabel: "AutoDesign 相关链接",
    sourceCode: "GitHub 源码",
    researchSite: "研究项目主页",
    footerNote: "托管平台已经下线，AutoDesign 将继续作为本地优先的开源项目维护。",
    copied: "安装命令已复制",
    toggleLabel: "Switch to English",
    toggleText: "English",
    guideHref: "https://github.com/Yaxin9Luo/AutoDesign/blob/main/README.zh-CN.md#quickstart",
  },
};

function setLanguage(language) {
  const strings = copy[language];
  currentLanguage = language;
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = strings.title;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = strings[element.dataset.i18n];
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", strings[element.dataset.i18nAriaLabel]);
  });

  languageToggle.textContent = strings.toggleText;
  languageToggle.setAttribute("aria-label", strings.toggleLabel);
  installGuide.href = strings.guideHref;
}

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
  toast.textContent = copy[currentLanguage].copied;
  toast.hidden = false;
  hideToastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

document.querySelectorAll("[data-copy-command]").forEach((button) => {
  button.addEventListener("click", copyInstallCommand);
});

languageToggle.addEventListener("click", () => {
  setLanguage(currentLanguage === "en" ? "zh" : "en");
});
