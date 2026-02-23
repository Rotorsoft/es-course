import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { router, createContext } from "./api/index.js";
import { seed } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = __dirname;  // server.js lives in dist/ alongside index.html and assets/
const corsMiddleware = cors({ origin: true, credentials: true });

const trpcHandler = createHTTPHandler({ router, createContext });

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  corsMiddleware(req, res, () => {
    // tRPC routes
    if (req.url?.startsWith("/trpc")) {
      req.url = req.url.slice(5); // strip /trpc prefix
      return trpcHandler(req, res);
    }

    // Static files
    const urlPath = req.url?.split("?")[0] ?? "/";
    let filePath = path.join(staticDir, urlPath === "/" ? "index.html" : urlPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    } else {
      // SPA fallback — serve index.html for client-side routing
      const indexPath = path.join(staticDir, "index.html");
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        fs.createReadStream(indexPath).pipe(res);
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    }
  });
});

await seed();

const port = Number(process.env.PORT) || 4000;
server.listen(port);
console.log(`Server listening on http://localhost:${port}`);
