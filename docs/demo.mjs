import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdtempSync, cpSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DOCS = new URL(".", import.meta.url).pathname;
const BASE = "http://localhost:5173";

/** Short pause for UI transitions */
const brief = (ms = 300) => new Promise((r) => setTimeout(r, ms));

/** Record a video in a fresh browser context, return the webm path */
async function record(browser, name, fn) {
  const videoDir = mkdtempSync(join(tmpdir(), `demo-${name}-`));
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
  });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForTimeout(1500);

  await fn(page);

  await ctx.close();

  const files = readdirSync(videoDir).filter((f) => f.endsWith(".webm"));
  if (!files.length) throw new Error(`No video generated for ${name}`);
  const webm = join(videoDir, files[0]);
  const mp4 = join(DOCS, `${name}.mp4`);
  execSync(
    `ffmpeg -y -i "${webm}" -vf "setpts=0.5*PTS" -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart -an "${mp4}"`,
    { stdio: "pipe" }
  );
  rmSync(videoDir, { recursive: true });
  console.log(`  ${name}.mp4 ready`);
}

async function main() {
  const browser = await chromium.launch();

  // ── Video 1 — User flow (Alice) ─────────────────────────
  await record(browser, "demo-user", async (page) => {
    // Browse shop
    console.log("  [user] Browsing shop...");
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: "smooth" }));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await brief(500);

    // Search "kettle"
    console.log("  [user] Searching for kettle...");
    await page.locator(".header-search input").fill("kettle");
    await page.waitForTimeout(1000);
    await page.locator(".search-clear").click();
    await brief(400);

    // Filter by "Beans" category
    console.log("  [user] Filtering by Beans...");
    await page.locator(".header-search select").selectOption("Beans");
    await page.waitForTimeout(1000);
    await page.locator(".header-search select").selectOption("All");
    await brief(400);

    // Add 3 items to cart
    console.log("  [user] Adding items to cart...");
    const addBtns = page.locator(".add-btn");
    for (let i = 0; i < 3; i++) {
      await addBtns.nth(i).click();
      await brief(500);
    }

    // Open cart drawer
    console.log("  [user] Opening cart drawer...");
    await page.locator(".cart-btn").click();
    await page.waitForTimeout(800);

    // Close drawer, sign up
    await page.locator(".drawer-close").click();
    await brief(400);

    console.log("  [user] Signing up as Alice...");
    await page.locator(".sign-in-btn").click();
    await brief(400);
    await page.locator(".auth-modal-toggle button").click();
    await brief(300);
    await page.locator('.auth-modal-input[placeholder="Username"]').fill("alice");
    await brief(150);
    await page.locator('.auth-modal-input[placeholder="Display name"]').fill("Alice");
    await brief(150);
    await page.locator('.auth-modal-input[placeholder="Password"]').fill("alice123");
    await brief(200);
    await page.locator(".auth-modal-submit").click();
    await page.waitForTimeout(1000);

    // Place order
    console.log("  [user] Placing order...");
    await page.locator(".cart-btn").click();
    await brief(500);
    await page.locator(".checkout-btn").click();
    await page.waitForTimeout(2000);

    // Orders tab
    console.log("  [user] Viewing orders...");
    await page.locator('button.subnav-tab:has-text("Orders")').click();
    await page.waitForTimeout(1200);
  });

  // ── Video 2 — Admin flow ────────────────────────────────
  await record(browser, "demo-admin", async (page) => {
    // Sign in as admin
    console.log("  [admin] Signing in...");
    await page.locator(".sign-in-btn").click();
    await brief(400);
    await page.locator('.auth-modal-input[placeholder="Username"]').fill("admin");
    await brief(150);
    await page.locator('.auth-modal-input[placeholder="Password"]').fill("admin");
    await brief(200);
    await page.locator(".auth-modal-submit").click();
    await page.waitForTimeout(1000);

    // Add items and place order
    console.log("  [admin] Adding items and placing order...");
    const addBtns = page.locator(".add-btn");
    for (let i = 0; i < 3; i++) {
      await addBtns.nth(i).click();
      await brief(400);
    }
    await page.locator(".cart-btn").click();
    await brief(500);
    await page.locator(".checkout-btn").click();
    await page.waitForTimeout(2000);

    // Orders tab — all orders
    console.log("  [admin] Viewing all orders...");
    await page.locator('button.subnav-tab:has-text("Orders")').click();
    await page.waitForTimeout(1200);

    // Admin tab — inventory manager
    console.log("  [admin] Inventory management...");
    await page.locator('button.subnav-tab:has-text("Admin")').click();
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const wrap = document.querySelector(".admin-table-wrap");
      if (wrap) wrap.scrollTo({ top: 400, behavior: "smooth" });
    });
    await page.waitForTimeout(800);

    // Adjust a price
    const firstPriceInput = page.locator(".admin-input").first();
    await firstPriceInput.fill("42.99");
    await brief(300);
    await page.locator(".admin-update-btn").first().click();
    await page.waitForTimeout(1000);

    // Marketing tab
    console.log("  [admin] Marketing analytics...");
    await page.locator('button.subnav-tab:has-text("Marketing")').click();
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: "smooth" }));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await page.waitForTimeout(600);
  });

  await browser.close();
  console.log("\nDone — videos saved to docs/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
