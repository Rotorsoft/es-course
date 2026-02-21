import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context.js";

export const t = initTRPC.context<Context>().create();

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.actor) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  return next({ ctx: { ...ctx, actor: ctx.actor } });
});

const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.actor) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  if (ctx.actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next({ ctx: { ...ctx, actor: ctx.actor } });
});

export const publicProcedure = t.procedure;
export const authedProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(isAdmin);
