'use client'
import { useRouter } from 'next/navigation'

const traces = [
  { agent: 'ResearchAgent', status: 'success', model: 'gpt-4o', cost: '$0.003', latency: '1.2s' },
  { agent: 'WriterAgent', status: 'success', model: 'claude-3', cost: '$0.008', latency: '2.4s' },
  { agent: 'ValidatorAgent', status: 'error', model: 'gpt-4o', cost: '$0.001', latency: '0.3s' },
]

export default function OnboardingDemo() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="fixed top-0 left-0 right-0 h-px bg-white/[0.06] z-50">
        <div className="h-full bg-white" style={{ width: '40%' }} />
      </div>
      <div className="fixed top-3 left-6 font-mono text-xs text-white/20 z-50">
        // step_02 — demo
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-3xl w-full">
          <h2
            className="font-extralight tracking-[-0.04em] text-white mb-4"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
          >
            This is what you&apos;ll see.
          </h2>
          <p className="text-[1.1rem] font-light text-white/50 mb-12">
            Every agent. Every call. Full trace in your dashboard.
          </p>

          {/* Mock trace table */}
          <div className="border border-white/[0.06] mb-4">
            <div className="px-6 py-3 border-b border-white/[0.06]">
              <span className="font-mono text-xs text-white/40">Execution Traces</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-6 py-3 font-mono text-xs text-white/20 font-normal">Agent</th>
                  <th className="text-left px-6 py-3 font-mono text-xs text-white/20 font-normal">Status</th>
                  <th className="text-left px-6 py-3 font-mono text-xs text-white/20 font-normal">Model</th>
                  <th className="text-right px-6 py-3 font-mono text-xs text-white/20 font-normal">Cost</th>
                  <th className="text-right px-6 py-3 font-mono text-xs text-white/20 font-normal">Latency</th>
                </tr>
              </thead>
              <tbody>
                {traces.map((trace, i) => (
                  <tr key={i} className="border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-sm text-white/70">{trace.agent}</td>
                    <td className="px-6 py-4">
                      <span className={`font-mono text-xs ${trace.status === 'error' ? 'text-[#ff4444]' : 'text-white/70'}`}>
                        {trace.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-white/40">{trace.model}</td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-white/70">{trace.cost}</td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-white/40">{trace.latency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="font-mono text-xs text-white/20 mb-12">
            // live data from your agents — not a simulation
          </p>

          <button
            onClick={() => router.push('/onboarding/value')}
            className="text-sm px-8 py-3 bg-white text-black hover:bg-white/90 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
