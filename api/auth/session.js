import { sessionUserFromRequest } from "../../server/sipass-session.mjs";

export default function handler(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const user = sessionUserFromRequest(request, process.env);
  sendJson(response, 200, {
    authenticated: Boolean(user),
    user
  });
}

function sendJson(response, status, value) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.statusCode = status;
  response.end(JSON.stringify(value));
}
