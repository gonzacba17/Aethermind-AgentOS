# Aethermind AgentOS - VSCode Extension

Code snippets and tools for Aethermind AgentOS development.

## Features

- **Code Snippets**: Quick snippets for creating agents, workflows, and providers
- **TypeScript & JavaScript Support**: Works with both languages
- **IntelliSense**: Tab completion for all snippets

## Installation

### Option 1: Install from .vsix file (Local)

1. Download the latest `.vsix` file from the releases
2. Open VSCode
3. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
4. Type "Extensions: Install from VSIX"
5. Select the downloaded `.vsix` file

### Option 2: Build from source

```bash
cd packages/vscode-extension
npm install -g vsce
vsce package
code --install-extension aethermind-agentos-0.1.0.vsix
```

## Available Snippets

### Agent Creation

**Trigger**: `aether-agent`

Creates a new agent with configuration and logic:

```typescript
import { createRuntime, createAgent } from '@aethermind/core';

const runtime = createRuntime();

const myAgent = runtime.createAgent(
  {
    name: 'Agent Name',
    model: 'gpt-4o',
    systemPrompt: 'You are a helpful assistant',
    temperature: 0.7,
    maxTokens: 1000
  },
  async (input, context) => {
    // Agent logic here
    return `Processed: ${input}`;
  }
);
```

### Workflow Creation

**Trigger**: `aether-workflow`

Creates a new workflow with steps:

```typescript
workflowEngine.registerWorkflow({
  id: 'workflow-id',
  name: 'Workflow Name',
  description: 'Workflow description',
  steps: [...]
});
```

### Provider Configuration

**OpenAI**: `aether-provider-openai`
**Anthropic**: `aether-provider-anthropic`
**Ollama**: `aether-provider-ollama`

### Agent Execution

**Execute Agent**: `aether-execute`
**Chat with Agent**: `aether-chat`

### Workflow Execution

**Trigger**: `aether-workflow-execute`

### Event Listeners

**Trigger**: `aether-event`

Listen to runtime events:
- `agent:event`
- `log`
- `workflow:started`
- `workflow:completed`
- `workflow:failed`
- `agent:reloaded`
- `agent:reload-failed`

### Error Handling

**Trigger**: `aether-error`

Handle Aethermind errors with error codes and suggestions.

### Cost Estimation

**Trigger**: `aether-cost-estimate`

Estimate workflow execution costs.

### Config Watcher

**Trigger**: `aether-config-watcher`

Set up hot reload for agent configurations.

## Usage

1. Open a TypeScript or JavaScript file
2. Start typing a snippet prefix (e.g., `aether-agent`)
3. Press `Tab` to expand the snippet
4. Use `Tab` to navigate between placeholders
5. Fill in the required values

## Keyboard Shortcuts

- `Tab`: Expand snippet / Jump to next placeholder
- `Shift+Tab`: Jump to previous placeholder
- `Esc`: Cancel snippet mode

## Tips

- Use `Ctrl+Space` to trigger IntelliSense and see available snippets
- Snippets work in both `.ts` and `.js` files
- Some snippets include dropdown options (use arrow keys to select)

## Contributing

Found a bug or want to add a snippet? Please open an issue or PR on [GitHub](https://github.com/aethermind/agentos).

## License

MIT

## Support

- [Documentation](https://docs.aethermind.dev)
- [Discord Community](https://discord.gg/aethermind)
- [GitHub Issues](https://github.com/aethermind/agentos/issues)
