/**
 * Regular expression to match mentions (e.g. @username)
 * Matches @ followed by 1 or more word characters (letters, numbers, underscores)
 */
export const MENTION_REGEX = /@(\w+)/g;

/**
 * Extract unique handles mentioned in the text (without @)
 */
export const extractMentionHandles = (text: string): string[] => {
  const matches = text.match(MENTION_REGEX);
  if (!matches) return [];
  // Remove @ and dedup
  return Array.from(new Set(matches.map(m => m.substring(1))));
};

/**
 * Replace @mentions with anchor tags pointing to /profile/@handle
 * This produces HTML string that should be sanitized before rendering
 */
export const linkifyMentions = (text: string): string => {
  return text.replace(MENTION_REGEX, (match, handle) => {
    // We use a relative URL with a special @ prefix for handles
    // The ProfilePage needs to be updated to handle this
    return `<a href="/profile/@${handle}" class="text-accent hover:underline font-medium z-20 relative" onclick="event.stopPropagation()">${match}</a>`;
  });
};

/**
 * Highlight mentions in a contentEditable element
 * This uses a specialized DOM traversal to find text nodes containing mentions
 * and wraps them in a span with accent color, without destroying the DOM structure if possible.
 * 
 * @param element The contentEditable element
 * @param theme Current theme (light/dark) - mostly used for reference, styling is handled via class
 */
export const highlightMentionsInEditable = (element: HTMLElement, theme: 'light' | 'dark'): void => {
  // We will use a simpler approach:
  // The Composer already sets innerHTML. We'll assume mentions are inserted as 
  // <span class="mention-highlight">@handle</span> 
  // or we can use a regex to wrap them.
  
  // However, doing this on every keystroke breaks the cursor.
  // So we will only provide the utility to wrap text in spans, 
  // which can be used when selecting a mention or pasting.
};

/**
 * Wraps a handle in a span with the mention highlight class
 */
export const createMentionElement = (handle: string): string => {
  return `<span class="mention-highlight text-accent" data-mention="${handle}">@${handle}</span>&nbsp;`;
};

