import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { app, systemActor } from "@rotorsoft/es-course-domain";
import { router, createContext } from "./api/index.js";
import { seed } from "./seed.js";

// Dev-only extras: a sample published order
async function devSeed() {
  await seed();

  const system = { ...systemActor, name: "Seed Script" };
  const order1 = crypto.randomUUID();
  await app.do("PlaceOrder", { stream: order1, actor: system }, {
    items: [{
      itemId: crypto.randomUUID(), productId: "prod-espresso",
      name: "Espresso Machine", description: "Professional 15-bar pressure", price: "299.99",
    }],
  });

  // Drain reactions + projections
  for (let i = 0; i < 3; i++) {
    const { leased } = await app.correlate({ after: -1, limit: 500 });
    if (leased.length === 0) break;
    await app.drain({ streamLimit: 100, eventLimit: 500 });
  }

  console.log(`Seeded dev order: ${order1}`);
}

// Start server
const server = createHTTPServer({
  middleware: cors({ origin: true, credentials: true }),
  router,
  createContext,
});
server.listen(4000);

await devSeed();
console.log("\nAPI server running at http://localhost:4000");
