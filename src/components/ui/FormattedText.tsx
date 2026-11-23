import React from 'react';

interface FormattedTextProps {
  content: string;
  className?: string;
}

export function FormattedText({ content, className = '' }: FormattedTextProps) {
  if (!content) return null;

  // Split into lines to handle bullet lists, numbered lists, and paragraphs
  const lines = content.split('\n');

  const renderInlineFormatted = (text: string) => {
    // Regex matches:
    // 1. Bold: **text**
    // 2. Inline code: `text`
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|`.*?`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={match.index} className="font-semibold text-inherit">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={match.index}
            className="px-1.5 py-0.5 rounded bg-black/5 font-mono text-[0.85em] font-medium"
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Bullet point detection: '*', '-', or '•'
        const bulletMatch = line.match(/^\s*([*\-•])\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-[#7257E8] font-bold select-none leading-relaxed">•</span>
              <div className="flex-1 leading-relaxed">
                {renderInlineFormatted(bulletMatch[2])}
              </div>
            </div>
          );
        }

        // Numbered list detection: '1.', '2.', etc.
        const numberedMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="font-semibold text-[#7257E8] font-mono text-xs select-none mt-0.5 min-w-[16px]">
                {numberedMatch[1]}.
              </span>
              <div className="flex-1 leading-relaxed">
                {renderInlineFormatted(numberedMatch[2])}
              </div>
            </div>
          );
        }

        return (
          <p key={idx} className="leading-relaxed">
            {renderInlineFormatted(line)}
          </p>
        );
      })}
    </div>
  );
}
