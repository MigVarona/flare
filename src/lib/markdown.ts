/**
 * Just enough markdown to render the legal documents: headings, bullet lists, bold, and
 * links. Not a general-purpose parser — it matches the specific shape those documents are
 * written in (blank-line-separated blocks), not arbitrary markdown.
 */

export type MarkdownBlock =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'h4'; text: string }
  | { type: 'hr' }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] };

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const chunks = markdown
    .trim()
    .split(/\n\s*\n/)
    .map((chunk) =>
      chunk
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0),
    )
    .filter((lines) => lines.length > 0);

  return chunks.map((lines): MarkdownBlock => {
    if (lines.length === 1 && lines[0] === '---') {
      return { type: 'hr' };
    }
    if (lines.length === 1 && lines[0].startsWith('#### ')) {
      return { type: 'h4', text: lines[0].slice(5).trim() };
    }
    if (lines.length === 1 && lines[0].startsWith('### ')) {
      return { type: 'h3', text: lines[0].slice(4).trim() };
    }
    if (lines.length === 1 && lines[0].startsWith('## ')) {
      return { type: 'h2', text: lines[0].slice(3).trim() };
    }
    if (lines.length === 1 && lines[0].startsWith('# ')) {
      return { type: 'h1', text: lines[0].slice(2).trim() };
    }
    if (lines.every((line) => line.startsWith('- '))) {
      return { type: 'ul', items: lines.map((line) => line.slice(2).trim()) };
    }
    return { type: 'p', text: lines.join('\n') };
  });
}

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string };

const inlinePattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  inlinePattern.lastIndex = 0;
  while ((match = inlinePattern.exec(text))) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      tokens.push({ type: 'link', text: match[1], href: match[2] });
    } else if (match[3] !== undefined) {
      tokens.push({ type: 'bold', text: match[3] });
    } else {
      tokens.push({ type: 'code', text: match[4] });
    }
    lastIndex = inlinePattern.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: 'text', text: text.slice(lastIndex) });
  }
  return tokens;
}
