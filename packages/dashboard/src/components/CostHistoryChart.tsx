'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import type { CostInfo } from '@/lib/api';
import { formatCost, formatDate } from '@/lib/utils';
import { Calendar, TrendingUp } from 'lucide-react';

interface CostHistoryChartProps {
    costs: CostInfo[];
}

type DateRange = '7' | '30' | '90';

export function CostHistoryChart({ costs }: CostHistoryChartProps) {
    const [dateRange, setDateRange] = useState<DateRange>('30');
    const [selectedAgent, setSelectedAgent] = useState<string>('all');

    // Filter costs by date range
    const filterByDateRange = (cost: CostInfo) => {
        const daysAgo = parseInt(dateRange);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
        return new Date(cost.timestamp) >= cutoffDate;
    };

    // Filter by agent
    const filterByAgent = (cost: CostInfo) => {
        if (selectedAgent === 'all') return true;
        return cost.agentName === selectedAgent;
    };

    // Get unique agents
    const uniqueAgents = Array.from(new Set(costs.map(c => c.agentName).filter(Boolean)));

    // Filter and aggregate data by day
    const filteredCosts = costs.filter(filterByDateRange).filter(filterByAgent);

    const aggregatedData = filteredCosts.reduce((acc, cost) => {
        const date = new Date(cost.timestamp).toLocaleDateString();
        if (!acc[date]) {
            acc[date] = { date, cost: 0, tokens: 0, count: 0 };
        }
        acc[date].cost += cost.cost;
        acc[date].tokens += cost.totalTokens;
        acc[date].count += 1;
        return acc;
    }, {} as Record<string, { date: string; cost: number; tokens: number; count: number }>);

    const chartData = Object.values(aggregatedData).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate statistics
    const totalCost = filteredCosts.reduce((sum, c) => sum + c.cost, 0);
    const avgCost = filteredCosts.length > 0 ? totalCost / filteredCosts.length : 0;
    const totalTokens = filteredCosts.reduce((sum, c) => sum + c.totalTokens, 0);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Cost History
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {/* Agent Filter */}
                        <select
                            value={selectedAgent}
                            onChange={(e) => setSelectedAgent(e.target.value)}
                            className="px-3 py-1.5 text-sm border rounded-md bg-background"
                        >
                            <option value="all">All Agents</option>
                            {uniqueAgents.map(agent => (
                                <option key={agent} value={agent}>{agent}</option>
                            ))}
                        </select>

                        {/* Date Range Filter */}
                        <div className="flex gap-1 border rounded-md p-1">
                            {(['7', '30', '90'] as DateRange[]).map((range) => (
                                <Button
                                    key={range}
                                    variant={dateRange === range ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setDateRange(range)}
                                    className="h-7 px-3"
                                >
                                    {range}d
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Statistics Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">Total Cost</div>
                        <div className="text-2xl font-bold">{formatCost(totalCost)}</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">Average Cost</div>
                        <div className="text-2xl font-bold">{formatCost(avgCost)}</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">Total Tokens</div>
                        <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
                    </div>
                </div>

                {/* Chart */}
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value: string) => {
                                    const date = new Date(value);
                                    return `${date.getMonth() + 1}/${date.getDate()}`;
                                }}
                            />
                            <YAxis
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value: number) => `$${value.toFixed(2)}`}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (!active || !payload || !payload.length) return null;
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                                            <div className="font-medium mb-2">{data.date}</div>
                                            <div className="space-y-1 text-sm">
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-muted-foreground">Cost:</span>
                                                    <span className="font-semibold">{formatCost(data.cost)}</span>
                                                </div>
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-muted-foreground">Executions:</span>
                                                    <span className="font-semibold">{data.count}</span>
                                                </div>
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-muted-foreground">Tokens:</span>
                                                    <span className="font-semibold">{data.tokens.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="cost"
                                stroke="#0088FE"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                                name="Daily Cost ($)"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-[350px] flex flex-col items-center justify-center text-muted-foreground">
                        <Calendar className="h-12 w-12 mb-3 opacity-50" />
                        <p>No cost data available for the selected period</p>
                        <p className="text-sm mt-1">Execute some workflows to see cost trends</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
