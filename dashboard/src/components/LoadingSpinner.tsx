interface LoadingSpinnerProps {
  label: string;
  /** Centers the spinner in a tall block instead of an inline row -- use
   * for a view that otherwise renders nothing else while loading, so it
   * doesn't read as a stray line of text floating in empty space. */
  center?: boolean;
}

export default function LoadingSpinner({ label, center = false }: LoadingSpinnerProps) {
  const spinner = (
    <div className="flex items-center gap-2.5 text-sm text-secondary">
      <span className="spinner-ring h-4 w-4 shrink-0 rounded-full border-2 border-outline-variant border-t-accent" />
      {label}
    </div>
  );

  if (!center) return spinner;

  return <div className="flex min-h-[50vh] items-center justify-center">{spinner}</div>;
}
