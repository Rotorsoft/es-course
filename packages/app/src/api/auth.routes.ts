import {
  app,
  getAllUsers,
  getUserByEmail,
  getUserByProviderId,
  systemActor,
} from "@rotorsoft/es-course-domain";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hashPassword, signToken, verifyPassword } from "./auth.js";
import { drainAll, getGoogleClient } from "./helpers.js";
import { t, publicProcedure, authedProcedure, adminProcedure } from "./trpc.js";

export const authRouter = t.router({
  getAuthConfig: publicProcedure.query(() => {
    const providers: ("local" | "google")[] = ["local"];
    if (process.env.GOOGLE_CLIENT_ID) providers.push("google");
    return { providers };
  }),

  login: publicProcedure
    .input(z.object({ username: z.string(), password: z.string() }))
    .mutation(async ({ input }) => {
      const user = getUserByProviderId(input.username);
      if (!user || user.provider !== "local" || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      }
      if (!verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      }
      const token = signToken({ email: user.email });
      return { user: { id: user.email, name: user.name, picture: user.picture, role: user.role }, token };
    }),

  signup: publicProcedure
    .input(z.object({ username: z.string(), name: z.string(), password: z.string() }))
    .mutation(async ({ input }) => {
      const existing = getUserByEmail(input.username);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "User already exists" });
      }
      const passwordHash = hashPassword(input.password);
      await app.do("RegisterUser", { stream: input.username, actor: { ...systemActor, name: "AuthSystem" } }, {
        email: input.username,
        name: input.name,
        provider: "local",
        providerId: input.username,
        passwordHash,
      });
      await drainAll();
      const user = getUserByEmail(input.username);
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to register user" });
      const token = signToken({ email: user.email });
      return { user: { id: user.email, name: user.name, picture: user.picture, role: user.role }, token };
    }),

  loginWithGoogle: publicProcedure
    .input(z.object({ idToken: z.string() }))
    .mutation(async ({ input }) => {
      const client = getGoogleClient();
      if (!client) throw new TRPCError({ code: "BAD_REQUEST", message: "Google SSO not configured" });

      const ticket = await client.verifyIdToken({
        idToken: input.idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid Google token" });
      }

      // Register if new
      let user = getUserByEmail(payload.email);
      if (!user) {
        await app.do("RegisterUser", { stream: payload.email, actor: { ...systemActor, name: "AuthSystem" } }, {
          email: payload.email,
          name: payload.name || payload.email,
          picture: payload.picture,
          provider: "google",
          providerId: payload.sub,
        });
        await drainAll();
        user = getUserByEmail(payload.email);
      }
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to register user" });

      const token = signToken({ email: user.email });
      return { user: { id: user.email, name: user.name, picture: user.picture, role: user.role }, token };
    }),

  me: authedProcedure.query(({ ctx }) => {
    return ctx.actor;
  }),

  assignRole: adminProcedure
    .input(z.object({ email: z.string(), role: z.enum(["admin", "user"]) }))
    .mutation(async ({ input, ctx }) => {
      const target = getUserByEmail(input.email);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      await app.do("AssignRole", { stream: input.email, actor: ctx.actor }, { role: input.role });
      await drainAll();
      return { success: true };
    }),

  listUsers: adminProcedure.query(() => {
    return getAllUsers().map(({ passwordHash: _, ...profile }) => profile);
  }),
});
