import { describe, it, expect } from 'vitest';
import { allFixtures, fixturesByTier } from './fixtures/benchmark.js';
import { ruleBasedClassify, type Tier } from '../src/classifier.js';

const DEFAULT_MODELS = {
  fast: 'claude-haiku-4-5-20251001',
  think: 'claude-sonnet-4-6',
  ultrathink: 'claude-opus-4-6',
};

const DEFAULT_EFFORTS = {
  fast: 'none' as const,
  think: 'medium' as const,
  ultrathink: 'max' as const,
};

interface ConfusionMetrics {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

function computeMetrics(tier: Tier, fixtures: typeof allFixtures): ConfusionMetrics {
  let tp = 0;
  let fp = 0;
  let fn = 0;

  for (const fixture of fixtures) {
    const result = ruleBasedClassify(fixture.prompt, DEFAULT_MODELS, DEFAULT_EFFORTS);
    const predicted = result.tier === tier;
    const actual = fixture.expectedTier === tier;

    if (predicted && actual) tp++;
    if (predicted && !actual) fp++;
    if (!predicted && actual) fn++;
  }

  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return { tp, fp, fn, precision, recall, f1 };
}

describe('rule-based benchmark', () => {
  const tiers: Tier[] = ['fast', 'think', 'ultrathink'];

  for (const tier of tiers) {
    describe(`${tier} tier`, () => {
      const metrics = computeMetrics(tier, allFixtures);

      it(`precision >= 0.7 (actual: ${metrics.precision.toFixed(2)})`, () => {
        expect(metrics.precision).toBeGreaterThanOrEqual(0.7);
      });

      it(`recall >= 0.7 (actual: ${metrics.recall.toFixed(2)})`, () => {
        expect(metrics.recall).toBeGreaterThanOrEqual(0.7);
      });
    });
  }

  it('prints confusion matrix summary', () => {
    const lines: string[] = ['', '=== Benchmark Confusion Matrix ==='];

    for (const tier of tiers) {
      const m = computeMetrics(tier, allFixtures);
      lines.push(
        `${tier.padEnd(12)} P=${m.precision.toFixed(2)} R=${m.recall.toFixed(2)} F1=${m.f1.toFixed(2)} (TP=${m.tp} FP=${m.fp} FN=${m.fn})`,
      );
    }

    lines.push(`Total fixtures: ${allFixtures.length}`);
    lines.push('');

    // Log to stderr so it's visible in test output
    process.stderr.write(lines.join('\n') + '\n');
  });

  it('has at least 50 fixtures', () => {
    expect(allFixtures.length).toBeGreaterThanOrEqual(50);
  });

  it('covers all three tiers', () => {
    expect(fixturesByTier.fast.length).toBeGreaterThan(0);
    expect(fixturesByTier.think.length).toBeGreaterThan(0);
    expect(fixturesByTier.ultrathink.length).toBeGreaterThan(0);
  });
});
