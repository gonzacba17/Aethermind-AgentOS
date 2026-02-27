"use client"

import { BarChart3, TrendingDown, TrendingUp, Minus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useClientBenchmarks } from "@/hooks/api/useClientBenchmarks"

export function BenchmarkCard() {
  const { data, isLoading } = useClientBenchmarks()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  // Hide if insufficient data
  if (!data?.benchmark || data.reason === 'insufficient_data' || data.reason === 'no_client_data') {
    return null
  }

  const { client, benchmark, insights } = data

  const costRatio = benchmark.avgCostPerRequest > 0
    ? client.costPerRequest / benchmark.avgCostPerRequest
    : 1

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Benchmark vs Plataforma
        </CardTitle>
        <CardDescription>
          Compara tu rendimiento contra {benchmark.sampleSize} clientes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cost comparison */}
        <MetricRow
          label="Costo por request"
          clientValue={`$${client.costPerRequest.toFixed(4)}`}
          benchmarkValue={`$${benchmark.avgCostPerRequest.toFixed(4)}`}
          ratio={costRatio}
          invertColor
        />

        {/* Cache hit rate comparison */}
        <MetricRow
          label="Cache hit rate"
          clientValue={`${(client.cacheHitRate * 100).toFixed(1)}%`}
          benchmarkValue={`${(benchmark.avgCacheHitRate * 100).toFixed(1)}%`}
          ratio={benchmark.avgCacheHitRate > 0 ? client.cacheHitRate / benchmark.avgCacheHitRate : 1}
        />

        {/* Compression ratio comparison */}
        <MetricRow
          label="Ratio de compresion"
          clientValue={`${(client.compressionRatio * 100).toFixed(1)}%`}
          benchmarkValue={`${(benchmark.avgCompressionRatio * 100).toFixed(1)}%`}
          ratio={benchmark.avgCompressionRatio > 0 ? client.compressionRatio / benchmark.avgCompressionRatio : 1}
        />

        {/* Insights */}
        {insights.length > 0 && (
          <div className="mt-4 space-y-2">
            {insights.map((insight, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                {insight}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MetricRow({
  label,
  clientValue,
  benchmarkValue,
  ratio,
  invertColor = false,
}: {
  label: string
  clientValue: string
  benchmarkValue: string
  ratio: number
  invertColor?: boolean
}) {
  const isGood = invertColor ? ratio < 1 : ratio > 1
  const isBad = invertColor ? ratio > 1.5 : ratio < 0.5
  const isNeutral = !isGood && !isBad

  const Icon = isGood ? TrendingDown : isBad ? TrendingUp : Minus
  const colorClass = isGood
    ? 'text-green-600'
    : isBad
      ? 'text-red-600'
      : 'text-muted-foreground'

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{clientValue}</span>
        <span className="text-xs text-muted-foreground">vs {benchmarkValue}</span>
        <Icon className={`h-3.5 w-3.5 ${colorClass}`} />
      </div>
    </div>
  )
}
