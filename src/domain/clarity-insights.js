const DEFAULT_DAYS = 1;
const DEFAULT_DIMENSION = "URL";

const CHART_DEFINITIONS = [
  {
    key: "traffic",
    metricName: "Traffic",
    title: "Obiski po URL",
    unit: "sej",
    valueKeys: ["totalSessionCount", "sessionCount", "totalSessions", "sessions", "Traffic"]
  },
  {
    key: "engagement",
    metricName: "Engagement Time",
    title: "Cas v uporabi",
    unit: "s",
    valueKeys: ["engagementTime", "averageEngagementTime", "avgEngagementTime", "Engagement Time"]
  },
  {
    key: "scroll",
    metricName: "Scroll Depth",
    title: "Globina branja",
    unit: "%",
    valueKeys: ["scrollDepth", "averageScrollDepth", "Scroll Depth"]
  },
  {
    key: "dead_clicks",
    metricName: "Dead Click Count",
    title: "Mrtvi kliki",
    unit: "klikov",
    valueKeys: ["deadClickCount", "Dead Click Count", "count"]
  },
  {
    key: "rage_clicks",
    metricName: "Rage Click Count",
    title: "Rage kliki",
    unit: "dogodkov",
    valueKeys: ["rageClickCount", "Rage Click Count", "count"]
  },
  {
    key: "script_errors",
    metricName: "Script Error Count",
    title: "JavaScript napake",
    unit: "napak",
    valueKeys: ["scriptErrorCount", "Script Error Count", "count"]
  }
];

export function emptyClarityInsights(reason = "") {
  return {
    configured: false,
    source: "clarity",
    days: DEFAULT_DAYS,
    dimension: DEFAULT_DIMENSION,
    fetchedAt: new Date().toISOString(),
    reason,
    summary: emptySummary(),
    charts: [],
    rawMetricCount: 0
  };
}

export function normalizeClarityInsights(payload, options = {}) {
  const metrics = normalizeMetrics(payload);
  const charts = CHART_DEFINITIONS.map((definition) => buildChart(metrics, definition)).filter(
    (chart) => chart.rows.length
  );

  return {
    configured: true,
    source: "clarity",
    days: clampDays(options.days),
    dimension: String(options.dimension || DEFAULT_DIMENSION),
    fetchedAt: new Date().toISOString(),
    summary: {
      sessions: sumMetric(metrics, "Traffic", ["totalSessionCount", "sessionCount", "totalSessions", "sessions"]),
      users: sumMetric(metrics, "Traffic", ["distinctUserCount", "distantUserCount", "userCount", "users"]),
      botSessions: sumMetric(metrics, "Traffic", ["totalBotSessionCount", "botSessionCount", "bots"]),
      deadClicks: sumMetric(metrics, "Dead Click Count", ["deadClickCount", "Dead Click Count", "count"]),
      rageClicks: sumMetric(metrics, "Rage Click Count", ["rageClickCount", "Rage Click Count", "count"]),
      scriptErrors: sumMetric(metrics, "Script Error Count", ["scriptErrorCount", "Script Error Count", "count"])
    },
    charts,
    rawMetricCount: metrics.length
  };
}

function normalizeMetrics(payload) {
  if (Array.isArray(payload)) return payload.map(normalizeMetric).filter(Boolean);
  if (Array.isArray(payload?.metrics)) return payload.metrics.map(normalizeMetric).filter(Boolean);
  if (Array.isArray(payload?.data)) return payload.data.map(normalizeMetric).filter(Boolean);
  return [];
}

function normalizeMetric(metric) {
  if (!metric || typeof metric !== "object") return null;
  return {
    metricName: String(metric.metricName || metric.name || metric.metric || "Metric"),
    information: Array.isArray(metric.information)
      ? metric.information.filter((row) => row && typeof row === "object")
      : []
  };
}

function buildChart(metrics, definition) {
  const metric = metrics.find((item) => normalizeName(item.metricName) === normalizeName(definition.metricName));
  const rows = (metric?.information || [])
    .map((row) => {
      const value = firstNumeric(row, definition.valueKeys);
      return {
        label: rowLabel(row),
        value,
        unit: definition.unit,
        secondary: rowSecondary(row)
      };
    })
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return {
    key: definition.key,
    title: definition.title,
    metricName: definition.metricName,
    unit: definition.unit,
    rows
  };
}

function sumMetric(metrics, metricName, valueKeys) {
  const metric = metrics.find((item) => normalizeName(item.metricName) === normalizeName(metricName));
  return roundOne((metric?.information || []).reduce((total, row) => total + firstNumeric(row, valueKeys), 0));
}

function firstNumeric(row, preferredKeys) {
  for (const key of preferredKeys) {
    const value = numericValue(row[key]);
    if (value !== null) return value;
  }

  for (const [key, value] of Object.entries(row)) {
    if (isDimensionKey(key)) continue;
    const numeric = numericValue(value);
    if (numeric !== null) return numeric;
  }

  return 0;
}

function rowLabel(row) {
  return (
    firstText(row, ["URL", "url", "Page Title", "pageTitle", "Device", "Browser", "OS", "Country/Region", "Source"]) ||
    "Nerazvrsceno"
  );
}

function rowSecondary(row) {
  const parts = [];
  const users = firstNumeric(row, ["distinctUserCount", "distantUserCount", "userCount", "users"]);
  const bots = firstNumeric(row, ["totalBotSessionCount", "botSessionCount", "bots"]);
  if (users) parts.push(`${formatMetricValue(users)} uporabnikov`);
  if (bots) parts.push(`${formatMetricValue(bots)} bot sej`);
  return parts.join(" - ");
}

function firstText(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

export function formatMetricValue(value) {
  const number = Number(value) || 0;
  if (Number.isInteger(number)) return String(number);
  return String(roundOne(number));
}

function numericValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(String(value).replace("%", ""));
  return Number.isFinite(number) ? number : null;
}

function isDimensionKey(key) {
  return ["url", "page title", "device", "browser", "os", "country/region", "source", "medium", "campaign", "channel"].includes(
    normalizeName(key)
  );
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function clampDays(value) {
  const number = Number(value) || DEFAULT_DAYS;
  return Math.min(3, Math.max(1, Math.round(number)));
}

function emptySummary() {
  return {
    sessions: 0,
    users: 0,
    botSessions: 0,
    deadClicks: 0,
    rageClicks: 0,
    scriptErrors: 0
  };
}

function roundOne(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}
