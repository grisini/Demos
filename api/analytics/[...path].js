import clarityHandler from "../../server/analytics-clarity.mjs";
import systemHandler from "../../server/analytics-system.mjs";

export default function handler(request, response) {
  const action = analyticsAction(request);

  if (action === "clarity") return clarityHandler(request, response);
  if (action === "system") return systemHandler(request, response);

  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.statusCode = 404;
  response.end(JSON.stringify({ error: "Not found" }));
}

function analyticsAction(request) {
  const path = request.query?.path;
  if (Array.isArray(path)) return path[0] || "";
  if (path) return String(path).split("/")[0];

  const pathname = String(request.url || "").split("?")[0];
  return pathname.split("/").filter(Boolean).at(-1) || "";
}
