import { clearSipassCookie } from "../../server/sipass-session.mjs";

export default function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  response.setHeader("Set-Cookie", clearSipassCookie(process.env));
  sendJson(response, 200, { signedOut: true });
}

function sendJson(response, status, value) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.statusCode = status;
  response.end(JSON.stringify(value));
}
