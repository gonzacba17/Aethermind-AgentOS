/**
 * Example: Using Aethermind Agent SDK with Anthropic Claude
 */

import { initAethermind } from '@aethermind/agent';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Aethermind
initAethermind({
  apiKey: process.env.AETHERMIND_API_KEY || 'aether_test_key',
});

// Use Anthropic as normal
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

async function main() {
  console.log('Making Anthropic API call...');
  
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'Write a haiku about TypeScript.' },
    ],
  });

  console.log('Response:', response.content);
  console.log('Usage:', response.usage);
}

main().catch(console.error);
