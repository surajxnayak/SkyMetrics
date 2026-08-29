import { useState } from "react";

interface LoginProps {
  onContinue: () => void;
}

export default function Login({ onContinue }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onContinue();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-6">
      <div className="w-full max-w-sm rounded-sm border border-outline-variant bg-panel p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src="/brand/skymetrics-logo.png" alt="" className="h-10 w-10" />
          <span className="font-mono text-sm font-bold tracking-[0.15em] text-primary">SKYMETRICS</span>
          <p className="text-sm text-on-surface-variant">Sign in to view the airfare index</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="login-email" className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-outline-variant bg-inset px-3 py-1.5 text-sm text-primary outline-none placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-outline-variant bg-inset px-3 py-1.5 text-sm text-primary outline-none placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-page hover:bg-accent-hover"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
