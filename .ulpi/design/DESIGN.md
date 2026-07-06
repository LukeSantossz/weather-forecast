# DESIGN.md - Weather Forecast Dashboard (locked design language)

> Source of truth for identity. Every screen binds to this; variation within identity, never between.
> Re-read first every session before any UI work.

> **Supersession notice:** this document replaces the prior "instrument console" identity in full, per
> SPEC 0031 and ADR-F. The Observatory identity below is the only locked design language as of this
> revision.

## Register & design system

- **Register:** editorial data-journalism instrument (the confidence and restraint of a data-journalism
  outlet, applied to a real ML pipeline; still a product surface, not a marketing site chasing a
  lead-gen conversion).
- **Design system:** **Astryx** (`@astryxdesign/core` `0.1.2`, pre-compiled CSS). We THEME Astryx with the
  tokens below by overriding its CSS-variable tokens; we do NOT re-implement its components. Custom work
  is limited to the chart/dataviz layer (Astryx has no charts) and the signature elements.

## Design Read & direction

**Design Read:** the pipeline's real strength, presented as a data-journalism story instead of a console
readout: a serif headline states the thesis, mono figures carry the exact numbers, and the warming-stripes
motif turns the temperature series itself into the backdrop. The bet, per SPEC 0031: for an ML-hiring
skim, a confident data-journalism identity signals the core skill (turning a model into insight) better
than a generic-technical console.

**Aesthetic direction (committed):** `editorial / data-journalism` - a warm-ink ground with a single ember
accent, reframing the honesty-first instrument as a story rather than a readout.
**Counterfactual/slop check:** the category-default answer for a weather product is still blue (the same
reflex the prior identity rejected). Observatory rejects it again, and also rejects the prior identity's
graphite-and-amber console default: warm-ink neutrals plus one ember accent and a glacier-cyan cool pole
(used only for the physical cold pole of the diverging scale, never as a brand hue) keep the category from
predicting the aesthetic twice over.

**Direction validated:** against the committed interactive preview
(`docs/design/observatory-preview-template.html`), running on the real `2026-07-05` pipeline output,
approved by the owner before SPEC 0031 (ADR-F). This supersedes the "Inspiration DNA" citations of the
prior identity; Observatory's reference is the approved preview itself, not a named external site.

## Color - strategy `restrained`: warm-ink neutrals + one ember accent + a glacier-cyan cool pole

Neutrals are warm-ink: a near-black ground with a warm, papery undertone in light mode and a warm
near-black in dark mode, never a cool gray and never cream. Hex values below are the committed source of
truth (`docs/design/observatory-preview-template.html`); the engineer verifies exact WCAG ratios in code.

**Core surfaces (light / dark)**
| role | light | dark | notes |
|---|---|---|---|
| background | #f7f6f3 | #141210 | the page ground |
| surface | #ffffff | #1b1815 | panels |
| elevated / popover | #ffffff | #24201b | raised cards, popovers, tooltips |
| border | #e5e0d8 | #37312b | hairlines, panel rules |
| text (primary) | #201c18 | #f3ece2 | primary body/heading text |
| muted (secondary) | #5e574e | #a79e92 | secondary text |
| subtle | #8b8377 | #6f6659 | large/decorative only; small essential text uses `muted` |

**Accent - the single accent, ember (signal: heat / the hero value / the primary action)**
| token | light | dark | use |
|---|---|---|---|
| accent (ember) | #d8511c | #f2612c | fills, lines, large text, key values, ensemble series, primary CTA |
| accent-text | #b8410f | #f7855a | small colored text on the accent (reaches AA where the bright fill would not) |
| on-accent | #ffffff | #1b1712 | text placed ON an accent fill |

**Cool pole (the diverging scale's cold end, also the info tone)**
| token | light | dark | use |
|---|---|---|---|
| cool | #2e8aa8 | #3fa9c7 | cold end of the temperature scale; info state |

Distribution ~60-30-10: warm-ink surfaces (60) / mid neutrals + gridlines (30) / ember accent (10).

**Semantic states**
| state | light | dark | meaning |
|---|---|---|---|
| success / final | #1f8f5c | #46b482 | metric row is `final` |
| warning | #b8902a | #e0b341 | a state that needs attention (kept for future use) |
| danger | #cc4a2e | #e0603f | severe anomaly, the both-methods overlap |

**Contrast rule for colored text (AA compliance):** the bright ember/cool/semantic tones above are for
fills, lines, borders, and large text (UI, ≥ 3:1). Small colored text uses the darker (light mode) /
brighter (dark mode) `-text` variant that reaches ≥ 4.5:1 on its actual surface: `accent-text` #b8410f /
#f7855a; `cool-text` #1f6f8a / #6fc3da (sourced from the committed preview template, same
darken/brighten pattern). Exact ratios are verified in code per the Accessibility section below.

## Dataviz palette (charts only, separate from the one UI accent)

- **Temperature (diverging, the one scale every chart and map reuses):** cool #2e8aa8 (light) / #3fa9c7
  (dark) → neutral #c9c3b6 → warm #d8511c (light) / #f2612c (dark). Encodes the real physical
  axis; used for the anomaly-map markers and the hero warming-stripes.
- **Forecast lines:** observed = the primary text color (achromatic, thick, direct-labeled "Observed");
  ensemble forecast = the ember accent (direct-labeled "Forecast"). The model leaderboard ranks every
  other model (GradientBoosting, LightGBM, ARIMA, SARIMA, Prophet) by position and mono figure, not by a
  per-model hue: one accent-colored bar, ranked, avoids a rainbow chart.
- **Anomaly methods:** encoded by marker shape, not hue: a filled dot is z-score, an open ring is
  isolation-forest. Color on the map stays reserved for temperature. The both-methods overlap (the
  highest-confidence outliers) is called out separately as a danger-toned stat, not a third map hue.
- Rule (kept): sequential/diverging color for magnitude, shape or label for identity; never encode
  meaning by hue alone. Bright tones for fills/lines/markers ≥ 3:1; darker `-text` variants for small
  colored text ≥ 4.5:1. Validate contrast and colorblind safety at build (dataviz skill validator).

## Type - a serif-display / grotesk-body / mono-data pairing (none are the banned reflex defaults)

- **Display** (section headers, the hero headline, the hero stat): **Fraunces**, a serif with an
  editorial, data-journalism register; used with restraint, tight tracking only at large sizes,
  `text-wrap: balance`.
- **Body / UI:** **Hanken Grotesk** (retained) - humanist-geometric, quiet, readable (measure 65-75ch).
- **Data / mono:** **IBM Plex Mono** (retained) - ALL numbers, axis ticks, footnotes, and the
  provenance/confidence chips. The mono is still the honesty voice: exact figures wear mono.
- Loaded via `next/font/google` (Fraunces, Hanken Grotesk, IBM Plex Mono - self-hosted at build, no
  runtime CDN, metric-matched fallbacks), per ADR-H. The three roles (serif display, grotesk body, mono
  data) are the locked commitment; the specific face is swappable if Fraunces reads wrong in production
  (ADR-H / SPEC 0031 risk note) - the roles are not.
- We override Astryx's font tokens with these three roles.

**Modular scale** (product-tight, 1.20): 12 · 14 · 16(base) · 19 · 23 · 28 · 34 · 41 · 49 px. Numbers in
the hero stat may go larger (mono, tabular figures).

## Structural scales (locked)

- **Spacing** (4px rhythm): 0 2 4 8 12 16 20 24 32 40 48 64 80 96 128.
- **Radius:** `{ sm 4, md 8, lg 12, xl 16, full 9999 }`, favoring the small end (crisp, not pillowy).
- **Shadow:** soft, low-opacity, only where elevation is real (popover, modal, the floating alert card). Dark
  mode leans on borders over shadows.
- **Z-index:** base 0, dropdown 20, sticky 30, fixed 40, modalBackdrop 45, modal 50, popover 60, toast 70, skipLink 80.
- **Breakpoints:** sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536; container max 1200.
- **Motion:** fast 120 · base 260 · emphasis 440; easing `cubic-bezier(0.16, 1, 0.3, 1)`; no bounce/elastic;
  exit ≈ 75% of enter; honor `prefers-reduced-motion`. One orchestrated page-load reveal per section, and
  chart draw-in on first view. Motion must be motivated.

## Signature (the recurring distinctive element)

1. **Warming stripes** - the Ed Hawkins warming-stripes motif, built from the real temperature series, used
   as the hero backdrop and repeated as a section motif. Not decoration: it is real committed data
   rendered as color.
2. **Provenance chips, reframed as confidence cues** - small IBM Plex Mono, uppercase, bordered chips that
   still make provenance first-class, but now read as confidence rather than caveat: `[ LIVE MODEL OUTPUT ]`,
   `[ FINAL ]`, `[ HOLDOUT ]`, `[ GLOBAL DAILY MEAN ]`, `[ COMMIT STAMPED ]`. Built on Astryx
   Badge/StatusDot, themed. Every claim/number that has provenance still wears one; the wording no longer
   apologizes for the data status when the data is real and final (ADR-E's honesty-in-data mechanism is
   unchanged: a genuinely `pending_rerun` or `sample` run still surfaces its own caveat chip).

These two are used on every section - they are how a viewer instantly recognizes the product and reads it
as both rigorous and confident.

## Voice

Confident, precise, plain. Numbers still carry units and provenance, but honesty now reads as engineering
rigor, not apology: reproducibility is the closing argument, not a hedge. No buzzwords (no "powerful",
"seamless", "revolutionary"). No em-dash as a crutch in UI copy. Example: "Live model output, commit
24b7120, 05 Jul 2026" reads as confidence; a caveat banner apologizing for placeholder data does not
belong once every metric is final. Consistent action vocabulary across a flow.

## Accessibility guarantees (locked)

- WCAG AA: 4.5:1 body text, 3:1 large text + UI/icons + chart strokes; verified in code per pairing.
- Never color alone: series and methods carry a label or shape too; provenance is text, not just color.
- Full keyboard path; visible focus ring (2px, accent, 2px offset); honor reduced-motion; charts have
  text/table equivalents (the metrics table IS the accessible form of the forecast numbers).
- Touch targets ≥ 44px (map markers get an enlarged invisible hit area); respect mobile safe areas.
