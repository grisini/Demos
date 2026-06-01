import dailyDigestHandler from "../../server/daily-digest.mjs";
import { deliverEmailNotifications } from "../../server/email.mjs";

const maxBodyBytes = 128 * 1024;

export default async function handler(request, response) {
  const action = notificationAction(request);

  if (action === "daily-digest") return dailyDigestHandler(request, response);

  if (action === "email") {
    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const payload = await readJsonBody(request);
      const result = await deliverEmailNotifications(payload, process.env);
      sendJson(response, 202, result);
    } catch (error) {
      console.error("[Demokracija 2.0] Email notifications failed", error);
      sendJson(response, error.status || 500, {
        error: error.message || "Email notifications failed"
      });
    }
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function notificationAction(request) {
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
