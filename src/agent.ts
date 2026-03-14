import OpenAI from "openai";
import { TOOL_DEFINITIONS } from "./tools/definitions.js";
import { ToolExecutor } from "./tools/executor.js";
import { ContextManager } from "./context/manager.js";
import { BrowserManager } from "./browser.js";
import { DomSubAgent } from "./dom/sub-agent.js";
import { printAssistant, printSystem } from "./ui/terminal.js";
import type readline from "readline";

const SYSTEM_PROMPT = `You are an autonomous AI browser agent. You control a real web browser to complete complex multi-step tasks for the user. You must be proactive, resourceful, and complete the task fully without hand-holding.

## Core loop
1. User gives you a task in natural language.
2. Break it into logical steps. Think step by step.
3. Execute each step by calling tools. After each action, observe the result.
4. Adapt based on results. If something fails, try a different approach.
5. Continue until the ENTIRE task is done, then give a clear summary.

## Speed tips
- Use query_dom (instant) to get page elements. Use analyze_page (slow) ONLY for complex analysis.
- Use click_text when you know the button text — faster than query_dom + click_element.
- Use wait with 1-2 seconds max.
- Act decisively: query_dom → find selector → click.

## Critical rules
- Call query_dom FIRST on every new page. Read its output to find selectors.
- NEVER invent CSS selectors. Use ONLY selectors from query_dom.
- If you know visible text of a button, use click_text directly.
- If a click fails: (1) click_text, (2) scroll first, (3) different selector, (4) hover then click.
- After navigation or clicks, wait 1-2s then query_dom to see new state.

## IMPORTANT: Popups, modals, overlays
- query_dom output marks active modals with "⚠️ ACTIVE MODAL/POPUP DETECTED".
- When a modal is detected, interact with it FIRST. Do NOT close or ignore it.
- Modals usually ask for important input: address, login, confirmation, location, etc.
- Fill forms, type addresses, select options — whatever the modal needs.
- Only after completing modal interaction, continue with main task.
- If you accidentally close a modal, trigger it again.

## Forms and interactions
- Search: query_dom → find input → type_text → press_key Enter.
- Buttons: query_dom → find selector → click_element. Or click_text if you know the text.
- Dropdowns: click to open → wait 1s → query_dom → click option.
- Address inputs: type address → wait for suggestions → query_dom → click suggestion.

## Strategy
- Tackle steps one at a time. Act and observe.
- If you need user credentials, use ask_user.
- After finding items, TAKE ACTION: click, add to cart, apply, etc.
- Before irreversible actions (payments, deletions), confirm with ask_user.
- Avoid exhaustive exploration: you do NOT need to view every similar item or every page of results. Once you have a few reasonable options, choose from them and act.
- Prefer shorter, more direct paths to complete the task instead of wandering around the site.
- If stuck, scroll down or use get_page_text.
- If a page requires location/address, provide it first.

## When finished
Provide a clear summary: what was accomplished, what wasn't, and why.

IMPORTANT: Respond in the same language as the user's message.`;

export class Agent {
  private client: OpenAI;
  private model: string;
  private toolExecutor: ToolExecutor;
  private contextManager: ContextManager;

  constructor(
    browser: BrowserManager,
    rl: readline.Interface,
    config: { apiKey: string; baseUrl: string; model: string; subAgentModel: string }
  ) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.model = config.model;

    const domSubAgent = new DomSubAgent(
      new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl }),
      config.subAgentModel
    );
    this.toolExecutor = new ToolExecutor(browser, domSubAgent, rl);
    this.contextManager = new ContextManager(this.client, config.subAgentModel);
  }

  async processTask(userMessage: string): Promise<void> {
    this.contextManager.addUserMessage(userMessage);

    let iterationCount = 0;
    const maxIterations = 20;

    while (iterationCount < maxIterations) {
      iterationCount++;
      await this.contextManager.compressIfNeeded();

      let response: OpenAI.ChatCompletion;
      try {
        response = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: 4096,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...this.contextManager.getMessages(),
          ],
          tools: TOOL_DEFINITIONS,
          tool_choice: "auto",
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        printSystem(`API Error: ${errMsg}`);

        if (errMsg.includes("rate") || errMsg.includes("429")) {
          printSystem("Rate limited. Waiting 10 seconds...");
          await new Promise((r) => setTimeout(r, 10000));
          continue;
        }
        break;
      }

      const message = response.choices[0]?.message;
      if (!message) break;

      this.contextManager.addAssistantMessage(message);

      if (message.content) {
        printAssistant(message.content);
      }

      const toolCalls = message.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        break;
      }

      for (const toolCall of toolCalls) {
        if (toolCall.type !== "function") continue;
        const fn = toolCall as OpenAI.ChatCompletionMessageToolCall & { type: "function"; function: { name: string; arguments: string } };

        let parsedInput: Record<string, unknown>;
        try {
          parsedInput = JSON.parse(fn.function.arguments || "{}");
        } catch {
          parsedInput = {};
        }

        const result = await this.toolExecutor.execute(
          fn.function.name,
          parsedInput
        );

        this.contextManager.addToolResult(toolCall.id, result);
      }
    }

    if (iterationCount >= maxIterations) {
      printSystem("Reached maximum iterations.");
    }
  }

  resetConversation(): void {
    this.contextManager.reset();
  }
}
