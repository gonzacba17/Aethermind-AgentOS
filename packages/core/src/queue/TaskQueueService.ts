import { Queue, Worker, QueueEvents, Job } from 'bullmq';
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
  defaultJobOptions?: {
    attempts?: number;
    backoff?: { type: string; delay: number };
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
  };
}

export class TaskQueueService {
  private queue: Queue<TaskQueueItem>;
  private worker?: Worker<TaskQueueItem>;
  private queueEvents: QueueEvents;
  private redis: Redis;
  private emitter: EventEmitter.EventEmitter;
  private redisUrl: string;

  constructor(options: TaskQueueOptions, emitter?: EventEmitter.EventEmitter) {
    this.redisUrl = options.redisUrl;
    this.redis = new Redis(options.redisUrl);
    this.emitter = emitter || new EventEmitter.EventEmitter();

    const connection = { url: options.redisUrl };

    this.queue = new Queue<TaskQueueItem>('aethermind-tasks', {
      connection,
      defaultJobOptions: options.defaultJobOptions || {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: 500
      }
    });

    this.queueEvents = new QueueEvents('aethermind-tasks', { connection });
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
    const connection = { url: this.redisUrl };
    this.worker = new Worker<TaskQueueItem>(
      'aethermind-tasks',
      async (job: Job<TaskQueueItem>) => {
        this.emitter.emit('task:processing', { taskId: job.data.id, agentId: job.data.agentId });
        await handler(job.data);
      },
      { connection, concurrency }
    );

    this.worker.on('completed', (job) => {
      this.emitter.emit('task:completed', {
        taskId: job.id,
        agentId: job.data.agentId
      });
    });

    this.worker.on('failed', (job, err) => {
      this.emitter.emit('task:failed', {
        taskId: job?.id,
        agentId: job?.data.agentId,
        error: err.message
      });
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
    this.queueEvents.on('completed', ({ jobId }) => {
      this.emitter.emit('task:completed', { taskId: jobId });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.emitter.emit('task:failed', {
        taskId: jobId,
        error: failedReason
      });
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      this.emitter.emit('task:stalled', { taskId: jobId });
    });

    this.queue.on('error', (error) => {
      this.emitter.emit('queue:error', { error: error.message });
    });
  }

  /**
   * Close the queue and Redis connection
   */
  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    await this.queueEvents.close();
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
