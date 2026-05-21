const STORAGE_KEY = "demos.currentUser";

export class DemoAuth {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.sipassUser = null;
  }

  currentUser() {
    if (this.sipassUser) return this.sipassUser;

    const raw = this.storage?.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  signIn({ name, email, role = "citizen" }) {
    const cleanName = String(name || "").trim() || "Demo uporabnik";
    const cleanEmail = String(email || "").trim().toLowerCase();
    const user = {
      id: cleanEmail || `demo-${slug(cleanName)}`,
      name: cleanName,
      email: cleanEmail,
      role,
      provider: "demo",
      signedInAt: new Date().toISOString()
    };
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  }

  signOut() {
    this.sipassUser = null;
    this.storage?.removeItem(STORAGE_KEY);
  }

  async refreshSipassSession(endpoint) {
    if (!endpoint || typeof fetch !== "function") return null;

    try {
      const response = await fetch(endpoint, {
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      });
      if (!response.ok) return null;
      const payload = await response.json();
      this.sipassUser = payload?.authenticated && payload.user?.id ? normalizeSipassUser(payload.user) : null;
      return this.sipassUser;
    } catch {
      return null;
    }
  }
}

function slug(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSipassUser(user) {
  return {
    id: String(user.id || ""),
    name: String(user.name || "SI-PASS uporabnik"),
    firstName: String(user.firstName || ""),
    lastName: String(user.lastName || ""),
    emso: String(user.emso || ""),
    taxNumber: String(user.taxNumber || ""),
    email: String(user.email || "").trim().toLowerCase(),
    role: String(user.role || "citizen"),
    provider: "sipass",
    signedInAt: String(user.signedInAt || "")
  };
}

