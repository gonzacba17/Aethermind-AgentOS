import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Replace template variables in all files within a directory
 */
export async function replaceVariables(
    dir: string,
    vars: Record<string, string>
): Promise<void> {
    const files = await getAllFiles(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);

        if (stat.isFile() && !isBinaryFile(filePath)) {
            let content = await fs.readFile(filePath, 'utf-8');

            // Replace all variables
            for (const [key, value] of Object.entries(vars)) {
                const regex = new RegExp(`{{${key}}}`, 'g');
                content = content.replace(regex, value);
            }

            await fs.writeFile(filePath, content, 'utf-8');
        }
    }
}

/**
 * Get all files recursively in a directory
 */
async function getAllFiles(dir: string, baseDir: string = dir): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
            const subFiles = await getAllFiles(fullPath, baseDir);
            files.push(...subFiles);
        } else {
            files.push(relativePath);
        }
    }

    return files;
}

/**
 * Check if a file is binary (should not be processed for variable replacement)
 */
function isBinaryFile(filePath: string): boolean {
    const binaryExtensions = [
        '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf',
        '.zip', '.tar', '.gz', '.exe', '.dll', '.so',
        '.woff', '.woff2', '.ttf', '.eot'
    ];

    const ext = path.extname(filePath).toLowerCase();
    return binaryExtensions.includes(ext);
}

/**
 * Detect which package manager is being used
 */
export function getPackageManager(): 'pnpm' | 'yarn' | 'npm' {
    try {
        execSync('pnpm --version', { stdio: 'ignore' });
        return 'pnpm';
    } catch {
        try {
            execSync('yarn --version', { stdio: 'ignore' });
            return 'yarn';
        } catch {
            return 'npm';
        }
    }
}

/**
 * Check if a command exists in PATH
 */
export function commandExists(command: string): boolean {
    try {
        execSync(`${command} --version`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}
