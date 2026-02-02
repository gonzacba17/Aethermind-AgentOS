'use client'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

export default function OnboardingDemo() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
      <div className="max-w-5xl w-full space-y-8">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-4xl font-bold">See Your AI Costs in Real-Time</h2>
          <p className="text-gray-400">This is what you'll see in your dashboard</p>
        </div>

        {/* Simulated Dashboard Preview */}
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 space-y-6">
          {/* Cost Meters */}
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-black/50 border border-gray-800 rounded-xl p-6">
              <div className="text-gray-400 text-sm mb-2">Current Execution</div>
              <div className="text-3xl font-bold text-green-400">$0.03</div>
              <div className="text-xs text-gray-500 mt-2">GPT-4 • 2.5k tokens</div>
            </div>
            
            <div className="bg-black/50 border border-gray-800 rounded-xl p-6">
              <div className="text-gray-400 text-sm mb-2">Today&apos;s Total</div>
              <div className="text-3xl font-bold">$24.80</div>
              <div className="text-xs text-green-400 mt-2">↓ 32% vs yesterday</div>
            </div>
            
            <div className="bg-black/50 border border-gray-800 rounded-xl p-6">
              <div className="text-gray-400 text-sm mb-2">Monthly Savings</div>
              <div className="text-3xl font-bold text-blue-400">$1,240</div>
              <div className="text-xs text-gray-500 mt-2">Since using Aethermind</div>
            </div>
          </div>

          {/* Execution Log */}
          <div className="space-y-3">
            <h3 className="text-sm text-gray-400 font-semibold">Live Execution Log</h3>
            {[
              { action: 'Code generation', cost: '$0.04', status: 'complete' },
              { action: 'Data analysis', cost: '$0.02', status: 'running' },
              { action: 'API call optimization', cost: '$0.01', status: 'queued' }
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-black/30 border border-gray-800 rounded-lg p-4">
                <span className="text-sm">{item.action}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-green-400">{item.cost}</span>
                  <span className={`text-xs px-3 py-1 rounded-full ${
                    item.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                    item.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center pt-8">
          <button
            onClick={() => router.push('/onboarding/value')}
            className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
          >
            This looks powerful
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
