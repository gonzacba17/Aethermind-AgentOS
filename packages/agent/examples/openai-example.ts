/**
 * Example: Using Aethermind Agent SDK with OpenAI
 * 
 * This example demonstrates how to use the Aethermind SDK
 * to automatically track OpenAI API costs.
 */

import { initAethermind } from '@aethermind/agent';
import OpenAI from 'openai';

// Initialize Aethermind SDK
init Aethermind({
  apiKey: process.env.AETHERMIND_API_KEY || 'aether_test_key',
  endpoint: process.env.AETHERMIND_ENDPOINT || 'https://api.aethermind.io',
  // Optional configuration
  flushInterval: 30000, // Flush every 30 seconds
  batchSize: 50,         // Max 50 events per batch
});

// Use OpenAI as normal - events are automatically captured
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

async function main() {
  console.log('Making OpenAI API call...');
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is the capital of France?' },
      ],
      max_tokens: 100,
    });

    console.log('Response:', response.choices[0]?.message.content);
    console.log('Usage:', response.usage);
    
    // Event was automatically captured and will be sent to Aethermind API
  } catch (error) {
    console.error('Error:', error);
    // Error events are also captured
  }
}

main().catch(console.error);
