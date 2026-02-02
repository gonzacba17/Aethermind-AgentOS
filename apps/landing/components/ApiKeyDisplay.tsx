'use client';
import { useState } from 'react';
import { Eye, EyeOff, Copy, Check, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  apiKey: string;
  label?: string;
}

export function ApiKeyDisplay({ apiKey, label = "Your API Key" }: Props) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maskedKey = apiKey.replace(/./g, '•').slice(0, 32) + '...';
  
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900/50 to-black/50 backdrop-blur-sm">
      {/* Decorative gradient border */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 opacity-50 blur-xl" />
      
      <div className="relative p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
            <Key className="w-5 h-5 text-blue-400" />
          </div>
          <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            {label}
          </span>
        </div>
        
        {/* API Key Display */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <code className="block w-full px-4 py-3.5 rounded-xl bg-black/60 border border-gray-700/50 font-mono text-sm text-gray-100 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              {visible ? apiKey : maskedKey}
            </code>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setVisible(!visible)}
              className="h-12 w-12 border-gray-700 bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-200 hover:border-gray-600"
              title={visible ? "Hide API Key" : "Show API Key"}
            >
              {visible ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </Button>
            
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleCopy}
              className={`h-12 w-12 transition-all duration-200 ${
                copied 
                  ? 'border-green-500 bg-green-500/20 text-green-400' 
                  : 'border-gray-700 bg-gray-800/50 hover:bg-gray-700/50 hover:border-gray-600'
              }`}
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4 text-gray-400" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Copy Feedback */}
        {copied && (
          <div className="flex items-center gap-2 text-green-400 text-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
            <Check className="w-4 h-4" />
            <span>API key copied to clipboard!</span>
          </div>
        )}
      </div>
    </div>
  );
}
