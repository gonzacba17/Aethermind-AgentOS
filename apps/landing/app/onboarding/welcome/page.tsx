'use client'
import { useRouter } from 'next/navigation'
import { ArrowRight, Zap } from 'lucide-react'

export default function OnboardingWelcome() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="max-w-2xl text-center space-y-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
          <Zap className="w-8 h-8" />
        </div>
        
        <h1 className="text-5xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          Welcome to Aethermind!
        </h1>
        
        <p className="text-xl text-gray-400">
          Let's take 30 seconds to show you how you'll control AI costs and ship faster.
        </p>
        
        <button
          onClick={() => router.push('/onboarding/demo')}
          className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
        >
          Show me how it works
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
