import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { app } from "@rotorsoft/es-course-domain";
import type { Target } from "@rotorsoft/act";
import { router, createContext } from "./api/index.js";
import { hashPassword } from "./api/auth.js";

// Seed data for UI development
async function seed() {
  const system: Target["actor"] = { id: "seed", name: "Seed Script" };

  // --- Inventory for 5 products ---
  const products = [
    { productId: "prod-espresso", name: "Espresso Machine", price: 299.99, inventory: 12 },
    { productId: "prod-grinder", name: "Burr Grinder", price: 89.5, inventory: 25 },
    { productId: "prod-kettle", name: "Gooseneck Kettle", price: 54.0, inventory: 40 },
    { productId: "prod-scale", name: "Precision Scale", price: 34.95, inventory: 60 },
    { productId: "prod-filters", name: "Paper Filters (100pk)", price: 12.0, inventory: 200 },
  ];

  for (const p of products) {
    await app.do("ImportInventory", { stream: p.productId, actor: system }, {
      productId: p.productId, name: p.name, price: p.price, quantity: p.inventory,
    });
  }

  // --- One published order (espresso machine) ---
  const order1 = crypto.randomUUID();
  await app.do("PlaceOrder", { stream: order1, actor: system }, {
    items: [{
      itemId: crypto.randomUUID(), productId: "prod-espresso",
      name: "Espresso Machine", description: "Professional 15-bar pressure", price: "299.99",
    }],
  });

  // --- Seed admin user (admin/admin) ---
  const adminHash = hashPassword("admin");
  await app.do("RegisterUser", { stream: "admin", actor: system }, {
    email: "admin",
    name: "Admin",
    provider: "local",
    providerId: "admin",
    passwordHash: adminHash,
  });
  await app.do("AssignRole", { stream: "admin", actor: system }, { role: "admin" });

  // Drain reactions + projections
  for (let i = 0; i < 2; i++) {
    const { leased } = await app.correlate({ after: -1, limit: 100 });
    if (leased.length === 0) break;
    await app.drain({ streamLimit: 10, eventLimit: 100 });
  }

  console.log("Seeded dev data:");
  console.log(`  Order (published): ${order1}`);
  console.log(`  Products: ${products.map((p) => p.productId).join(", ")}`);
  console.log(`  Admin user: admin/admin`);
}

// Start server
const server = createHTTPServer({
  middleware: cors({ origin: true, credentials: true }),
  router,
  createContext,
});
server.listen(4000);

await seed();
console.log("\nAPI server running at http://localhost:4000");
