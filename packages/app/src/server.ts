import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { app } from "@rotorsoft/es-course-domain";
import { router, createContext } from "./api/index.js";

const server = createHTTPServer({
  middleware: cors({ origin: true, credentials: true }),
  router,
  createContext,
});
const port = Number(process.env.PORT) || 4000;
server.listen(port);

await app.settle();
console.log(`Server listening on http://localhost:${port}`);
