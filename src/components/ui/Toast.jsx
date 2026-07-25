import { useEffect } from 'react';
import { useStore } from '../../store/useStore';

export default function Toast() {
  const toast = useStore((s) => s.toast);
  const dismissToast = useStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(dismissToast, 3000);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-text-primary px-6 py-3 text-sm font-medium text-white shadow-lg transition-opacity duration-300 motion-reduce:transition-none"
    >
      {toast}
    </div>
  );
}
