import { watch, FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import path from 'path';

export interface ConfigWatcherOptions {
  watchPath: string;
  patterns: string[];
  debounceMs?: number;
  ignored?: string | string[];
  deep?: boolean;
}

export interface ConfigWatcherEvents {
  change: (filepath: string) => void;
  add: (filepath: string) => void;
  unlink: (filepath: string) => void;
  error: (error: Error) => void;
  ready: () => void;
}

export class ConfigWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private options: Required<ConfigWatcherOptions>;

  constructor(options: ConfigWatcherOptions) {
    super();
    
    this.options = {
      watchPath: options.watchPath,
      patterns: options.patterns,
      debounceMs: options.debounceMs ?? 300,
      ignored: options.ignored ?? '**/.git',
      deep: options.deep ?? true,
    };
  }

  public start(): void {
    if (this.watcher) {
      console.warn('ConfigWatcher already started');
      return;
    }

    const { watchPath, patterns, ignored, deep } = this.options;

    this.watcher = watch(patterns.map(p => path.join(watchPath, p)), {
      ignored,
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
      depth: deep ? undefined : 0,
    });

    this.watcher
      .on('add', (filepath) => this.handleEvent('add', filepath))
      .on('change', (filepath) => this.handleEvent('change', filepath))
      .on('unlink', (filepath) => this.handleEvent('unlink', filepath))
      .on('error', (error) => this.emit('error', error))
      .on('ready', () => this.emit('ready'));
  }

  public async stop(): Promise<void> {
    if (!this.watcher) {
      return;
    }

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    await this.watcher.close();
    this.watcher = null;
  }

  private handleEvent(event: 'add' | 'change' | 'unlink', filepath: string): void {
    const key = `${event}:${filepath}`;

    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      this.emit(event, filepath);
    }, this.options.debounceMs);

    this.debounceTimers.set(key, timer);
  }

  public getWatchedPaths(): string[] {
    if (!this.watcher) {
      return [];
    }

    const watched = this.watcher.getWatched();
    const paths: string[] = [];

    for (const [dir, files] of Object.entries(watched)) {
      for (const file of files) {
        paths.push(path.join(dir, file));
      }
    }

    return paths;
  }

  public isActive(): boolean {
    return this.watcher !== null;
  }
}

export function createConfigWatcher(options: ConfigWatcherOptions): ConfigWatcher {
  const watcher = new ConfigWatcher(options);
  watcher.start();
  return watcher;
}

export type ConfigWatcherEventMap = {
  [K in keyof ConfigWatcherEvents]: ConfigWatcherEvents[K];
};

export default ConfigWatcher;
