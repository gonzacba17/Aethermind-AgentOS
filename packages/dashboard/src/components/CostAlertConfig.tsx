'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Bell, BellOff, Settings } from 'lucide-react';

interface CostAlertConfigProps {
    currentCost: number;
    onThresholdChange: (threshold: number) => void;
}

export function CostAlertConfig({ currentCost, onThresholdChange }: CostAlertConfigProps) {
    const [threshold, setThreshold] = useState<number>(10);
    const [enabled, setEnabled] = useState<boolean>(true);
    const [alertType, setAlertType] = useState<'execution' | 'daily' | 'weekly'>('daily');
    const [showConfig, setShowConfig] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('costAlertConfig');
        if (saved) {
            try {
                const config = JSON.parse(saved);
                setThreshold(config.threshold || 10);
                setEnabled(config.enabled ?? true);
                setAlertType(config.alertType || 'daily');
            } catch (e) {
                console.error('Failed to load alert config:', e);
            }
        }
    }, []);

    // Save to localStorage when config changes
    const saveConfig = (newThreshold: number, newEnabled: boolean, newAlertType: string) => {
        const config = {
            threshold: newThreshold,
            enabled: newEnabled,
            alertType: newAlertType,
        };
        localStorage.setItem('costAlertConfig', JSON.stringify(config));
        onThresholdChange(newThreshold);
    };

    const handleThresholdChange = (value: number) => {
        setThreshold(value);
        saveConfig(value, enabled, alertType);
    };

    const handleEnabledToggle = () => {
        const newEnabled = !enabled;
        setEnabled(newEnabled);
        saveConfig(threshold, newEnabled, alertType);
    };

    const handleAlertTypeChange = (type: 'execution' | 'daily' | 'weekly') => {
        setAlertType(type);
        saveConfig(threshold, enabled, type);
    };

    const isThresholdExceeded = enabled && currentCost >= threshold;

    return (
        <>
            {/* Alert Banner (shown when threshold exceeded) */}
            {isThresholdExceeded && (
                <div className="p-4 bg-destructive/10 border-2 border-destructive/50 rounded-lg flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-destructive mb-1">Cost Threshold Exceeded!</h3>
                        <p className="text-sm text-muted-foreground">
                            Current {alertType} cost ({currentCost.toFixed(4)} USD) has exceeded your threshold of ${threshold.toFixed(2)}.
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowConfig(true)}
                        className="shrink-0"
                    >
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Configuration Card */}
            <Card className={showConfig || !isThresholdExceeded ? '' : 'hidden'}>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            {enabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                            Cost Alert Configuration
                        </CardTitle>
                        <Button
                            variant={enabled ? 'default' : 'outline'}
                            size="sm"
                            onClick={handleEnabledToggle}
                            className="gap-2"
                        >
                            {enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                            {enabled ? 'Enabled' : 'Disabled'}
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Current Status */}
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                        <div>
                            <div className="text-sm text-muted-foreground mb-1">Current {alertType} Cost</div>
                            <div className="text-2xl font-bold">${currentCost.toFixed(4)}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-muted-foreground mb-1">Threshold</div>
                            <div className="text-2xl font-bold">${threshold.toFixed(2)}</div>
                        </div>
                        <div>
                            <Badge variant={isThresholdExceeded ? 'destructive' : 'default'}>
                                {isThresholdExceeded ? 'EXCEEDED' : 'OK'}
                            </Badge>
                        </div>
                    </div>

                    {/* Alert Type Selection */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">Alert Type</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['execution', 'daily', 'weekly'] as const).map((type) => (
                                <Button
                                    key={type}
                                    variant={alertType === type ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => handleAlertTypeChange(type)}
                                    disabled={!enabled}
                                    className="capitalize"
                                >
                                    {type}
                                </Button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            {alertType === 'execution' && 'Alert when a single execution exceeds threshold'}
                            {alertType === 'daily' && 'Alert when daily total cost exceeds threshold'}
                            {alertType === 'weekly' && 'Alert when weekly total cost exceeds threshold'}
                        </p>
                    </div>

                    {/* Threshold Input */}
                    <div>
                        <label htmlFor="threshold" className="text-sm font-medium mb-2 block">
                            Threshold Amount (USD)
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <input
                                    id="threshold"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={threshold}
                                    onChange={(e) => handleThresholdChange(parseFloat(e.target.value) || 0)}
                                    disabled={!enabled}
                                    className="w-full pl-7 pr-3 py-2 border rounded-md bg-background disabled:opacity-50"
                                />
                            </div>
                            <div className="flex gap-1">
                                {[1, 5, 10, 25].map((amount) => (
                                    <Button
                                        key={amount}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleThresholdChange(amount)}
                                        disabled={!enabled}
                                    >
                                        ${amount}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                            <strong>Note:</strong> Alerts are currently stored locally in your browser.
                            They will reset if you clear your browser data.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
