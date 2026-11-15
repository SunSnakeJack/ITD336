import './RequestStepper.css'

export function RequestStepper({ step, label }: { step: 1 | 2 | 3; label: string }) {
  return <ol className="request-stepper" aria-label={label}>
    {[1, 2, 3].map(number => (
      <li key={number} aria-current={number === step ? 'step' : undefined}
        className={number < step ? 'is-complete' : undefined}>
        <span>{number}</span>
      </li>
    ))}
  </ol>
}
