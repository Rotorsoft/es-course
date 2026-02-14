import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../api/index.js";

export const trpc = createTRPCReact<AppRouter>();
