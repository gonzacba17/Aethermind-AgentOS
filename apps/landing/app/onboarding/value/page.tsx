'use client'
import { useRouter } from 'next/navigation'
import { ArrowRight, DollarSign, Zap, Shield, CheckCircle } from 'lucide-react'

export default function OnboardingValue() {
  const router = useRouter()

  const features = [
    {
      icon: DollarSign,
      title: 'Cost Visibility Before Execution',
      description: 'See exactly what each AI call will cost before running it. No more surprises.'
    },
    {
      icon: Zap,
      title: 'Real-Time Optimization',
      description: 'Automatically switch to cheaper models when quality allows it.'
    },
    {
      icon: Shield,
      title: 'Budget Protection',
      description: 'Set spending limits and get alerts before you go over budget.'
    },
    {
      icon: CheckCircle,
      title: 'Ship 3x Faster',
      description: 'Stop worrying about costs and focus on building great products.'
    }
  ]

  return (
    <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
      <div className="max-w-4xl w-full space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold">Here&apos;s What You Get</h2>
          <p className="text-gray-400">Everything you need to control AI costs</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <div key={i} className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6 space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/30 rounded-xl">
                <feature.icon className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-blue-500/10 to-purple-600/10 border border-blue-500/20 rounded-2xl p-8 text-center space-y-4">
          <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Save an average of $1,200/month
          </div>
          <p className="text-gray-400">Based on teams using Aethermind with 10+ AI calls per day</p>
        </div>

        <div className="text-center">
          <button
            onClick={() => router.push('/onboarding/pricing')}
            className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-xl font-semibold hover:bg-gray-100 transition-colors text-lg"
          >
            I&apos;m ready to start saving
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
