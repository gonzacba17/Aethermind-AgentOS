'use client';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Terminal, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  code: string;
  language: string;
  title?: string;
  showLineNumbers?: boolean;
}

const languageIcons: Record<string, React.ReactNode> = {
  bash: <Terminal className="w-4 h-4" />,
  typescript: <FileCode className="w-4 h-4" />,
  javascript: <FileCode className="w-4 h-4" />,
};

const languageLabels: Record<string, string> = {
  bash: 'Terminal',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  json: 'JSON',
  tsx: 'TypeScript React',
  jsx: 'JavaScript React',
};

export function CodeSnippet({ 
  code, 
  language, 
  title, 
  showLineNumbers = false 
}: Props) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const Icon = languageIcons[language] || <FileCode className="w-4 h-4" />;
  const languageLabel = languageLabels[language] || language;
  
  return (
    <div className="relative group rounded-xl overflow-hidden border border-gray-800 bg-gray-900/50">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800/50 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          {/* macOS-style dots */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          
          {/* Language Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-700/50 text-gray-400 text-xs font-medium">
            {Icon}
            <span>{title || languageLabel}</span>
          </div>
        </div>
        
        {/* Copy Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className={`h-8 gap-2 text-xs transition-all duration-200 ${
            copied 
              ? 'text-green-400 hover:text-green-400' 
              : 'text-gray-400 hover:text-white opacity-0 group-hover:opacity-100'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </Button>
      </div>
      
      {/* Code Block */}
      <div className="relative overflow-x-auto">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          showLineNumbers={showLineNumbers}
          customStyle={{
            margin: 0,
            padding: '1rem 1.25rem',
            background: 'transparent',
            fontSize: '0.875rem',
            lineHeight: '1.6',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }
          }}
          lineNumberStyle={{
            minWidth: '2.5em',
            paddingRight: '1em',
            color: '#4b5563',
            userSelect: 'none',
          }}
        >
          {code.trim()}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
