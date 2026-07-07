import SectionHeader from './SectionHeader';

// The closing act (ported from docs/design/observatory-preview-template.html's
// `.close` / `.repro` / `.colophon` + its section-scoped footer). Reproducibility
// is framed as the argument's conclusion, not a hedge (DESIGN.md § Voice:
// "reproducibility is the closing argument, not a hedge"): two cards state what
// "every figure regenerates from the contract" and "commit-stamped and honest"
// actually mean, and a role-grouped colophon credits the real stack. The commit
// + generation date live once at the page bottom, in the page-level
// `<footer className="site-footer">` in app/layout.tsx (the contentinfo
// landmark), so this closing footer carries only the wordmark signature.
export default function CloseSection() {
  return (
    <section className="close" aria-labelledby="heading-close">
      <div className="reveal">
        <SectionHeader title="Built to be reproduced" headingId="heading-close" actNumber="§" />

        <div className="repro">
          <div>
            <h3>Every figure regenerates</h3>
            <p>
              The dashboard reads only the committed JSON contracts the pipeline emits. Nothing is typed
              in by hand, so a number cannot drift from the model that produced it.
            </p>
          </div>
          <div>
            <h3>Commit-stamped and honest</h3>
            <p>
              Every dataset carries its generation date and source commit. A metric that cannot be
              trusted yet is marked pending, with a stated reason, instead of padded.
            </p>
          </div>
        </div>

        <dl className="colophon">
          <div>
            <dt>Forecasting</dt>
            <dd>GradientBoosting, LightGBM, ARIMA, SARIMA, Prophet</dd>
          </div>
          <div>
            <dt>Detection</dt>
            <dd>z-score, Isolation Forest</dd>
          </div>
          <div>
            <dt>Explainability</dt>
            <dd>SHAP feature attribution</dd>
          </div>
          <div>
            <dt>Search</dt>
            <dd>all-MiniLM-L6-v2 embeddings, offline cosine</dd>
          </div>
          <div>
            <dt>Mapping</dt>
            <dd>MapLibre GL</dd>
          </div>
          <div>
            <dt>Charts</dt>
            <dd>d3-scale, d3-shape</dd>
          </div>
          <div>
            <dt>Serving</dt>
            <dd>Python, FastAPI</dd>
          </div>
          <div>
            <dt>Interface</dt>
            <dd>Next.js, Astryx design system</dd>
          </div>
        </dl>
      </div>

      <footer>
        <div className="foot">
          <span>WEATHER · FORECAST OBSERVATORY</span>
        </div>
      </footer>
    </section>
  );
}
