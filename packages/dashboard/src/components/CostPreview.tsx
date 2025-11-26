'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { estimateWorkflowCost, type CostEstimate } from '@/lib/api';
import { formatCost } from '@/lib/utils';
import { Loader2, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';

interface CostPreviewProps {
    workflowName: string;
    input: unknown;
    onConfirm: () => void;
    onCancel: () => void;
}

export function CostPreview({ workflowName, input, onConfirm, onCancel }: CostPreviewProps) {
    const [estimate, setEstimate] = useState<CostEstimate | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchEstimate() {
            try {
                setLoading(true);
                setError(null);
                const data = await estimateWorkflowCost(workflowName, input);
                setEstimate(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to estimate cost');
            } finally {
                setLoading(false);
            }
        }
        fetchEstimate();
    }, [workflowName, input]);

    const getConfidenceBadge = (confidence: string) => {
        const variants = {
            high: 'default',
            medium: 'secondary',
            low: 'outline',
        } as const;

        const colors = {
            high: 'text-green-600',
            medium: 'text-yellow-600',
            low: 'text-orange-600',
        } as const;

        return (
            <Badge variant={variants[confidence as keyof typeof variants]}>
                <span className={colors[confidence as keyof typeof colors]}>
                    {confidence.toUpperCase()} CONFIDENCE
                </span>
            </Badge>
        );
    };

    return (
        <Card className="w-full max-w-2xl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Cost Estimate Preview
                    </CardTitle>
                    {estimate && getConfidenceBadge(estimate.confidence)}
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Calculating cost estimate...</span>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <div>
                            <p className="font-medium text-destructive">Error estimating cost</p>
                            <p className="text-sm text-muted-foreground">{error}</p>
                        </div>
                    </div>
                )}

                {estimate && !loading && (
                    <>
                        {/* Total Cost Summary */}
                        <div className="p-6 bg-primary/5 rounded-lg border-2 border-primary/20">
                            <div className="text-sm text-muted-foreground mb-1">Estimated Total Cost</div>
                            <div className="text-4xl font-bold text-primary">{formatCost(estimate.estimatedCost)}</div>
                            <div className="text-sm text-muted-foreground mt-2">
                                {estimate.tokenCount.totalTokens.toLocaleString()} tokens
                                ({estimate.tokenCount.promptTokens.toLocaleString()} prompt + {estimate.tokenCount.completionTokens.toLocaleString()} completion)
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Based on {estimate.basedOn === 'historical' ? 'historical data' : 'heuristic estimation'}
                            </div>
                        </div>

                        {/* Step Breakdown */}
                        <div>
                            <h3 className="font-semibold mb-3">Cost Breakdown by Step</h3>
                            <div className="space-y-2">
                                {estimate.breakdown.map((step, index) => (
                                    <div
                                        key={step.stepId}
                                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">Step {index + 1}: {step.agentName}</span>
                                                <Badge variant="outline" className="text-xs">
                                                    {step.model}
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground mt-1">
                                                {step.estimatedTokens.totalTokens.toLocaleString()} tokens
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold">{formatCost(step.estimatedCost)}</div>
                                            {step.confidence !== estimate.confidence && (
                                                <div className="text-xs text-muted-foreground">
                                                    {step.confidence} conf.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Warning for low confidence */}
                        {estimate.confidence === 'low' && (
                            <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
                                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                                <div className="text-sm">
                                    <p className="font-medium text-yellow-900 dark:text-yellow-100">
                                        Low Confidence Estimate
                                    </p>
                                    <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                                        This estimate is based on heuristics. Actual cost may vary significantly.
                                        Execute workflows to improve accuracy.
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>

            <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" onClick={onCancel} disabled={loading}>
                    Cancel
                </Button>
                <Button
                    onClick={onConfirm}
                    disabled={loading || !!error}
                    className="gap-2"
                >
                    {estimate && <CheckCircle2 className="h-4 w-4" />}
                    Confirm & Execute
                </Button>
            </CardFooter>
        </Card>
    );
}
