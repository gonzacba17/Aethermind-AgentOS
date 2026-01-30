# Flujo de Frontend para Aethermind Dashboard

## Contexto del Proyecto

Este documento describe el flujo completo del frontend para **Aethermind Agent OS**, una plataforma de gestión de agentes LLM con tracking de costos, presupuestos y optimización. El backend está en Express + TypeScript con autenticación JWT.

---

## 1. ARQUITECTURA DE AUTENTICACIÓN

```
┌─────────────────────────────────────────────────────────────────┐
│                        FLUJO DE AUTH                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Login/  │───▶│  POST    │───▶│  Recibe  │───▶│ Guarda   │  │
│  │  Signup  │    │ /auth/*  │    │  JWT +   │    │ token en │  │
│  │  Page    │    │          │    │  User    │    │ storage  │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                       │         │
│                                                       ▼         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │Dashboard │◀───│ AuthGuard│◀───│ Valida   │◀───│ GET      │  │
│  │  Pages   │    │ Wrapper  │    │ Token    │    │ /auth/me │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. PÁGINAS REQUERIDAS

```typescript
// Estructura de rutas del frontend
const routes = {
  // Públicas (sin auth)
  public: {
    landing: '/',
    login: '/login',
    signup: '/signup',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password',  // ?token=xxx
    verifyEmail: '/verify-email',      // ?token=xxx
  },

  // Protegidas (requieren JWT)
  protected: {
    dashboard: '/dashboard',
    agents: '/agents',
    agentDetail: '/agents/:id',
    costs: '/costs',
    budgets: '/budgets',
    traces: '/traces',
    traceDetail: '/traces/:id',
    logs: '/logs',
    settings: {
      profile: '/settings/profile',
      apiKeys: '/settings/api-keys',
      organization: '/settings/organization',
      alerts: '/settings/alerts',
    },
  },
};
```

---

## 3. SERVICIO DE AUTENTICACIÓN

```typescript
// lib/auth.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface User {
  id: string;
  email: string;
  name?: string;
  plan: 'free' | 'pro' | 'enterprise';
  apiKey: string;
  emailVerified: boolean;
  usageCount: number;
  usageLimit: number;
  subscriptionStatus?: string;
  hasCompletedOnboarding: boolean;
  onboardingStep?: string;
}

interface AuthResponse {
  token: string;
  user: User;
  newToken?: string; // Para usuarios temporales convertidos
}

class AuthService {
  private tokenKey = 'auth_token';

  // Signup con email/password
  async signup(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Signup failed');
    }

    const data = await res.json();
    this.setToken(data.token);
    return data;
  }

  // Login con email/password
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Invalid credentials');
    }

    const data = await res.json();
    this.setToken(data.token);
    return data;
  }

  // OAuth - redirige al provider
  initiateOAuth(provider: 'google' | 'github'): void {
    const redirectUrl = encodeURIComponent(window.location.origin + '/dashboard');
    window.location.href = `${API_URL}/auth/${provider}?redirect=${redirectUrl}`;
  }

  // Obtener usuario actual (valida token)
  async getCurrentUser(): Promise<User | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Para cookies httpOnly
      });

      if (!res.ok) {
        this.removeToken();
        return null;
      }

      const data = await res.json();

      // Si hay nuevo token (usuario temp convertido), actualizarlo
      if (data.newToken) {
        this.setToken(data.newToken);
      }

      return data.user;
    } catch {
      this.removeToken();
      return null;
    }
  }

  // Verificar email
  async verifyEmail(token: string): Promise<void> {
    const res = await fetch(`${API_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Verification failed');
    }
  }

  // Solicitar reset de password
  async forgotPassword(email: string): Promise<void> {
    await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    // Siempre retorna success por seguridad
  }

  // Resetear password
  async resetPassword(token: string, password: string): Promise<void> {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Reset failed');
    }
  }

  // Actualizar onboarding
  async updateOnboarding(step: string, completed?: boolean): Promise<void> {
    const token = this.getToken();
    await fetch(`${API_URL}/auth/onboarding`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ step, completed }),
    });
  }

  // Helpers de token
  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  removeToken(): void {
    localStorage.removeItem(this.tokenKey);
  }

  logout(): void {
    this.removeToken();
    window.location.href = '/login';
  }
}

export const authService = new AuthService();
```

---

## 4. COMPONENTE AUTH GUARD

```tsx
// components/AuthGuard.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authService } from '@/lib/auth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const user = await authService.getCurrentUser();

      if (!user) {
        // Guardar URL para redirect post-login
        sessionStorage.setItem('redirectAfterLogin', pathname);
        router.push('/login');
        return;
      }

      // Verificar onboarding para nuevos usuarios
      if (!user.hasCompletedOnboarding && pathname !== '/onboarding') {
        router.push('/onboarding');
        return;
      }

      setIsAuthenticated(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [pathname, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
```

---

## 5. API CLIENT PARA DASHBOARD

```typescript
// lib/api.ts
import { authService } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = authService.getToken();

    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      credentials: 'include',
    });

    if (res.status === 401) {
      authService.logout();
      throw new Error('Session expired');
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || 'Request failed');
    }

    return res.json();
  }

  // ========== AGENTS ==========
  async getAgents(page = 1, limit = 20) {
    return this.request<{ agents: Agent[]; pagination: Pagination }>(
      `/api/agents?page=${page}&limit=${limit}`
    );
  }

  async getAgent(id: string) {
    return this.request<Agent>(`/api/agents/${id}`);
  }

  async createAgent(data: CreateAgentInput) {
    return this.request<Agent>('/api/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async executeAgent(id: string, input: Record<string, unknown>) {
    return this.request<ExecutionResult>(`/api/agents/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({ input }),
    });
  }

  // ========== COSTS ==========
  async getCosts(filters?: CostFilters) {
    const params = new URLSearchParams(filters as Record<string, string>);
    return this.request<{ costs: Cost[]; pagination: Pagination }>(
      `/api/costs?${params}`
    );
  }

  async getCostsSummary() {
    return this.request<CostSummary>('/api/costs/summary');
  }

  // ========== BUDGETS ==========
  async getBudgets() {
    return this.request<{ budgets: Budget[] }>('/api/budgets');
  }

  async createBudget(data: CreateBudgetInput) {
    return this.request<Budget>('/api/budgets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBudget(id: string, data: Partial<Budget>) {
    return this.request<Budget>(`/api/budgets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getBudgetUsage(id: string) {
    return this.request<BudgetUsage>(`/api/budgets/${id}/usage`);
  }

  // ========== TRACES ==========
  async getTraces(filters?: TraceFilters) {
    const params = new URLSearchParams(filters as Record<string, string>);
    return this.request<{ traces: Trace[] }>(`/api/traces?${params}`);
  }

  async getTrace(id: string) {
    return this.request<TraceDetail>(`/api/traces/${id}`);
  }

  // ========== LOGS ==========
  async getLogs(filters?: LogFilters) {
    const params = new URLSearchParams(filters as Record<string, string>);
    return this.request<{ logs: Log[] }>(`/api/logs?${params}`);
  }

  // ========== API KEYS ==========
  async getApiKeys() {
    return this.request<{ apiKeys: ApiKey[] }>('/api/user/api-keys');
  }

  async createApiKey(name: string) {
    return this.request<ApiKey>('/api/user/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async revokeApiKey(id: string) {
    return this.request<void>(`/api/user/api-keys/${id}`, {
      method: 'DELETE',
    });
  }

  // ========== OPTIMIZATION ==========
  async getOptimizationSuggestions() {
    return this.request<OptimizationSuggestion[]>('/api/optimization/suggestions');
  }

  async getForecasts() {
    return this.request<Forecast>('/api/forecasting');
  }

  // ========== STRIPE/BILLING ==========
  async createCheckoutSession(plan: 'pro' | 'enterprise') {
    return this.request<{ url: string }>('/api/stripe/create-checkout', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
  }

  async getBillingPortalUrl() {
    return this.request<{ url: string }>('/api/stripe/billing-portal');
  }
}

export const api = new ApiClient();
```

---

## 6. FLUJOS DE USUARIO

### 6.1 Registro y Primer Acceso

```
1. Usuario llega a /signup
2. Completa formulario (email, password)
3. POST /auth/signup → recibe token + user
4. Guarda token en localStorage
5. Redirect a /onboarding (si hasCompletedOnboarding: false)
6. Completa pasos de onboarding
7. PATCH /auth/onboarding con cada paso
8. Al finalizar → redirect a /dashboard
```

### 6.2 Login con OAuth

```
1. Usuario clickea "Continuar con Google"
2. authService.initiateOAuth('google')
3. Redirect a /auth/google?redirect={dashboard_url}
4. Usuario autoriza en Google
5. Callback a /auth/google/callback
6. Backend genera JWT y setea cookie httpOnly
7. Redirect a /dashboard
8. AuthGuard valida con GET /auth/me
9. Dashboard carga datos del usuario
```

### 6.3 Navegación en Dashboard

```
1. AuthGuard verifica token en cada cambio de ruta
2. Si token válido → renderiza página
3. Si token inválido → redirect a /login
4. Cada API call incluye header Authorization
5. Si 401 → logout automático
```

---

## 7. ESTADO GLOBAL (CONTEXT/STORE)

```tsx
// contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '@/lib/auth';

interface User {
  id: string;
  email: string;
  name?: string;
  plan: 'free' | 'pro' | 'enterprise';
  usageCount: number;
  usageLimit: number;
  hasCompletedOnboarding: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithOAuth: (provider: 'google' | 'github') => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const userData = await authService.getCurrentUser();
    setUser(userData);
  };

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { user } = await authService.login(email, password);
    setUser(user);
  };

  const signup = async (email: string, password: string) => {
    const { user } = await authService.signup(email, password);
    setUser(user);
  };

  const loginWithOAuth = (provider: 'google' | 'github') => {
    authService.initiateOAuth(provider);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      signup,
      loginWithOAuth,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

---

## 8. VARIABLES DE ENTORNO

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=Aethermind
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx  # Solo si implementas OAuth en frontend
```

---

## 9. ESTRUCTURA DE CARPETAS RECOMENDADA

```
src/
├── app/
│   ├── (auth)/              # Rutas públicas
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   └── verify-email/
│   ├── (dashboard)/         # Rutas protegidas
│   │   ├── layout.tsx       # Wrapper con AuthGuard + Sidebar
│   │   ├── dashboard/
│   │   ├── agents/
│   │   ├── costs/
│   │   ├── budgets/
│   │   ├── traces/
│   │   ├── logs/
│   │   └── settings/
│   ├── onboarding/
│   └── layout.tsx           # Root layout con AuthProvider
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   └── OAuthButtons.tsx
│   ├── dashboard/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── StatsCards.tsx
│   │   └── ...
│   └── ui/                  # Componentes base (shadcn/ui)
├── lib/
│   ├── auth.ts
│   ├── api.ts
│   └── utils.ts
├── contexts/
│   └── AuthContext.tsx
├── hooks/
│   ├── useAgents.ts
│   ├── useCosts.ts
│   └── useBudgets.ts
└── types/
    └── index.ts
```

---

## 10. ENDPOINTS DEL BACKEND

### Autenticación (`/auth/*`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/auth/signup` | Registro con email/password | No |
| POST | `/auth/login` | Login con email/password | No |
| GET | `/auth/me` | Obtener usuario actual | JWT |
| POST | `/auth/verify-email` | Verificar email | No |
| POST | `/auth/forgot-password` | Solicitar reset | No |
| POST | `/auth/reset-password` | Resetear password | No |
| PATCH | `/auth/onboarding` | Actualizar onboarding | JWT |
| POST | `/auth/update-plan` | Cambiar plan | JWT |

### OAuth (`/auth/*`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/auth/google` | Iniciar OAuth Google |
| GET | `/auth/google/callback` | Callback Google |
| GET | `/auth/github` | Iniciar OAuth GitHub |
| GET | `/auth/github/callback` | Callback GitHub |

### Agents (`/api/agents`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/agents` | Listar agentes |
| GET | `/api/agents/:id` | Detalle de agente |
| POST | `/api/agents` | Crear agente |
| PATCH | `/api/agents/:id` | Actualizar agente |
| DELETE | `/api/agents/:id` | Eliminar agente |
| POST | `/api/agents/:id/execute` | Ejecutar agente |

### Costs (`/api/costs`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/costs` | Listar costos |
| GET | `/api/costs/summary` | Resumen de costos |
| POST | `/api/costs` | Registrar costo |

### Budgets (`/api/budgets`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/budgets` | Listar presupuestos |
| GET | `/api/budgets/:id` | Detalle de presupuesto |
| POST | `/api/budgets` | Crear presupuesto |
| PATCH | `/api/budgets/:id` | Actualizar presupuesto |
| DELETE | `/api/budgets/:id` | Eliminar presupuesto |
| GET | `/api/budgets/:id/usage` | Uso del presupuesto |

### API Keys (`/api/user/api-keys`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/user/api-keys` | Listar API keys |
| POST | `/api/user/api-keys` | Crear API key |
| DELETE | `/api/user/api-keys/:id` | Revocar API key |

### Optimization (`/api/optimization`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/optimization/suggestions` | Sugerencias de optimización |
| POST | `/api/optimization/route` | Routing inteligente |
| GET | `/api/optimization/analyze` | Análisis de uso |

### Forecasting (`/api/forecasting`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/forecasting` | Predicciones de costos |

---

## 11. TIPOS TYPESCRIPT

```typescript
// types/index.ts

// ========== AUTH ==========
interface User {
  id: string;
  email: string;
  name?: string;
  plan: 'free' | 'pro' | 'enterprise';
  apiKey: string;
  emailVerified: boolean;
  usageCount: number;
  usageLimit: number;
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'free';
  hasCompletedOnboarding: boolean;
  onboardingStep?: string;
  createdAt: string;
}

// ========== AGENTS ==========
interface Agent {
  id: string;
  name: string;
  description?: string;
  model: string;
  status: 'active' | 'inactive' | 'error';
  lastExecutedAt?: string;
  executionCount: number;
  totalCost: number;
  createdAt: string;
}

interface CreateAgentInput {
  name: string;
  description?: string;
  model: string;
  systemPrompt?: string;
  tools?: string[];
}

interface ExecutionResult {
  id: string;
  agentId: string;
  status: 'success' | 'error';
  output: unknown;
  cost: number;
  tokens: { input: number; output: number };
  duration: number;
  createdAt: string;
}

// ========== COSTS ==========
interface Cost {
  id: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  executionId?: string;
  agentId?: string;
  createdAt: string;
}

interface CostSummary {
  totalCost: number;
  totalTokens: number;
  totalExecutions: number;
  byModel: Record<string, { cost: number; tokens: number; count: number }>;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

interface CostFilters {
  model?: string;
  agentId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ========== BUDGETS ==========
interface Budget {
  id: string;
  name: string;
  limitAmount: number;
  currentSpend: number;
  period: 'daily' | 'weekly' | 'monthly';
  scope: 'user' | 'team' | 'agent' | 'workflow' | 'global';
  scopeId?: string;
  hardLimit: boolean;
  alertAt: number;
  status: 'active' | 'paused' | 'exceeded';
  createdAt: string;
}

interface CreateBudgetInput {
  name: string;
  limitAmount: number;
  period: 'daily' | 'weekly' | 'monthly';
  scope: 'user' | 'team' | 'agent' | 'workflow' | 'global';
  scopeId?: string;
  hardLimit?: boolean;
  alertAt?: number;
}

interface BudgetUsage {
  budget: Budget;
  percentUsed: number;
  remaining: number;
  projectedOverage: number;
  daysUntilReset: number;
}

// ========== TRACES ==========
interface Trace {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'error';
  duration: number;
  spanCount: number;
  createdAt: string;
}

interface TraceDetail extends Trace {
  spans: Span[];
  metadata: Record<string, unknown>;
}

interface Span {
  id: string;
  name: string;
  parentId?: string;
  startTime: string;
  endTime: string;
  status: 'ok' | 'error';
  attributes: Record<string, unknown>;
}

// ========== LOGS ==========
interface Log {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface LogFilters {
  level?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ========== API KEYS ==========
interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt?: string;
  createdAt: string;
}

// ========== PAGINATION ==========
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ========== OPTIMIZATION ==========
interface OptimizationSuggestion {
  id: string;
  type: 'model_switch' | 'caching' | 'batching' | 'prompt_optimization';
  title: string;
  description: string;
  potentialSavings: number;
  confidence: number;
}

// ========== FORECASTING ==========
interface Forecast {
  daily: number;
  weekly: number;
  monthly: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
}
```

---

## 12. SEGURIDAD

### Almacenamiento de Token
- **localStorage**: Para el JWT principal (`auth_token`)
- **httpOnly cookie**: Seteada por el backend en OAuth flow
- **Nunca** almacenar tokens en URLs o sessionStorage

### Headers Requeridos
```typescript
{
  'Authorization': 'Bearer <jwt_token>',
  'Content-Type': 'application/json',
}
```

### Manejo de Errores 401
- Limpiar token de localStorage
- Redirect a `/login`
- Mostrar mensaje "Sesión expirada"

### Rate Limiting
El backend aplica rate limiting:
- Auth endpoints: 5 intentos / 15 min
- API general: 100 requests / 15 min

El frontend debe manejar respuestas 429 (Too Many Requests).

---

## 13. EJEMPLO DE PÁGINA DE DASHBOARD

```tsx
// app/(dashboard)/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { CostsChart } from '@/components/dashboard/CostsChart';
import { RecentAgents } from '@/components/dashboard/RecentAgents';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CostSummary | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [costsSummary, agentsData] = await Promise.all([
          api.getCostsSummary(),
          api.getAgents(1, 5),
        ]);

        setStats(costsSummary);
        setAgents(agentsData.agents);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {user?.name || user?.email}
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your agents
        </p>
      </div>

      <StatsCards
        totalCost={stats?.totalCost || 0}
        totalTokens={stats?.totalTokens || 0}
        totalExecutions={stats?.totalExecutions || 0}
        trend={stats?.trend || 'stable'}
        usagePercent={(user?.usageCount || 0) / (user?.usageLimit || 1) * 100}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CostsChart data={stats?.byModel || {}} />
        <RecentAgents agents={agents} />
      </div>
    </div>
  );
}
```

---

## 14. CHECKLIST DE IMPLEMENTACIÓN

- [ ] Configurar proyecto Next.js con App Router
- [ ] Instalar dependencias (shadcn/ui, lucide-react, etc.)
- [ ] Implementar AuthService (`lib/auth.ts`)
- [ ] Implementar ApiClient (`lib/api.ts`)
- [ ] Crear AuthContext (`contexts/AuthContext.tsx`)
- [ ] Crear AuthGuard (`components/AuthGuard.tsx`)
- [ ] Implementar páginas de auth (login, signup, etc.)
- [ ] Implementar layout del dashboard con Sidebar
- [ ] Crear páginas del dashboard
- [ ] Implementar hooks para data fetching
- [ ] Agregar manejo de errores global
- [ ] Configurar variables de entorno
- [ ] Testing de flujos de autenticación
- [ ] Testing de integración con API
