interface SecurityCheckResult {
  requiresConfirmation: boolean;
  reason?: string;
}

const DESTRUCTIVE_URL_PATTERNS = [
  /pay/i, /checkout/i, /order.*confirm/i, /purchase/i,
  /delete/i, /remove/i, /cancel.*subscription/i,
  /оплат/i, /заказ.*подтвер/i, /покупк/i, /удалени/i, /отмен.*подписк/i,
];

const DESTRUCTIVE_SELECTOR_PATTERNS = [
  /pay/i, /buy/i, /purchase/i, /checkout/i, /submit.*order/i,
  /delete/i, /remove.*all/i, /confirm.*payment/i,
  /оплатить/i, /купить/i, /заказать/i, /удалить/i, /подтвердить.*оплат/i,
  /отправить.*заказ/i, /оформить/i,
];

export class SecurityGuard {
  private recentDomContext: string = "";

  setDomContext(context: string): void {
    this.recentDomContext = context;
  }

  checkAction(
    toolName: string,
    toolInput: Record<string, unknown>
  ): SecurityCheckResult {
    if (toolName === "navigate_to_url") {
      const url = (toolInput.url as string) || "";
      for (const pattern of DESTRUCTIVE_URL_PATTERNS) {
        if (pattern.test(url)) {
          return {
            requiresConfirmation: true,
            reason: `Navigating to potentially sensitive URL: ${url}`,
          };
        }
      }
    }

    if (toolName === "click_element") {
      const selector = (toolInput.selector as string) || "";

      for (const pattern of DESTRUCTIVE_SELECTOR_PATTERNS) {
        if (pattern.test(selector)) {
          return {
            requiresConfirmation: true,
            reason: `Clicking potentially destructive element: ${selector}`,
          };
        }
      }

      if (this.recentDomContext) {
        const selectorInContext = this.findElementTextInContext(selector);
        if (selectorInContext) {
          for (const pattern of DESTRUCTIVE_SELECTOR_PATTERNS) {
            if (pattern.test(selectorInContext)) {
              return {
                requiresConfirmation: true,
                reason: `Clicking element with destructive text "${selectorInContext}": ${selector}`,
              };
            }
          }
        }
      }
    }

    return { requiresConfirmation: false };
  }

  private findElementTextInContext(selector: string): string | null {
    const lines = this.recentDomContext.split("\n");
    for (const line of lines) {
      if (line.includes(selector)) {
        const textMatch = line.match(/"([^"]+)"/);
        if (textMatch) return textMatch[1];
      }
    }
    return null;
  }
}
