'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, RefreshCw } from 'lucide-react';

function RenewContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  const getMessage = () => {
    if (reason === 'expired') {
      return {
        title: 'Tu suscripción ha expirado',
        description: 'Tu período de suscripción ha finalizado. Para seguir disfrutando de todas las funcionalidades de Aethermind Pro, renueva tu suscripción ahora.',
      };
    }
    return {
      title: 'Reactiva tu suscripción',
      description: 'Para seguir usando Aethermind Pro, actualiza tu método de pago o renueva tu suscripción.',
    };
  };

  const { title, description } = getMessage();

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-zinc-400">{description}</p>
        </div>

        {/* Info Box */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
          <p className="text-sm text-zinc-300">
            Al renovar tu suscripción, recuperarás acceso instantáneo a:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-400">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
              Agentes de AI ilimitados
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
              Todos los modelos de AI (GPT-4, Claude, etc.)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
              Analytics avanzado y FinOps
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
              Soporte prioritario
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/pricing"
            className="w-full flex items-center justify-center gap-2 bg-white text-black py-3 px-4 rounded-lg font-medium hover:bg-zinc-200 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Renovar Suscripción
          </Link>

          <Link
            href="/"
            className="w-full block text-center bg-zinc-800 border border-zinc-700 text-white py-3 px-4 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Volver a la home
          </Link>
        </div>

        {/* Help */}
        <div className="pt-4 border-t border-zinc-800 text-center">
          <p className="text-sm text-zinc-500">
            ¿Necesitas ayuda?{' '}
            <a href="mailto:support@aethermind.com" className="text-white hover:underline">
              Contacta soporte
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RenewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <RenewContent />
    </Suspense>
  );
}
