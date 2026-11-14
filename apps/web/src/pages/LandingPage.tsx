import { useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { useReveal, useTilt } from "../landingHooks";
import { formatClock, nudge, prefersReducedMotion, seeded } from "../landingMotion";
import "../landing.css";

type IconName = "clock" | "bell" | "chat" | "list" | "chart" | "shield";

const ICONS: Record<IconName, ReactNode> = {
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 01-3.4 0" />
    </>
  ),
  chat: <path d="M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.4A8 8 0 1121 12z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.2 8.2-8 9-4.8-.8-8-4.5-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "clock",
    title: "Frequent checks",
    body: "Check any HTTP or HTTPS address every 1, 5 or 15 minutes and verify the status code you expect. A failed check is retried once before it counts.",
  },
  {
    icon: "bell",
    title: "Alerts without the noise",
    body: "A monitor is declared down only after consecutive failed checks, so a single blip never wakes you. You get one message when it goes down and one when it recovers.",
  },
  {
    icon: "chat",
    title: "Slack and email",
    body: "Send alerts to a Slack channel through an incoming webhook, or to your account email. Test buttons show whether delivery works before you need it.",
  },
  {
    icon: "list",
    title: "Incident history",
    body: "Every outage is recorded with its start, its duration and the last error, so you can see what happened and for how long.",
  },
  {
    icon: "chart",
    title: "Uptime and response times",
    body: "See uptime and average response time over 24 hours, 7 days or 30 days, with a chart that highlights the periods when checks failed.",
  },
  {
    icon: "shield",
    title: "Safe by design",
    body: "Checks cannot reach private or internal addresses, webhook URLs are never shown back to you, and every account only sees its own data.",
  },
];

const STEPS = [
  {
    title: "Add a URL",
    body: "Give the monitor a name, the address to watch and how often to check it.",
  },
  {
    title: "It keeps watching",
    body: "A background worker checks the address, records the status and response time, and retries once before counting a failure.",
  },
  {
    title: "Get told what matters",
    body: "When failures repeat, an incident opens and your Slack channel or inbox is notified. You are told again when the site recovers.",
  },
];

const TARGETS = [
  "Websites",
  "REST APIs",
  "Landing pages",
  "Login pages",
  "Checkout flows",
  "Status pages",
  "Webhook endpoints",
  "Health checks",
];

type Delay = 0 | 1 | 2 | 3 | 4 | 5;

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: Delay;
  className?: string;
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`lp-reveal d${delay}${visible ? " in" : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  delay,
}: {
  icon: IconName;
  title: string;
  body: string;
  delay: Delay;
}) {
  const { ref, visible } = useReveal<HTMLElement>();

  // a soft light follows the pointer inside the card
  function onMove(event: ReactPointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }

  return (
    <article
      ref={ref}
      onPointerMove={onMove}
      className={`lp-card lp-reveal d${delay}${visible ? " in" : ""}`}
    >
      <span className="lp-icon">
        <Icon name={icon} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

const BASE_MS = [98, 142];

// Decorative sample data: the numbers move so the page feels alive.
function HeroPreview() {
  const [tick, setTick] = useState(0);
  const tiltRef = useTilt<HTMLDivElement>(7);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const step = Math.floor(tick / 2);
  const ms = BASE_MS.map((base, lane) => nudge(base, 18, seeded(step, lane)));

  return (
    <div className="lp-stage lp-rise d3" aria-hidden="true">
      <div className="lp-float">
        <div className="lp-preview" ref={tiltRef}>
          <div className="lp-win">
            <span />
            <span />
            <span />
            <small>Example view</small>
          </div>
          <ul className="lp-rows">
            <li className="lp-row">
              <span className="lp-dot" />
              <span>Marketing site</span>
              <span className="lp-ms">{ms[0]} ms</span>
            </li>
            <li className="lp-row">
              <span className="lp-dot" />
              <span>Public API</span>
              <span className="lp-ms">{ms[1]} ms</span>
            </li>
            <li className="lp-row">
              <span className="lp-dot down" />
              <span>Checkout page</span>
              <span className="lp-ms down">down {formatClock(192 + tick)}</span>
            </li>
          </ul>
          <svg className="lp-spark" viewBox="0 0 200 60" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lp-line" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#6366f1" />
                <stop offset="0.55" stopColor="#06b6d4" />
                <stop offset="1" stopColor="#ec4899" />
              </linearGradient>
              <linearGradient id="lp-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#6366f1" stopOpacity="0.28" />
                <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              className="lp-spark-area"
              fill="url(#lp-area)"
              d="M0 42 L20 38 L40 44 L60 30 L80 34 L100 22 L120 28 L140 18 L160 24 L180 12 L200 16 L200 60 L0 60 Z"
            />
            <path
              className="lp-spark-line"
              pathLength={1}
              fill="none"
              stroke="url(#lp-line)"
              d="M0 42 L20 38 L40 44 L60 30 L80 34 L100 22 L120 28 L140 18 L160 24 L180 12 L200 16"
            />
          </svg>
        </div>
      </div>
      <div className="lp-toast">
        <span className="lp-dot down" />
        <div>
          <b>Checkout page is down</b>
          <span>Alert sent to Slack</span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { token } = useAuth();

  return (
    <div className="lp">
      <div className="lp-bg" aria-hidden="true">
        <span className="lp-blob a" />
        <span className="lp-blob b" />
        <span className="lp-blob c" />
      </div>

      <div className="lp-content">
        <header className="lp-header">
          <Link to="/" className="lp-brand">
            <span className="lp-logo" aria-hidden="true" />
            Uptime Monitor
          </Link>
          <nav className="lp-nav" aria-label="Account">
            {token ? (
              <Link to="/app" className="lp-btn primary">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="lp-btn">
                  Log in
                </Link>
                <Link to="/login?mode=register" className="lp-btn primary">
                  Get started
                </Link>
              </>
            )}
          </nav>
        </header>

        <main>
          <section className="lp-hero" aria-labelledby="hero-title">
            <div>
              <p className="lp-pill lp-rise d0">
                <i aria-hidden="true" /> Slack and email alerts included
              </p>
              <h1 id="hero-title" className="lp-rise d1">
                Know when your site goes down, <span className="lp-grad">before your users do.</span>
              </h1>
              <p className="lp-lead lp-rise d2">
                Uptime Monitor checks your websites and APIs every few minutes, records every
                outage, and alerts you the moment something breaks.
              </p>
              <div className="lp-actions lp-rise d3">
                {token ? (
                  <Link to="/app" className="lp-btn primary">
                    Open dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/login?mode=register" className="lp-btn primary">
                      Create an account
                    </Link>
                    <Link to="/login" className="lp-btn">
                      Log in
                    </Link>
                  </>
                )}
              </div>
              <ul className="lp-trust lp-rise d4">
                <li>Checks every 1 to 15 minutes</li>
                <li>Incident history</li>
                <li>Private to your account</li>
              </ul>
            </div>
            <HeroPreview />
          </section>

          <div className="lp-marquee" aria-label="What you can monitor">
            <ul className="lp-track">
              {TARGETS.map((target) => (
                <li key={target}>{target}</li>
              ))}
              {TARGETS.map((target) => (
                <li key={`${target}-copy`} aria-hidden="true">
                  {target}
                </li>
              ))}
            </ul>
          </div>

          <section className="lp-section" aria-labelledby="features-title">
            <Reveal>
              <p className="lp-eyebrow">Features</p>
              <h2 id="features-title">Everything you need to stay on top of outages</h2>
            </Reveal>
            <div className="lp-grid">
              {FEATURES.map((feature, index) => (
                <FeatureCard
                  key={feature.title}
                  {...feature}
                  delay={((index % 3) + 1) as Delay}
                />
              ))}
            </div>
          </section>

          <section className="lp-section" aria-labelledby="how-title">
            <Reveal>
              <p className="lp-eyebrow">How it works</p>
              <h2 id="how-title">From a URL to an alert in three steps</h2>
            </Reveal>
            <ol className="lp-steps">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <Reveal delay={(index + 1) as Delay} className="lp-step">
                    <span className="lp-step-num">{index + 1}</span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </section>

          {!token && (
            <section className="lp-section" aria-labelledby="cta-title">
              <Reveal className="lp-cta">
                <h2 id="cta-title">Try it with your own site</h2>
                <p>Add a URL and see your first check come back in minutes.</p>
                <Link to="/login?mode=register" className="lp-btn primary">
                  Create an account
                </Link>
              </Reveal>
            </section>
          )}
        </main>

        <footer className="lp-footer">
          A portfolio project by Yordanos Hailu. It comes with no uptime guarantee.
        </footer>
      </div>
    </div>
  );
}
