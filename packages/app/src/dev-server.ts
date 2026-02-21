import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { app, systemActor } from "@rotorsoft/es-course-domain";
import { router, createContext } from "./api/index.js";
import { hashPassword } from "./api/auth.js";

// Seed data for UI development
async function seed() {
  const system = { ...systemActor, name: "Seed Script" };

  // --- Inventory for 50 products ---
  const products = [
    // Espresso
    { productId: "prod-espresso", name: "Espresso Machine", price: 299.99, inventory: 12 },
    { productId: "prod-espresso-compact", name: "Compact Espresso Maker", price: 149.99, inventory: 18 },
    { productId: "prod-portafilter", name: "Bottomless Portafilter", price: 45.0, inventory: 30 },
    { productId: "prod-tamper", name: "Calibrated Tamper", price: 39.95, inventory: 35 },
    { productId: "prod-dist-tool", name: "Distribution Tool", price: 29.99, inventory: 40 },
    // Brewing
    { productId: "prod-v60", name: "V60 Dripper", price: 28.0, inventory: 50 },
    { productId: "prod-chemex", name: "Chemex Classic", price: 47.5, inventory: 20 },
    { productId: "prod-aeropress", name: "AeroPress Original", price: 34.95, inventory: 45 },
    { productId: "prod-french-press", name: "French Press", price: 32.0, inventory: 30 },
    { productId: "prod-moka-pot", name: "Moka Pot", price: 38.0, inventory: 25 },
    { productId: "prod-cold-brew", name: "Cold Brew Maker", price: 27.5, inventory: 35 },
    { productId: "prod-siphon", name: "Siphon Brewer", price: 89.0, inventory: 8 },
    // Grinders
    { productId: "prod-grinder", name: "Burr Grinder", price: 89.5, inventory: 25 },
    { productId: "prod-hand-grinder", name: "Hand Grinder", price: 64.0, inventory: 30 },
    { productId: "prod-grinder-pro", name: "Pro Flat Burr Grinder", price: 249.0, inventory: 10 },
    { productId: "prod-grinder-travel", name: "Travel Grinder", price: 42.0, inventory: 20 },
    { productId: "prod-single-dose", name: "Single Dose Hopper", price: 24.99, inventory: 40 },
    // Kettles
    { productId: "prod-kettle", name: "Gooseneck Kettle", price: 54.0, inventory: 40 },
    { productId: "prod-kettle-stovetop", name: "Stovetop Kettle", price: 38.0, inventory: 25 },
    { productId: "prod-kettle-mini", name: "Mini Travel Kettle", price: 29.99, inventory: 30 },
    { productId: "prod-kettle-temp", name: "Variable Temp Kettle", price: 79.0, inventory: 15 },
    // Accessories
    { productId: "prod-scale", name: "Precision Scale", price: 34.95, inventory: 60 },
    { productId: "prod-filters", name: "Paper Filters (100pk)", price: 12.0, inventory: 200 },
    { productId: "prod-thermometer", name: "Milk Thermometer", price: 14.5, inventory: 50 },
    { productId: "prod-milk-pitcher", name: "Milk Frothing Pitcher", price: 18.99, inventory: 45 },
    { productId: "prod-knock-box", name: "Knock Box", price: 22.0, inventory: 35 },
    { productId: "prod-drip-tray", name: "Drip Tray", price: 16.5, inventory: 40 },
    { productId: "prod-dosing-cup", name: "Dosing Cup", price: 19.99, inventory: 30 },
    // Beans
    { productId: "prod-beans-ethiopia", name: "Ethiopian Yirgacheffe", price: 19.99, inventory: 80 },
    { productId: "prod-beans-colombia", name: "Colombian Supremo", price: 17.5, inventory: 90 },
    { productId: "prod-beans-brazil", name: "Brazilian Santos", price: 15.99, inventory: 100 },
    { productId: "prod-beans-guatemala", name: "Guatemalan Antigua", price: 21.0, inventory: 60 },
    { productId: "prod-beans-kenya", name: "Kenyan AA", price: 23.5, inventory: 50 },
    { productId: "prod-beans-espresso-blend", name: "Espresso Blend", price: 18.0, inventory: 75 },
    { productId: "prod-beans-decaf", name: "Swiss Water Decaf", price: 20.0, inventory: 40 },
    { productId: "prod-beans-sumatra", name: "Sumatran Mandheling", price: 22.0, inventory: 55 },
    // Cups & Mugs
    { productId: "prod-espresso-cup", name: "Espresso Cup Set", price: 24.99, inventory: 25 },
    { productId: "prod-latte-mug", name: "Latte Mug", price: 16.0, inventory: 40 },
    { productId: "prod-travel-mug", name: "Insulated Travel Mug", price: 28.5, inventory: 35 },
    { productId: "prod-cappuccino-cup", name: "Cappuccino Cup Set", price: 32.0, inventory: 20 },
    { productId: "prod-keep-cup", name: "Reusable KeepCup", price: 21.0, inventory: 30 },
    // Cleaning
    { productId: "prod-cleaner-tablets", name: "Cleaning Tablets", price: 9.99, inventory: 100 },
    { productId: "prod-descaler", name: "Descaling Solution", price: 11.5, inventory: 80 },
    { productId: "prod-group-brush", name: "Group Head Brush", price: 8.5, inventory: 60 },
    { productId: "prod-grinder-cleaner", name: "Grinder Cleaning Pellets", price: 12.99, inventory: 70 },
    { productId: "prod-micro-cloth", name: "Microfiber Cloth Set", price: 7.99, inventory: 90 },
    // Storage
    { productId: "prod-canister", name: "Airtight Canister", price: 26.0, inventory: 35 },
    { productId: "prod-canister-glass", name: "Glass Storage Jar", price: 18.0, inventory: 45 },
    { productId: "prod-vacuum-canister", name: "Vacuum Canister", price: 34.0, inventory: 20 },
    { productId: "prod-bean-cellar", name: "Single Dose Bean Cellar", price: 44.99, inventory: 15 },
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
  for (let i = 0; i < 3; i++) {
    const { leased } = await app.correlate({ after: -1, limit: 500 });
    if (leased.length === 0) break;
    await app.drain({ streamLimit: 100, eventLimit: 500 });
  }

  console.log("Seeded dev data:");
  console.log(`  Order (published): ${order1}`);
  console.log(`  Products: ${products.length} seeded`);
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
