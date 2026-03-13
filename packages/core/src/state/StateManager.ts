import EventEmitter from 'eventemitter3';

export interface StateChange<T = unknown> {
  key: string;
  previousValue: T | undefined;
  newValue: T;
  timestamp: Date;
}

export class StateManager {
  private state: Map<string, unknown> = new Map();
  private history: StateChange[] = [];
  private emitter: EventEmitter.EventEmitter;
  private maxHistorySize: number;

  constructor(maxHistorySize = 1000) {
    this.emitter = new EventEmitter.EventEmitter();
    this.maxHistorySize = maxHistorySize;
  }

  get<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    const previousValue = this.state.get(key);
    this.state.set(key, value);

    const change: StateChange<T> = {
      key,
      previousValue: previousValue as T | undefined,
      newValue: value,
      timestamp: new Date(),
    };

    this.history.push(change);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    this.emitter.emit('change', change);
    this.emitter.emit(`change:${key}`, change);
  }

  has(key: string): boolean {
    return this.state.has(key);
  }

  delete(key: string): boolean {
    const previousValue = this.state.get(key);
    const deleted = this.state.delete(key);

    if (deleted) {
      const change: StateChange = {
        key,
        previousValue,
        newValue: undefined as unknown,
        timestamp: new Date(),
      };
      this.history.push(change);
      this.emitter.emit('delete', change);
      this.emitter.emit(`delete:${key}`, change);
    }

    return deleted;
  }

  clear(): void {
    this.state.clear();
    this.emitter.emit('clear');
  }

  keys(): IterableIterator<string> {
    return this.state.keys();
  }

  values(): IterableIterator<unknown> {
    return this.state.values();
  }

  entries(): IterableIterator<[string, unknown]> {
    return this.state.entries();
  }

  toObject(): Record<string, unknown> {
    return Object.fromEntries(this.state);
  }

  fromObject(obj: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(obj)) {
      this.set(key, value);
    }
  }

  getHistory(): StateChange[] {
    return [...this.history];
  }

  getHistoryForKey(key: string): StateChange[] {
    return this.history.filter((change) => change.key === key);
  }

  onChange<T>(callback: (change: StateChange<T>) => void): () => void {
    this.emitter.on('change', callback);
    return () => this.emitter.off('change', callback);
  }

  onKeyChange<T>(key: string, callback: (change: StateChange<T>) => void): () => void {
    this.emitter.on(`change:${key}`, callback);
    return () => this.emitter.off(`change:${key}`, callback);
  }

  getSnapshot(): Map<string, unknown> {
    return new Map(this.state);
  }

  restoreSnapshot(snapshot: Map<string, unknown>): void {
    this.state = new Map(snapshot);
    this.emitter.emit('restore');
  }

  get size(): number {
    return this.state.size;
  }
}

export function createStateManager(maxHistorySize?: number): StateManager {
  return new StateManager(maxHistorySize);
}
