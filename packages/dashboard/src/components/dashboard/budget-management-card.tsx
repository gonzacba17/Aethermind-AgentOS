'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Trash2, Plus, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useClientBudgets, useCreateClientBudget, useDeleteClientBudget } from '@/hooks';
import type { ClientBudget } from '@/hooks';
import { cn } from '@/lib/utils';

function getStatusColor(status: string | undefined) {
  switch (status) {
    case 'exceeded': return 'text-destructive';
    case 'warning': return 'text-yellow-500';
    default: return 'text-green-500';
  }
}

function getStatusIcon(status: string | undefined) {
  switch (status) {
    case 'exceeded': return XCircle;
    case 'warning': return AlertTriangle;
    default: return CheckCircle;
  }
}

function BudgetRow({ budget, onDelete }: { budget: ClientBudget; onDelete: (id: string) => void }) {
  const evaluation = budget.evaluation;
  const StatusIcon = getStatusIcon(evaluation?.status);
  const percentUsed = evaluation?.percentUsed ?? 0;

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3 flex-1">
        <StatusIcon className={cn('h-5 w-5', getStatusColor(evaluation?.status))} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium capitalize">{budget.type}</span>
            <span className="text-sm text-muted-foreground">
              ${budget.limitUsd.toFixed(2)} limit
            </span>
          </div>
          {evaluation && (
            <div className="mt-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-2 max-w-[200px]">
                  <div
                    className={cn(
                      'h-2 rounded-full transition-all',
                      percentUsed >= 100 ? 'bg-destructive' :
                      percentUsed >= 80 ? 'bg-yellow-500' :
                      'bg-green-500'
                    )}
                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  ${evaluation.spentUsd.toFixed(2)} spent ({percentUsed.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(budget.id)}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function BudgetManagementCard() {
  const { data, isLoading } = useClientBudgets();
  const createBudget = useCreateClientBudget();
  const deleteBudget = useDeleteClientBudget();

  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'monthly' | 'daily'>('monthly');
  const [formLimit, setFormLimit] = useState('100');

  const budgets = data?.budgets || [];

  const handleCreate = async () => {
    const limitNum = parseFloat(formLimit);
    if (isNaN(limitNum) || limitNum <= 0) return;

    await createBudget.mutateAsync({
      type: formType,
      limitUsd: limitNum,
      alertThresholds: [80, 90, 100],
    });

    setShowForm(false);
    setFormLimit('100');
  };

  const handleDelete = async (id: string) => {
    await deleteBudget.mutateAsync(id);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" />
              Budget Limits
            </CardTitle>
            <CardDescription>Control your LLM spending with hard limits</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showForm && (
          <div className="mb-4 p-3 border border-border rounded-lg space-y-3">
            <div className="flex gap-2">
              <select
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={formType}
                onChange={(e) => setFormType(e.target.value as 'monthly' | 'daily')}
              >
                <option value="monthly">Monthly</option>
                <option value="daily">Daily</option>
              </select>
              <Input
                type="number"
                placeholder="Limit (USD)"
                value={formLimit}
                onChange={(e) => setFormLimit(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={createBudget.isPending}
              >
                {createBudget.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Alerts at 80%, 90%, and 100%. Execution blocked at 100%.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Loading budgets...</div>
        ) : budgets.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No budgets configured. Add one to control your spending.
          </div>
        ) : (
          <div>
            {budgets.map((budget) => (
              <BudgetRow key={budget.id} budget={budget} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
