import ProvenanceChip from './ProvenanceChip';

// In-context methodology (native <details>, no JS, keyboard-operable and
// static-export safe). A short "how to read this" aside explaining the two
// conventions that recur across every act, in the product, instead of only
// linking out to the repo (DESIGN.md § Accessibility: provenance is never
// color-only). Mounted at the end of the Anomalies act (AnomaliesSection.tsx),
// which already sits inside `<main className="shell-container">`
// (app/layout.tsx) - this component carries no shell-container wrapper of its
// own, so it does not double the horizontal inset.
export default function MethodologyNote() {
  return (
    <section className="methodology" aria-label="About and methodology">
      <details className="methodology-details">
        <summary className="methodology-summary">How to read this</summary>
        <div className="methodology-body">
          <p className="methodology-intro">Two conventions recur across every section on this page.</p>
          <ul className="methodology-list">
            <li className="methodology-item">
              <ProvenanceChip tone="final" label="[ FINAL ]" />
              <p>
                A provenance chip names exactly what a number measures and how it was produced, so a
                claim is never color-only.
              </p>
            </li>
            <li className="methodology-item">
              <ProvenanceChip tone="holdout" label="[ HOLDOUT ]" />
              <p>
                The holdout is a final stretch of days none of the models trained on. Every forecast
                metric shown here is scored against readings the model had not yet seen.
              </p>
            </li>
          </ul>
        </div>
      </details>
    </section>
  );
}
