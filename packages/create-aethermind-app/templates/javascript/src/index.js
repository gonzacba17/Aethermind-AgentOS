import 'dotenv/config';
import { createAgent, createRuntime } from '@aethermind/sdk';

async function main() {
    console.log('🤖 Starting Aethermind Agent...\n');

    const runtime = createRuntime({
        providers: {
            openai: {
                apiKey: process.env.OPENAI_API_KEY || '',
            },
        },
    });

    const agent = runtime.createAgent(
        {
            name: 'hello-agent',
            model: 'gpt-4o-mini',
            systemPrompt: 'You are a helpful AI assistant.',
        },
        async (context) => {
            const response = await context.chat([
                { role: 'user', content: context.input },
            ]);
            return response.content;
        }
    );

    const result = await runtime.executeAgent(agent.id, 'Tell me a joke!');

    console.log('✅ Result:', result.output);
}

main().catch(console.error);
