import dotenv from "dotenv";
dotenv.config();

import { BrowserManager } from "./browser.js";
import { Agent } from "./agent.js";
import {
  printBanner,
  printUser,
  printSystem,
  createReadline,
  askQuestion,
} from "./ui/terminal.js";

async function main(): Promise<void> {
  const apiKey = process.env.API_KEY;
  const baseUrl = process.env.API_BASE_URL || "https://api.z.ai/api/paas/v4";
  const model = process.env.MODEL_NAME || "glm-4.7-flash";
  const subAgentModel = process.env.SUB_AGENT_MODEL || "glm-4.7-flash";

  if (!apiKey) {
    console.error("Error: API_KEY is not set in .env file");
    process.exit(1);
  }

  printBanner();
  printSystem(`Model: ${model}`);
  printSystem(`API: ${baseUrl}`);
  printSystem("Launching browser...");

  const browser = new BrowserManager();
  await browser.launch();

  printSystem("Browser ready. You can log in manually if needed.");
  printSystem("Type your task below.\n");

  const rl = createReadline();
  const agent = new Agent(browser, rl, {
    apiKey,
    baseUrl,
    model,
    subAgentModel,
  });

  const processInput = async (): Promise<void> => {
    while (true) {
      const input = await askQuestion(rl, "\nYou: ");

      if (!input) continue;

      if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
        printSystem("Shutting down...");
        break;
      }

      if (input.toLowerCase() === "reset") {
        agent.resetConversation();
        printSystem("Conversation reset.");
        continue;
      }

      printUser(input);

      try {
        await agent.processTask(input);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        printSystem(`Error: ${errMsg}`);
      }
    }
  };

  try {
    await processInput();
  } finally {
    rl.close();
    await browser.close();
    printSystem("Goodbye!");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
