import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import ora from 'ora';
import chalk from 'chalk';
import { execSync } from 'child_process';
import type { ProjectConfig } from './prompts.js';
import { replaceVariables, getPackageManager } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function scaffoldProject(config: ProjectConfig) {
    const { projectName, template, features, installDeps, initGit } = config;
    const targetDir = path.join(process.cwd(), projectName);

    // Check if directory already exists
    if (await fs.pathExists(targetDir)) {
        console.error(chalk.red(`\n❌ Directory "${projectName}" already exists!`));
        process.exit(1);
    }

    // Step 1: Create directory
    const spinner = ora('Creating project directory...').start();
    await fs.ensureDir(targetDir);
    spinner.succeed(chalk.green('Project directory created'));

    // Step 2: Copy template
    spinner.start('Copying template files...');
    const templateDir = path.join(__dirname, '../templates', template);

    if (!(await fs.pathExists(templateDir))) {
        spinner.fail(chalk.red(`Template "${template}" not found`));
        process.exit(1);
    }

    await fs.copy(templateDir, targetDir);

    // Copy common files if features selected
    const commonDir = path.join(__dirname, '../templates/common');

    if (features.includes('docker') && (await fs.pathExists(path.join(commonDir, 'docker-compose.yml')))) {
        await fs.copy(
            path.join(commonDir, 'docker-compose.yml'),
            path.join(targetDir, 'docker-compose.yml')
        );
    }

    spinner.succeed(chalk.green('Template files copied'));

    // Step 3: Replace variables
    spinner.start('Configuring project...');
    await replaceVariables(targetDir, {
        PROJECT_NAME: projectName,
        HAS_DASHBOARD: features.includes('dashboard') ? 'true' : 'false',
        HAS_OLLAMA: features.includes('ollama') ? 'true' : 'false',
        HAS_EXAMPLES: features.includes('examples') ? 'true' : 'false',
    });
    spinner.succeed(chalk.green('Project configured'));

    // Step 4: Install dependencies
    if (installDeps) {
        const packageManager = getPackageManager();
        spinner.start(`Installing dependencies with ${packageManager}...`);

        try {
            const installCmd = packageManager === 'npm' ? 'npm install' : `${packageManager} install`;
            execSync(installCmd, { cwd: targetDir, stdio: 'ignore' });
            spinner.succeed(chalk.green('Dependencies installed'));
        } catch (error) {
            spinner.fail(chalk.yellow('Failed to install dependencies (you can install them manually)'));
        }
    }

    // Step 5: Git init
    if (initGit) {
        spinner.start('Initializing git repository...');
        try {
            execSync('git init', { cwd: targetDir, stdio: 'ignore' });
            execSync('git add .', { cwd: targetDir, stdio: 'ignore' });
            execSync('git commit -m "Initial commit from create-aethermind-app"', {
                cwd: targetDir,
                stdio: 'ignore'
            });
            spinner.succeed(chalk.green('Git repository initialized'));
        } catch (error) {
            spinner.warn(chalk.yellow('Git init failed (skipping)'));
        }
    }

    // Step 6: Success message
    console.log(chalk.green.bold('\n✨ Project created successfully!\n'));
    console.log(chalk.cyan('📁 Project location:'), chalk.white(targetDir));
    console.log(chalk.cyan('\n🚀 Next steps:\n'));
    console.log(chalk.white(`  cd ${projectName}`));

    if (!installDeps) {
        const packageManager = getPackageManager();
        const installCmd = packageManager === 'npm' ? 'npm install' : `${packageManager} install`;
        console.log(chalk.white(`  ${installCmd}`));
    }

    if (template === 'python') {
        console.log(chalk.white('  pip install -r requirements.txt'));
        console.log(chalk.white('  python main.py'));
    } else {
        console.log(chalk.white('  pnpm dev'));
    }

    console.log(chalk.cyan('\n📚 Documentation:'), chalk.white('https://docs.aethermind.ai'));
    console.log(chalk.cyan('💬 Discord:'), chalk.white('https://discord.gg/aethermind'));
    console.log(chalk.cyan('⭐ GitHub:'), chalk.white('https://github.com/aethermind/agentos\n'));
}
