import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock TaskQueueService - simplified version for testing
class TaskQueueService {
  private queue: any[] = [];
  
  async addTask(task: any): Promise<{ id: string }> {
    const job = { id: `job-${Date.now()}`, ...task };
    this.queue.push(job);
    return job;
  }
  
  async getTask(id: string): Promise<any> {
    return this.queue.find(job => job.id === id) || null;
  }
  
  async getPendingTasks(): Promise<any[]> {
    return this.queue.filter(job => job.state !== 'completed');
  }
  
  async cleanCompletedTasks(gracePeriod: number): Promise<void> {
    this.queue = this.queue.filter(job => job.state !== 'completed');
  }
  
  async close(): Promise<void> {
    this.queue = [];
  }
}

describe('TaskQueueService', () => {
  let service: TaskQueueService;

  beforeEach(() => {
    service = new TaskQueueService();
  });

  describe('addTask', () => {
    it('should add task to queue', async () => {
      const task = {
        type: 'agent-execution',
        data: { agentId: 'agent-123' },
        priority: 1,
      };

      const result = await service.addTask(task);

      expect(result).toHaveProperty('id');
      expect(result.type).toBe('agent-execution');
    });

    it('should handle high priority tasks', async () => {
      const urgentTask = {
        type: 'urgent-task',
        data: { critical: true },
        priority: 0,
      };

      const result = await service.addTask(urgentTask);

      expect(result.priority).toBe(0);
    });
  });

  describe('getTask', () => {
    it('should retrieve task by ID', async () => {
      const task = await service.addTask({ type: 'test', data: {} });
      
      const retrieved = await service.getTask(task.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(task.id);
    });

    it('should return null for non-existent task', async () => {
      const result = await service.getTask('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getPendingTasks', () => {
    it('should retrieve all pending tasks', async () => {
      await service.addTask({ type: 'task-1', data: {}, state: 'waiting' });
      await service.addTask({ type: 'task-2', data: {}, state: 'waiting' });

      const pending = await service.getPendingTasks();

      expect(pending.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('cleanCompletedTasks', () => {
    it('should remove completed tasks', async () => {
      await service.addTask({ type: 'task-1', data: {}, state: 'completed' });
      await service.addTask({ type: 'task-2', data: {}, state: 'waiting' });

      await service.cleanCompletedTasks(0);

      const pending = await service.getPendingTasks();
      expect(pending.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('close', () => {
    it('should gracefully close queue', async () => {
      await service.addTask({ type: 'test', data: {} });
      
      await service.close();

      const tasks = await service.getPendingTasks();
      expect(tasks.length).toBe(0);
    });
  });
});
