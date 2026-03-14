import type { Page } from "playwright";

export interface ExtractedElement {
  index: number;
  tag: string;
  role: string;
  text: string;
  selector: string;
  attributes: Record<string, string>;
  inModal: boolean;
}

export interface PageContent {
  url: string;
  title: string;
  elements: ExtractedElement[];
  textContent: string;
  hasModal: boolean;
  modalText: string;
}

const MAX_TEXT_LENGTH = 8000;
const MAX_ELEMENTS = 150;

const EXTRACT_SCRIPT = `
(function(maxElements) {
  var getUniqueSelector = function(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    var tag = el.tagName.toLowerCase();
    var testid = el.getAttribute('data-testid');
    if (testid) return '[data-testid="' + testid + '"]';
    var name = el.getAttribute('name');
    if (name) return tag + '[name="' + name + '"]';
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return '[aria-label="' + ariaLabel.replace(/"/g, '\\\\"') + '"]';
    if (tag === 'a') {
      var href = el.getAttribute('href');
      if (href && href.length < 80) return 'a[href="' + CSS.escape(href) + '"]';
    }
    if (tag === 'input') {
      var inputName = el.getAttribute('name');
      if (inputName) return 'input[name="' + inputName + '"]';
      var type = el.getAttribute('type');
      if (type) return 'input[type="' + type + '"]';
    }
    var parent = el.parentElement;
    if (!parent) return tag;
    var siblings = Array.from(parent.children).filter(function(c) { return c.tagName === el.tagName; });
    if (siblings.length === 1) {
      return getUniqueSelector(parent) + ' > ' + tag;
    }
    var idx = siblings.indexOf(el) + 1;
    return getUniqueSelector(parent) + ' > ' + tag + ':nth-child(' + idx + ')';
  };

  var isVisible = function(el) {
    try {
      var style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (style.opacity === '0') return false;
      var rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch(e) { return false; }
  };

  var getVisibleText = function(el) {
    return (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 100);
  };

  // Detect modals/popups/overlays
  var modalSelectors = [
    '[role="dialog"]', '[role="alertdialog"]', '[aria-modal="true"]',
    '.modal', '.popup', '.overlay', '.drawer', '.dialog',
    '[class*="modal"]', '[class*="popup"]', '[class*="overlay"]',
    '[class*="dialog"]', '[class*="drawer"]', '[class*="bottomsheet"]',
    '[class*="Modal"]', '[class*="Popup"]', '[class*="Overlay"]',
    '[class*="Dialog"]', '[class*="Drawer"]', '[class*="BottomSheet"]'
  ];

  var modalElements = [];
  var modalText = '';
  var hasModal = false;

  for (var m = 0; m < modalSelectors.length; m++) {
    var modals = document.querySelectorAll(modalSelectors[m]);
    for (var mi = 0; mi < modals.length; mi++) {
      var modal = modals[mi];
      if (isVisible(modal)) {
        hasModal = true;
        modalElements.push(modal);
        var mt = (modal.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 2000);
        if (mt.length > modalText.length) modalText = mt;
      }
    }
  }

  var isInsideModal = function(el) {
    for (var mi = 0; mi < modalElements.length; mi++) {
      if (modalElements[mi].contains(el)) return true;
    }
    return false;
  };

  var interactiveSelectors = [
    'a[href]', 'button', 'input', 'textarea', 'select',
    '[role="button"]', '[role="link"]', '[role="tab"]',
    '[role="menuitem"]', '[role="checkbox"]', '[role="radio"]',
    '[role="switch"]', '[role="option"]', '[role="listbox"]',
    '[onclick]', '[tabindex]', 'summary', 'label'
  ];

  var modalInteractive = [];
  var pageInteractive = [];
  var seen = [];

  for (var s = 0; s < interactiveSelectors.length; s++) {
    var sel = interactiveSelectors[s];
    var nodeList = document.querySelectorAll(sel);
    for (var i = 0; i < nodeList.length; i++) {
      var el = nodeList[i];
      if (seen.indexOf(el) !== -1 || !isVisible(el)) continue;
      seen.push(el);

      var tag = el.tagName.toLowerCase();
      var role = el.getAttribute('role') ||
        (tag === 'a' ? 'link' : tag === 'button' ? 'button' : tag === 'input' ? 'input' : tag);
      var text = getVisibleText(el);
      var selector = '';
      try { selector = getUniqueSelector(el); } catch(e) { selector = tag; }

      var attrs = {};
      var attrNames = ['type', 'placeholder', 'value', 'href', 'aria-label', 'title', 'name'];
      for (var a = 0; a < attrNames.length; a++) {
        var v = el.getAttribute(attrNames[a]);
        if (v) attrs[attrNames[a]] = v.slice(0, 100);
      }

      var inModal = isInsideModal(el);
      var item = { tag: tag, role: role, text: text, selector: selector, attributes: attrs, inModal: inModal };

      if (inModal) {
        modalInteractive.push(item);
      } else {
        pageInteractive.push(item);
      }
    }
  }

  // Modal elements come first, capped total
  var allElements = modalInteractive.concat(pageInteractive).slice(0, maxElements);

  var bodyText = '';
  try { bodyText = (document.body.innerText || '').slice(0, 12000); } catch(e) {}

  return {
    elements: allElements,
    bodyText: bodyText,
    hasModal: hasModal,
    modalText: modalText
  };
})(MAXELEMENTS)
`;

export async function extractPageContent(page: Page): Promise<PageContent> {
  const url = page.url();
  const title = await page.title();

  const script = EXTRACT_SCRIPT.replace("MAXELEMENTS", String(MAX_ELEMENTS));

  let extracted: {
    elements: Array<{
      tag: string; role: string; text: string; selector: string;
      attributes: Record<string, string>; inModal: boolean;
    }>;
    bodyText: string;
    hasModal: boolean;
    modalText: string;
  };

  try {
    extracted = await page.evaluate(script);
  } catch {
    const bodyText = await page.evaluate(`
      (function() {
        try { return (document.body.innerText || '').slice(0, 12000); } catch(e) { return ''; }
      })()
    `) as string;
    extracted = { elements: [], bodyText, hasModal: false, modalText: "" };
  }

  const elements: ExtractedElement[] = extracted.elements.map((el, i) => ({
    index: i + 1,
    ...el,
  }));

  const textContent = extracted.bodyText.slice(0, MAX_TEXT_LENGTH);

  return {
    url,
    title,
    elements,
    textContent,
    hasModal: extracted.hasModal,
    modalText: extracted.modalText.slice(0, 2000),
  };
}

export function formatPageContent(content: PageContent): string {
  const lines: string[] = [
    `Page: ${content.title}`,
    `URL: ${content.url}`,
  ];

  if (content.hasModal) {
    lines.push("");
    lines.push("⚠️ ACTIVE MODAL/POPUP DETECTED — interact with it before doing anything else!");
    lines.push(`Modal text: ${content.modalText.slice(0, 500)}`);
    lines.push("");
    lines.push("=== MODAL Elements (interact with these FIRST) ===");
    const modalEls = content.elements.filter((el) => el.inModal);
    for (const el of modalEls) {
      const attrs = Object.entries(el.attributes)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      const textPart = el.text ? ` "${el.text}"` : "";
      lines.push(
        `[${el.index}] <${el.tag}> (${el.role})${textPart} ${attrs ? `{${attrs}}` : ""} → ${el.selector}`
      );
    }
  }

  lines.push("");
  lines.push("=== Page Interactive Elements ===");
  const pageEls = content.hasModal
    ? content.elements.filter((el) => !el.inModal)
    : content.elements;
  for (const el of pageEls) {
    const attrs = Object.entries(el.attributes)
      .map(([k, v]) => `${k}="${v}"`)
      .join(" ");
    const textPart = el.text ? ` "${el.text}"` : "";
    lines.push(
      `[${el.index}] <${el.tag}> (${el.role})${textPart} ${attrs ? `{${attrs}}` : ""} → ${el.selector}`
    );
  }

  lines.push("", "=== Page Text (truncated) ===", content.textContent);

  return lines.join("\n");
}
