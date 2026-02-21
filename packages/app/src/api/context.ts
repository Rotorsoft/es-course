import { getUserByEmail, type AppActor } from "@rotorsoft/es-course-domain";
import { verifyToken } from "./auth.js";

export type Context = {
  actor: AppActor | null;
};

export function createContext({ req }: { req: { headers: Record<string, string | string[] | undefined> } }): Context {
  const auth = req.headers["authorization"];
  const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = getUserByEmail(payload.email);
      if (user) return { actor: { id: user.email, name: user.name, picture: user.picture, role: user.role } };
    }
  }

  return { actor: null };
}
