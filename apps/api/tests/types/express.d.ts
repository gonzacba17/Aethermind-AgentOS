import type { StoreInterface } from '../../src/services/PostgresStore';
import type { RedisCache } from '../../src/services/RedisCache';
import type { BudgetService } from '../../src/services/BudgetService';
import type { AlertService } from '../../src/services/AlertService';
import type { WebSocketManager } from '../../src/websocket/WebSocketManager';

declare global {
  namespace Express {
    interface Request {
      runtime?: any;
      orchestrator?: any;
      workflowEngine?: any;
      store?: any;
      cache?: any;
      budgetService?: BudgetService;
      alertService?: AlertService;
      wsManager?: WebSocketManager;
      prisma?: any;
      user?: { id: string; email: string; plan: string; usageCount: number; usageLimit: number };
    }
  }
}

export {};
