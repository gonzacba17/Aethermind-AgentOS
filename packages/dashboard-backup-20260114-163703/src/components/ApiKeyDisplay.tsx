/**
 * API Key Management Component
 * 
 * Displays organization API key with copy-to-clipboard functionality
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Eye, EyeOff, CheckCircle } from 'lucide-react';

interface ApiKeyDisplayProps {
  apiKey: string;
  organizationName: string;
}

export function ApiKeyDisplay({ apiKey, organizationName }: ApiKeyDisplayProps) {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayKey = showKey ? apiKey : `${apiKey.slice(0, 12)}${'•'.repeat(20)}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle>Your API Key</CardTitle>
        <CardDescription>
          Use this key to authenticate SDK requests for {organizationName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-white rounded-lg border font-mono text-sm">
          <span className="flex-1">{displayKey}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowKey(!showKey)}
            className="shrink-0"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Quick Start Code */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Quick Start</h4>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
            <pre className="text-xs">
              <code>{`# Install SDK
npm install @aethermind/agent

# Initialize in your app
import { initAethermind } from '@aethermind/agent';

initAethermind({
  apiKey: '${apiKey}',
  endpoint: '${process.env.NEXT_PUBLIC_API_URL || 'https://api.aethermind.io'}',
});

# Use OpenAI normally - events automatically tracked!
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await openai.chat.completions.create({ ... });`}</code>
            </pre>
          </div>
        </div>

        {/* Security Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
          <p className="font-semibold text-yellow-800">⚠️ Keep this key secure</p>
          <ul className="text-yellow-700 mt-1 ml-4 list-disc space-y-1">
            <li>Never commit to version control</li>
            <li>Store in environment variables</li>
            <li>Rotate if compromised</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
