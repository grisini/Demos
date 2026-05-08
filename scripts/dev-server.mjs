import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const defaultPort = Number(process.env.PORT || 5173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function parseEnvFile(fileName) {
  const file = join(root, fileName);
  if (!existsSync(file)) return {};

  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
    .reduce((acc, line) => {
      const index = line.indexOf("=");
      if (index === -1) return acc;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      acc[key] = value;
      return acc;
    }, {});
}

function runtimeConfig() {
  const env = {
    ...parseEnvFile(".env"),
    ...parseEnvFile(".env.local"),
    ...process.env
  };

  return {
    DATA_SOURCE: env.DATA_SOURCE || "local",
    AUTH_MODE: env.AUTH_MODE || "demo",
    SUPABASE_URL: env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || "",
    SIPASS_ENV: env.SIPASS_ENV || "test",
    SIPASS_AUTHORITY: env.SIPASS_AUTHORITY || "https://sicas-test.sigov.si/",
    SIPASS_CLIENT_ID: env.SIPASS_CLIENT_ID || "",
    SIPASS_REDIRECT_URI:
      env.SIPASS_REDIRECT_URI || `http://localhost:${env.PORT || defaultPort}/auth/sipass/callback`
  };
}

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function createAppServer() {
  return createServer((req, res) => {
    const requestedUrl = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = decodeURIComponent(requestedUrl.pathname);

    if (pathname === "/config.local.js") {
      const body = `window.DEMOS_CONFIG = ${JSON.stringify(runtimeConfig(), null, 2)};\n`;
      send(res, 200, body, "text/javascript; charset=utf-8");
      return;
    }

    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = normalize(resolve(join(root, relative)));

    if (!filePath.startsWith(root)) {
      send(res, 403, "Forbidden");
      return;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      send(res, 404, "Not found");
      return;
    }

    const type = contentTypes[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    createReadStream(filePath).pipe(res);
  });
}

function listenOnAvailablePort(port) {
  const server = createAppServer();

  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      listenOnAvailablePort(port + 1);
      return;
    }
    throw error;
  });

  server.listen(port, () => {
    console.log(`Demokracija 2.0 dev server: http://localhost:${port}`);
  });
}

listenOnAvailablePort(defaultPort);

