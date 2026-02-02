'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth-utils';
import { config } from '@/lib/config';
import { Check, Sparkles, Zap, Crown } from 'lucide-react';
import { NeuralBackground } from '@/components/neural-background';
import { 
  ConfirmationModal, 
  TempUserWarningModal, 
  PlanConfirmationModal 
} from '@/components/ConfirmationModal';
import { ErrorBanner } from '@/components/ErrorBanner';
import { 
  userAPI, 
  isTemporaryUser, 
  getErrorMessage,
  type PlanType,
  type UserValidationResult 
} from '@/lib/api/user';

// Helper function to validate and get Stripe priceId
function getStripePriceId(): string {
  const priceId = config.stripe.proPriceId;
  if (!priceId && typeof window !== 'undefined') {
    console.error('NEXT_PUBLIC_STRIPE_PRO_PRICE_ID is not configured');
  }
  return priceId;
}

const plans = [
  {
    name: 'Free',
    price: '$0',
    priceId: null,
    description: 'Perfect for trying out Aethermind',
    features: [
      '1 AI Agent',
      '100 API calls/month',
      'Basic analytics',
      'Community support',
      'Standard models (GPT-3.5)',
    ],
    notIncluded: [
      'Advanced models',
      'FinOps cost tracking',
      'Priority support',
      'Custom integrations',
    ],
    icon: Sparkles,
    popular: false,
  },
  {
    name: 'Pro',
    price: '$49',
    priceId: getStripePriceId(),
    description: 'For professionals scaling their AI operations',
    features: [
      'Unlimited AI Agents',
      'Unlimited API calls',
      'Advanced analytics & FinOps',
      'All AI models (GPT-4, Claude, etc.)',
      'Priority email support',
      'Cost optimization alerts',
      'Budget controls',
      'Custom webhooks',
    ],
    notIncluded: [
      'Dedicated account manager',
      'Custom SLA',
      'On-premise deployment',
    ],
    icon: Zap,
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    priceId: getStripePriceId(),
    description: 'For organizations with advanced needs',
    features: [
      'Everything in Pro',
      'Dedicated account manager',
      'Custom SLA (99.9% uptime)',
      'On-premise deployment option',
      'Advanced security (SSO, SAML)',
      'Custom integrations',
      'Volume discounts',
      'Training & onboarding',
      'Phone support',
    ],
    notIncluded: [],
    icon: Crown,
    popular: false,
  },
];

// Error state interface
interface ErrorState {
  message: string;
  type: 'error' | 'warning' | 'info';
  retryable: boolean;
  planName?: string;
}

function PricingContent() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [retryLoading, setRetryLoading] = useState(false);
  
  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showTempUserModal, setShowTempUserModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<{ name: string; priceId: string | null } | null>(null);
  
  // Validation state
  const [validationResult, setValidationResult] = useState<UserValidationResult | null>(null);
  
  const searchParams = useSearchParams();
  const isCheckout = searchParams.get('checkout') === 'true';

  useEffect(() => {
    if (isCheckout) {
      // User came from authentication, show message
      const timer = setTimeout(() => {
        setError(null);
      }, 10000); // Extended to 10 seconds
      return () => clearTimeout(timer);
    }
  }, [isCheckout]);

  // Handle retry for Free plan
  const handleRetry = useCallback(async () => {
    if (!pendingPlan) return;
    
    setRetryLoading(true);
    setError(null);
    
    try {
      await handleConfirmFreePlan();
    } finally {
      setRetryLoading(false);
    }
  }, [pendingPlan]);

  // Validate user before showing confirmation
  const validateAndShowConfirmation = async (planName: string, priceId: string | null) => {
    console.log('[Pricing] Starting validation for plan:', planName);
    setLoading(planName);
    setError(null);
    
    const token = getToken();
    
    if (!token) {
      console.log('[Pricing] No token, redirecting to signup');
      window.location.href = '/signup?returnTo=/pricing';
      return;
    }
    
    try {
      // Validate user for plan update
      const validation = await userAPI.validateForPlanUpdate(planName.toLowerCase() as PlanType);
      setValidationResult(validation);
      
      console.log('[Pricing] Validation result:', validation);
      
      if (!validation.valid) {
        if (validation.reason === 'TEMP_USER') {
          // Show temp user warning modal
          setPendingPlan({ name: planName, priceId });
          setShowTempUserModal(true);
          setLoading(null);
          return;
        }
        
        if (validation.reason === 'ALREADY_HAS_PLAN') {
          // User already has this plan - show info and offer dashboard redirect
          setError({
            message: validation.message || `Ya tienes el plan ${planName} activo.`,
            type: 'info',
            retryable: false,
            planName,
          });
          setLoading(null);
          return;
        }
        
        if (validation.reason === 'NO_TOKEN' || validation.reason === 'INVALID_TOKEN') {
          // Auth issue - redirect to login
          console.log('[Pricing] Auth issue, redirecting to login');
          window.location.href = '/login?returnTo=/pricing';
          return;
        }
        
        // Generic validation error
        setError({
          message: validation.message || 'Error de validación. Intenta nuevamente.',
          type: 'error',
          retryable: true,
          planName,
        });
        setLoading(null);
        return;
      }
      
      // Validation passed - show confirmation modal
      setPendingPlan({ name: planName, priceId });
      setShowConfirmModal(true);
      
    } catch (err) {
      console.error('[Pricing] Validation error:', err);

      // Si es un error de autenticación, limpiar sesión y redirigir a login
      const errorMessage = getErrorMessage(err);
      if (errorMessage.includes('sesión') || errorMessage.includes('expirado') || errorMessage.includes('session')) {
        console.log('[Pricing] Auth error detected, redirecting to login');
        window.location.href = '/login?returnTo=/pricing&error=session_expired';
        return;
      }

      setError({
        message: errorMessage,
        type: 'error',
        retryable: true,
        planName,
      });
    } finally {
      setLoading(null);
    }
  };

  // Handle confirmed Free plan activation
  const handleConfirmFreePlan = async () => {
    if (!pendingPlan) return;
    
    console.log('[Pricing] Confirming Free plan activation');
    setLoading(pendingPlan.name);
    setError(null);
    
    try {
      const result = await userAPI.updatePlan('free');
      console.log('[Pricing] Plan updated successfully:', result);
      
      // Success! Redirect to dashboard
      setShowConfirmModal(false);
      setTimeout(() => {
        window.location.href = config.dashboardUrl;
      }, 500);
      
    } catch (err) {
      console.error('[Pricing] Update plan error:', err);
      setShowConfirmModal(false);
      
      const errorMessage = err instanceof Error ? err.message : getErrorMessage(err);
      
      // Check if it's a temp user error from the backend
      if (errorMessage.toLowerCase().includes('temp') || errorMessage.toLowerCase().includes('temporal')) {
        setShowTempUserModal(true);
      } else {
        setError({
          message: errorMessage,
          type: 'error',
          retryable: true,
          planName: pendingPlan.name,
        });
      }
    } finally {
      setLoading(null);
    }
  };

  const handleSelectPlan = async (planName: string, priceId: string | null) => {
    console.log('[Pricing] Plan selected:', { planName, priceId });
    
    if (!priceId) {
      if (planName === 'Free') {
        // Free plan - validate first, then show confirmation
        await validateAndShowConfirmation(planName, priceId);
      }
      return;
    }

    // Validate priceId is not empty
    if (!priceId || priceId.trim() === '') {
      setError({
        message: 'La configuración de pago no está disponible. Contacta a soporte.',
        type: 'error',
        retryable: false,
      });
      console.error('Stripe priceId is empty or not configured');
      return;
    }

    // Paid plan - validate first
    await validateAndShowConfirmation(planName, priceId);
  };

  // Handle confirmed paid plan (Stripe checkout)
  const handleConfirmPaidPlan = async () => {
    if (!pendingPlan || !pendingPlan.priceId) return;
    
    console.log('[Pricing] Confirming paid plan:', pendingPlan.name);
    setLoading(pendingPlan.name);
    setError(null);
    
    try {
      const token = getToken();
      
      // Call backend to create Stripe Checkout session
      const response = await fetch(`${config.apiUrl}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          priceId: pendingPlan.priceId,
          successUrl: `${window.location.origin}/pricing/success`,
          cancelUrl: `${window.location.origin}/pricing?checkout=true`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al crear sesión de pago');
      }

      // Redirect to Stripe Checkout
      setShowConfirmModal(false);
      window.location.href = data.url;

    } catch (err) {
      console.error('[Pricing] Checkout error:', err);
      setShowConfirmModal(false);
      setError({
        message: err instanceof Error ? err.message : 'Error al iniciar el pago. Intenta nuevamente.',
        type: 'error',
        retryable: true,
        planName: pendingPlan.name,
      });
    } finally {
      setLoading(null);
    }
  };

  // Handle modal confirmation based on plan type
  const handleModalConfirm = () => {
    if (!pendingPlan) return;
    
    if (pendingPlan.priceId) {
      // Paid plan
      handleConfirmPaidPlan();
    } else {
      // Free plan
      handleConfirmFreePlan();
    }
  };

  // Get banner message based on URL parameters
  const reason = searchParams.get('reason');
  const getBannerMessage = () => {
    if (reason === 'canceled') {
      return {
        show: true,
        message: 'Tu suscripción fue cancelada. Selecciona un plan para reactivarla y continuar usando Aethermind Pro.',
        color: 'blue'
      };
    }
    if (reason === 'expired') {
      return {
        show: true,
        message: 'Tu suscripción ha expirado. Renueva ahora para recuperar acceso a todas las funcionalidades de Aethermind Pro.',
        color: 'yellow'
      };
    }
    if (isCheckout) {
      return {
        show: true,
        message: 'Selecciona un plan para acceder al dashboard y comenzar a usar Aethermind.',
        color: 'blue'
      };
    }
    return { show: false, message: '', color: 'blue' };
  };

  const banner = getBannerMessage();

  // Handle go to dashboard (for already has plan case)
  const handleGoToDashboard = () => {
    window.location.href = config.dashboardUrl;
  };

  return (
    <div className="relative min-h-screen bg-black text-white">
      <NeuralBackground />
      
      {/* Modals */}
      <TempUserWarningModal
        isOpen={showTempUserModal}
        onClose={() => setShowTempUserModal(false)}
      />
      
      <PlanConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setPendingPlan(null);
        }}
        onConfirm={handleModalConfirm}
        planName={pendingPlan?.name || 'Free'}
        isLoading={loading !== null}
      />
      
      {/* Header */}
      <div className="relative z-10 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center">
            <Link href="/" className="text-2xl font-bold">
              AETHERMIND
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Title Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">
            Choose your plan
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Scale your AI operations with flexible pricing that grows with your business
          </p>
          
          {/* Informative Banner */}
          {banner.show && (
            <div className={`mt-6 max-w-2xl mx-auto ${
              banner.color === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400' : 'bg-blue-500/10 border-blue-500/50 text-blue-400'
            } border px-6 py-4 rounded-lg flex items-start gap-3`}>
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">{banner.message}</p>
            </div>
          )}
          
          {/* Error Banner with enhanced UI */}
          {error && (
            <div className="mt-6 max-w-2xl mx-auto">
              <ErrorBanner
                message={error.message}
                type={error.type}
                onRetry={error.retryable ? handleRetry : (error.type === 'info' ? handleGoToDashboard : undefined)}
                retryLoading={retryLoading}
                showRetry={error.retryable || error.type === 'info'}
                showSupport={error.type === 'error'}
                onDismiss={() => setError(null)}
              />
            </div>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl border ${
                  plan.popular
                    ? 'border-white bg-zinc-900'
                    : 'border-zinc-800 bg-zinc-900/50'
                } p-8 ${plan.popular ? 'shadow-2xl shadow-white/10' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="bg-white text-black px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <Icon className={`w-10 h-10 mb-4 ${plan.popular ? 'text-white' : 'text-zinc-400'}`} />
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-zinc-400 text-sm">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.price !== '$0' && plan.price !== 'Custom' && (
                      <span className="text-zinc-400">/month</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleSelectPlan(plan.name, plan.priceId)}
                  disabled={loading === plan.name}
                  className={`w-full py-3 px-6 rounded-lg font-medium transition mb-8 ${
                    plan.popular
                      ? 'bg-white text-black hover:bg-zinc-200'
                      : 'bg-zinc-800 text-white hover:bg-zinc-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading === plan.name ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Procesando...
                    </span>
                  ) : plan.name === 'Free' ? (
                    'Start Free'
                  ) : (
                    'Subscribe'
                  )}
                </button>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-zinc-400 mb-4">What's included:</p>
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-zinc-300">{feature}</span>
                    </div>
                  ))}
                  {plan.notIncluded.length > 0 && (
                    <>
                      <div className="border-t border-zinc-800 my-4" />
                      {plan.notIncluded.map((feature) => (
                        <div key={feature} className="flex items-start gap-3 opacity-40">
                          <span className="text-sm text-zinc-500">{feature}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <details className="group bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
              <summary className="cursor-pointer font-medium text-lg flex items-center justify-between">
                Can I upgrade or downgrade anytime?
                <span className="transition group-open:rotate-180">▼</span>
              </summary>
              <p className="mt-4 text-zinc-400">
                Yes! You can upgrade, downgrade, or cancel your plan at any time. Changes take effect immediately,
                and we'll prorate any charges or credits.
              </p>
            </details>

            <details className="group bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
              <summary className="cursor-pointer font-medium text-lg flex items-center justify-between">
                What payment methods do you accept?
                <span className="transition group-open:rotate-180">▼</span>
              </summary>
              <p className="mt-4 text-zinc-400">
                We accept all major credit cards (Visa, MasterCard, Amex) through Stripe.
                Enterprise customers can also pay via invoice.
              </p>
            </details>

            <details className="group bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
              <summary className="cursor-pointer font-medium text-lg flex items-center justify-between">
                Is there a free trial?
                <span className="transition group-open:rotate-180">▼</span>
              </summary>
              <p className="mt-4 text-zinc-400">
                Yes! The Free plan gives you access to core features indefinitely. You can upgrade to Pro anytime
                to unlock unlimited usage and advanced features.
              </p>
            </details>

            <details className="group bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
              <summary className="cursor-pointer font-medium text-lg flex items-center justify-between">
                What happens if I exceed my limits?
                <span className="transition group-open:rotate-180">▼</span>
              </summary>
              <p className="mt-4 text-zinc-400">
                On the Free plan, you'll receive a notification when approaching limits. Pro users have unlimited
                usage. Our FinOps dashboard helps you monitor and control costs in real-time.
              </p>
            </details>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-24 text-center">
          <h2 className="text-3xl font-bold mb-4">Still have questions?</h2>
          <p className="text-zinc-400 mb-8">Our team is here to help you find the right plan</p>
          <Link
            href="/contact"
            className="inline-block bg-white text-black px-8 py-3 rounded-lg font-medium hover:bg-zinc-200 transition"
          >
            Contact Sales
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white">Loading pricing...</div>
      </div>
    }>
      <PricingContent />
    </Suspense>
  );
}
