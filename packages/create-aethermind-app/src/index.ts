#!/usr/bin/env node

import { runCLI } from './prompts.js';
import chalk from 'chalk';

async function main() {
    console.log(chalk.cyan('\n🚀 Welcome to Aethermind AgentOS!\n'));
    console.log(chalk.gray('Create a new AI agent project in seconds\n'));

    try {
        await runCLI();
    } catch (error) {
        if (error instanceof Error) {
            console.error(chalk.red('\n❌ Error:'), error.message);
        }
        process.exit(1);
    }
}

main();
