// Text/monogram badges, not scraped logo artwork -- these are the real
// airlines and OTAs SkyMetrics evaluated for its compliance audit
// (config/sources.json), shown here as market context, not as claimed
// partners or sponsors.
const MARKET_PLAYERS = [
  { code: "AA", name: "Akasa Air", bg: "#E4572E" },
  { code: "MMT", name: "MakeMyTrip", bg: "#E4002B" },
  { code: "ixigo", name: "ixigo", bg: "#FF6600" },
  { code: "6E", name: "IndiGo", bg: "#0A1F63" },
];

export default function BrandStrip() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-full border border-outline-variant bg-panel px-8 py-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">
        Tracking fares across India&apos;s airline &amp; OTA landscape
      </p>
      <div className="flex flex-wrap items-center justify-center gap-6">
        {MARKET_PLAYERS.map((player) => (
          <div key={player.code} className="flex items-center gap-2" title={player.name}>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: player.bg }}
              aria-hidden="true"
            >
              {player.code}
            </span>
            <span className="text-sm text-secondary">{player.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
