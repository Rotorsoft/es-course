import { projection, slice, state } from "@rotorsoft/act";
import {
  AssignRole,
  RegisterUser,
  RoleAssigned,
  UserRegistered,
  UserState,
} from "./schemas.js";

// === User aggregate (write model) ===
export const User = state({ User: UserState })
  .init(() => ({
    email: "",
    name: "",
    role: "user" as const,
    provider: "local" as const,
    providerId: "",
  }))
  .emits({ UserRegistered, RoleAssigned })
  .on({ RegisterUser }).emit("UserRegistered")
  .on({ AssignRole }).emit("RoleAssigned")
  .build();

// === User projection (read model) ===
export type UserProfile = {
  email: string;
  name: string;
  picture?: string;
  role: "admin" | "user";
  provider: "local" | "google";
  providerId: string;
  passwordHash?: string;
};

const users = new Map<string, UserProfile>();
const byProviderId = new Map<string, string>(); // providerId → email

export const UserProjection = projection("users")
  .on({ UserRegistered })
  .do(async (event) => {
    const profile: UserProfile = {
      email: event.data.email,
      name: event.data.name,
      picture: event.data.picture,
      role: "user",
      provider: event.data.provider,
      providerId: event.data.providerId,
      passwordHash: event.data.passwordHash,
    };
    users.set(event.stream, profile);
    byProviderId.set(event.data.providerId, event.stream);
  })
  .on({ RoleAssigned })
  .do(async (event) => {
    const user = users.get(event.stream);
    if (user) {
      user.role = event.data.role;
    }
  })
  .build();

export const UserSlice = slice()
  .withState(User)
  .withProjection(UserProjection)
  .build();

// === Query helpers ===
export function getUserByEmail(email: string): UserProfile | undefined {
  return users.get(email);
}

export function getUserByProviderId(providerId: string): UserProfile | undefined {
  const email = byProviderId.get(providerId);
  return email ? users.get(email) : undefined;
}

export function getAllUsers(): UserProfile[] {
  return Array.from(users.values());
}

export function clearUsers(): void {
  users.clear();
  byProviderId.clear();
}
