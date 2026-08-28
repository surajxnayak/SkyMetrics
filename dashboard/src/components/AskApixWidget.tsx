import { useState } from "react";
import AskApix from "./AskApix";

export default function AskApixWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="max-h-[70vh] w-[min(24rem,calc(100vw-3rem))] overflow-y-auto rounded-sm shadow-2xl">
          <AskApix />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Close Ask APIx chat" : "Open Ask APIx chat"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-page shadow-lg hover:bg-accent-hover"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[26px]">
          {open ? "close" : "chat"}
        </span>
      </button>
    </div>
  );
}
