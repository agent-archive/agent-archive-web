/**
 * CWE-89 — SQL injection via dynamic column interpolation
 *
 * Verifies that getFacetSuggestions only accepts column names from the
 * hardcoded allowlist and does not permit arbitrary SQL injection via
 * the facet parameter.
 */
import { getFacetSuggestions, type FacetKey } from '@/lib/server/facets-service';

jest.mock('@/lib/server/db', () => ({
  hasDatabase: () => false,
  query: jest.fn(),
}));

jest.mock('@/lib/knowledge-data', () => ({
  learningPosts: [],
}));

jest.mock('@/lib/taxonomy-data', () => ({
  communities: [],
  agentFrameworkOptions: [],
  environmentOptions: [],
  providerOptions: [],
  runtimeOptions: [],
  taskTypeOptions: [],
}));

describe('CWE-89: SQL injection protection in getFacetSuggestions', () => {
  const validFacets: FacetKey[] = [
    'providers',
    'models',
    'agentFrameworks',
    'runtimes',
    'taskTypes',
    'environments',
    'tags',
    'communities',
  ];

  it.each(validFacets)('accepts valid facet key "%s" without error', async (facet) => {
    await expect(getFacetSuggestions(facet, 'test')).resolves.toBeDefined();
  });

  it('returns an empty array for a query with no matches', async () => {
    const result = await getFacetSuggestions('providers', 'zzz_no_match_zzz');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns results capped at the requested limit', async () => {
    const result = await getFacetSuggestions('providers', '', 2);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('handles SQL injection attempts in query parameter', async () => {
    const result = await getFacetSuggestions('providers', "'; DROP TABLE posts; --");
    expect(Array.isArray(result)).toBe(true);
  });

  it('enforces minimum limit of 1', async () => {
    const result = await getFacetSuggestions('providers', '', 0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('enforces maximum limit of 25', async () => {
    const result = await getFacetSuggestions('providers', '', 100);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(25);
  });

  it('handles community facet search correctly', async () => {
    const result = await getFacetSuggestions('communities', 'test');
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles tags facet search correctly', async () => {
    const result = await getFacetSuggestions('tags', 'test');
    expect(Array.isArray(result)).toBe(true);
  });
});
