import type { Tier } from '../../src/classifier.js';

export interface BenchmarkFixture {
  prompt: string;
  expectedTier: Tier;
  category: string;
}

// --- FAST tier fixtures (15) ---
const fastFixtures: BenchmarkFixture[] = [
  { prompt: 'Hello', expectedTier: 'fast', category: 'greeting' },
  { prompt: 'Hi there, how are you?', expectedTier: 'fast', category: 'greeting' },
  { prompt: 'Thanks!', expectedTier: 'fast', category: 'greeting' },
  { prompt: "What's the capital of France?", expectedTier: 'fast', category: 'factual' },
  { prompt: 'What year did World War II end?', expectedTier: 'fast', category: 'factual' },
  { prompt: 'Who wrote Romeo and Juliet?', expectedTier: 'fast', category: 'factual' },
  { prompt: 'Translate "hello" to Spanish', expectedTier: 'fast', category: 'translation' },
  { prompt: 'Say "good morning" in Japanese', expectedTier: 'fast', category: 'translation' },
  { prompt: 'Fix this typo: recieve', expectedTier: 'fast', category: 'typo' },
  { prompt: 'What is 2 + 2?', expectedTier: 'fast', category: 'arithmetic' },
  { prompt: 'Calculate 15 * 3', expectedTier: 'fast', category: 'arithmetic' },
  {
    prompt: 'Format this as a bullet list: apples oranges bananas',
    expectedTier: 'fast',
    category: 'formatting',
  },
  { prompt: 'What does HTTP stand for?', expectedTier: 'fast', category: 'factual' },
  { prompt: 'Convert 100 celsius to fahrenheit', expectedTier: 'fast', category: 'arithmetic' },
  { prompt: 'Yes', expectedTier: 'fast', category: 'greeting' },
];

// --- THINK tier fixtures (15) ---
const thinkFixtures: BenchmarkFixture[] = [
  {
    prompt: 'Debug why this function returns undefined instead of the expected array',
    expectedTier: 'think',
    category: 'debugging',
  },
  {
    prompt: 'Debug this TypeError in my React component',
    expectedTier: 'think',
    category: 'debugging',
  },
  {
    prompt: 'Design an API for a simple todo application',
    expectedTier: 'think',
    category: 'api-design',
  },
  {
    prompt: 'Compare REST vs GraphQL for a mobile app backend',
    expectedTier: 'think',
    category: 'comparison',
  },
  {
    prompt: 'Compare PostgreSQL and MongoDB for a blog platform',
    expectedTier: 'think',
    category: 'comparison',
  },
  {
    prompt: 'Refactor this class to use composition instead of inheritance',
    expectedTier: 'think',
    category: 'refactoring',
  },
  {
    prompt: 'Review this pull request for potential issues',
    expectedTier: 'think',
    category: 'code-review',
  },
  {
    prompt: 'Explain the trade-offs between SSR and CSR',
    expectedTier: 'think',
    category: 'analysis',
  },
  {
    prompt: 'Write a test suite for this authentication module',
    expectedTier: 'think',
    category: 'testing',
  },
  {
    prompt: 'Implement a retry mechanism with exponential backoff',
    expectedTier: 'think',
    category: 'implementation',
  },
  {
    prompt: 'Optimize this database query that is running slowly',
    expectedTier: 'think',
    category: 'optimization',
  },
  {
    prompt: 'How should I structure my Next.js project for scalability?',
    expectedTier: 'think',
    category: 'strategy',
  },
  {
    prompt: 'Why does this regex not match multiline strings?',
    expectedTier: 'think',
    category: 'debugging',
  },
  {
    prompt: 'Walk me through how JavaScript closures work',
    expectedTier: 'think',
    category: 'explanation',
  },
  {
    prompt: 'Help me understand the event loop in Node.js',
    expectedTier: 'think',
    category: 'explanation',
  },
];

// --- ULTRATHINK tier fixtures (10) ---
const ultrathinkFixtures: BenchmarkFixture[] = [
  {
    prompt: 'Architect a real-time messaging system that handles 10 million concurrent users',
    expectedTier: 'ultrathink',
    category: 'system-architecture',
  },
  {
    prompt: 'Design a complete system for distributed task scheduling from scratch',
    expectedTier: 'ultrathink',
    category: 'system-architecture',
  },
  {
    prompt: 'Prove that this sorting algorithm has O(n log n) average case complexity',
    expectedTier: 'ultrathink',
    category: 'proof',
  },
  {
    prompt: 'Analyze all failure modes of this distributed consensus protocol',
    expectedTier: 'ultrathink',
    category: 'failure-analysis',
  },
  {
    prompt: 'Build a production-grade CI/CD pipeline for a multi-tenant SaaS platform',
    expectedTier: 'ultrathink',
    category: 'production-system',
  },
  {
    prompt: 'Design a multi-tenant data isolation architecture with row-level security',
    expectedTier: 'ultrathink',
    category: 'system-architecture',
  },
  {
    prompt:
      'What are the second-order effects of switching from monolith to microservices on team velocity?',
    expectedTier: 'ultrathink',
    category: 'analysis',
  },
  {
    prompt: 'Architect a scalable event sourcing system with CQRS for financial transactions',
    expectedTier: 'ultrathink',
    category: 'system-architecture',
  },
  {
    prompt: 'Design a complete end-to-end system for real-time fraud detection at scale',
    expectedTier: 'ultrathink',
    category: 'production-system',
  },
  {
    prompt: 'Prove this theorem about the convergence properties of this distributed algorithm',
    expectedTier: 'ultrathink',
    category: 'proof',
  },
];

// --- Edge cases (5) ---
const edgeCaseFixtures: BenchmarkFixture[] = [
  // Long but trivial — just a lot of words asking a simple question
  {
    prompt:
      'Hey I was just wondering if you could please tell me and I know this is a really simple question but I just want to make sure I get it right what is the capital city of the country known as France in Europe',
    expectedTier: 'fast',
    category: 'edge-long-trivial',
  },
  // Short but needs thought
  { prompt: 'Optimize this', expectedTier: 'think', category: 'edge-short-complex' },
  // Polite but simple
  {
    prompt:
      'Would you be so kind as to please tell me what two plus two equals? Thank you so much in advance!',
    expectedTier: 'fast',
    category: 'edge-polite-simple',
  },
  // Single character
  { prompt: 'x', expectedTier: 'fast', category: 'edge-single-char' },
  // Numbers only
  { prompt: '42', expectedTier: 'fast', category: 'edge-numbers' },
];

// --- Benign edge cases (5) ---
const benignEdgeCases: BenchmarkFixture[] = [
  // All caps
  { prompt: 'WHAT IS THE WEATHER', expectedTier: 'fast', category: 'edge-caps' },
  // Lots of punctuation
  { prompt: 'Hello???!!!...', expectedTier: 'fast', category: 'edge-punctuation' },
  // Unicode
  { prompt: 'Translate this: Bonjour le monde', expectedTier: 'fast', category: 'edge-unicode' },
  // Repeated words
  { prompt: 'help help help', expectedTier: 'fast', category: 'edge-repeated' },
  // Mixed whitespace
  { prompt: '  what   is    this  ', expectedTier: 'fast', category: 'edge-whitespace' },
];

export const allFixtures: BenchmarkFixture[] = [
  ...fastFixtures,
  ...thinkFixtures,
  ...ultrathinkFixtures,
  ...edgeCaseFixtures,
  ...benignEdgeCases,
];

export const fixturesByTier = {
  fast: allFixtures.filter((f) => f.expectedTier === 'fast'),
  think: allFixtures.filter((f) => f.expectedTier === 'think'),
  ultrathink: allFixtures.filter((f) => f.expectedTier === 'ultrathink'),
};
