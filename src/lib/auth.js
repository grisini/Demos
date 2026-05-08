const STORAGE_KEY = "demos.currentUser";

export class DemoAuth {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }

  currentUser() {
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
    this.storage?.removeItem(STORAGE_KEY);
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

