import {
  createServerComment,
  createServerInitiative,
  updateServerInitiativeStatus
} from "../server/initiatives.mjs";

const largeBodyBytes = 256 * 1024;
const smallBodyBytes = 16 * 1024;

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  const payload = await readPayloadOrRespond(request, response);
  if (!payload) return;

  const route = initiativeRoutes[normalizeAction(payload.action)];
  if (!route) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  if (!route.methods.includes(request.method || "")) {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  await runInitiativeRoute(route, request, response, payload);
}

const initiativeRoutes = {
  create: {
    methods: ["POST"],
    run: createServerInitiative,
    status: 201,
    success: "created",
    log: "Initiative create failed",
    error: "Initiative create failed",
    includeValidationErrors: true
  },
  comment: {
    methods: ["POST"],
    run: createServerComment,
    status: 201,
    success: "created",
    log: "Comment create failed",
    error: "Comment create failed"
  },
  status: {
    methods: ["PATCH", "POST"],
    run: updateServerInitiativeStatus,
    status: 200,
    success: "updated",
    log: "Initiative status update failed",
    error: "Initiative status update failed"
  }
};

async function readPayloadOrRespond(request, response) {
  try {
    return await readJsonBody(request, request.method === "POST" ? largeBodyBytes : smallBodyBytes);
  } catch (error) {
    sendJson(response, error.status || 400, { error: error.message || "Invalid JSON body" });
    return null;
  }
}

function normalizeAction(action) {
  const value = String(action || "").toLowerCase();
  return value || "create";
}

async function runInitiativeRoute(route, request, response, payload) {
  try {
    const initiative = await route.run(request, payload, process.env);
    sendJson(response, route.status, { [route.success]: true, initiative });
  } catch (error) {
    console.error(`[Demokracija 2.0] ${route.log}`, error);
    sendJson(response, error.status || 500, routeErrorPayload(route, error));
  }
}

function routeErrorPayload(route, error) {
  return {
    [route.success]: false,
    error: error.message || route.error,
    errors: route.includeValidationErrors ? error.errors || undefined : undefined
  };
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
