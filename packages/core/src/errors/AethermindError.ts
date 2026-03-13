/**
 * Base error class for all Aethermind errors
 * Includes error codes and helpful suggestions for resolution
 */
export class AethermindError extends Error {
    public readonly code: string;
    public readonly suggestion: string;
    public readonly timestamp: Date;

    constructor(code: string, message: string, suggestion: string) {
        super(message);
        this.name = 'AethermindError';
        this.code = code;
        this.suggestion = suggestion;
        this.timestamp = new Date();

        // Maintains proper stack trace for where error was thrown
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Convert error to JSON format for API responses
     */
    public toJSON(): Record<string, unknown> {
        return {
            error: this.name,
            code: this.code,
            message: this.message,
            suggestion: this.suggestion,
            timestamp: this.timestamp.toISOString(),
        };
    }
}

/**
 * Configuration-related errors (E001-E099)
 */
export class ConfigurationError extends AethermindError {
    constructor(code: string, message: string, suggestion: string) {
        super(code, message, suggestion);
        this.name = 'ConfigurationError';
    }

    static invalidConfig(details: string): ConfigurationError {
        return new ConfigurationError(
            'E001',
            `Invalid configuration: ${details}`,
            'Check your configuration file syntax and ensure all required fields are present. Refer to the documentation for the correct format.'
        );
    }

    static missingEnvVar(varName: string): ConfigurationError {
        return new ConfigurationError(
            'E002',
            `Missing required environment variable: ${varName}`,
            `Set the ${varName} environment variable in your .env file. See .env.example for reference.`
        );
    }

    static invalidEnvVar(varName: string, expectedType: string): ConfigurationError {
        return new ConfigurationError(
            'E003',
            `Invalid environment variable ${varName}: expected ${expectedType}`,
            `Check the value of ${varName} in your .env file. It should be a valid ${expectedType}.`
        );
    }

    static configFileNotFound(path: string): ConfigurationError {
        return new ConfigurationError(
            'E004',
            `Configuration file not found: ${path}`,
            `Ensure the configuration file exists at ${path}. You may need to create it or check the file path.`
        );
    }
}

/**
 * LLM Provider-related errors (E100-E199)
 */
export class ProviderError extends AethermindError {
    constructor(code: string, message: string, suggestion: string) {
        super(code, message, suggestion);
        this.name = 'ProviderError';
    }

    static invalidApiKey(provider: string): ProviderError {
        return new ProviderError(
            'E101',
            `Invalid API key for ${provider}`,
            `Check your ${provider} API key in the .env file. Ensure it's correctly copied from your ${provider} account dashboard.`
        );
    }

    static providerNotFound(providerName: string): ProviderError {
        return new ProviderError(
            'E102',
            `Provider not found: ${providerName}`,
            `Register the provider before using it. Available providers: openai, anthropic, ollama. Use runtime.registerProvider() to add custom providers.`
        );
    }

    static rateLimitExceeded(provider: string, retryAfter?: number): ProviderError {
        const retryMsg = retryAfter ? ` Retry after ${retryAfter} seconds.` : '';
        return new ProviderError(
            'E103',
            `Rate limit exceeded for ${provider}.${retryMsg}`,
            `You've hit the rate limit for ${provider}. Consider upgrading your plan or implementing request throttling. Enable smart routing to automatically fallback to other providers.`
        );
    }

    static modelNotSupported(model: string, provider: string): ProviderError {
        return new ProviderError(
            'E104',
            `Model ${model} is not supported by ${provider}`,
            `Check the provider documentation for supported models. Common models: gpt-4o, gpt-4o-mini (OpenAI), claude-3-5-sonnet (Anthropic), llama3.2 (Ollama).`
        );
    }

    static providerTimeout(provider: string, timeoutMs: number): ProviderError {
        return new ProviderError(
            'E105',
            `Request to ${provider} timed out after ${timeoutMs}ms`,
            `The provider took too long to respond. Check your network connection and the provider's status page. Consider increasing the timeout or using a different provider.`
        );
    }
}

/**
 * Workflow execution errors (E200-E299)
 */
export class WorkflowError extends AethermindError {
    constructor(code: string, message: string, suggestion: string) {
        super(code, message, suggestion);
        this.name = 'WorkflowError';
    }

    static workflowNotFound(workflowId: string): WorkflowError {
        return new WorkflowError(
            'E201',
            `Workflow not found: ${workflowId}`,
            `Ensure the workflow is registered before executing it. Use workflowEngine.registerWorkflow() to add workflows.`
        );
    }

    static cyclicDependency(stepIds: string[]): WorkflowError {
        return new WorkflowError(
            'E202',
            `Cyclic dependency detected in workflow: ${stepIds.join(' -> ')}`,
            `Review your workflow definition and remove circular dependencies. Each step should depend only on previous steps.`
        );
    }

    static invalidStepConfig(stepId: string, reason: string): WorkflowError {
        return new WorkflowError(
            'E203',
            `Invalid configuration for step ${stepId}: ${reason}`,
            `Check the step configuration in your workflow definition. Ensure all required fields are present and valid.`
        );
    }

    static stepExecutionFailed(stepId: string, error: string): WorkflowError {
        return new WorkflowError(
            'E204',
            `Step ${stepId} execution failed: ${error}`,
            `Review the step logs for details. Common causes: invalid input data, provider errors, or timeout. Consider adding error handling or retry logic.`
        );
    }
}

/**
 * Agent-related errors (E300-E399)
 */
export class AgentError extends AethermindError {
    constructor(code: string, message: string, suggestion: string) {
        super(code, message, suggestion);
        this.name = 'AgentError';
    }

    static agentNotFound(agentId: string): AgentError {
        return new AgentError(
            'E301',
            `Agent not found: ${agentId}`,
            `Ensure the agent is registered before using it. Use runtime.registerAgent() to add agents.`
        );
    }

    static invalidPrompt(agentId: string, reason: string): AgentError {
        return new AgentError(
            'E302',
            `Invalid prompt for agent ${agentId}: ${reason}`,
            `Check the agent's system prompt and ensure it's properly formatted. Prompts should be non-empty strings.`
        );
    }

    static agentExecutionFailed(agentId: string, error: string): AgentError {
        return new AgentError(
            'E303',
            `Agent ${agentId} execution failed: ${error}`,
            `Review the agent logs for details. Common causes: provider errors, invalid input, or timeout. Check your agent configuration and provider settings.`
        );
    }

    static agentReloadFailed(agentId: string, error: string): AgentError {
        return new AgentError(
            'E304',
            `Failed to reload agent ${agentId}: ${error}`,
            `The agent configuration may be invalid. Check the config file for syntax errors. The previous configuration has been restored.`
        );
    }

    static maxTokensExceeded(agentId: string, requested: number, max: number): AgentError {
        return new AgentError(
            'E305',
            `Agent ${agentId} requested ${requested} tokens, but maximum is ${max}`,
            `Reduce the maxTokens setting in your agent configuration or use a model with a larger context window.`
        );
    }
}

/**
 * Authentication and authorization errors (E400-E499)
 */
export class AuthError extends AethermindError {
    constructor(code: string, message: string, suggestion: string) {
        super(code, message, suggestion);
        this.name = 'AuthError';
    }

    static missingApiKey(): AuthError {
        return new AuthError(
            'E401',
            'Missing API key',
            'Include the X-API-Key header in your request. Generate an API key using: pnpm run generate-api-key'
        );
    }

    static invalidApiKey(): AuthError {
        return new AuthError(
            'E403',
            'Invalid API key',
            'The provided API key is invalid. Verify your API key or generate a new one using: pnpm run generate-api-key'
        );
    }

    static insufficientPermissions(resource: string): AuthError {
        return new AuthError(
            'E403',
            `Insufficient permissions to access ${resource}`,
            'Your API key does not have permission to access this resource. Contact your administrator for access.'
        );
    }
}
