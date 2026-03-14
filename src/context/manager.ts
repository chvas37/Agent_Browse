import type OpenAI from "openai";

type Message = OpenAI.ChatCompletionMessageParam;

const MAX_MESSAGES = 40;
const SUMMARIZE_THRESHOLD = 25;

export class ContextManager {
  private messages: Message[] = [];
  private client: OpenAI;
  private model: string;

  constructor(client: OpenAI, model: string) {
    this.client = client;
    this.model = model;
  }

  getMessages(): Message[] {
    return this.messages;
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: "user", content });
  }

  addAssistantMessage(message: OpenAI.ChatCompletionMessage): void {
    const msg: Message = {
      role: "assistant",
      content: message.content || "",
    };
    if (message.tool_calls && message.tool_calls.length > 0) {
      (msg as OpenAI.ChatCompletionAssistantMessageParam).tool_calls = message.tool_calls;
    }
    this.messages.push(msg);
  }

  addToolResult(toolCallId: string, result: string): void {
    this.messages.push({
      role: "tool",
      tool_call_id: toolCallId,
      content: result,
    });
  }

  async compressIfNeeded(): Promise<void> {
    if (this.messages.length < SUMMARIZE_THRESHOLD) return;

    const recentMessages = this.messages.slice(-14);
    const oldMessages = this.messages.slice(0, -14);

    try {
      const summaryText = oldMessages
        .map((m) => {
          if (typeof m.content === "string") return `[${m.role}]: ${m.content?.slice(0, 200)}`;
          return `[${m.role}]`;
        })
        .join("\n");

      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 500,
        messages: [
          { role: "system", content: "Summarize this conversation history concisely. Preserve key actions and results." },
          { role: "user", content: summaryText.slice(0, 4000) },
        ],
      });

      const summary = response.choices[0]?.message?.content || "Previous conversation summarized.";

      this.messages = [
        { role: "user", content: `[Previous conversation summary: ${summary}]` },
        { role: "assistant", content: "Understood, continuing the task." },
        ...recentMessages,
      ];
    } catch {
      if (this.messages.length > MAX_MESSAGES) {
        this.messages = this.messages.slice(-20);
      }
    }
  }

  reset(): void {
    this.messages = [];
  }
}
