#!/usr/bin/env node
/**
 * Downloads the Ollama server binary for the current platform into
 * resources/ollama/<platform>/  — run once before building.
 *
 * Mac  → downloads a ~51 MB standalone binary from GitHub (fast).
 * Win  → uses HTTP Range requests on the 1.8 GB CUDA zip to fetch ONLY
 *         ollama.exe (~55 MB) without downloading the whole archive.
 *
 * Called automatically by npm run dist:win / dist:mac and Codemagic CI.
 */

import { createWriteStream, mkdirSync, chmodSync, existsSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";
import { inflateRawSync } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── helpers ─────────────────────────────────────────────────────────────────

/** Follow redirects and return the final URL (needed to enable Range requests). */
function resolveUrl(url, depth = 0) {
  if (depth > 15) return Promise.reject(new Error("Too many redirects"));
  return new Promise((res, rej) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, { method: "HEAD", headers: { "User-Agent": "forusin10-builder/1.0" } }, (r) => {
      if ((r.statusCode >= 301 && r.statusCode <= 308) && r.headers.location) {
        r.resume();
        return res(resolveUrl(r.headers.location, depth + 1));
      }
      r.resume();
      res(url); // this is the final URL
    });
    req.on("error", rej);
    req.end();
  });
}

/** GET a specific byte range from a URL and return a Buffer. */
function fetchRange(url, start, end, onProgress) {
  return new Promise((res, rej) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, { headers: { "User-Agent": "forusin10-builder/1.0", Range: `bytes=${start}-${end}` } }, (r) => {
      if (r.statusCode !== 206 && r.statusCode !== 200) {
        r.resume();
        return rej(new Error(`HTTP ${r.statusCode} for range ${start}-${end}`));
      }
      const chunks = [];
      let got = 0;
      const total = end - start + 1;
      r.on("data", (c) => {
        chunks.push(c);
        got += c.length;
        onProgress?.(got, total);
      });
      r.on("end", () => res(Buffer.concat(chunks)));
      r.on("error", rej);
    }).on("error", rej);
  });
}

/** Full streaming download (for small files or Mac binary). */
function downloadFull(url, dest, depth = 0) {
  if (depth > 15) return Promise.reject(new Error("Too many redirects"));
  return new Promise((res, rej) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, { headers: { "User-Agent": "forusin10-builder/1.0" } }, (r) => {
      if ((r.statusCode >= 301 && r.statusCode <= 308) && r.headers.location) {
        r.resume();
        return res(downloadFull(r.headers.location, dest, depth + 1));
      }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error(`HTTP ${r.statusCode}`)); }
      const total = parseInt(r.headers["content-length"] || "0");
      let got = 0;
      const file = createWriteStream(dest);
      r.on("data", (c) => {
        got += c.length;
        if (total) process.stdout.write(`\r   ${Math.round(got / total * 100)}%  ${Math.round(got / 1e6)}MB / ${Math.round(total / 1e6)}MB  `);
      });
      r.pipe(file);
      file.on("finish", () => { file.close(); process.stdout.write("\n"); res(); });
      file.on("error", rej);
    }).on("error", rej);
  });
}

// ── ZIP range extractor ──────────────────────────────────────────────────────
// Instead of downloading 1.8 GB, we:
//   1. HEAD to get file size
//   2. Fetch last 22 bytes → locate End-of-Central-Directory
//   3. Fetch Central Directory → find the entry for "ollama.exe"
//   4. Fetch Local File Header → find actual data offset
//   5. Fetch compressed data → inflate and write

async function extractFileFromRemoteZip(zipUrl, targetFile, destPath) {
  console.log(`   Resolving final URL…`);
  const finalUrl = await resolveUrl(zipUrl);

  // 1. File size via HEAD
  const fileSize = await new Promise((res, rej) => {
    const lib = finalUrl.startsWith("https") ? https : http;
    lib.request(finalUrl, { method: "HEAD", headers: { "User-Agent": "forusin10-builder/1.0" } }, (r) => {
      r.resume();
      const len = parseInt(r.headers["content-length"] || "0");
      if (!len) return rej(new Error("No Content-Length — Range requests not supported"));
      res(len);
    }).on("error", rej).end();
  });
  console.log(`   Archive size: ${Math.round(fileSize / 1e6)} MB`);

  // 2. Read End-of-Central-Directory (last 22 bytes, assuming no ZIP comment)
  const eocd = await fetchRange(finalUrl, fileSize - 22, fileSize - 1);
  if (eocd.readUInt32LE(0) !== 0x06054b50) throw new Error("Invalid EOCD signature");
  const cdSize   = eocd.readUInt32LE(12);
  const cdOffset = eocd.readUInt32LE(16);
  if (cdOffset === 0xffffffff) throw new Error("ZIP64 not supported");

  // 3. Central Directory
  process.stdout.write(`   Reading directory…`);
  const cd = await fetchRange(finalUrl, cdOffset, cdOffset + cdSize - 1);
  process.stdout.write(` done\n`);

  // Parse Central Directory entries to find our target file
  let pos = 0;
  let found = null;
  while (pos < cd.length - 4) {
    if (cd.readUInt32LE(pos) !== 0x02014b50) break;
    const compMethod   = cd.readUInt16LE(pos + 10);
    const compSize     = cd.readUInt32LE(pos + 20);
    const uncompSize   = cd.readUInt32LE(pos + 24);
    const fnLen        = cd.readUInt16LE(pos + 28);
    const extraLen     = cd.readUInt16LE(pos + 30);
    const commentLen   = cd.readUInt16LE(pos + 32);
    const lhOffset     = cd.readUInt32LE(pos + 42);
    const fname        = cd.slice(pos + 46, pos + 46 + fnLen).toString("utf8");
    if (fname.toLowerCase() === targetFile.toLowerCase()) {
      found = { compMethod, compSize, uncompSize, lhOffset };
    }
    pos += 46 + fnLen + extraLen + commentLen;
  }
  if (!found) throw new Error(`"${targetFile}" not found in ZIP central directory`);
  console.log(`   Found ${targetFile}: ${Math.round(found.uncompSize / 1e6)} MB uncompressed`);

  // 4. Read Local File Header to get exact data start
  const lh = await fetchRange(finalUrl, found.lhOffset, found.lhOffset + 29);
  if (lh.readUInt32LE(0) !== 0x04034b50) throw new Error("Invalid local file header");
  const localFnLen    = lh.readUInt16LE(26);
  const localExtraLen = lh.readUInt16LE(28);
  const dataStart     = found.lhOffset + 30 + localFnLen + localExtraLen;

  // 5. Download compressed data
  process.stdout.write(`   Downloading ${targetFile} (${Math.round(found.compSize / 1e6)} MB compressed)…\n`);
  const compData = await fetchRange(finalUrl, dataStart, dataStart + found.compSize - 1, (got, total) => {
    process.stdout.write(`\r   ${Math.round(got / total * 100)}%  ${Math.round(got / 1e6)}MB / ${Math.round(total / 1e6)}MB  `);
  });
  process.stdout.write("\n");

  // 6. Decompress (method 8 = Deflate, method 0 = stored)
  let data;
  if (found.compMethod === 8) {
    data = inflateRawSync(compData);
  } else if (found.compMethod === 0) {
    data = compData;
  } else {
    throw new Error(`Unsupported compression method: ${found.compMethod}`);
  }

  writeFileSync(destPath, data);
  console.log(`✓ Saved ${destPath} (${Math.round(data.length / 1e6)} MB)`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const VERSION = "v0.5.7"; // last version with good qwen2.5vl support + lean binaries

const TASKS = {
  darwin: {
    url: `https://github.com/ollama/ollama/releases/download/${VERSION}/ollama-darwin`,
    dest: join(ROOT, "resources", "ollama", "mac", "ollama"),
    mode: "full",
  },
  win32: {
    zipUrl: `https://github.com/ollama/ollama/releases/download/${VERSION}/ollama-windows-amd64.zip`,
    target: "ollama.exe",
    dest: join(ROOT, "resources", "ollama", "win", "ollama.exe"),
    mode: "zip-extract",
  },
};

const task = TASKS[process.platform];
if (!task) {
  console.log(`No Ollama binary needed for ${process.platform}`);
  process.exit(0);
}

// Skip if already present and looks real (> 10 MB)
if (existsSync(task.dest) && statSync(task.dest).size > 10_000_000) {
  console.log(`✓ Ollama already present (${Math.round(statSync(task.dest).size / 1e6)} MB) — skipping download`);
  process.exit(0);
}

mkdirSync(dirname(task.dest), { recursive: true });
console.log(`⬇  Fetching Ollama ${VERSION} for ${process.platform}…`);

if (task.mode === "full") {
  await downloadFull(task.url, task.dest);
  chmodSync(task.dest, 0o755);
} else {
  await extractFileFromRemoteZip(task.zipUrl, task.target, task.dest);
}

console.log("✓ Done");
