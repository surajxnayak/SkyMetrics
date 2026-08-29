import { useEffect, useState } from "react";
import { useFilters, type Filters } from "../context/FilterContext";
import { ADVANCE_WINDOWS, CARRIERS, FARE_CLASSES, ROUTES, SOURCES, TIME_PRESETS, datesForTimePreset } from "../config/filters";

const INPUT_CLASS = "w-full rounded-md border border-outline-variant bg-inset px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent";
const SELECT_CLASS = INPUT_CLASS + " appearance-none";
type SearchState = "idle" | "changed" | "sent" | "received";

function MenuSelect({ label, selected, options, onToggle }: { label: string; selected: string[]; options: readonly { id: string; label: string }[]; onToggle: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="relative min-w-0">
    <span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">{label}</span>
    <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen((value) => !value)} className={SELECT_CLASS + " flex items-center justify-between gap-2 text-left"}>
      <span className="truncate">{selected.length === options.length ? `All ${label.toLowerCase()}` : `${selected.length} selected`}</span>
      <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[18px]">expand_more</span>
    </button>
    {open && <div role="listbox" aria-label={`${label} options`} className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-64 overflow-y-auto rounded-md border border-outline-variant bg-surface-container-high p-2 shadow-xl">
      {options.map((option) => <label key={option.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-2 text-sm text-primary hover:bg-surface-container-highest">
        <input type="checkbox" aria-label={option.label} checked={selected.includes(option.id)} onChange={() => onToggle(option.id)} className="mt-0.5 h-4 w-4 shrink-0 accent-accent" />
        <span>{option.label}</span>
      </label>)}
      <p className="px-2 pt-1 font-mono text-[10px] text-muted">{selected.length} selected</p>
    </div>}
  </div>;
}

export default function Sidebar() {
  const { filters, setFilters, applyFilters, hasPendingChanges } = useFilters();
  const [expanded, setExpanded] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>("idle");

  useEffect(() => { if (hasPendingChanges) setSearchState("changed"); }, [hasPendingChanges]);
  useEffect(() => {
    const markReceived = () => setSearchState("received");
    window.addEventListener("skymetrics:data-received", markReceived);
    return () => window.removeEventListener("skymetrics:data-received", markReceived);
  }, []);

  const toggleListValue = (key: "selectedRoutes" | "sources", value: string) => setFilters((prev) => {
    const list = prev[key];
    if (list.includes(value)) {
      if (key === "selectedRoutes" && list.length === 1) return prev;
      return { ...prev, [key]: list.filter((item) => item !== value) };
    }
    return { ...prev, [key]: [...list, value] };
  });
  const changeTimePreset = (presetId: string) => setFilters((prev) => ({ ...prev, timePreset: presetId, ...(datesForTimePreset(presetId) ?? {}) }));
  const handleSearch = () => { if (applyFilters()) setSearchState("sent"); };
  const searchColor = searchState === "changed" ? "text-warning" : searchState === "sent" ? "text-accent" : searchState === "received" ? "text-up" : "text-secondary";
  const searchLabel = searchState === "changed" ? "Filters changed" : searchState === "sent" ? "Query sent" : searchState === "received" ? "Data received" : "Search";

  return <section aria-label="Filters" className="border-b border-outline-variant bg-surface-container px-4 py-3">
    <div className="flex items-center justify-between gap-3">
      <div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Filter workspace</p><p className="mt-0.5 text-xs text-on-surface-variant">Tune the active analytical query</p></div>
      <button type="button" aria-expanded={expanded} aria-controls="filter-controls" onClick={() => setExpanded((value) => !value)} className="flex items-center gap-1 rounded-md border border-outline-variant px-3 py-2 text-xs font-medium text-secondary hover:border-accent hover:text-primary">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{expanded ? "keyboard_arrow_up" : "tune"}</span>{expanded ? "Retract filters" : "Open filters"}
      </button>
    </div>
    {expanded && <div id="filter-controls" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      <label className="block"><span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Frequency</span><select aria-label="Frequency" value={filters.frequency} onChange={(e) => setFilters((prev) => ({ ...prev, frequency: e.target.value as Filters["frequency"] }))} className={SELECT_CLASS}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
      <label className="block"><span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Time range</span><select aria-label="Time range" value={filters.timePreset} onChange={(e) => changeTimePreset(e.target.value)} className={SELECT_CLASS}>{TIME_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>
      {filters.timePreset === "custom" && <div className="col-span-full grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Start</span><input aria-label="Start" type="date" value={filters.startDate} onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))} className={INPUT_CLASS} /></label><label className="block"><span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">End</span><input aria-label="End" type="date" value={filters.endDate} onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))} className={INPUT_CLASS} /></label></div>}
      <MenuSelect label="Routes" selected={filters.selectedRoutes} options={ROUTES} onToggle={(value) => toggleListValue("selectedRoutes", value)} />
      <MenuSelect label="Source" selected={filters.sources} options={SOURCES} onToggle={(value) => toggleListValue("sources", value)} />
      <label className="block"><span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Carrier</span><select aria-label="Carrier" value={filters.carrier} onChange={(e) => setFilters((prev) => ({ ...prev, carrier: e.target.value }))} className={SELECT_CLASS}><option value="">All carriers</option>{CARRIERS.map((carrier) => <option key={carrier.code} value={carrier.code}>{carrier.name} ({carrier.code})</option>)}</select></label>
      <label className="block"><span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Advance window</span><select aria-label="Advance window" value={filters.advanceWindow} onChange={(e) => setFilters((prev) => ({ ...prev, advanceWindow: e.target.value }))} className={SELECT_CLASS}><option value="">All</option>{ADVANCE_WINDOWS.map((window) => <option key={window} value={window}>{window}</option>)}</select></label>
      <label className="block"><span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Fare class</span><select aria-label="Fare class" value={filters.fareClass} onChange={(e) => setFilters((prev) => ({ ...prev, fareClass: e.target.value }))} className={SELECT_CLASS}><option value="">All fare classes</option>{FARE_CLASSES.map((fareClass) => <option key={fareClass} value={fareClass}>{fareClass}</option>)}</select></label>
      <div className="flex items-end"><button type="button" onClick={handleSearch} aria-label={hasPendingChanges ? "Search changes" : "Search filters"} title={searchLabel} className={`flex aspect-square h-[42px] items-center justify-center rounded-full border border-outline-variant bg-inset transition-colors hover:border-accent ${searchColor}`}><span aria-hidden="true" className="material-symbols-outlined text-[23px]">search</span></button></div>
    </div>}
  </section>;
}
