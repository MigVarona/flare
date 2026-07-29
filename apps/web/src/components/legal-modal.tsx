'use client';

import { Fragment } from 'react';

function inlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return <a href={link[2]} target="_blank" rel="noreferrer" key={index}>{link[1]}</a>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function LegalModal({
  title,
  markdown,
  onClose,
}: {
  title: string;
  markdown: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop legal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card legal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
        <h2>{title}</h2>
        <div className="legal-document">
          {markdown.split('\n').map((line, index) => {
            const clean = line.trim();
            if (!clean) return null;
            if (clean.startsWith('### ')) return <h4 key={index}>{inlineMarkdown(clean.slice(4))}</h4>;
            if (clean.startsWith('## ')) return <h3 key={index}>{inlineMarkdown(clean.slice(3))}</h3>;
            if (clean.startsWith('# ')) return <h2 key={index}>{inlineMarkdown(clean.slice(2))}</h2>;
            if (clean.startsWith('- ')) return <p className="legal-list-item" key={index}>• {inlineMarkdown(clean.slice(2))}</p>;
            return <p key={index}>{inlineMarkdown(clean)}</p>;
          })}
        </div>
      </section>
    </div>
  );
}
