export const MENTION_REGEX = /@(\w+)/g;

export const extractMentionHandles = (text: string): string[] => {
  const matches = text.match(MENTION_REGEX);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.slice(1))));
};

export const linkifyMentions = (text: string): string => {
  return text.replace(MENTION_REGEX, (_match, handle) => {
    return `<a href="/app/profile/@${handle}" data-mention="${handle}">@${handle}</a>`;
  });
};


