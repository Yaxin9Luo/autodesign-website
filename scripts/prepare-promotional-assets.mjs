import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const sourceRoot = process.env.AUTODESIGN_PROMO_ROOT;
const posterSource = process.env.AUTODESIGN_POSTER_SOURCE;
if (!sourceRoot || !posterSource) {
  throw new Error("Set AUTODESIGN_PROMO_ROOT and AUTODESIGN_POSTER_SOURCE");
}

const run = promisify(execFile);
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const studiesOutput = resolve(root, "assets/studies");
const slidesOutput = resolve(root, "artifacts/slides/longcat-next/index.html");
const webOutput = resolve(root, "artifacts/web/longcat-next/index.html");
const slideSource = resolve(sourceRoot, "slides/longcat-next--20260720-194725-0ebee292/deck-standalone.html");
const webSource = resolve(sourceRoot, "landing-pages/longcat-next--20260720-194725-f842c2f9/index-standalone.html");
const webPreviewSource = resolve(sourceRoot, "landing-pages/longcat-next--20260720-194725-f842c2f9/preview.png");
const videoSource = resolve(sourceRoot, "videos/ddpm-conference-video/ddpm-conference-video-6min.mp4");
const captionsSource = resolve(sourceRoot, "videos/ddpm-conference-video/subtitles.en.vtt");
const approvedSources = [
  ["PosterHarness poster", posterSource, "6290d4be1bc4a7b0432941f875415102c78099d8e2c837431c375480115a3cf9"],
  ["Slides HTML", slideSource, "90d3ec2e27b470b2c9c5e208e26bd8b31e9e97effa896da9fb475c8ac750423c"],
  ["Web HTML", webSource, "e7a37c2df61b6ab333b1f8b2b66437b094be5fd086ea92b8ac4f8aebbfb7cd59"],
  ["Web preview PNG", webPreviewSource, "63b80b2bd025aab9e44ffd23e467c2fc985d81eb303ad3cdd1b4c3f2c68c8b50"],
  ["DDPM MP4", videoSource, "98e94d39767e563d105d69342c03daf36efcb615134032a986f1236b7bd777c8"],
  ["DDPM VTT", captionsSource, "c48c263dda465d2a6100c51c3dfb104e35dd59e1a631143c84c4435fddd4e6d8"],
];
const validateApprovedSources = async () => {
  const contents = new Map();
  for (const [label, path, expectedSha256] of approvedSources) {
    const content = await readFile(path);
    const actualSha256 = createHash("sha256").update(content).digest("hex");
    if (actualSha256 !== expectedSha256) {
      throw new Error(
        `Approved source SHA-256 mismatch for ${label}: expected ${expectedSha256}, received ${actualSha256} from ${path}`,
      );
    }
    contents.set(path, content);
  }
  return contents;
};
const approvedSourceContents = await validateApprovedSources();

const ARTIFACT_ESCAPE_MESSAGE = "autodesign:artifact-viewer:escape";
const escapeBridge = `<script>
    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || window.parent === window) return;
      event.preventDefault();
      window.parent.postMessage("${ARTIFACT_ESCAPE_MESSAGE}", "*");
    });
  </script>`;
const normalizeGeneratedHtml = (source) => {
  const normalized = source
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\s+$/, "\n");
  const bodyClose = normalized.lastIndexOf("</body>");
  if (bodyClose < 0) throw new Error("Generated HTML is missing </body>");
  return `${normalized.slice(0, bodyClose)}${escapeBridge}\n${normalized.slice(bodyClose)}`;
};

const generated = [];
const record = (path) => {
  generated.push(path);
  console.log(relative(root, path));
};
const transcodeWebp = async (input, output) => {
  await run("cwebp", ["-quiet", "-q", "90", "-m", "6", "-metadata", "all", input, "-o", output]);
  record(output);
};

await mkdir(studiesOutput, { recursive: true });
await mkdir(resolve(slidesOutput, ".."), { recursive: true });
await mkdir(resolve(webOutput, ".."), { recursive: true });

const temporaryDirectory = await mkdtemp(join(tmpdir(), "autodesign-promo-"));
const approvedPosterInput = resolve(temporaryDirectory, "approved-poster.png");
const approvedWebPreviewInput = resolve(temporaryDirectory, "approved-web-preview.png");
const approvedVideoInput = resolve(temporaryDirectory, "approved-ddpm.mp4");
let browser;
try {
  await writeFile(approvedPosterInput, approvedSourceContents.get(posterSource));
  await writeFile(approvedWebPreviewInput, approvedSourceContents.get(webPreviewSource));
  await writeFile(approvedVideoInput, approvedSourceContents.get(videoSource));
  await writeFile(slidesOutput, normalizeGeneratedHtml(approvedSourceContents.get(slideSource).toString("utf8")));
  record(slidesOutput);
  await writeFile(webOutput, normalizeGeneratedHtml(approvedSourceContents.get(webSource).toString("utf8")));
  record(webOutput);
  await writeFile(resolve(studiesOutput, "ddpm-conference.en.vtt"), approvedSourceContents.get(captionsSource));
  record(resolve(studiesOutput, "ddpm-conference.en.vtt"));

  await transcodeWebp(approvedPosterInput, resolve(studiesOutput, "longcat-next-poster.webp"));
  await transcodeWebp(approvedWebPreviewInput, resolve(studiesOutput, "longcat-next-web.webp"));

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(pathToFileURL(slidesOutput).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);

  for (const [index, name] of [
    [1, "cover"],
    [4, "method"],
    [7, "results"],
  ]) {
    const temporarySlide = resolve(temporaryDirectory, `slide-${index}.png`);
    const slide = page.locator(`[data-slide-index="${index}"]`);
    await slide.scrollIntoViewIfNeeded();
    await slide.screenshot({ animations: "disabled", path: temporarySlide });
    await transcodeWebp(temporarySlide, resolve(studiesOutput, `longcat-next-slide-${name}.webp`));
  }

  const posterFrame = resolve(temporaryDirectory, "ddpm-poster.png");
  await run("ffmpeg", [
    "-hide_banner",
    "-y",
    "-loglevel", "error",
    "-ss", "5",
    "-i", approvedVideoInput,
    "-frames:v", "1",
    posterFrame,
  ]);
  await transcodeWebp(posterFrame, resolve(studiesOutput, "ddpm-conference-poster.webp"));

  const teaserOutput = resolve(studiesOutput, "ddpm-conference-teaser.mp4");
  const excerpts = [30, 90, 210, 330]
    .map((start, index) => `[0:v]trim=start=${start}:duration=6,setpts=PTS-STARTPTS,scale=1280:720:flags=lanczos,setsar=1[v${index}]`)
    .join(";");
  await run("ffmpeg", [
    "-hide_banner",
    "-y",
    "-loglevel", "error",
    "-i", approvedVideoInput,
    "-filter_complex", `${excerpts};[v0][v1][v2][v3]concat=n=4:v=1:a=0,format=yuv420p[v]`,
    "-map", "[v]",
    "-an",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "24",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-movflags", "+faststart",
    teaserOutput,
  ]);
  record(teaserOutput);

  const fullVideoOutput = resolve(studiesOutput, "ddpm-conference-video-6min.mp4");
  await writeFile(fullVideoOutput, approvedSourceContents.get(videoSource));
  record(fullVideoOutput);
} finally {
  await browser?.close();
  await rm(temporaryDirectory, { force: true, recursive: true });
}

if (generated.length !== 11) {
  throw new Error(`Expected 11 generated paths, received ${generated.length}`);
}
