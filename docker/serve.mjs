/**
 * Production server for TanStack Start (fetch-handler entry) + client assets.
 * srvx CLI currently ignores --static when --entry is set; this bridges both.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, extname, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import { Readable } from "node:stream";

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const serverEntry =
  process.env.SERVER_ENTRY || "apps/web/dist/server/server.js";
const staticDir = process.env.STATIC_DIR || "apps/web/dist/client";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent((reqPath || "/").split("?")[0] || "/");
  // Strip leading slash so join(root, path) stays under root (path.join
  // discards root when a segment is absolute).
  const cleaned = normalize(decoded)
    .replace(/^(\.\.(\/|\\|$))+/, "")
    .replace(/^[/\\]+/, "");
  if (!cleaned || cleaned === ".") return null;
  const full = join(root, cleaned);
  if (full !== root && !full.startsWith(root.endsWith("/") ? root : `${root}/`)) {
    return null;
  }
  return full;
}

async function loadHandler() {
  const mod = await import(pathToFileURL(join(process.cwd(), serverEntry)).href);
  const entry = mod.default ?? mod;
  if (typeof entry?.fetch !== "function") {
    throw new Error(
      `Server entry ${serverEntry} must export default { fetch }`,
    );
  }
  return entry.fetch.bind(entry);
}

function tryStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  let path = url.pathname;
  if (path.endsWith("/")) path += "index.html";
  const filePath = safeJoin(join(process.cwd(), staticDir), path);
  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return false;
  }
  const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
  res.statusCode = 200;
  res.setHeader("content-type", type);
  res.setHeader("cache-control", "public, max-age=31536000, immutable");
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  createReadStream(filePath).pipe(res);
  return true;
}

async function nodeReqToWeb(req) {
  const hostHdr = req.headers.host || `localhost:${port}`;
  const url = `http://${hostHdr}${req.url || "/"}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const item of v) headers.append(k, item);
    else headers.set(k, v);
  }
  const method = req.method || "GET";
  /** @type {RequestInit} */
  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    init.body = Buffer.concat(chunks);
    // @ts-expect-error Node undici/fetch duplex
    init.duplex = "half";
  }
  return new Request(url, init);
}

async function webResToNode(webRes, res) {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") return;
    res.setHeader(key, value);
  });
  if (!webRes.body) {
    res.end();
    return;
  }
  const nodeStream = Readable.fromWeb(webRes.body);
  nodeStream.pipe(res);
}

const fetchHandler = await loadHandler();

const server = createServer(async (req, res) => {
  try {
    if (tryStatic(req, res)) return;
    const webReq = await nodeReqToWeb(req);
    const webRes = await fetchHandler(webReq);
    await webResToNode(webRes, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("Internal Server Error");
    } else {
      res.end();
    }
  }
});

server.listen(port, host, () => {
  console.log(
    `Maximus listening on http://${host}:${port}/ (entry=${serverEntry} static=${staticDir})`,
  );
});
