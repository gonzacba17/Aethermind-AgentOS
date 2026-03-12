'use client'
import { useRouter } from 'next/navigation'

const features = [
  { label: 'agent_tracing', description: 'See which agent ran, what model, what it cost, why it failed.' },
  { label: 'byok', description: 'Use your existing API keys. We route, we don\'t store.' },
  { label: 'multi_provider', description: 'OpenAI, Anthropic, Gemini, Groq — one gateway, one dashboard.' },
  { label: 'workflow_view', description: 'Group agents by workflow. See the full pipeline cost.' },
]

const comparison = [
  { feature: 'Per-agent tracing', litellm: false, portkey: false, aethermind: true },
  { feature: 'BYOK', litellm: true, portkey: true, aethermind: true },
  { feature: 'Multi-provider', litellm: true, portkey: true, aethermind: true },
  { feature: 'Drop-in OpenAI', litellm: true, portkey: true, aethermind: true },
]

export default function OnboardingValue() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="fixed top-0 left-0 right-0 h-px bg-white/[0.06] z-50">
        <div className="h-full bg-white" style={{ width: '60%' }} />
      </div>
      <div className="fixed top-3 left-6 font-mono text-xs text-white/20 z-50">
        // step_03 — why_it_matters
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-5xl w-full py-16">
          <h2
            className="font-light tracking-[-0.04em] text-white mb-4"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
          >
            Built for multi-agent systems.
          </h2>
          <p className="text-[1.1rem] font-light text-white/40 mb-12">
            The first AI gateway with native per-agent tracing.
          </p>

          <div className="grid md:grid-cols-2 gap-0 border border-white/[0.06]">
            {/* Left — What you get */}
            <div className="p-8">
              <h3 className="font-mono text-xs text-white/20 mb-6">// what_you_get</h3>
              <div className="space-y-6">
                {features.map((f) => (
                  <div key={f.label}>
                    <h4 className="font-mono text-xs text-white/60 mb-1">:: {f.label}</h4>
                    <p className="text-sm text-white/40 leading-relaxed">{f.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Comparison */}
            <div className="p-8 border-t md:border-t-0 md:border-l border-white/[0.06]">
              <h3 className="font-mono text-xs text-white/20 mb-6">// how_it_compares</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left pb-3 text-xs text-white/20 font-normal">Feature</th>
                    <th className="text-center pb-3 font-mono text-xs text-white/20 font-normal">LiteLLM</th>
                    <th className="text-center pb-3 font-mono text-xs text-white/20 font-normal">Portkey</th>
                    <th className="text-center pb-3 font-mono text-xs text-white/20 font-normal">Aethermind</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.feature} className="border-b border-white/[0.06] last:border-b-0">
                      <td className="py-3 text-sm text-white/40">{row.feature}</td>
                      <td className="py-3 text-center font-mono text-xs">{row.litellm ? <span className="text-white/40">✓</span> : <span className="text-white/20">✗</span>}</td>
                      <td className="py-3 text-center font-mono text-xs">{row.portkey ? <span className="text-white/40">✓</span> : <span className="text-white/20">✗</span>}</td>
                      <td className="py-3 text-center font-mono text-xs">{row.aethermind ? <span className="text-white">✓</span> : <span className="text-white/20">✗</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-12">
            <button
              onClick={() => router.push('/onboarding/pricing')}
              className="font-mono text-sm px-8 py-3 bg-white text-black hover:bg-white/90 transition-colors"
            >
              im_ready()
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
