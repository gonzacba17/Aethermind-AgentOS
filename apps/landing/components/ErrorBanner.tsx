'use client';

import { X, AlertCircle, RefreshCw, MessageCircle, AlertTriangle, CheckCircle } from 'lucide-react';

export type ErrorType = 'error' | 'warning' | 'success' | 'info';

export interface ErrorBannerProps {
  message: string;
  type?: ErrorType;
  onRetry?: () => void;
  onContactSupport?: () => void;
  onDismiss?: () => void;
  retryLoading?: boolean;
  showRetry?: boolean;
  showSupport?: boolean;
  showDismiss?: boolean;
  className?: string;
}

export function ErrorBanner({
  message,
  type = 'error',
  onRetry,
  onContactSupport,
  onDismiss,
  retryLoading = false,
  showRetry = true,
  showSupport = true,
  showDismiss = true,
  className = '',
}: ErrorBannerProps) {
  const styles = {
    error: {
      container: 'bg-red-500/10 border-red-500/50 text-red-400',
      icon: <AlertCircle className="w-5 h-5 flex-shrink-0" />,
    },
    warning: {
      container: 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400',
      icon: <AlertTriangle className="w-5 h-5 flex-shrink-0" />,
    },
    success: {
      container: 'bg-green-500/10 border-green-500/50 text-green-400',
      icon: <CheckCircle className="w-5 h-5 flex-shrink-0" />,
    },
    info: {
      container: 'bg-blue-500/10 border-blue-500/50 text-blue-400',
      icon: <AlertCircle className="w-5 h-5 flex-shrink-0" />,
    },
  };

  const currentStyle = styles[type];

  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport();
    } else {
      // Default: open email
      window.location.href = 'mailto:support@aethermind.ai?subject=Error%20en%20activación%20de%20plan';
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${currentStyle.container} ${className}`}>
      <div className="flex items-start gap-3">
        {currentStyle.icon}
        
        <div className="flex-1">
          <p className="text-sm">{message}</p>
          
          {/* Action buttons */}
          {(showRetry || showSupport) && (
            <div className="flex flex-wrap gap-3 mt-3">
              {showRetry && onRetry && (
                <button
                  onClick={onRetry}
                  disabled={retryLoading}
                  className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-4 h-4 ${retryLoading ? 'animate-spin' : ''}`} />
                  {retryLoading ? 'Reintentando...' : 'Reintentar'}
                </button>
              )}
              
              {showSupport && (
                <button
                  onClick={handleContactSupport}
                  className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                >
                  <MessageCircle className="w-4 h-4" />
                  Contactar Soporte
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Dismiss button */}
        {showDismiss && onDismiss && (
          <button
            onClick={onDismiss}
            className="text-current opacity-60 hover:opacity-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Pre-configured error banner for network errors
 */
export function NetworkErrorBanner({
  onRetry,
  retryLoading,
  onDismiss,
}: {
  onRetry: () => void;
  retryLoading?: boolean;
  onDismiss?: () => void;
}) {
  return (
    <ErrorBanner
      message="Error de conexión. Verifica tu internet e intenta nuevamente."
      type="error"
      onRetry={onRetry}
      retryLoading={retryLoading}
      onDismiss={onDismiss}
      showSupport={false}
    />
  );
}

/**
 * Pre-configured error banner for auth errors
 */
export function AuthErrorBanner({
  onDismiss,
}: {
  onDismiss?: () => void;
}) {
  const handleLogin = () => {
    window.location.href = '/login';
  };

  return (
    <ErrorBanner
      message="Tu sesión ha expirado. Por favor inicia sesión nuevamente."
      type="warning"
      onRetry={handleLogin}
      showRetry={true}
      showSupport={false}
      onDismiss={onDismiss}
    />
  );
}

/**
 * Pre-configured banner for temporary user
 */
export function TempUserBanner({
  onDismiss,
}: {
  onDismiss?: () => void;
}) {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <ErrorBanner
      message="Tu cuenta es temporal. Recarga la página para completar el registro con Google."
      type="warning"
      onRetry={handleReload}
      showRetry={true}
      showSupport={true}
      onDismiss={onDismiss}
    />
  );
}

/**
 * Pre-configured banner for already has plan
 */
export function AlreadyHasPlanBanner({
  planName,
  onDismiss,
}: {
  planName: string;
  onDismiss?: () => void;
}) {
  const handleGoToDashboard = () => {
    window.location.href = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://aethermind-agent-os-dashboard.vercel.app';
  };

  return (
    <ErrorBanner
      message={`Ya tienes el plan ${planName} activo.`}
      type="info"
      onRetry={handleGoToDashboard}
      showRetry={true}
      showSupport={false}
      onDismiss={onDismiss}
    />
  );
}
