'use client';

import { useEffect, useState } from 'react';
import { CostDashboard } from '@/components/CostDashboard';
import { CostHistoryChart } from '@/components/CostHistoryChart';
import { CostAlertConfig } from '@/components/CostAlertConfig';
import { CostExportButton } from '@/components/CostExportButton';
import { BackToHomeButton } from '@/components/BackToHomeButton';
import { fetchCostSummary, fetchCostHistory, type CostSummary, type CostInfo } from '@/lib/api';

export default function CostsPage() {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [costs, setCosts] = useState<CostInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState<number>(10);

  useEffect(() => {
    async function loadCosts() {
      try {
        const [summaryData, historyData] = await Promise.all([
          fetchCostSummary(),
          fetchCostHistory({
            // Fetch last 90 days by default
            startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        ]);
        setSummary(summaryData);
        setCosts(historyData);
      } catch (error) {
        console.error('Failed to fetch cost data:', error);
        // Set empty data on error
        setSummary({
          total: 0,
          totalTokens: 0,
          executionCount: 0,
          byModel: {},
        });
        setCosts([]);
      } finally {
        setLoading(false);
      }
    }

    loadCosts();

    // Refresh every 10 seconds
    const interval = setInterval(loadCosts, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header with Export Button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Cost Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage your LLM API costs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BackToHomeButton />
          {summary && costs.length > 0 && !loading && (
            <CostExportButton summary={summary} costs={costs} />
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading cost data...
        </div>
      ) : summary ? (
        <>
          {/* Cost Alert Configuration */}
          <CostAlertConfig
            currentCost={summary.total}
            onThresholdChange={setThreshold}
          />

          {/* Cost Dashboard (existing) */}
          <CostDashboard summary={summary} />

          {/* Cost History Chart (new) */}
          {costs.length > 0 && <CostHistoryChart costs={costs} />}
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Failed to load cost data. Please try again.
        </div>
      )}
    </div>
  );
}
