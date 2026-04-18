/**
 * CWE-89: SQL injection via dynamic column interpolation
 *
 * Verifies that getFacetSuggestions only allows columns from the hardcoded
 * allowlist and rejects arbitrary input that could lead to SQL injection.
 */

import type { FacetKey } from '@/lib/server/facets-service';

jest.mock('@/lib/server/db', () => ({
  hasDatabase: jest.fn().mockReturnValue(true),
  query: jest.fn().mockResolvedValue({ rows: [] }),
}));

jest.mock('@/lib/knowledge-data', () => ({ learningPosts: [] }));
jest.mock('@/lib/taxonomy-data', () => ({
  communities: [],
  agentFrameworkOptions: [],
  environmentOptions: [],
  providerOptions: [],
  runtimeOptions: [],
  taskTypeOptions: [],
}));

import { getFacetSuggestions } from '@/lib/server/facets-service';
import { query } from '@/lib/server/db';

const mockQuery = query as jest.MockedFunction<typeof query>;

const ALLOWED_FACETS: FacetKey[] = ['providers', 'models', 'agentFrameworks', 'runtimes', 'taskTypes', 'environments'];

describe('CWE-89 – SQL injection via dynamic column interpolation', () => {
  afterEach(() => jest.clearAllMocks());

  it.each(ALLOWED_FACETS)('accepts valid facet key "%s"', async (facet) => {
    await getFacetSuggestions(facet, 'test');
    expect(mockQuery).toHaveBeenCalled();
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toContain('undefined');
  });

  it('interpolated column names come from a fixed allowlist, not user input', async () => {
    await getFacetSuggestions('providers', 'test');
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('provider');

    mockQuery.mockClear();
    await getFacetSuggestions('models', 'test');
    const sql2 = mockQuery.mock.calls[0][0] as string;
    expect(sql2).toContain('model');
  });

  it('query parameters are passed as parameterized values, not interpolated', async () => {
    await getFacetSuggestions('providers', "'; DROP TABLE posts; --");
    const params = mockQuery.mock.calls[0][1] as any[];
    expect(params).toContain("'; drop table posts; --");
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toContain('DROP TABLE');
  });

  it('uses parameterized queries for communities facet', async () => {
    await getFacetSuggestions('communities', "' OR 1=1 --");
    const params = mockQuery.mock.calls[0][1] as any[];
    expect(params[0]).toContain("' or 1=1 --");
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toContain("OR 1=1");
  });

  it('uses parameterized queries for tags facet', async () => {
    await getFacetSuggestions('tags', "'; DELETE FROM posts; --");
    const params = mockQuery.mock.calls[0][1] as any[];
    expect(params[0]).toContain("'; delete from posts; --");
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toContain('DELETE FROM');
  });
});
