import { Link } from '@astryxdesign/core/Link';
import ProvenanceChip from './ProvenanceChip';

const ISSUE_20_URL = 'https://github.com/LukeSantossz/weather-forecast/issues/20';

// In-context methodology (native <details>, no JS, keyboard-operable and
// static-export safe). Explains the honesty states the dashboard shows, in the
// product, instead of only linking out to the repo. Each item pairs its real
// provenance chip with a plain-language reading so the state is never
// color-only (DESIGN.md § Accessibility, § Voice).
export default function MethodologyNote() {
  return (
    <section className="methodology" aria-label="About and methodology">
      <div className="shell-container">
        <details className="methodology-details">
          <summary className="methodology-summary">About / methodology</summary>
          <div className="methodology-body">
            <p className="methodology-intro">
              This console shows how far each number can be trusted. Three states flag the caveats in place.
            </p>
            <ul className="methodology-list">
              <li className="methodology-item">
                <ProvenanceChip tone="sample" label="[ SAMPLE DATA ]" />
                <p>
                  The banner at the top shows this when the data files are a layout preview, not model
                  output. A real run replaces it with the generation date and commit.
                </p>
              </li>
              <li className="methodology-item">
                <ProvenanceChip tone="pending" label="[ PENDING RE-RUN ]" />
                <p>
                  A metrics row marked this is withheld. Its value stays blank until a corrected run
                  replaces it, rather than showing a figure we no longer stand behind.
                </p>
              </li>
              <li className="methodology-item">
                <ProvenanceChip tone="pending" label="[ LEAKAGE FIX PENDING · #20 ]" />
                <p>
                  The LightGBM and ensemble metrics were withdrawn after an evaluation-leakage bug, tracked
                  in issue #20. Until the leakage-free re-run lands, the Forecast hero reports the best final
                  statistical model instead.
                </p>
              </li>
            </ul>
            <p className="methodology-more">
              The full write-up lives in the repository README and{' '}
              <Link href={ISSUE_20_URL} isExternalLink>
                issue #20
              </Link>
              .
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
