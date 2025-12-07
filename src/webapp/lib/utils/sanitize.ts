const DEFAULT_ALLOWED_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'span',
  'div',
  'a',
]);

const DEFAULT_ALLOWED_ATTRS = new Set(['href', 'title', 'target', 'rel', 'class']);
const URI_ATTRS = new Set(['href']);
const SAFE_URI_PATTERN = /^(https?:|mailto:|\/)/i;

const sanitizeElementNode = (element: Element): void => {
  const tagName = element.tagName.toLowerCase();

  if (!DEFAULT_ALLOWED_TAGS.has(tagName)) {
    const parent = element.parentNode;
    if (parent) {
      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
      }
      parent.removeChild(element);
    } else {
      element.remove();
    }
    return;
  }

  Array.from(element.attributes).forEach((attr) => {
    const attrName = attr.name.toLowerCase();
    const attrValue = attr.value.trim();

    if (attrName.startsWith('on') || !DEFAULT_ALLOWED_ATTRS.has(attrName)) {
      element.removeAttribute(attr.name);
      return;
    }

    if (URI_ATTRS.has(attrName)) {
      if (!SAFE_URI_PATTERN.test(attrValue)) {
        element.removeAttribute(attr.name);
        return;
      }
      if (attrName === 'href') {
        element.setAttribute('rel', 'noopener noreferrer');
      }
    }

    if (attrName === 'target' && attrValue !== '_blank') {
      element.setAttribute('target', '_blank');
    }
  });
};

const sanitizeNode = (node: Node): void => {
  if (node.nodeType === Node.ELEMENT_NODE) {
    sanitizeElementNode(node as Element);
  }

  Array.from(node.childNodes).forEach((child) => sanitizeNode(child));
};

const fallbackStrip = (input: string): string => {
  if (!input) {
    return '';
  }
  return input.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
};

export const sanitizeHTML = (input: string): string => {
  if (!input) {
    return '';
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallbackStrip(input);
  }

  const container = document.createElement('div');
  container.innerHTML = input;
  sanitizeNode(container);
  return container.innerHTML;
};


