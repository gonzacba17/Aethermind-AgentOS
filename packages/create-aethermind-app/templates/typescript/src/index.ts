import 'dotenv/config';
import { createAgent, createRuntime } from '@aethermind/sdk';

async function main() {
    console.log('🤖 Starting Aethermind Agent...\n');

    // Create runtime with your preferred LLM provider
    const runtime = createRuntime({
        providers: {
            openai: {
                apiKey: process.env.OPENAI_API_KEY || '',
            },
            anthropic: {
                apiKey: process.env.ANTHROPIC_API_KEY || '',
            },
        },
    });

    // Create a simple agent
    const agent = runtime.createAgent(
        {
            name: 'hello-agent',
            model: 'gpt-4o-mini', // or 'claude-3-5-haiku-20241022'
            systemPrompt: 'You are a helpful AI assistant. Be concise and friendly.',
            temperature: 0.7,
            maxTokens: 500,
        },
        async (context) => {
            // Agent logic: send user input to LLM and return response
            const response = await context.chat([
                { role: 'user', content: context.input as string },
            ]);
            return response.content;
        }
    );

    // Execute the agent
    const userInput = 'Hello! Tell me a short joke about programming.';
    console.log('📝 User:', userInput);
    console.log('⏳ Thinking...\n');

    const result = await runtime.executeAgent(agent.id, userInput);

    console.log('✅ Agent:', result.output);
    console.log('\n💰 Cost:', `$${result.cost?.toFixed(6) || '0.000000'}`);
    console.log('🔢 Tokens:', result.tokens || 'N/A');
}

main().catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});
