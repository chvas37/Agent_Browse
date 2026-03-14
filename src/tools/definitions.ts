import type OpenAI from "openai";

export const TOOL_DEFINITIONS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "navigate_to_url",
      description: "Navigate the browser to a specific URL.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full URL to navigate to" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "click_element",
      description: "Click on a page element using a CSS selector. Use query_dom first to find the right selector.",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector of the element" },
        },
        required: ["selector"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "type_text",
      description: "Type text into an input field. Clicks the element first, then fills it.",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector of the input" },
          text: { type: "string", description: "Text to type" },
        },
        required: ["selector", "text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "press_key",
      description: "Press a keyboard key (Enter, Escape, Tab, ArrowDown, Backspace).",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Key to press" },
        },
        required: ["key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "take_screenshot",
      description: "Take a screenshot of the current page.",
      parameters: {
        type: "object",
        properties: {
          full_page: { type: "boolean", description: "Capture full page or viewport. Default: false" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_dom",
      description: "FAST: Get all interactive elements on the page with CSS selectors. Use this FIRST on every new page. Returns raw data instantly, no AI call.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_page",
      description: "SLOW: Ask an AI sub-agent a complex question about the page. Only use when query_dom alone can't answer your question.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Complex question about page content" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scroll_page",
      description: "Scroll the page up or down.",
      parameters: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["up", "down"], description: "Scroll direction" },
          amount: { type: "number", description: "Pixels to scroll. Default: 500" },
        },
        required: ["direction"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wait",
      description: "Wait for specified seconds. Use after actions that trigger page loads.",
      parameters: {
        type: "object",
        properties: {
          seconds: { type: "number", description: "Seconds to wait (1-30)" },
        },
        required: ["seconds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "go_back",
      description: "Navigate back to the previous page.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "hover_element",
      description: "Hover over an element. Useful for dropdown menus.",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector" },
        },
        required: ["selector"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_page_text",
      description: "Get visible text content of the page. Fallback when query_dom fails.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "click_text",
      description: "Click element by its visible text. Faster than query_dom + click_element when you know the button text.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Visible text of the element to click" },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_user",
      description: "Ask the user a question when you need info, clarification, or confirmation.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "Question to ask" },
        },
        required: ["question"],
      },
    },
  },
];
