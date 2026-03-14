import OpenAI from "openai";
import type { Page } from "playwright";
import { extractPageContent, formatPageContent } from "./extractor.js";

export class DomSubAgent {
  private client: OpenAI;
  private model: string;

  constructor(client: OpenAI, model: string) {
    this.client = client;
    this.model = model;
  }

  async query(page: Page, question: string): Promise<string> {
    const content = await extractPageContent(page);
    const formatted = formatPageContent(content);

    const systemPrompt = `You are a DOM analysis sub-agent. You analyze web page content and answer questions about page structure, elements, and their CSS selectors.

Rules:
- ALWAYS provide exact CSS selectors. Format: selector → description
- Be precise and actionable
- List the top 3-5 most relevant elements
- For buttons/links, include both selector AND visible text
- Respond in the same language as the question
- If no elements found, suggest scrolling or alternative approaches`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 1500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Page content:\n\n${formatted}\n\nQuestion: ${question}` },
        ],
      });

      return response.choices[0]?.message?.content || "No analysis available.";
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const elemSummary = content.elements.slice(0, 30).map(
        (el) => `[${el.index}] <${el.tag}> "${el.text}" → ${el.selector}`
      ).join("\n");
      return `DOM sub-agent error: ${errMsg}. Raw content:\n\nPage: ${content.title}\nURL: ${content.url}\n\nElements:\n${elemSummary}\n\nText:\n${content.textContent.slice(0, 2000)}`;
    }
  }
}
