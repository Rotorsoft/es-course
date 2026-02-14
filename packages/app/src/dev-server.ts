import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { app } from "@rotorsoft/es-course-domain";
import type { Target } from "@rotorsoft/act";
import { router } from "./api/index.js";

// Seed data for UI development
async function seed() {
  const system: Target["actor"] = { id: "seed", name: "Seed Script" };

  // --- Inventory for 5 products ---
  const products = [
    { productId: "prod-espresso", name: "Espresso Machine", price: "299.99", description: "Professional 15-bar pressure", inventory: 12 },
    { productId: "prod-grinder", name: "Burr Grinder", price: "89.50", description: "40mm conical burrs, 18 settings", inventory: 25 },
    { productId: "prod-kettle", name: "Gooseneck Kettle", price: "54.00", description: "Temperature control, 1.2L", inventory: 40 },
    { productId: "prod-scale", name: "Precision Scale", price: "34.95", description: "0.1g accuracy, timer built-in", inventory: 60 },
    { productId: "prod-filters", name: "Paper Filters (100pk)", price: "12.00", description: "Unbleached, fits V60 & Chemex", inventory: 200 },
  ];

  for (const p of products) {
    await app.do("ChangePrice", { stream: p.productId, actor: system }, { productId: p.productId, price: parseFloat(p.price) });
    await app.do("ImportInventory", { stream: p.productId, actor: system }, { productId: p.productId, inventory: p.inventory });
  }

  // --- Cart 1: has 2 items, still open ---
  const cart1 = crypto.randomUUID();
  await app.do("AddItem", { stream: cart1, actor: system }, {
    itemId: crypto.randomUUID(), productId: "prod-espresso",
    name: "Espresso Machine", description: "Professional 15-bar pressure", price: "299.99",
  });
  await app.do("AddItem", { stream: cart1, actor: system }, {
    itemId: crypto.randomUUID(), productId: "prod-grinder",
    name: "Burr Grinder", description: "40mm conical burrs, 18 settings", price: "89.50",
  });

  // --- Cart 2: has 3 items (full), still open ---
  const cart2 = crypto.randomUUID();
  await app.do("AddItem", { stream: cart2, actor: system }, {
    itemId: crypto.randomUUID(), productId: "prod-kettle",
    name: "Gooseneck Kettle", description: "Temperature control, 1.2L", price: "54.00",
  });
  await app.do("AddItem", { stream: cart2, actor: system }, {
    itemId: crypto.randomUUID(), productId: "prod-scale",
    name: "Precision Scale", description: "0.1g accuracy, timer built-in", price: "34.95",
  });
  await app.do("AddItem", { stream: cart2, actor: system }, {
    itemId: crypto.randomUUID(), productId: "prod-filters",
    name: "Paper Filters (100pk)", description: "Unbleached, fits V60 & Chemex", price: "12.00",
  });

  // --- Cart 3: submitted + published ---
  const cart3 = crypto.randomUUID();
  await app.do("AddItem", { stream: cart3, actor: system }, {
    itemId: crypto.randomUUID(), productId: "prod-espresso",
    name: "Espresso Machine", description: "Professional 15-bar pressure", price: "299.99",
  });
  await app.do("SubmitCart", { stream: cart3, actor: system }, {});
  await app.correlate({ after: -1, limit: 100 });
  await app.drain({ streamLimit: 10, eventLimit: 100 });

  console.log("Seeded dev data:");
  console.log(`  Cart 1 (open, 2 items):  ${cart1}`);
  console.log(`  Cart 2 (open, 3 items):  ${cart2}`);
  console.log(`  Cart 3 (published):      ${cart3}`);
  console.log(`  Products: ${products.map((p) => p.productId).join(", ")}`);
}

// Start server
const server = createHTTPServer({ middleware: cors(), router });
server.listen(4000);

await seed();
console.log("\nAPI server running at http://localhost:4000");
