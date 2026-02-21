import { describe, it, expect, beforeEach } from "vitest";
import { store } from "@rotorsoft/act";
import { app, User, getUserByEmail, getUserByProviderId, getAllUsers, clearUsers, systemActor } from "../src/index.js";

const system = systemActor;

async function drainAll() {
  for (let i = 0; i < 10; i++) {
    const { leased } = await app.correlate({ after: -1, limit: 100 });
    if (leased.length === 0) break;
    await app.drain({ streamLimit: 10, eventLimit: 100 });
  }
}

describe("User aggregate", () => {
  beforeEach(async () => {
    await store().seed();
    clearUsers();
  });

  it("should register a local user with role 'user'", async () => {
    await app.do("RegisterUser", { stream: "alice@test.com", actor: system }, {
      email: "alice@test.com",
      name: "Alice",
      provider: "local",
      providerId: "alice",
      passwordHash: "hashed",
    });
    const snap = await app.load(User, "alice@test.com");
    expect(snap.state.email).toBe("alice@test.com");
    expect(snap.state.name).toBe("Alice");
    expect(snap.state.role).toBe("user");
    expect(snap.state.provider).toBe("local");
    expect(snap.state.providerId).toBe("alice");
    expect(snap.state.passwordHash).toBe("hashed");
  });

  it("should register a google user", async () => {
    await app.do("RegisterUser", { stream: "bob@gmail.com", actor: system }, {
      email: "bob@gmail.com",
      name: "Bob",
      picture: "https://example.com/bob.jpg",
      provider: "google",
      providerId: "google-sub-123",
    });
    const snap = await app.load(User, "bob@gmail.com");
    expect(snap.state.provider).toBe("google");
    expect(snap.state.providerId).toBe("google-sub-123");
    expect(snap.state.picture).toBe("https://example.com/bob.jpg");
  });

  it("should assign admin role", async () => {
    await app.do("RegisterUser", { stream: "alice@test.com", actor: system }, {
      email: "alice@test.com",
      name: "Alice",
      provider: "local",
      providerId: "alice",
    });
    await app.do("AssignRole", { stream: "alice@test.com", actor: system }, {
      role: "admin",
    });
    const snap = await app.load(User, "alice@test.com");
    expect(snap.state.role).toBe("admin");
  });
});

describe("User projection", () => {
  beforeEach(async () => {
    await store().seed();
    clearUsers();
  });

  it("should materialize user profile on registration", async () => {
    await app.do("RegisterUser", { stream: "alice@test.com", actor: system }, {
      email: "alice@test.com",
      name: "Alice",
      provider: "local",
      providerId: "alice",
      passwordHash: "hashed",
    });
    await drainAll();

    const user = getUserByEmail("alice@test.com");
    expect(user).toBeDefined();
    expect(user!.name).toBe("Alice");
    expect(user!.role).toBe("user");
    expect(user!.provider).toBe("local");
  });

  it("should support lookup by providerId", async () => {
    await app.do("RegisterUser", { stream: "bob@gmail.com", actor: system }, {
      email: "bob@gmail.com",
      name: "Bob",
      provider: "google",
      providerId: "google-sub-456",
    });
    await drainAll();

    const user = getUserByProviderId("google-sub-456");
    expect(user).toBeDefined();
    expect(user!.email).toBe("bob@gmail.com");
  });

  it("should reflect role change", async () => {
    await app.do("RegisterUser", { stream: "alice@test.com", actor: system }, {
      email: "alice@test.com",
      name: "Alice",
      provider: "local",
      providerId: "alice",
    });
    await drainAll();
    expect(getUserByEmail("alice@test.com")!.role).toBe("user");

    await app.do("AssignRole", { stream: "alice@test.com", actor: system }, {
      role: "admin",
    });
    await drainAll();
    expect(getUserByEmail("alice@test.com")!.role).toBe("admin");
  });

  it("should list all users", async () => {
    await app.do("RegisterUser", { stream: "a@test.com", actor: system }, {
      email: "a@test.com", name: "A", provider: "local", providerId: "a",
    });
    await app.do("RegisterUser", { stream: "b@test.com", actor: system }, {
      email: "b@test.com", name: "B", provider: "local", providerId: "b",
    });
    await drainAll();

    const all = getAllUsers();
    expect(all).toHaveLength(2);
  });
});
