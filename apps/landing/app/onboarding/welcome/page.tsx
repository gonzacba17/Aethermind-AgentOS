'use client'
import { useRouter } from 'next/navigation'

export default function OnboardingWelcome() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-px bg-white/[0.06] z-50">
        <div className="h-full bg-white" style={{ width: '20%' }} />
      </div>
      <div className="fixed top-3 left-6 font-mono text-xs text-white/20 z-50">
        // step_01 — welcome
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-3xl w-full">
          <h1 className="font-mono text-sm tracking-[0.2em] text-white/20 mb-8">AETHERMIND</h1>

          <h2
            className="font-light tracking-[-0.04em] text-white mb-6"
            style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}
          >
            See inside your agents.
          </h2>

          <p className="text-[1.1rem] font-light text-white/40 max-w-2xl mb-12 leading-relaxed">
            Aethermind is an AI gateway with native agent-level tracing.
            <br />
            Drop-in OpenAI replacement. No SDK required.
          </p>

          <div className="grid sm:grid-cols-3 border border-white/[0.06] mb-12">
            <div className="p-6 group hover:bg-white/[0.02] transition-colors">
              <h3 className="font-mono text-xs text-white/60 mb-2">agent_tracing()</h3>
              <p className="text-sm text-white/40">Cost, latency, errors — per agent.</p>
            </div>
            <div className="p-6 border-t sm:border-t-0 sm:border-l border-white/[0.06] group hover:bg-white/[0.02] transition-colors">
              <h3 className="font-mono text-xs text-white/60 mb-2">byok()</h3>
              <p className="text-sm text-white/40">Your API keys. Your data. Always.</p>
            </div>
            <div className="p-6 border-t sm:border-t-0 sm:border-l border-white/[0.06] group hover:bg-white/[0.02] transition-colors">
              <h3 className="font-mono text-xs text-white/60 mb-2">drop_in()</h3>
              <p className="text-sm text-white/40">Change one line of code.</p>
            </div>
          </div>

          <button
            onClick={() => router.push('/onboarding/demo')}
            className="font-mono text-sm px-8 py-3 bg-white text-black hover:bg-white/90 transition-colors"
          >
            show_me_how()
          </button>
        </div>
      </div>
    </div>
  )
}
