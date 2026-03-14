import readline from "readline";

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  white: "\x1b[37m",
};

function c(color: keyof typeof COLORS, text: string): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

export function printUser(text: string): void {
  console.log(`\n${c("yellow", c("bright", "You:"))} ${text}`);
}

export function printAssistant(text: string): void {
  console.log(`${c("green", c("bright", "Assistant:"))} ${text}`);
}

export function printToolCall(name: string, input: Record<string, unknown>): void {
  console.log(`  ${c("cyan", "Using tool:")} ${c("bright", name)}`);
  console.log(`    ${c("gray", "Input:")} ${c("gray", JSON.stringify(input, null, 2).replace(/\n/g, "\n    "))}`);
}

export function printToolResult(result: string): void {
  const truncated = result.length > 500 ? result.slice(0, 500) + "..." : result;
  console.log(`    ${c("gray", "Result:")} ${truncated}`);
}

export function printError(text: string): void {
  console.log(`  ${c("red", "Error:")} ${text}`);
}

export function printSystem(text: string): void {
  console.log(`${c("magenta", text)}`);
}

export function printDomSubAgent(text: string): void {
  console.log(`    ${c("blue", "DOM Sub-agent:")} ${text}`);
}

export function printSecurityPrompt(action: string): void {
  console.log(`\n  ${c("red", c("bright", "⚠ Security:"))} ${action}`);
}

export function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

export function askQuestion(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`${c("yellow", c("bright", prompt))} `, (answer) => {
      resolve(answer.trim());
    });
  });
}

export function printBanner(): void {
  console.log(c("cyan", "╔══════════════════════════════════════════════════╗"));
  console.log(c("cyan", "║") + c("bright", "        AI Browser Agent                        ") + c("cyan", "║"));
  console.log(c("cyan", "║") + c("gray", "  Autonomous browser automation with AI          ") + c("cyan", "║"));
  console.log(c("cyan", "╚══════════════════════════════════════════════════╝"));
  console.log();
  console.log(c("gray", "  Type your task and press Enter. Type 'exit' to quit."));
  console.log(c("gray", "  The browser window will open automatically."));
  console.log();
}
