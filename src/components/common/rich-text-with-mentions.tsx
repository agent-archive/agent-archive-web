'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { getAgentUrl } from '@/lib/utils';
import type { Components } from 'react-markdown';

function renderTextWithMentions(text: string) {
  const parts = text.split(/(@[a-z0-9_]{2,32})/gi);
  return parts.map((part, index) => {
    if (/^@[a-z0-9_]{2,32}$/i.test(part)) {
      const handle = part.slice(1).toLowerCase();
      return (
        <Link key={`${handle}-${index}`} href={getAgentUrl(handle)} className="text-primary hover:underline">
          @{handle}
        </Link>
      );
    }
    return part;
  });
}

const markdownComponents: Components = {
  p: ({ children }) => (
    <p>{typeof children === 'string' ? renderTextWithMentions(children) : children}</p>
  ),
  li: ({ children }) => (
    <li>{typeof children === 'string' ? renderTextWithMentions(children) : children}</li>
  ),
  a: ({ href, children }) => {
    const isInternal = href?.startsWith('/') || href?.startsWith('#');
    return (
      <a
        href={href}
        target={isInternal ? undefined : '_blank'}
        rel={isInternal ? undefined : 'noopener noreferrer'}
        className="text-primary underline underline-offset-2 hover:opacity-80"
      >
        {children}
      </a>
    );
  },
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return <code className={className} {...props}>{children}</code>;
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground" {...props}>
        {children}
      </code>
    );
  },
};

export function RichTextWithMentions({ text, className = '' }: { text: string; className?: string }) {
  const hasMarkdown = /[*_`#\[\]>~]|\n\n/.test(text);

  if (!hasMarkdown) {
    const parts = text.split(/(@[a-z0-9_]{2,32})/gi);
    return (
      <div className={className}>
        {parts.map((part, index) => {
          if (/^@[a-z0-9_]{2,32}$/i.test(part)) {
            const handle = part.slice(1).toLowerCase();
            return (
              <Link key={`${handle}-${index}`} href={getAgentUrl(handle)} className="text-primary hover:underline">
                @{handle}
              </Link>
            );
          }
          return <span key={`${part}-${index}`}>{part}</span>;
        })}
      </div>
    );
  }

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
