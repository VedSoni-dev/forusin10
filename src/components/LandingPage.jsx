import {
  ArrowRight,
  CheckCircle2,
  Download,
  HardDrive,
  Laptop,
  Lock,
  MessageSquare,
  ShieldCheck,
  WifiOff,
} from "lucide-react";

const INSTALL_STEPS = [
  {
    title: "Install the desktop app",
    detail: "Use the Windows or Mac installer for for us in 10.",
  },
  {
    title: "Open it once",
    detail: "The app starts the local AI engine on your computer.",
  },
  {
    title: "Let the model download",
    detail: "First launch downloads about 3.2 GB. After that, it stays here.",
  },
  {
    title: "Start chatting",
    detail: "Ask questions, attach files, and keep web search off by default.",
  },
];

const TRUST_POINTS = [
  { icon: HardDrive, label: "Model stored locally" },
  { icon: Lock, label: "No account required" },
  { icon: WifiOff, label: "Works offline after setup" },
  { icon: ShieldCheck, label: "Web search is opt-in" },
];

export default function LandingPage({ runtimeState, screen, onStart }) {
  const setupNeeded = screen === "onboarding";
  const statusLabel =
    runtimeState?.connected ? "Local runtime ready" : setupNeeded ? "Setup needed" : "Desktop app needed";

  return (
    <main className="h-full bg-white overflow-y-auto">
      <div className="min-h-full grid lg:grid-cols-[1.05fr_0.95fr]">
        <section className="px-6 sm:px-10 lg:px-14 py-10 lg:py-14 flex flex-col justify-between gap-12">
          <div>
            <div className="surface-enter">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-[0.76rem] font-medium text-[var(--color-ink-soft)] mb-6">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    runtimeState?.connected ? "bg-[var(--color-brand)]" : "bg-[var(--color-sand)]"
                  }`}
                />
                {statusLabel}
              </div>

              <h1 className="font-display text-[clamp(2.6rem,6vw,5rem)] leading-[0.96] text-[var(--color-ink)] max-w-[9.5ch] mb-5">
                Private AI for your own computer.
              </h1>
              <p className="text-[1rem] sm:text-[1.05rem] leading-relaxed text-[var(--color-ink-soft)] font-light max-w-[62ch]">
                for us in 10 gives you a ChatGPT-like workspace that runs locally. Install once, download the model once, then chat with your files without sending conversations to a cloud account.
              </p>

              <div className="flex flex-wrap items-center gap-2.5 mt-8">
                <button
                  onClick={onStart}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] text-white px-5 py-3 text-[0.88rem] font-medium hover:bg-slate-700 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
                >
                  {setupNeeded ? "Continue setup" : "Enter chat"}
                  <ArrowRight size={16} />
                </button>
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] px-4 py-3 text-[0.82rem] font-light text-[var(--color-ink-soft)]">
                  <Download size={15} />
                  Installer includes the local runtime
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 max-w-xl">
            {TRUST_POINTS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-3 text-[0.8rem] text-[var(--color-ink-soft)]"
              >
                <Icon size={15} className="text-[var(--color-brand-deep)] flex-shrink-0" />
                <span className="truncate">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[var(--color-paper)] border-t lg:border-t-0 lg:border-l border-[var(--color-line)] px-6 sm:px-10 lg:px-12 py-10 lg:py-14 flex flex-col justify-center">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-[var(--color-line)] text-[var(--color-brand-deep)]">
                <Laptop size={17} />
              </span>
              <div>
                <h2 className="text-[1rem] font-medium text-[var(--color-ink)]">How install works</h2>
                <p className="text-[0.78rem] font-light text-[var(--color-ink-faint)]">
                  Four steps, no account.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {INSTALL_STEPS.map((step, index) => (
                <div
                  key={step.title}
                  className="grid grid-cols-[2rem_1fr] gap-3 rounded-xl border border-[var(--color-line)] bg-white px-3.5 py-3.5"
                >
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-brand-soft)] text-[var(--color-brand-deep)] text-[0.82rem] font-medium tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[0.9rem] font-medium text-[var(--color-ink)]">
                      {step.title}
                    </h3>
                    <p className="text-[0.78rem] leading-relaxed font-light text-[var(--color-ink-soft)] mt-0.5">
                      {step.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-[var(--color-line)] bg-white px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-ink)] text-white flex-shrink-0">
                  {runtimeState?.connected ? <CheckCircle2 size={16} /> : <MessageSquare size={16} />}
                </span>
                <div>
                  <p className="text-[0.88rem] font-medium text-[var(--color-ink)]">
                    {runtimeState?.connected ? "You are ready to chat." : "You can still preview the chat."}
                  </p>
                  <p className="text-[0.78rem] leading-relaxed font-light text-[var(--color-ink-soft)] mt-0.5">
                    {runtimeState?.connected
                      ? "The local runtime is available, so the next screen can answer with your on-device model."
                      : "If answers cannot run yet, the chat screen will tell you what the runtime needs."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
