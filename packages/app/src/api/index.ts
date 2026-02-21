import { authRouter } from "./auth.routes.js";
import { domainRouter } from "./domain.routes.js";
import { eventsRouter } from "./events.routes.js";
import { t } from "./trpc.js";

export { createContext, type Context } from "./context.js";

export const router = t.mergeRouters(authRouter, domainRouter, eventsRouter);

export type AppRouter = typeof router;
