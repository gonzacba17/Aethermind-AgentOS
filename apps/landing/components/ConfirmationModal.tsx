'use client';

import { useEffect, useCallback } from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export type ModalType = 'confirm' | 'warning' | 'info';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type?: ModalType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmLoading?: boolean;
  showCancel?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  type = 'confirm',
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmLoading = false,
  showCancel = true,
}: ConfirmationModalProps) {
  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !confirmLoading) {
      onClose();
    }
  }, [onClose, confirmLoading]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-12 h-12 text-yellow-400" />;
      case 'info':
        return <Info className="w-12 h-12 text-blue-400" />;
      default:
        return <CheckCircle className="w-12 h-12 text-green-400" />;
    }
  };

  const getConfirmButtonStyle = () => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-500 hover:bg-yellow-600 text-black';
      default:
        return 'bg-white hover:bg-zinc-200 text-black';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={!confirmLoading ? onClose : undefined}
      />
      
      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Close button */}
        {!confirmLoading && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Icon */}
        <div className="flex justify-center mb-6">
          {getIcon()}
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white text-center mb-3">
          {title}
        </h3>

        {/* Message */}
        <p className="text-zinc-400 text-center mb-8">
          {message}
        </p>

        {/* Buttons */}
        <div className={`flex gap-3 ${showCancel ? 'justify-between' : 'justify-center'}`}>
          {showCancel && (
            <button
              onClick={onClose}
              disabled={confirmLoading}
              className="flex-1 py-3 px-6 rounded-lg font-medium border border-zinc-700 text-white hover:bg-zinc-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            disabled={confirmLoading}
            className={`flex-1 py-3 px-6 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${getConfirmButtonStyle()}`}
          >
            {confirmLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Procesando...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pre-configured modal for temporary user warning
 */
export function TempUserWarningModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleReload}
      type="warning"
      title="Cuenta Temporal Detectada"
      message="Tu sesión de Google es temporal y no se pudo completar el registro. Recarga la página para intentar nuevamente con tu cuenta de Google."
      confirmText="Recargar Página"
      cancelText="Cerrar"
      showCancel={true}
    />
  );
}

/**
 * Pre-configured modal for plan confirmation
 */
export function PlanConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  planName,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  planName: string;
  isLoading: boolean;
}) {
  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      type="confirm"
      title={`Activar Plan ${planName}`}
      message={`¿Estás seguro de que deseas activar el plan ${planName}? ${
        planName === 'Free' 
          ? 'Tendrás acceso a las funcionalidades básicas de Aethermind.' 
          : 'Se procesará tu método de pago.'
      }`}
      confirmText={`Activar ${planName}`}
      cancelText="Cancelar"
      confirmLoading={isLoading}
    />
  );
}
