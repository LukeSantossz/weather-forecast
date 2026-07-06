import meta from '../public/data/meta.json';
import SectionHeader from './SectionHeader';

// Mirrors the enum in web/public/data/schema/meta.schema.json (data_status).
// Kept local (not a shared contract module) - same convention as
// components/DataStatusBanner.tsx and the shortCommit/shortDate helpers in
// app/layout.tsx.
type Meta = {
  generated_at: string;
  data_status: 'sample' | 'real';
  pipeline: {
    source: string;
    repo_commit?: string | null;
  };
};

function shortDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toISOString().slice(0, 10);
}

function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : 'unknown';
}

// The closing act (ported from docs/design/observatory-preview-template.html's
// `.close` / `.repro` / `.colophon` + its section-scoped footer). Reproducibility
// is framed as the argument's conclusion, not a hedge (DESIGN.md § Voice:
// "reproducibility is the closing argument, not a hedge"): two cards state what
// "every figure regenerates from the contract" and "commit-stamped and honest"
// actually mean, a role-grouped colophon credits the real stack, and a
// commit-stamped line closes the page. Reads the same committed meta.json
// contract as DataStatusBanner.
export default function CloseSection() {
  const data = meta as Meta;
  const commit = shortSha(data.pipeline.repo_commit);
  const date = shortDate(data.generated_at);

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
          <span>
            SOURCE COMMIT {commit} · GENERATED {date}
          </span>
        </div>
      </footer>
    </section>
  );
}
