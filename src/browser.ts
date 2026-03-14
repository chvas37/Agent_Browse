import { chromium, type BrowserContext, type Page } from "playwright";
import path from "path";
import fs from "fs";

const BROWSER_DATA_DIR = path.join(process.cwd(), "browser-data");
const SCREENSHOTS_DIR = path.join(process.cwd(), "screenshots");

export class BrowserManager {
  private context: BrowserContext | null = null;
  private _page: Page | null = null;

  get page(): Page {
    if (!this._page || this._page.isClosed()) {
      throw new Error("Page is closed. Will auto-relaunch.");
    }
    return this._page;
  }

  async getActivePage(): Promise<Page> {
    return this.ensurePage();
  }

  private async ensurePage(): Promise<Page> {
    if (this._page && !this._page.isClosed()) return this._page;

    // Context might still be alive but page closed
    if (this.context) {
      try {
        const pages = this.context.pages();
        if (pages.length > 0) {
          this._page = pages[0];
          return this._page;
        }
        this._page = await this.context.newPage();
        return this._page;
      } catch {
        // Context is also dead — relaunch everything
      }
    }

    await this.launch();
    return this._page!;
  }

  async launch(): Promise<void> {
    fs.mkdirSync(BROWSER_DATA_DIR, { recursive: true });
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

    // Close old context if any
    if (this.context) {
      try { await this.context.close(); } catch { /* already closed */ }
    }

    this.context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: false,
      viewport: { width: 1280, height: 900 },
      locale: "ru-RU",
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
      ],
    });

    const pages = this.context.pages();
    this._page = pages.length > 0 ? pages[0] : await this.context.newPage();

    this.context.on("page", (newPage) => {
      this._page = newPage;
    });
  }

  async navigateTo(url: string): Promise<string> {
    const p = await this.ensurePage();
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await p.waitForTimeout(1000);
    return `Successfully navigated to ${p.url()}`;
  }

  async clickElement(selector: string): Promise<string> {
    const p = await this.ensurePage();
    try {
      await p.click(selector, { timeout: 5000 });
      return `Clicked element: ${selector}`;
    } catch {
      const el = p.locator(selector).first();
      await el.scrollIntoViewIfNeeded();
      await el.click({ force: true });
      return `Clicked element (force): ${selector}`;
    }
  }

  async typeText(selector: string, text: string): Promise<string> {
    const p = await this.ensurePage();
    await p.click(selector, { timeout: 5000 });
    await p.fill(selector, text);
    return `Typed text into: ${selector}`;
  }

  async pressKey(key: string): Promise<string> {
    const p = await this.ensurePage();
    await p.keyboard.press(key);
    return `Pressed key: ${key}`;
  }

  async hoverElement(selector: string): Promise<string> {
    const p = await this.ensurePage();
    await p.hover(selector, { timeout: 5000 });
    return `Hovered over: ${selector}`;
  }

  async scrollPage(direction: "up" | "down", amount: number = 500): Promise<string> {
    const p = await this.ensurePage();
    const delta = direction === "down" ? amount : -amount;
    await p.mouse.wheel(0, delta);
    await p.waitForTimeout(300);
    return `Scrolled ${direction} by ${amount}px`;
  }

  async goBack(): Promise<string> {
    const p = await this.ensurePage();
    await p.goBack({ waitUntil: "domcontentloaded" });
    return `Navigated back to ${p.url()}`;
  }

  async takeScreenshot(fullPage: boolean = false): Promise<string> {
    const p = await this.ensurePage();
    const filename = `screenshot-${Date.now()}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    await p.screenshot({ path: filepath, fullPage });
    return `Screenshot saved as ${filename}`;
  }

  async waitFor(seconds: number): Promise<string> {
    const p = await this.ensurePage();
    await p.waitForTimeout(seconds * 1000);
    return `Waited for ${seconds} seconds`;
  }

  async getPageText(): Promise<string> {
    const p = await this.ensurePage();
    const text = await p.evaluate(`
      (function() {
        try { return (document.body.innerText || '').slice(0, 8000); } catch(e) { return ''; }
      })()
    `);
    const url = p.url();
    const title = await p.title();
    return `Page: ${title}\nURL: ${url}\n\n${text}`;
  }

  async clickByText(text: string): Promise<string> {
    const p = await this.ensurePage();
    const strategies = [
      () => p.getByRole("button", { name: text }).first().click({ timeout: 3000 }),
      () => p.getByRole("link", { name: text }).first().click({ timeout: 3000 }),
      () => p.getByText(text, { exact: false }).first().click({ timeout: 3000 }),
      () => p.locator(`button:has-text("${text}")`).first().click({ timeout: 3000 }),
      () => p.locator(`a:has-text("${text}")`).first().click({ timeout: 3000 }),
      () => p.locator(`[role="button"]:has-text("${text}")`).first().click({ timeout: 3000 }),
    ];

    for (const strategy of strategies) {
      try {
        await strategy();
        return `Clicked element with text: "${text}"`;
      } catch {
        continue;
      }
    }

    // Scroll and retry
    await p.mouse.wheel(0, 300);
    await p.waitForTimeout(500);
    try {
      await p.getByText(text, { exact: false }).first().click({ timeout: 3000 });
      return `Clicked element with text (after scroll): "${text}"`;
    } catch {
      throw new Error(`Could not find clickable element with text: "${text}"`);
    }
  }

  async getPageUrl(): Promise<string> {
    const p = await this.ensurePage();
    return p.url();
  }

  async getPageTitle(): Promise<string> {
    const p = await this.ensurePage();
    return p.title();
  }

  async close(): Promise<void> {
    if (this.context) {
      try { await this.context.close(); } catch { /* ok */ }
      this.context = null;
      this._page = null;
    }
  }
}
