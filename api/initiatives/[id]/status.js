import { updateServerInitiativeStatus } from "../../../server/initiatives.mjs";

const maxBodyBytes = 16 * 1024;

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (!["PATCH", "POST"].includes(request.method || "")) {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const initiativeId = request.query?.id || payload.initiativeId;
    const initiative = await updateServerInitiativeStatus(request, { ...payload, initiativeId }, process.env);
    sendJson(response, 200, { updated: true, initiative });
  } catch (error) {
    console.error("[Demokracija 2.0] Initiative status update failed", error);
    sendJson(response, error.status || 500, {
      updated: false,
      error: error.message || "Initiative status update failed"
    });
  }
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
