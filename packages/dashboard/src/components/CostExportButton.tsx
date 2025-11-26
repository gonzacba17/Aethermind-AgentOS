'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { CostSummary, CostInfo } from '@/lib/api';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CostExportButtonProps {
    summary: CostSummary;
    costs: CostInfo[];
}

export function CostExportButton({ summary, costs }: CostExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false);

    const exportToCSV = () => {
        setIsExporting(true);
        try {
            const headers = ['Timestamp', 'Execution ID', 'Agent', 'Workflow', 'Model', 'Prompt Tokens', 'Completion Tokens', 'Total Tokens', 'Cost (USD)'];

            const rows = costs.map(item => [
                new Date(item.timestamp).toISOString(),
                item.executionId,
                item.agentName || '-',
                item.workflowName || '-',
                item.model,
                item.promptTokens.toString(),
                item.completionTokens.toString(),
                item.totalTokens.toString(),
                item.cost.toFixed(6),
            ]);

            const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `cost-report-${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export CSV:', error);
            alert('Failed to export CSV. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    const exportToPDF = () => {
        setIsExporting(true);
        try {
            const doc = new jsPDF();

            // Title
            doc.setFontSize(20);
            doc.text('Cost Analytics Report', 14, 20);

            // Date
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

            // Summary Section
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text('Summary', 14, 40);

            doc.setFontSize(10);
            const summaryData = [
                ['Total Cost', `$${summary.total.toFixed(4)}`],
                ['Total Tokens', summary.totalTokens.toLocaleString()],
                ['Total Executions', summary.executionCount.toString()],
            ];

            autoTable(doc, {
                startY: 45,
                head: [['Metric', 'Value']],
                body: summaryData,
                theme: 'grid',
                headStyles: { fillColor: [0, 136, 254] },
            });

            // Model Breakdown Section
            const modelBreakdownY = (doc as any).lastAutoTable.finalY + 10;
            doc.setFontSize(14);
            doc.text('Cost by Model', 14, modelBreakdownY);

            const modelData = Object.entries(summary.byModel).map(([model, data]) => [
                model,
                data.count.toString(),
                data.tokens.toLocaleString(),
                `$${data.cost.toFixed(4)}`,
            ]);

            autoTable(doc, {
                startY: modelBreakdownY + 5,
                head: [['Model', 'Executions', 'Tokens', 'Cost']],
                body: modelData,
                theme: 'grid',
                headStyles: { fillColor: [0, 136, 254] },
            });

            // Detailed Transactions (last 50)
            const detailsY = (doc as any).lastAutoTable.finalY + 10;
            doc.setFontSize(14);
            doc.text('Recent Transactions (Last 50)', 14, detailsY);

            const recentCosts = costs.slice(-50).reverse();
            const detailData = recentCosts.map(item => [
                new Date(item.timestamp).toLocaleString(),
                (item.agentName || item.workflowName || '-').substring(0, 20),
                item.model.substring(0, 15),
                item.totalTokens.toLocaleString(),
                `$${item.cost.toFixed(4)}`,
            ]);

            autoTable(doc, {
                startY: detailsY + 5,
                head: [['Timestamp', 'Agent/Workflow', 'Model', 'Tokens', 'Cost']],
                body: detailData,
                theme: 'striped',
                headStyles: { fillColor: [0, 136, 254] },
                styles: { fontSize: 8 },
            });

            // Footer
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(
                    `Page ${i} of ${pageCount}`,
                    doc.internal.pageSize.getWidth() / 2,
                    doc.internal.pageSize.getHeight() - 10,
                    { align: 'center' }
                );
            }

            // Save
            doc.save(`cost-report-${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Failed to export PDF:', error);
            alert('Failed to export PDF. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={isExporting || costs.length === 0}
                className="gap-2"
            >
                <FileSpreadsheet className="h-4 w-4" />
                Export CSV
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={exportToPDF}
                disabled={isExporting || costs.length === 0}
                className="gap-2"
            >
                <FileText className="h-4 w-4" />
                Export PDF
            </Button>
        </div>
    );
}
