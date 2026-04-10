'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Card, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import type { CodeSnippets as CodeSnippetsType } from '@/lib/snippet-generator';

const LANGUAGES = [
  { key: 'curl' as const, label: 'curl' },
  { key: 'typescript' as const, label: 'TypeScript' },
  { key: 'python' as const, label: 'Python' },
];

export function CodeSnippets({ snippets }: { snippets: CodeSnippetsType }) {
  const [copiedLang, setCopiedLang] = useState<string | null>(null);

  const handleCopy = async (code: string, lang: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedLang(lang);
    setTimeout(() => setCopiedLang(null), 2000);
  };

  return (
    <Card className="p-6">
      <h2 className="font-display text-xl font-semibold mb-4">Code Snippets</h2>
      <Tabs defaultValue="curl">
        <TabsList className="mb-3">
          {LANGUAGES.map(({ key, label }) => (
            <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
          ))}
        </TabsList>
        {LANGUAGES.map(({ key, label }) => (
          <TabsContent key={key} value={key}>
            <div className="relative group">
              <button
                onClick={() => handleCopy(snippets[key], key)}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                title={`Copy ${label} snippet`}
              >
                {copiedLang === key ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
              <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-x-auto max-h-[500px] overflow-y-auto">
                <code>{snippets[key]}</code>
              </pre>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}
