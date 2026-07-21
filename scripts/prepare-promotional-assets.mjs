import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
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

const APPROVED_POSTER_SHA256 = "6290d4be1bc4a7b0432941f875415102c78099d8e2c837431c375480115a3cf9";
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
const posterSha256 = createHash("sha256").update(await readFile(posterSource)).digest("hex");
if (posterSha256 !== APPROVED_POSTER_SHA256) {
  throw new Error(
    `Approved PosterHarness poster SHA-256 mismatch: expected ${APPROVED_POSTER_SHA256}, received ${posterSha256} from ${posterSource}`,
  );
}

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
let browser;
try {
  await cp(slideSource, slidesOutput);
  record(slidesOutput);
  await cp(webSource, webOutput);
  record(webOutput);
  await cp(captionsSource, resolve(studiesOutput, "ddpm-conference.en.vtt"));
  record(resolve(studiesOutput, "ddpm-conference.en.vtt"));

  await transcodeWebp(posterSource, resolve(studiesOutput, "longcat-next-poster.webp"));
  await transcodeWebp(webPreviewSource, resolve(studiesOutput, "longcat-next-web.webp"));

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(pathToFileURL(slideSource).href, { waitUntil: "load" });
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
    "-i", videoSource,
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
    "-i", videoSource,
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
  await cp(videoSource, fullVideoOutput);
  record(fullVideoOutput);
} finally {
  await browser?.close();
  await rm(temporaryDirectory, { force: true, recursive: true });
}

if (generated.length !== 11) {
  throw new Error(`Expected 11 generated paths, received ${generated.length}`);
}
