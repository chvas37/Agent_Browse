import type { BrowserManager } from "../browser.js";
import type { DomSubAgent } from "../dom/sub-agent.js";
import { extractPageContent, formatPageContent } from "../dom/extractor.js";
import { SecurityGuard } from "../security/guard.js";
import {
  printToolCall,
  printToolResult,
  printDomSubAgent,
  printError,
  printSecurityPrompt,
  askQuestion,
} from "../ui/terminal.js";
import type readline from "readline";

export class ToolExecutor {
  private browser: BrowserManager;
  private domSubAgent: DomSubAgent;
  private securityGuard: SecurityGuard;
  private rl: readline.Interface;

  constructor(
    browser: BrowserManager,
    domSubAgent: DomSubAgent,
    rl: readline.Interface
  ) {
    this.browser = browser;
    this.domSubAgent = domSubAgent;
    this.securityGuard = new SecurityGuard();
    this.rl = rl;
  }

  async execute(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<string> {
    printToolCall(toolName, toolInput);

    try {
      const securityCheck = this.securityGuard.checkAction(toolName, toolInput);
      if (securityCheck.requiresConfirmation) {
        printSecurityPrompt(securityCheck.reason!);
        const answer = await askQuestion(
          this.rl,
          "  Allow this action? (yes/no): "
        );
        if (answer.toLowerCase() !== "yes" && answer.toLowerCase() !== "y") {
          const result = `Action blocked by user: ${securityCheck.reason}`;
          printToolResult(result);
          return result;
        }
      }

      let result: string;

      switch (toolName) {
        case "navigate_to_url":
          result = await this.browser.navigateTo(toolInput.url as string);
          break;

        case "click_element":
          result = await this.browser.clickElement(toolInput.selector as string);
          break;

        case "type_text":
          result = await this.browser.typeText(
            toolInput.selector as string,
            toolInput.text as string
          );
          break;

        case "press_key":
          result = await this.browser.pressKey(toolInput.key as string);
          break;

        case "take_screenshot":
          result = await this.browser.takeScreenshot(
            (toolInput.full_page as boolean) || false
          );
          break;

        case "query_dom": {
          printDomSubAgent("Extracting page elements...");
          const activePage = await this.browser.getActivePage();
          const content = await extractPageContent(activePage);
          result = formatPageContent(content);
          this.securityGuard.setDomContext(result);
          break;
        }

        case "analyze_page": {
          printDomSubAgent("Processing query with sub-agent...");
          const pageForAnalysis = await this.browser.getActivePage();
          result = await this.domSubAgent.query(
            pageForAnalysis,
            toolInput.query as string
          );
          this.securityGuard.setDomContext(result);
          break;
        }

        case "scroll_page":
          result = await this.browser.scrollPage(
            toolInput.direction as "up" | "down",
            (toolInput.amount as number) || 500
          );
          break;

        case "wait": {
          const raw = Number(toolInput.seconds);
          const seconds = Number.isFinite(raw) ? raw : 1;
          const clamped = Math.max(1, Math.min(seconds, 3));
          result = await this.browser.waitFor(clamped);
          break;
        }

        case "go_back":
          result = await this.browser.goBack();
          break;

        case "hover_element":
          result = await this.browser.hoverElement(toolInput.selector as string);
          break;

        case "get_page_text":
          result = await this.browser.getPageText();
          break;

        case "click_text":
          result = await this.browser.clickByText(toolInput.text as string);
          break;

        case "ask_user": {
          const answer = await askQuestion(
            this.rl,
            `\n  Agent asks: ${toolInput.question}\n  Your answer: `
          );
          result = `User responded: ${answer}`;
          break;
        }

        default:
          result = `Unknown tool: ${toolName}`;
      }

      printToolResult(result);
      return result;
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : String(error);
      const result = `Error executing ${toolName}: ${errMsg}`;
      printError(result);
      return result;
    }
  }
}
