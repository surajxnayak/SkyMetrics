export default function LoadingSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-secondary">
      <span className="spinner-ring h-4 w-4 shrink-0 rounded-full border-2 border-outline-variant border-t-accent" />
      {label}
    </div>
  );
}
