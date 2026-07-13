// Isolation Forest scoring reproduced in the browser from the exported trees, matching
// sklearn's IsolationForest.score_samples / predict to 1e-6 (locked by the parity fixture).
//
// The tree-traversal primitive here (treePathLength) is the shared inference core: the
// Isolation Forest path-length scorer is its first consumer; SP2's gradient-boosting leaf-value
// scorer will be the second (spec 0033, ADR tree-traversal-as-the-shared-inference-primitive).

export interface Tree {
  feature: number[];
  threshold: number[];
  children_left: number[];
  children_right: number[];
  n_node_samples: number[];
}

export interface Forest {
  max_samples: number;
  offset: number;
  trees: Tree[];
}

const EULER_GAMMA = 0.5772156649015329;

// sklearn _average_path_length: the expected path length of an unsuccessful BST search over n
// points, used to correct truncated leaves and to normalize by c(max_samples).
function averagePathLength(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + EULER_GAMMA) - (2 * (n - 1)) / n;
}

// Edges walked from the root to the leaf reached by `scaled`, plus the leaf's average-path-length
// correction. sklearn accumulates node_indicator.sum(axis=1) + _average_path_length(leaf) - 1;
// node_indicator.sum counts nodes (edges + 1), so the -1 cancels the +1 and this edge count plus
// the leaf correction is the exact per-tree depth.
function treePathLength(scaled: number[], t: Tree): number {
  let node = 0;
  let depth = 0;
  // A leaf has children_left == -1 (sklearn TREE_LEAF) and feature == -2 (TREE_UNDEFINED).
  while (t.children_left[node] !== -1) {
    node =
      scaled[t.feature[node]] <= t.threshold[node]
        ? t.children_left[node]
        : t.children_right[node];
    depth += 1;
  }
  return depth + averagePathLength(t.n_node_samples[node]);
}

export function scoreSamples(scaled: number[], forest: Forest): number {
  let sum = 0;
  for (const t of forest.trees) sum += treePathLength(scaled, t);
  const meanDepth = sum / forest.trees.length;
  const c = averagePathLength(forest.max_samples);
  // sklearn: score_samples = -(2 ** (-mean_depth / c)).
  return -(2 ** (-meanDepth / c));
}

// predict flags an anomaly where score_samples - offset < 0, i.e. score_samples < offset.
export function predictIsAnomaly(scaled: number[], forest: Forest): boolean {
  return scoreSamples(scaled, forest) - forest.offset < 0;
}
