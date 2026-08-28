type AnalyticsLoadingSkeletonVariant = "chart" | "table" | "quality";

export default function AnalyticsLoadingSkeleton({
  title,
  variant = "chart",
}: {
  title: string;
  variant?: AnalyticsLoadingSkeletonVariant;
}) {
  if (variant === "quality") {
    return (
      <div className="quality-loading-skeleton" role="status" aria-label={`Loading ${title}`}>
        <span className="quality-loading-skeleton__title" />
        <span />
        <span />
        <span />
      </div>
    );
  }

  return (
    <div className={`view-loading-skeleton view-loading-skeleton--${variant}`} role="status" aria-label={`Loading ${title}`}>
      <div className="view-loading-skeleton__header">
        <span />
        <span />
      </div>
      {variant === "table" ? (
        <div className="view-loading-skeleton__table">
          {Array.from({ length: 36 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      ) : (
        <div className="view-loading-skeleton__chart">
          <span />
          <span />
          <span />
          <i />
          <i />
          <i />
        </div>
      )}
      <div className="view-loading-skeleton__footer">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
