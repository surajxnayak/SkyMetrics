// Text/monogram badges, not scraped logo artwork -- this is the real,
// complete list of airlines and OTAs SkyMetrics evaluated for its
// compliance audit (config/sources.json), shown as market context, not as
// claimed partners or sponsors. Only Akasa Air is live; the rest are
// blocked by robots.txt or WAF -- see config/sources.json for the audit.
const MARKET_PLAYERS = [
  { code: "AA", name: "Akasa Air", bg: "#E4572E" },
  { code: "SG", name: "SpiceJet", bg: "#E4002B" },
  { code: "IX", name: "Air India Express", bg: "#D4213D" },
  { code: "6E", name: "IndiGo", bg: "#0A1F63" },
  { code: "AI", name: "Air India", bg: "#B01C2E" },
  { code: "CT", name: "Cleartrip", bg: "#E9762B" },
  { code: "EMT", name: "EaseMyTrip", bg: "#0A6ED1" },
  { code: "ixigo", name: "ixigo", bg: "#FF6600" },
  { code: "MMT", name: "MakeMyTrip", bg: "#E4002B" },
  { code: "GO", name: "Goibibo", bg: "#D6262B" },
  { code: "YT", name: "Yatra", bg: "#0B6E4F" },
];

function Badge({ player }: { player: (typeof MARKET_PLAYERS)[number] }) {
  return (
    <div className="flex shrink-0 items-center gap-2 px-4" title={player.name}>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
        style={{ backgroundColor: player.bg }}
        aria-hidden="true"
      >
        {player.code}
      </span>
      <span className="whitespace-nowrap text-sm text-secondary">{player.name}</span>
    </div>
  );
}

export default function BrandStrip() {
  return (
    <div className="w-full border-y border-outline-variant bg-panel py-5">
      <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">
        Tracking fares across India&apos;s airline &amp; OTA landscape
      </p>
      <div className="marquee-mask overflow-hidden">
        <div className="brand-marquee flex w-max items-center">
          {MARKET_PLAYERS.map((player) => (
            <Badge key={`a-${player.code}`} player={player} />
          ))}
          {MARKET_PLAYERS.map((player) => (
            <Badge key={`b-${player.code}`} player={player} />
          ))}
        </div>
      </div>
    </div>
  );
}
