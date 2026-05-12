import {
  addComment,
  signInitiative,
  updateInitiativeStatus,
  voteForInitiative
} from "../domain/validation.js";

const STORAGE_KEY = "demos.initiatives";

export class LocalInitiativeRepository {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }

  async list() {
    return this.read();
  }

  async create(initiative) {
    const initiatives = [initiative, ...this.read()];
    this.write(initiatives);
    return initiative;
  }

  async vote(id, actor) {
    return this.update(id, (initiative) => voteForInitiative(initiative, actor));
  }

  async sign(id, actor, method = "demo") {
    return this.update(id, (initiative) => signInitiative(initiative, actor, method));
  }

  async comment(id, actor, body) {
    return this.update(id, (initiative) => addComment(initiative, actor, body));
  }

  async updateStatus(id, status) {
    return this.update(id, (initiative) => updateInitiativeStatus(initiative, status));
  }

  read() {
    const raw = this.storage?.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  write(initiatives) {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(initiatives));
  }

  update(id, updater) {
    const initiatives = this.read();
    const index = initiatives.findIndex((initiative) => initiative.id === id);
    if (index === -1) throw new Error("Pobuda ne obstaja.");

    const updated = updater(initiatives[index]);
    initiatives[index] = updated;
    this.write(initiatives);
    return updated;
  }
}

