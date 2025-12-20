import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TaskQueueService, TaskQueueItem, TaskQueueConfig } from '../../src/queue/TaskQueueService';
import { Queue, Worker, Job } from 'bullmq';

// Mock BullMQ
jest.mock('bullmq');
jest.mock('ioredis');

describe('TaskQueueService', () => {
  let queueService: TaskQueueService;
  let mockQueue: jest.Mocked<Queue>;
  let mockWorker: jest.Mocked<Worker>;
  let mockConfig: TaskQueueConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock config
    mockConfig = {
      redis: {
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    };

    // Mock Queue constructor
    mockQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
      getWaitingCount: jest.fn(),
      getActiveCount: jest.fn(),
      getCompletedCount: jest.fn(),
      getFailedCount: jest.fn(),
      getDelayedCount: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      clean: jest.fn(),
      drain: jest.fn(),
      close: jest.fn(),
      isPaused: jest.fn(),
      name: 'test-queue',
    } as any;

    (Queue as jest.MockedClass<typeof Queue>).mockImplementation(() => mockQueue);

    // Mock Worker constructor
    mockWorker = {
      on: jest.fn(),
      close: jest.fn(),
    } as any;

    (Worker as jest.MockedClass<typeof Worker>).mockImplementation(() => mockWorker);

    // Create queue service
    queueService = new TaskQueueService('test-queue', mockConfig);
  });

  afterEach(async () => {
    if (queueService) {
      await queueService.close();
    }
  });

  describe('Constructor', () => {
    it('should create queue with correct configuration', () => {
      expect(Queue).toHaveBeenCalledWith(
        'test-queue',
        expect.objectContaining({
          defaultJobOptions: expect.objectContaining({
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          }),
        })
      );
    });

    it('should initialize with custom config', () => {
      const customConfig: TaskQueueConfig = {
        redis: {
          host: 'custom-host',
          port: 6380,
          password: 'secret',
          db: 1,
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'fixed',
            delay: 2000,
          },
        },
      };

      const customService = new TaskQueueService('custom-queue', customConfig);

      expect(Queue).toHaveBeenCalledWith(
        'custom-queue',
        expect.objectContaining({
          defaultJobOptions: expect.objectContaining({
            attempts: 5,
            backoff: {
              type: 'fixed',
              delay: 2000,
            },
          }),
        })
      );
    });
  });

  describe('addTask', () => {
    it('should add task to queue successfully', async () => {
      const task: TaskQueueItem = {
        id: 'task-1',
        type: 'agent-execution',
        data: { agentId: 'test-agent', input: 'test' },
        priority: 1,
        timestamp: Date.now(),
      };

      const mockJob = { id: 'job-1', data: task } as any;
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await queueService.addTask(task);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'agent-execution',
        task,
        expect.objectContaining({
          priority: 1,
        })
      );
      expect(result).toBe(mockJob);
    });

    it('should add task with custom options', async () => {
      const task: TaskQueueItem = {
        id: 'task-2',
        type: 'workflow-execution',
        data: { workflowId: 'wf-1' },
        timestamp: Date.now(),
      };

      const options = {
        priority: 5,
        delay: 5000,
        jobId: 'custom-job-id',
      };

      mockQueue.add.mockResolvedValue({} as any);

      await queueService.addTask(task, options);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'workflow-execution',
        task,
        expect.objectContaining({
          jobId: 'custom-job-id',
          priority: 5,
          delay: 5000,
        })
      );
    });

    it('should handle add task failures', async () => {
      const task: TaskQueueItem = {
        id: 'task-3',
        type: 'test',
        data: {},
        timestamp: Date.now(),
      };

      mockQueue.add.mockRejectedValue(new Error('Queue full'));

      await expect(queueService.addTask(task)).rejects.toThrow('Queue full');
    });
  });

  describe('onProcess', () => {
    it('should configure worker with handler', () => {
      const handler = jest.fn<(job: Job<TaskQueueItem>) => Promise<any>>().mockResolvedValue({ success: true });

      queueService.onProcess(handler);

      expect(Worker).toHaveBeenCalledWith(
        'test-queue',
        expect.any(Function),
        expect.objectContaining({
          concurrency: 10,
        })
      );
    });

    it('should throw error if worker already configured', () => {
      const handler = jest.fn<(job: Job<TaskQueueItem>) => Promise<any>>().mockResolvedValue({});

      queueService.onProcess(handler);

      expect(() => {
        queueService.onProcess(handler);
      }).toThrow('Worker already configured');
    });

    it('should register event listeners', () => {
      const handler = jest.fn<(job: Job<TaskQueueItem>) => Promise<any>>().mockResolvedValue({});

      queueService.onProcess(handler);

      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('getJob', () => {
    it('should get job by ID', async () => {
      const mockJob = {
        id: 'job-1',
        data: { id: 'task-1', type: 'test', data: {}, timestamp: Date.now() },
      } as any;

      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await queueService.getJob('job-1');

      expect(mockQueue.getJob).toHaveBeenCalledWith('job-1');
      expect(result).toBe(mockJob);
    });

    it('should return null for non-existent job', async () => {
      mockQueue.getJob.mockResolvedValue(undefined);

      const result = await queueService.getJob('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      mockQueue.getWaitingCount.mockResolvedValue(10);
      mockQueue.getActiveCount.mockResolvedValue(5);
      mockQueue.getCompletedCount.mockResolvedValue(100);
      mockQueue.getFailedCount.mockResolvedValue(2);
      mockQueue.getDelayedCount.mockResolvedValue(3);

      const stats = await queueService.getStats();

      expect(stats).toEqual({
        waiting: 10,
        active: 5,
        completed: 100,
        failed: 2,
        delayed: 3,
      });
    });

    it('should handle stats retrieval errors', async () => {
      mockQueue.getWaitingCount.mockRejectedValue(new Error('Redis error'));

      await expect(queueService.getStats()).rejects.toThrow('Redis error');
    });
  });

  describe('pause and resume', () => {
    it('should pause queue', async () => {
      mockQueue.pause.mockResolvedValue(undefined);

      await queueService.pause();

      expect(mockQueue.pause).toHaveBeenCalled();
    });

    it('should resume queue', async () => {
      mockQueue.resume.mockResolvedValue(undefined);

      await queueService.resume();

      expect(mockQueue.resume).toHaveBeenCalled();
    });

    it('should check if queue is paused', async () => {
      mockQueue.isPaused.mockResolvedValue(true);

      const isPaused = await queueService.isPaused();

      expect(isPaused).toBe(true);
      expect(mockQueue.isPaused).toHaveBeenCalled();
    });
  });

  describe('clean', () => {
    it('should clean completed jobs', async () => {
      const cleanedJobs = ['job-1', 'job-2', 'job-3'];
      mockQueue.clean.mockResolvedValue(cleanedJobs);

      const result = await queueService.clean(3600000, 100, 'completed');

      expect(mockQueue.clean).toHaveBeenCalledWith(3600000, 100, 'completed');
      expect(result).toEqual(cleanedJobs);
    });

    it('should clean failed jobs', async () => {
      mockQueue.clean.mockResolvedValue(['failed-job-1']);

      const result = await queueService.clean(86400000, 50, 'failed');

      expect(mockQueue.clean).toHaveBeenCalledWith(86400000, 50, 'failed');
      expect(result).toEqual(['failed-job-1']);
    });
  });

  describe('drain', () => {
    it('should drain queue without delayed jobs', async () => {
      mockQueue.drain.mockResolvedValue(undefined);

      await queueService.drain(false);

      expect(mockQueue.drain).toHaveBeenCalledWith(false);
    });

    it('should drain queue including delayed jobs', async () => {
      mockQueue.drain.mockResolvedValue(undefined);

      await queueService.drain(true);

      expect(mockQueue.drain).toHaveBeenCalledWith(true);
    });
  });

  describe('close', () => {
    it('should close all connections', async () => {
      mockQueue.close.mockResolvedValue(undefined);

      await queueService.close();

      expect(mockQueue.close).toHaveBeenCalled();
    });

    it('should close worker if configured', async () => {
      const handler = jest.fn<(job: Job<TaskQueueItem>) => Promise<any>>().mockResolvedValue({});
      queueService.onProcess(handler);

      mockWorker.close.mockResolvedValue(undefined);
      mockQueue.close.mockResolvedValue(undefined);

      await queueService.close();

      expect(mockWorker.close).toHaveBeenCalled();
      expect(mockQueue.close).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full task lifecycle', async () => {
      const task: TaskQueueItem = {
        id: 'lifecycle-task',
        type: 'test-task',
        data: { test: 'data' },
        timestamp: Date.now(),
      };

      const mockJob = { id: 'job-1', data: task } as any;
      mockQueue.add.mockResolvedValue(mockJob);
      mockQueue.getJob.mockResolvedValue(mockJob);

      // Add task
      const addedJob = await queueService.addTask(task);
      expect(addedJob.id).toBe('job-1');

      // Get task
      const retrievedJob = await queueService.getJob('job-1');
      expect(retrievedJob).toBe(mockJob);
    });

    it('should handle high priority tasks', async () => {
      const highPriorityTask: TaskQueueItem = {
        id: 'urgent-task',
        type: 'urgent',
        data: { priority: 'high' },
        priority: 10,
        timestamp: Date.now(),
      };

      mockQueue.add.mockResolvedValue({} as any);

      await queueService.addTask(highPriorityTask);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'urgent',
        highPriorityTask,
        expect.objectContaining({
          priority: 10,
        })
      );
    });

    it('should handle delayed tasks', async () => {
      const delayedTask: TaskQueueItem = {
        id: 'delayed-task',
        type: 'scheduled',
        data: { scheduledFor: 'later' },
        timestamp: Date.now(),
      };

      mockQueue.add.mockResolvedValue({} as any);

      await queueService.addTask(delayedTask, { delay: 60000 });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'scheduled',
        delayedTask,
        expect.objectContaining({
          delay: 60000,
        })
      );
    });
  });
});
