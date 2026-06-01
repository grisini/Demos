export function createDemoLogin(payload = {}, env = process.env) {
  const email = clean(payload.email, 320).toLowerCase();
  const name = clean(payload.name, 200) || demoNameFromEmail(email);
  const id = email || `demo-${slug(name)}`;

  return {
    authenticated: true,
    user: {
      id,
      name,
      email,
      role: adminEmails(env).has(email) ? "admin" : "citizen",
      provider: "demo",
      signedInAt: new Date().toISOString()
    }
  };
}

export function adminEmails(env = process.env) {
  return new Set(
    String(env.ADMIN_EMAILS || "")
      .split(/[,\s]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function demoNameFromEmail(email) {
  const localPart = String(email || "").split("@")[0]?.trim();
  return localPart || "Demo uporabnik";
}

function slug(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
