import { createDemoLogin } from "../../server/demo-login.mjs";
import { sessionUserWithAdminRole } from "../../server/initiatives.mjs";
import { clearSipassCookie } from "../../server/sipass-session.mjs";

const maxBodyBytes = 16 * 1024;

export default async function handler(request, response) {
  const action = authAction(request);

  if (action === "session") {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const user = sessionUserWithAdminRole(request, process.env);
    sendJson(response, 200, {
      authenticated: Boolean(user),
      user
    });
    return;
  }

  if (action === "logout") {
    if (!["GET", "POST"].includes(request.method)) {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    response.setHeader("Set-Cookie", clearSipassCookie(process.env));
    sendJson(response, 200, { signedOut: true });
    return;
  }

  if (action === "demo-login") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const payload = await readJsonBody(request);
      sendJson(response, 200, createDemoLogin(payload, process.env));
    } catch (error) {
      sendJson(response, error.status || 400, {
        authenticated: false,
        error: error.message || "Demo prijava ni uspela."
      });
    }
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function authAction(request) {
  const path = request.query?.path;
  if (Array.isArray(path)) return path[0] || "";
  if (path) return String(path).split("/")[0];

  const pathname = String(request.url || "").split("?")[0];
  return pathname.split("/").filter(Boolean).at(-1) || "";
}

function sendJson(response, status, value) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.statusCode = status;
  response.end(JSON.stringify(value));
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === "string") return request.body ? JSON.parse(request.body) : {};
  if (Buffer.isBuffer(request.body)) return request.body.length ? JSON.parse(request.body.toString("utf8")) : {};

  const raw = await new Promise((resolveBody, rejectBody) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBodyBytes) {
        const error = new Error("Request body is too large.");
        error.status = 413;
        rejectBody(error);
        request.destroy();
      }
    });
    request.on("end", () => resolveBody(body));
    request.on("error", rejectBody);
  });

  return raw ? JSON.parse(raw) : {};
}
