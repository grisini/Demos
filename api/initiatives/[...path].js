import {
  createServerComment,
  createServerInitiative,
  updateServerInitiativeStatus
} from "../../server/initiatives.mjs";

const largeBodyBytes = 256 * 1024;
const smallBodyBytes = 16 * 1024;

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  const route = initiativeRoute(request);

  if (route.kind === "create") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const payload = await readJsonBody(request, largeBodyBytes);
      const initiative = await createServerInitiative(request, payload, process.env);
      sendJson(response, 201, { created: true, initiative });
    } catch (error) {
      console.error("[Demokracija 2.0] Initiative create failed", error);
      sendJson(response, error.status || 500, {
        created: false,
        error: error.message || "Initiative create failed",
        errors: error.errors || undefined
      });
    }
    return;
  }

  if (route.kind === "comments") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const payload = await readJsonBody(request, smallBodyBytes);
      const initiative = await createServerComment(
        request,
        { ...payload, initiativeId: route.id || payload.initiativeId },
        process.env
      );
      sendJson(response, 201, { created: true, initiative });
    } catch (error) {
      console.error("[Demokracija 2.0] Comment create failed", error);
      sendJson(response, error.status || 500, {
        created: false,
        error: error.message || "Comment create failed"
      });
    }
    return;
  }

  if (route.kind === "status") {
    if (!["PATCH", "POST"].includes(request.method || "")) {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const payload = await readJsonBody(request, smallBodyBytes);
      const initiative = await updateServerInitiativeStatus(
        request,
        { ...payload, initiativeId: route.id || payload.initiativeId },
        process.env
      );
      sendJson(response, 200, { updated: true, initiative });
    } catch (error) {
      console.error("[Demokracija 2.0] Initiative status update failed", error);
      sendJson(response, error.status || 500, {
        updated: false,
        error: error.message || "Initiative status update failed"
      });
    }
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function initiativeRoute(request) {
  const queryPath = request.query?.path;
  const parts = Array.isArray(queryPath)
    ? queryPath
    : queryPath
      ? String(queryPath).split("/")
      : pathParts(request);

  if (!parts.length || parts[0] === "create") return { kind: "create" };
  if (parts.length >= 2 && parts[1] === "comments") return { kind: "comments", id: parts[0] };
  if (parts.length >= 2 && parts[1] === "status") return { kind: "status", id: parts[0] };
  return { kind: "unknown" };
}

function pathParts(request) {
  const pathname = String(request.url || "").split("?")[0];
  const parts = pathname.split("/").filter(Boolean);
  const index = parts.indexOf("initiatives");
  return index === -1 ? [] : parts.slice(index + 1).map(decodeURIComponent);
}

function sendJson(response, status, value) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.statusCode = status;
  response.end(JSON.stringify(value));
}

async function readJsonBody(request, maxBodyBytes) {
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
