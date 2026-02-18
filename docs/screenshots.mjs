import { createRequire } from "node:module";
const require = createRequire("/tmp/");
const { chromium } = require("playwright");

const DOCS = new URL(".", import.meta.url).pathname;

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  await page.goto("http://localhost:5173");
  await page.waitForTimeout(3000);

  // 1. Shop view
  await page.screenshot({ path: `${DOCS}shop-view.png` });
  console.log("  shop-view.png");

  // 2. Add items to generate tracking events
  const addBtns = page.locator(".add-btn");
  for (let i = 0; i < 3; i++) {
    await addBtns.nth(i).click();
    await page.waitForTimeout(1000);
  }

  // 3. Cart drawer
  await page.locator(".cart-btn").click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${DOCS}cart-drawer.png` });
  console.log("  cart-drawer.png");

  // Place order
  await page.locator(".checkout-btn").click();
  await page.waitForTimeout(2500);

  // 4. Orders
  await page.locator('button.subnav-tab:has-text("Orders")').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DOCS}orders-view.png` });
  console.log("  orders-view.png");

  // 5. Admin
  await page.locator('button.subnav-tab:has-text("Admin")').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${DOCS}admin-view.png` });
  console.log("  admin-view.png");

  // 6. Marketing
  await page.locator('button.subnav-tab:has-text("Marketing")').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${DOCS}marketing-view.png` });
  console.log("  marketing-view.png");

  await browser.close();
  console.log("\nDone — screenshots in docs/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
