// web/lib/contract.ts
//
// Hand-written TypeScript mirror of the committed JSON-Schema contract in
// `web/public/data/schema/*.schema.json` (SPEC 0006). Types below follow each
// schema's `required` array exactly: a property missing from `required` is
// modeled as optional, not just nullable. Do not add fields the schemas don't
// declare (`additionalProperties: false` in every schema).

/** Shared literal: every section's `schema_version` is pinned to "1.0". */
export type SchemaVersion = '1.0';

/** Shared literal: whether a section's payload is a layout-preview sample or real model output. */
export type DataStatus = 'sample' | 'real';

// --- meta.schema.json ---------------------------------------------------

export interface MetaPipeline {
  source: string;
  /** Git commit the real data was generated from; null for sample. Not in
   * the schema's `required` list, so a section may omit it entirely. */
  repo_commit?: string | null;
}

export interface Meta {
  schema_version: SchemaVersion;
  generated_at: string;
  data_status: DataStatus;
  pipeline: MetaPipeline;
  disclaimer: string;
}

// --- forecast.schema.json ------------------------------------------------

export interface ForecastPoint {
  date: string;
  value: number;
}

export interface ForecastModelSeries {
  id: string;
  name: string;
  predictions: ForecastPoint[];
}

export interface ForecastSeriesData {
  granularity: 'daily_global_mean';
  unit: string;
  train_end: string;
  test_window_days: number;
  history: ForecastPoint[];
  actual: ForecastPoint[];
  models: ForecastModelSeries[];
}

export interface Forecast {
  schema_version: SchemaVersion;
  generated_at: string;
  data_status: DataStatus;
  series: ForecastSeriesData;
}

// --- metrics.schema.json --------------------------------------------------

/** `pending_rerun` marks models withdrawn pending the evaluation-leakage fix (#20). */
export type MetricsStatus = 'final' | 'pending_rerun';

export interface MetricsEvaluation {
  method: string;
  window_days: number;
}

export interface MetricsModel {
  id: string;
  name: string;
  rmse_c: number | null;
  mae_c: number | null;
  mape_pct: number | null;
  ensemble_weight: number | null;
  status: MetricsStatus;
  /** Not in the schema's `required` list; present on `pending_rerun` rows. */
  note?: string;
}

export interface Metrics {
  schema_version: SchemaVersion;
  generated_at: string;
  data_status: DataStatus;
  evaluation: MetricsEvaluation;
  models: MetricsModel[];
  caveats: string[];
}

// --- anomalies.schema.json ------------------------------------------------

export type AnomalyDetectedBy = 'zscore' | 'isolation_forest' | 'both';

export interface AnomalyZscoreMethod {
  threshold: number;
  count: number;
  share_pct: number;
}

export interface AnomalyIsolationForestMethod {
  contamination: number;
  count: number;
  share_pct: number;
}

export interface AnomalyMethods {
  zscore: AnomalyZscoreMethod;
  isolation_forest: AnomalyIsolationForestMethod;
  overlap_count: number;
}

export interface AnomalyRecord {
  ts: string;
  country: string;
  lat: number;
  lon: number;
  temp_c: number;
  z: number;
  if_score: number;
  detected_by: AnomalyDetectedBy;
}

export interface Anomalies {
  schema_version: SchemaVersion;
  generated_at: string;
  data_status: DataStatus;
  methods: AnomalyMethods;
  records: AnomalyRecord[];
}

// --- shap.schema.json -------------------------------------------------------

export interface ShapFeature {
  name: string;
  mean_abs_shap: number;
}

export interface ShapBeeswarmPoint {
  shap: number;
  feature_value_norm: number;
}

export interface ShapBeeswarmSeries {
  feature: string;
  /** Schema caps this at 200 points; not enforced at the type level. */
  points: ShapBeeswarmPoint[];
}

export interface Shap {
  schema_version: SchemaVersion;
  generated_at: string;
  data_status: DataStatus;
  model: string;
  /** This dashboard's SHAP explanation is always for the air-quality model, never temperature. */
  target: 'pm2_5';
  sample_n: number;
  features: ShapFeature[];
  beeswarm: ShapBeeswarmSeries[];
}

// --- section loader -----------------------------------------------------

/** One entry per committed JSON file under `web/public/data/`. */
export type SectionName = 'meta' | 'forecast' | 'metrics' | 'anomalies' | 'shap';

/** Thrown by `loadSection` on a non-ok HTTP response or a JSON parse failure. */
export class DataLoadError extends Error {
  readonly section: SectionName;

  constructor(section: SectionName, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DataLoadError';
    this.section = section;
  }
}

/**
 * Fetches `/data/<name>.json` and parses it as `T`. Throws `DataLoadError`
 * when the response is not ok or the body isn't valid JSON; never returns a
 * silently-empty or partially-parsed result.
 */
export async function loadSection<T>(name: SectionName): Promise<T> {
  const response = await fetch(`/data/${name}.json`);

  if (!response.ok) {
    throw new DataLoadError(
      name,
      `Failed to load section "${name}": HTTP ${response.status} ${response.statusText}.`,
    );
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new DataLoadError(name, `Failed to parse section "${name}": response was not valid JSON.`, {
      cause,
    });
  }
}

export const loadMeta = (): Promise<Meta> => loadSection<Meta>('meta');
export const loadForecast = (): Promise<Forecast> => loadSection<Forecast>('forecast');
export const loadMetrics = (): Promise<Metrics> => loadSection<Metrics>('metrics');
export const loadAnomalies = (): Promise<Anomalies> => loadSection<Anomalies>('anomalies');
export const loadShap = (): Promise<Shap> => loadSection<Shap>('shap');

// --- anomaly_embeddings.json (issue #32) ---------------------------------
// Precomputed sentence-transformer embeddings for the browser-side semantic
// search demo. Not a core dashboard section, so it has its own loader.

export interface EmbeddedAnomalyRecord extends AnomalyRecord {
  embedding: number[];
}

export interface ExampleQuery {
  text: string;
  embedding: number[];
}

export interface AnomalyEmbeddings {
  schema_version: SchemaVersion;
  model: string;
  dim: number;
  records: EmbeddedAnomalyRecord[];
  queries: ExampleQuery[];
}

/** Fetches the precomputed anomaly embeddings; throws on HTTP or parse error. */
export async function loadAnomalyEmbeddings(): Promise<AnomalyEmbeddings> {
  const response = await fetch('/data/anomaly_embeddings.json');
  if (!response.ok) {
    throw new Error(
      `Failed to load anomaly embeddings: HTTP ${response.status} ${response.statusText}.`,
    );
  }
  try {
    return (await response.json()) as AnomalyEmbeddings;
  } catch (cause) {
    throw new Error('Failed to parse anomaly embeddings: response was not valid JSON.', { cause });
  }
}
