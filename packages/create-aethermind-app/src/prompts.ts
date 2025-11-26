import prompts from 'prompts';
import chalk from 'chalk';
import { scaffoldProject } from './scaffold.js';

export interface ProjectConfig {
    projectName: string;
    template: 'typescript' | 'javascript' | 'python';
    features: string[];
    installDeps: boolean;
    initGit: boolean;
}

export async function runCLI() {
    const response = await prompts(
        [
            {
                type: 'text',
                name: 'projectName',
                message: 'Project name:',
                initial: 'my-aethermind-app',
                validate: (value: string) => {
                    if (!/^[a-z0-9-]+$/.test(value)) {
                        return 'Project name must contain only lowercase letters, numbers, and hyphens';
                    }
                    return true;
                },
            },
            {
                type: 'select',
                name: 'template',
                message: 'Choose a template:',
                choices: [
                    { title: chalk.cyan('TypeScript') + chalk.gray(' (Recommended)'), value: 'typescript' },
                    { title: 'JavaScript', value: 'javascript' },
                    { title: 'Python', value: 'python' },
                ],
                initial: 0,
            },
            {
                type: 'multiselect',
                name: 'features',
                message: 'Select features to include:',
                choices: [
                    { title: 'Dashboard (Next.js)', value: 'dashboard', selected: true },
                    { title: 'Ollama (Local LLM)', value: 'ollama' },
                    { title: 'Docker Compose', value: 'docker', selected: true },
                    { title: 'Example workflows', value: 'examples', selected: true },
                ],
                hint: 'Space to select, Enter to confirm',
            },
            {
                type: 'confirm',
                name: 'installDeps',
                message: 'Install dependencies now?',
                initial: true,
            },
            {
                type: 'confirm',
                name: 'initGit',
                message: 'Initialize git repository?',
                initial: true,
            },
        ],
        {
            onCancel: () => {
                console.log(chalk.yellow('\n👋 Setup cancelled'));
                process.exit(0);
            },
        }
    );

    await scaffoldProject(response as ProjectConfig);
}
