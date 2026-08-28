import { useState } from "react";

export interface NavSection {
  id: string;
  label: string;
}

interface NavbarProps {
  sections: NavSection[];
  onGoHome: () => void;
  onGoToSection: (id: string) => void;
  transparent: boolean;
}

export default function Navbar({ sections, onGoHome, onGoToSection, transparent }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className={
        transparent
          ? "fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between px-6"
          : "fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-outline-variant bg-surface-container px-6"
      }
    >
      <button
        type="button"
        onClick={onGoHome}
        className="flex items-center gap-2.5 text-left"
        aria-label="SkyMetrics home"
      >
        <img src="/brand/skymetrics-logo.png" alt="" className="h-7 w-7" />
        <span className="font-mono text-sm font-bold tracking-[0.15em] text-primary">SKYMETRICS</span>
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
          aria-label="Open navigation menu"
          className="flex h-10 w-10 items-center justify-center rounded-sm border border-outline-variant bg-surface-container text-primary hover:bg-surface-container-high"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[22px]">
            {menuOpen ? "close" : "menu"}
          </span>
        </button>

        {menuOpen && (
          <nav
            aria-label="Dashboard sections"
            className="absolute right-0 top-12 w-56 rounded-sm border border-outline-variant bg-panel py-2 shadow-lg"
          >
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  onGoToSection(section.id);
                  setMenuOpen(false);
                }}
                className="block w-full px-4 py-2 text-left text-sm text-primary hover:bg-surface-container-high"
              >
                {section.label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
