import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children, maxWidthClass = 'max-w-lg' }) {
  // Fechar no ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal panel */}
      <div className={`relative flex max-h-[90vh] w-full ${maxWidthClass} flex-col rounded-2xl bg-panel shadow-2xl ring-1 ring-white/10 animate-fade-in`}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary hover:bg-bg hover:text-text-primary transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
