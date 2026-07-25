const VARIANTS = {
  primary: 'bg-text-primary text-white hover:bg-neutral-800',
  secondary: 'bg-white text-text-primary border border-border hover:border-text-primary',
  ghost: 'bg-transparent text-text-secondary hover:text-text-primary',
};

export default function Button({ variant = 'primary', className = '', disabled, children, ...props }) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold text-base transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
