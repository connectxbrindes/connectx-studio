import { useStore } from '../../store/useStore';
import { STEPS } from '../../store/slices/wizardSlice';

export default function StepIndicator() {
  const currentStep = useStore((s) => s.currentStep);
  const furthestStep = useStore((s) => s.furthestStep);
  const goToStep = useStore((s) => s.goToStep);

  return (
    <nav aria-label="Progresso da personalização" className="w-full py-6">
      <ol className="flex items-center gap-2 sm:gap-4">
        {STEPS.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isReachable = step.id <= furthestStep;

          return (
            <li key={step.id} className="flex flex-1 items-center gap-2 sm:gap-4">
              <div className="flex flex-col items-center gap-2">
                {isReachable ? (
                  <button
                    type="button"
                    onClick={() => goToStep(step.id)}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-200 ${
                      isCurrent
                        ? 'bg-accent text-white'
                        : isCompleted
                        ? 'bg-text-primary text-white'
                        : 'bg-white text-text-secondary border border-border'
                    }`}
                  >
                    {isCompleted ? '✓' : step.id}
                  </button>
                ) : (
                  <span
                    aria-disabled="true"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-sm font-semibold text-text-secondary/50"
                  >
                    {step.id}
                  </span>
                )}
                <span
                  className={`hidden text-xs font-medium sm:block ${
                    isCurrent ? 'text-text-primary' : 'text-text-secondary'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className="h-0.5 flex-1 rounded bg-border">
                  <div
                    className="h-0.5 rounded bg-accent transition-all duration-300"
                    style={{ width: isCompleted ? '100%' : '0%' }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
