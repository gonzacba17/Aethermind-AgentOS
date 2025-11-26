// Aethermind AgentOS - Full Demo
// This demonstrates the complete workflow of creating agents, orchestrating them, and monitoring execution

console.log('🚀 Aethermind AgentOS - Full Demo\n');

// Mock SDK implementation for demonstration
// In production, import from '@aethermind/sdk'

interface AgentConfig {
    name: string;
    model: string;
    systemPrompt: string;
    tools?: any[];
    logic: (ctx: any) => Promise<any>;
}

interface OrchestratorConfig {
    agents: any[];
    config?: {
        maxRetries?: number;
        timeout?: number;
        costLimit?: number;
    };
}

const mockLogs: any[] = [];
const mockCosts: any[] = [];
const mockTraces: any[] = [];

const mockLogger = {
    info: (msg: string) => {
        const log = { level: 'info', message: msg, timestamp: new Date().toISOString() };
        mockLogs.push(log);
        console.log(`  ℹ️  ${msg}`);
    },
    debug: (msg: string) => {
        const log = { level: 'debug', message: msg, timestamp: new Date().toISOString() };
        mockLogs.push(log);
        console.log(`  🔍 ${msg}`);
    },
    error: (msg: string) => {
        const log = { level: 'error', message: msg, timestamp: new Date().toISOString() };
        mockLogs.push(log);
        console.error(`  ❌ ${msg}`);
    },
};

function createAgent(config: AgentConfig) {
    return {
        id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: config.name,
        model: config.model,
        systemPrompt: config.systemPrompt,
        tools: config.tools || [],
        logic: config.logic,
    };
}

function startOrchestrator(config: OrchestratorConfig) {
    const { agents, config: orchestratorConfig } = config;

    return {
        agents,
        config: orchestratorConfig,

        async execute({ agentId, input }: any) {
            const agent = agents.find(a => a.id === agentId);
            if (!agent) throw new Error('Agent not found');

            const executionId = `exec-${Date.now()}`;
            const startTime = Date.now();

            try {
                const result = await agent.logic({ input, logger: mockLogger });
                const duration = Date.now() - startTime;

                // Track costs
                mockCosts.push({
                    executionId,
                    agentId: agent.id,
                    model: agent.model,
                    tokens: Math.floor(Math.random() * 1000) + 500,
                    cost: Math.random() * 0.05 + 0.01,
                });

                // Track trace
                mockTraces.push({
                    executionId,
                    agentId: agent.id,
                    duration,
                    success: true,
                });

                return { success: true, executionId, ...result };
            } catch (error: any) {
                mockLogger.error(`Execution failed: ${error.message}`);
                return { success: false, error: error.message };
            }
        },

        async executeWorkflow(workflow: any, input: any) {
            console.log(`\n⚡ Executing workflow: ${workflow.name || 'unnamed'}`);
            let currentInput = input;
            let result: any = {};

            for (const step of workflow.steps) {
                const agent = agents.find(a => a.id === step.agent);
                if (!agent) continue;

                console.log(`\n  📍 Step: ${step.id || agent.name}`);
                const stepResult = await agent.logic({ input: currentInput, logger: mockLogger });
                currentInput = stepResult;
                result = { ...result, ...stepResult };

                // Simulate processing time
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            return { success: true, ...result };
        },

        async getCosts() {
            return mockCosts;
        },

        async getLogs() {
            return mockLogs;
        },

        async getTraces() {
            return mockTraces.map(trace => ({
                ...trace,
                tree: {
                    id: 'root',
                    agent: agents.find(a => a.id === trace.agentId)?.name,
                    children: [],
                },
            }));
        },

        async shutdown() {
            console.log('\n🛑 Shutting down orchestrator...');
        },
    };
}

async function runFullDemo() {
    // ===== 1. Create Agents =====
    console.log('📝 Creating agents...\n');

    const researcher = createAgent({
        name: 'researcher',
        model: 'gpt-4',
        systemPrompt: 'You are a research assistant specialized in gathering information.',
        tools: [],
        logic: async (ctx) => {
            ctx.logger.info('Starting research...');

            // Simulate research
            await new Promise(resolve => setTimeout(resolve, 1000));

            const research = {
                topic: ctx.input.topic,
                findings: [
                    'Finding 1: AI market growing at 40% CAGR',
                    'Finding 2: Multi-agent systems gaining traction',
                    'Finding 3: DevTools for AI are underserved',
                ],
                sources: 3,
            };

            ctx.logger.info(`Research completed. Found ${research.sources} sources.`);
            return research;
        },
    });

    const analyst = createAgent({
        name: 'analyst',
        model: 'gpt-4',
        systemPrompt: 'You analyze research data and extract insights.',
        logic: async (ctx) => {
            ctx.logger.info('Analyzing data...');

            await new Promise(resolve => setTimeout(resolve, 800));

            const { findings } = ctx.input;

            const analysis = {
                insights: findings.map((f: string, i: number) =>
                    `Insight ${i + 1}: ${f} → High potential`
                ),
                recommendation: 'Strong market opportunity identified',
            };

            ctx.logger.info('Analysis complete.');
            return analysis;
        },
    });

    const writer = createAgent({
        name: 'writer',
        model: 'gpt-4',
        systemPrompt: 'You create clear, concise reports from analysis.',
        logic: async (ctx) => {
            ctx.logger.info('Writing report...');

            await new Promise(resolve => setTimeout(resolve, 600));

            const { insights, recommendation } = ctx.input;

            const report = {
                title: 'Market Analysis Report',
                summary: recommendation,
                details: insights,
                createdAt: new Date().toISOString(),
            };

            ctx.logger.info('Report completed.');
            return report;
        },
    });

    console.log(`✓ Created ${[researcher, analyst, writer].length} agents`);
    console.log(`  • ${researcher.name} (${researcher.model})`);
    console.log(`  • ${analyst.name} (${analyst.model})`);
    console.log(`  • ${writer.name} (${writer.model})`);

    // ===== 2. Start Orchestrator =====
    console.log('\n🎭 Starting orchestrator...\n');

    const orchestrator = startOrchestrator({
        agents: [researcher, analyst, writer],
        config: {
            maxRetries: 3,
            timeout: 30000,
            costLimit: 1.0, // $1 max
        },
    });

    console.log('✓ Orchestrator started');
    console.log(`  • Agents: ${orchestrator.agents.length}`);
    console.log(`  • Max retries: ${orchestrator.config?.maxRetries}`);
    console.log(`  • Timeout: ${orchestrator.config?.timeout}ms`);

    // ===== 3. Execute Workflow =====
    const workflow = {
        name: 'research-pipeline',
        steps: [
            {
                id: 'research',
                agent: researcher.id,
                next: 'analyze',
            },
            {
                id: 'analyze',
                agent: analyst.id,
                next: 'write',
            },
            {
                id: 'write',
                agent: writer.id,
            },
        ],
    };

    const result = await orchestrator.executeWorkflow(workflow, {
        topic: 'AI Agent Development Tools Market',
    });

    console.log('\n✅ Workflow completed!\n');
    console.log('📊 Result:');
    console.log(JSON.stringify(result, null, 2));

    // ===== 4. Get Metrics =====
    console.log('\n📈 Metrics:\n');

    const logs = await orchestrator.getLogs();
    console.log(`  • Total logs: ${logs.length}`);

    const costs = await orchestrator.getCosts();
    const totalCost = costs.reduce((sum, c) => sum + c.cost, 0);
    console.log(`  • Total cost: $${totalCost.toFixed(4)}`);
    console.log(`  • Total tokens: ${costs.reduce((sum, c) => sum + c.tokens, 0)}`);

    const traces = await orchestrator.getTraces();
    console.log(`  • Execution traces: ${traces.length}`);

    // ===== 5. Visualize Trace =====
    console.log('\n🌳 Execution Trace:\n');
    if (traces.length > 0) {
        traces.forEach((trace, i) => {
            console.log(`  Trace ${i + 1}:`);
            console.log(`    Agent: ${trace.tree.agent}`);
            console.log(`    Duration: ${trace.duration}ms`);
            console.log(`    Success: ${trace.success}`);
        });
    }

    // ===== 6. Display Logs =====
    console.log('\n📋 Recent Logs:\n');
    logs.slice(-5).forEach(log => {
        const icon = log.level === 'info' ? 'ℹ️' : log.level === 'debug' ? '🔍' : '❌';
        console.log(`  ${icon} [${log.level.toUpperCase()}] ${log.message}`);
    });

    console.log('\n✨ Demo completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('  • View dashboard: http://localhost:3000');
    console.log('  • Check API docs: http://localhost:3001/docs');
    console.log('  • Run tests: pnpm test');

    // Cleanup
    await orchestrator.shutdown();
}

// Run demo
runFullDemo()
    .then(() => {
        console.log('\n👋 Goodbye!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Demo failed:', error);
        process.exit(1);
    });
