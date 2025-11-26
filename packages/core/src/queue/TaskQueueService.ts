import Bull, { Queue, Job, JobOptions } from 'bull';
import { Redis } from 'ioredis';
import EventEmitter from 'eventemitter3';

export interface TaskQueueItem {
  id: string;
  agentId: string;
  workflowId?: string;
  priority: number;
  input: unknown;
  createdAt: Date;
}

export interface TaskQueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface TaskQueueOptions {
  redisUrl: string;
  concurrency?: number;
  defaultJobOptions?: JobOptions;
}

export class TaskQueueService {
  private queue: Queue<TaskQueueItem>;
  private redis: Redis;
  private emitter: EventEmitter.EventEmitter;

  constructor(options: TaskQueueOptions, emitter?: EventEmitter.EventEmitter) {
    this.redis = new Redis(options.redisUrl);
    this.emitter = emitter || new EventEmitter.EventEmitter();

    this.queue = new Bull<TaskQueueItem>('aethermind-tasks', {
      redis: options.redisUrl,
      defaultJobOptions: options.defaultJobOptions || {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100, // Keep last 100 completed
        removeOnFail: 500      // Keep last 500 failed
      }
    });

    this.setupEventHandlers();
  }

  /**
   * Add a task to the queue
   */
  async addTask(task: TaskQueueItem): Promise<string> {
    const job = await this.queue.add(task, {
      priority: task.priority,
      jobId: task.id
    });
    
    this.emitter.emit('task:queued', { taskId: task.id, agentId: task.agentId });
    return job.id as string;
  }

  /**
   * Process tasks from the queue
   */
  process(concurrency: number, handler: (task: TaskQueueItem) => Promise<void>): void {
    this.queue.process(concurrency, async (job: Job<TaskQueueItem>) => {
      this.emitter.emit('task:processing', { taskId: job.data.id, agentId: job.data.agentId });
      await handler(job.data);
    });
  }

  /**
   * Get queue metrics
   */
  async getMetrics(): Promise<TaskQueueMetrics> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount()
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    this.emitter.emit('queue:paused');
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    this.emitter.emit('queue:resumed');
  }

  /**
   * Clean completed and failed jobs
   */
  async clean(grace: number = 86400000): Promise<void> {
    await this.queue.clean(grace, 'completed');
    await this.queue.clean(grace, 'failed');
    this.emitter.emit('queue:cleaned', { grace });
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job<TaskQueueItem> | null> {
    return await this.queue.getJob(jobId);
  }

  /**
   * Remove a job from the queue
   */
  async removeJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      this.emitter.emit('task:removed', { taskId: jobId });
    }
  }

  /**
   * Get all waiting jobs
   */
  async getWaitingJobs(): Promise<Job<TaskQueueItem>[]> {
    return await this.queue.getWaiting();
  }

  /**
   * Get all active jobs
   */
  async getActiveJobs(): Promise<Job<TaskQueueItem>[]> {
    return await this.queue.getActive();
  }

  /**
   * Setup event handlers for queue events
   */
  private setupEventHandlers(): void {
    this.queue.on('completed', (job) => {
      this.emitter.emit('task:completed', { 
        taskId: job.id, 
        agentId: job.data.agentId 
      });
    });

    this.queue.on('failed', (job, err) => {
      this.emitter.emit('task:failed', { 
        taskId: job?.id, 
        agentId: job?.data.agentId,
        error: err.message 
      });
    });

    this.queue.on('stalled', (job) => {
      this.emitter.emit('task:stalled', { 
        taskId: job.id, 
        agentId: job.data.agentId 
      });
    });

    this.queue.on('error', (error) => {
      this.emitter.emit('queue:error', { error: error.message });
    });
  }

  /**
   * Close the queue and Redis connection
   */
  async close(): Promise<void> {
    await this.queue.close();
    await this.redis.quit();
    this.emitter.emit('queue:closed');
  }

  /**
   * Get the underlying Bull queue instance
   */
  getQueue(): Queue<TaskQueueItem> {
    return this.queue;
  }
}
