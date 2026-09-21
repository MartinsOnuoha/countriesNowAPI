/**
 * The landing page.
 *
 * V1 served a single hard-coded hbs view at `/` — a cream card with a tilting
 * logo, three buttons (Contribute, API Docs, Support) and a live JSON sample
 * rendered by jQuery + tilt.js + renderjson.js. It never scrolled; the whole
 * pitch fit in one viewport.
 *
 * V2 keeps that constraint — one screen, no scroll, links out to GitHub and
 * the docs — but drops the runtime dependency on three CDN scripts. Every
 * design below is a single self-contained HTML string: inline CSS, no JS,
 * one Google Fonts link. There's nothing here to go down.
 *
 * Three directions are implemented so the design can actually be picked
 * rather than argued about in the abstract. Preview them side by side:
 *
 *   GET /?design=classic    warm, serif, a direct descendant of the V1 card
 *   GET /?design=terminal   dark, monospace, a curl example in place of copy
 *   GET /?design=editorial  off-white, oversized type, Swiss/editorial
 *
 * The default is set by `DEFAULT_LANDING_DESIGN` below; change one line to
 * ship a different pick permanently.
 */

export type LandingDesign = 'classic' | 'terminal' | 'editorial';

export const LANDING_DESIGNS: readonly LandingDesign[] = ['classic', 'terminal', 'editorial'];

export const DEFAULT_LANDING_DESIGN: LandingDesign = 'terminal';

export function isLandingDesign(value: unknown): value is LandingDesign {
  return typeof value === 'string' && (LANDING_DESIGNS as readonly string[]).includes(value);
}

const LINKS = {
  github: 'https://github.com/MartinsOnuoha/countriesNowAPI',
  docs: '/openapi',
  sponsor: 'https://buymeacoffee.com/martinsvicf',
  legacy: '/v0.1'
} as const;

export interface LandingContext {
  /** The dataset version currently loaded, e.g. "2026.08.0". Omitted pre-artifact. */
  datasetVersion?: string;
}

export function renderLanding(design: LandingDesign, ctx: LandingContext = {}): string {
  switch (design) {
    case 'classic':
      return classicPage(ctx);
    case 'editorial':
      return editorialPage(ctx);
    case 'terminal':
    default:
      return terminalPage(ctx);
  }
}

/** Wraps <body> markup in the boilerplate every design shares. */
function shell(opts: {
  title: string;
  fonts: string;
  style: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${opts.title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="CountriesNow: countries, states and cities with full source provenance, served from a read-only artifact that can't go down.">
<link rel="icon" href="data:,">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${opts.fonts}
<style>
*{box-sizing:border-box}
html,body{height:100%;margin:0;overflow:hidden;-webkit-text-size-adjust:100%;text-size-adjust:100%}
a{text-decoration:none}
${opts.style}
</style>
</head>
<body>
${opts.body}
</body>
</html>`;
}

const NAV_TOOLTIP = 'No key. No hardcoded JSON. No downtime philosophy.';

/* ------------------------------------------------------------------------ *
 * classic — a direct descendant of the V1 card: cream, serif, three pills.
 * ------------------------------------------------------------------------ */
function classicPage(ctx: LandingContext): string {
  const badge = ctx.datasetVersion ? `<span class="badge">dataset ${ctx.datasetVersion}</span>` : '';
  const body = `
<main class="wrap">
  <div class="mark" aria-hidden="true">🌍</div>
  <h1>Countries, states &amp; cities —<br>without the downtime.</h1>
  <p class="sub">A self-updating geo dataset with per-field source provenance, served from an
    immutable read-only artifact. ${badge}</p>
  <div class="row">
    <a class="btn btn-dark" href="${LINKS.github}">Contribute 🛠</a>
    <a class="btn btn-light" href="${LINKS.docs}">API Docs 🚀</a>
    <a class="btn btn-amber" href="${LINKS.sponsor}">Support 💚</a>
  </div>
  <a class="quiet" href="${LINKS.legacy}" title="${NAV_TOOLTIP}">Upgrading from v0.1? Read the migration guide →</a>
</main>`;
  return shell({
    title: 'CountriesNow — geo data that stays up',
    fonts:
      '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Fira+Mono&display=swap" rel="stylesheet">',
    style: `
body{background:radial-gradient(120% 120% at 50% 0%,#FCF3E9 0%,#F6E2CC 100%);font-family:system-ui,sans-serif;color:#5a393e}
.wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;gap:18px}
.mark{width:72px;height:72px;border-radius:16px;background:#fff;display:grid;place-items:center;font-size:34px;
  box-shadow:0 10px 24px rgba(90,57,62,.12);transition:transform .35s ease}
.mark:hover{transform:rotate(-6deg) scale(1.06)}
h1{font-family:'Playfair Display',serif;font-weight:600;font-size:clamp(26px,4vw,42px);line-height:1.2;margin:0;max-width:16ch}
.sub{margin:0;max-width:46ch;font-size:clamp(14px,1.6vw,17px);color:#7a5b60}
.badge{display:inline-block;margin-top:6px;font-family:'Fira Mono',monospace;font-size:11px;background:#5a393e;
  color:#FCF3E9;padding:2px 8px;border-radius:20px}
.row{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
.btn{padding:12px 26px;border-radius:999px;font-size:14px;font-weight:600;box-shadow:0 6px 16px rgba(90,57,62,.14);
  transition:transform .18s ease,box-shadow .18s ease}
.btn:hover{transform:translateY(-2px)}
.btn-dark{background:#1f1315;color:#fff}
.btn-light{background:#fff;color:#5a393e}
.btn-amber{background:#E08A2C;color:#fff}
.quiet{font-size:13px;color:#9b7d81;border-bottom:1px dotted #c9a8ac}
@media (max-width:480px){h1{max-width:none}}
`,
    body
  });
}

/* ------------------------------------------------------------------------ *
 * terminal — dark, monospace, the pitch made out of a curl example.
 * ------------------------------------------------------------------------ */
function terminalPage(ctx: LandingContext): string {
  const version = ctx.datasetVersion ?? '…';
  const body = `
<main class="wrap">
  <section class="copy">
    <p class="kicker">GEO DATA API · v2</p>
    <h1>Countries<br>Cities<br><span class="accent">Currencies.</span></h1>
    <p class="sub">Provenance-tracked, AI-curated, served from a read-only artifact baked
      into every replica. Nothing to be down to.</p>
    <div class="row">
      <a class="btn" href="${LINKS.github}">GitHub ↗</a>
      <a class="btn btn-accent" href="${LINKS.docs}">API Reference ↗</a>
      <a class="btn" href="${LINKS.sponsor}">Sponsor ↗</a>
    </div>
    <p class="quiet">still on v0.1? <a href="${LINKS.legacy}" title="${NAV_TOOLTIP}">it still works →</a></p>
  </section>
  <section class="term" aria-hidden="true">
    <div class="term-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
      <span class="term-title">zsh — countriesnow</span></div>
    <pre class="term-body">$ curl https://countriesnow.space/v2/countries/NG

{
  <span class="k">"data"</span>: {
    <span class="k">"name"</span>: <span class="s">"Nigeria"</span>,
    <span class="k">"iso2"</span>: <span class="s">"NG"</span>,
    <span class="k">"capital"</span>: <span class="s">"Abuja"</span>,
    <span class="k">"region"</span>: <span class="s">"Africa"</span>
  }
}

$ curl -I https://countriesnow.space/v2/countries/NG
<span class="m">HTTP/1.1 200 OK</span>
etag: <span class="s">"${version}"</span>
cache-control: public, max-age=86400</pre>
  </section>
</main>`;
  return shell({
    title: 'CountriesNow — geo data that stays up',
    fonts:
      '<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">',
    style: `
body{background:#0B0B0E;font-family:'JetBrains Mono',monospace;color:#E7E5E0;
  background-image:radial-gradient(circle,#17161c 1px,transparent 1px);background-size:22px 22px}
.wrap{height:100%;display:grid;grid-template-columns:1.1fr 1fr;align-items:center;gap:40px;
  max-width:1100px;margin:0 auto;padding:32px}
.kicker{color:#7CFF6B;font-size:12px;letter-spacing:.12em;margin:0 0 10px}
h1{font-size:clamp(30px,5.6vw,58px);line-height:1.02;margin:0 0 16px;font-weight:700}
.accent{color:#7CFF6B}
.sub{color:#9c9a94;max-width:38ch;font-size:14px;line-height:1.5;margin:0 0 22px}
.row{display:flex;gap:10px;flex-wrap:wrap}
.btn{border:1px solid #37353f;color:#E7E5E0;padding:10px 18px;border-radius:8px;font-size:13px;
  transition:border-color .18s ease,background .18s ease}
.btn:hover{border-color:#7CFF6B;background:rgba(124,255,107,.06)}
.btn-accent{background:#7CFF6B;color:#0B0B0E;border-color:#7CFF6B}
.btn-accent:hover{background:#93ff85}
.quiet{margin-top:18px;font-size:12px;color:#6f6d68}
.quiet a{color:#9c9a94;border-bottom:1px dotted #4a4841}
.term{background:#111116;border:1px solid #26242c;border-radius:12px;overflow:hidden;
  box-shadow:0 30px 60px -20px rgba(0,0,0,.6)}
.term-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#17161c;border-bottom:1px solid #26242c}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block}
.dot.r{background:#ff5f57}.dot.y{background:#febc2e}.dot.g{background:#28c840}
.term-title{margin-left:8px;font-size:11px;color:#6f6d68}
.term-body{margin:0;padding:18px;font-size:12.5px;line-height:1.7;white-space:pre;color:#c9c7c1;overflow:hidden}
.term-body .k{color:#7fb0ff}.term-body .s{color:#7CFF6B}.term-body .m{color:#ffb86b}
@media (max-width:760px){.wrap{grid-template-columns:1fr;gap:20px}.term-body{font-size:11px}}
`,
    body
  });
}

/* ------------------------------------------------------------------------ *
 * editorial — off-white, oversized type, one accent, almost no chrome.
 * ------------------------------------------------------------------------ */
function editorialPage(ctx: LandingContext): string {
  const version = ctx.datasetVersion ?? 'unreleased';
  const body = `
<main class="wrap">
  <header class="row-top">
    <span>CN / 02</span>
    <span>dataset ${version}</span>
  </header>
  <h1>
    <span>Countries</span>
    <span>Cities</span>
    <span class="accent">Currencies</span>
  </h1>
  <p class="sub">Provenance-backed geo data, curated by an AI harness and served from an
    artifact that has nothing to go down to.</p>
  <nav class="links">
    <a href="${LINKS.github}">GitHub <i>↗</i></a>
    <a href="${LINKS.docs}">API Reference <i>↗</i></a>
    <a href="${LINKS.sponsor}">Sponsor <i>↗</i></a>
    <a href="${LINKS.legacy}" title="${NAV_TOOLTIP}">v0.1 (legacy) <i>↗</i></a>
  </nav>
</main>`;
  return shell({
    title: 'CountriesNow — geo data that stays up',
    fonts:
      '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">',
    style: `
body{background:#F7F5F2;color:#17140F;font-family:'Space Grotesk',system-ui,sans-serif}
.wrap{height:100%;display:flex;flex-direction:column;justify-content:center;max-width:900px;
  margin:0 auto;padding:6vh 28px}
.row-top{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;
  padding:22px 28px;font-size:12px;letter-spacing:.08em;color:#8a8578}
h1{margin:0 0 22px;font-size:clamp(46px,10vw,108px);font-weight:700;line-height:.92;letter-spacing:-.01em}
h1 span{display:block}
.accent{color:#E4572E}
.sub{max-width:44ch;font-size:clamp(14px,1.6vw,17px);color:#4b473d;margin:0 0 28px;line-height:1.5}
.links{display:flex;gap:26px;flex-wrap:wrap;border-top:1px solid #ddd8cd;padding-top:18px}
.links a{font-size:14px;font-weight:500;color:#17140F}
.links a i{font-style:normal;color:#E4572E}
.links a:hover{color:#E4572E}
@media (max-width:520px){.row-top{padding:16px 20px;font-size:11px}}
`,
    body
  });
}
