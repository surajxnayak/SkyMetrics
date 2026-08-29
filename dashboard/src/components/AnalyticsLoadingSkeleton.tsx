type SkeletonVariant = "chart" | "table" | "quality";

export default function AnalyticsLoadingSkeleton({ title, variant }: { title: string; variant: SkeletonVariant }) {
  return (
    <div className={`view-loading-skeleton view-loading-skeleton--${variant}`} role="status" aria-label={`Loading ${title}`}>
      <span className="sr-only">Loading {title}</span>
      <div className="view-loading-skeleton__header"><span /><span /><span /></div>
      {variant === "chart" && <div className="view-loading-skeleton__chart"><span /><span /><span /><span /><span /></div>}
      {variant === "table" && <div className="view-loading-skeleton__table">{Array.from({ length: 6 }, (_, row) => <div key={row}><span /><span /><span /><span /><span /></div>)}</div>}
      {variant === "quality" && <div className="quality-loading-skeleton__rows"><span /><span /><span /></div>}
      <div className="view-loading-skeleton__footer"><span /><span /></div>
    </div>
  );
}
