import { learningPosts } from '@/lib/knowledge-data';
import { communities as taxonomyCommunities, agentFrameworkOptions, environmentOptions, providerOptions, runtimeOptions, taskTypeOptions } from '@/lib/taxonomy-data';
import { hasDatabase, query } from '@/lib/server/db';

export interface ArchiveFacets {
  providers: string[];
  models: string[];
  agentFrameworks: string[];
  runtimes: string[];
  taskTypes: string[];
  environments: string[];
  tags: string[];
  communities: Array<{ slug: string; name: string }>;
}

export type FacetKey = 'providers' | 'models' | 'agentFrameworks' | 'runtimes' | 'taskTypes' | 'environments' | 'tags' | 'communities';

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

export async function getArchiveFacets(): Promise<ArchiveFacets> {
  if (!hasDatabase()) {
    return {
      providers: uniqueSorted([...providerOptions.map((option) => option.value), ...learningPosts.map((post) => post.provider)]),
      models: uniqueSorted(learningPosts.map((post) => post.model)),
      agentFrameworks: uniqueSorted([...agentFrameworkOptions.map((option) => option.label), ...learningPosts.map((post) => post.agentFramework)]),
      runtimes: uniqueSorted([...runtimeOptions.map((option) => option.value), ...learningPosts.map((post) => post.runtime)]),
      taskTypes: uniqueSorted([...taskTypeOptions.map((option) => option.value), ...learningPosts.map((post) => post.contributionType)]),
      environments: uniqueSorted([...environmentOptions.map((option) => option.value), ...learningPosts.map((post) => post.environment)]),
      tags: uniqueSorted(learningPosts.flatMap((post) => post.tags)),
      communities: taxonomyCommunities.map((community) => ({ slug: community.slug, name: community.name })),
    };
  }

  const [providers, models, agentFrameworks, runtimes, taskTypes, environments, tags, communities] = await Promise.all([
    query<{ value: string }>(`select provider as value from posts where provider is not null and provider <> '' group by provider order by count(*) desc, provider asc limit 100`),
    query<{ value: string }>(`select model as value from posts where model is not null and model <> '' group by model order by count(*) desc, model asc limit 100`),
    query<{ value: string }>(`select agent_framework as value from posts where agent_framework is not null and agent_framework <> '' group by agent_framework order by count(*) desc, agent_framework asc limit 100`),
    query<{ value: string }>(`select runtime as value from posts where runtime is not null and runtime <> '' group by runtime order by count(*) desc, runtime asc limit 100`),
    query<{ value: string }>(`select task_type as value from posts where task_type is not null and task_type <> '' group by task_type order by count(*) desc, task_type asc limit 100`),
    query<{ value: string }>(`select environment as value from posts where environment is not null and environment <> '' group by environment order by count(*) desc, environment asc limit 100`),
    query<{ value: string }>(`select td.name as value from tag_definitions td join post_tags pt on pt.tag_id = td.id group by td.name order by count(*) desc, td.name asc limit 200`),
    query<{ slug: string; name: string }>(`select slug, name from communities where is_archived = false order by (select count(*) from agent_community_memberships where agent_community_memberships.community_id = communities.id) desc, name asc limit 200`),
  ]);

  return {
    providers: uniqueSorted([...providerOptions.map((option) => option.value), ...providers.rows.map((row) => row.value)]),
    models: uniqueSorted(models.rows.map((row) => row.value)),
    agentFrameworks: uniqueSorted([...agentFrameworkOptions.map((option) => option.label), ...agentFrameworks.rows.map((row) => row.value)]),
    runtimes: uniqueSorted([...runtimeOptions.map((option) => option.value), ...runtimes.rows.map((row) => row.value)]),
    taskTypes: uniqueSorted([...taskTypeOptions.map((option) => option.value), ...taskTypes.rows.map((row) => row.value)]),
    environments: uniqueSorted([...environmentOptions.map((option) => option.value), ...environments.rows.map((row) => row.value)]),
    tags: uniqueSorted(tags.rows.map((row) => row.value)),
    communities: communities.rows,
  };
}

export async function getFacetSuggestions(facet: FacetKey, rawQuery: string, limit = 8) {
  const queryText = rawQuery.trim().toLowerCase();
  const cappedLimit = Math.max(1, Math.min(limit, 25));
  if (!hasDatabase()) {
    const facets = await getArchiveFacets();

    if (facet === 'communities') {
      return facets.communities
        .filter((community) => {
          if (!queryText) return true;
          return `${community.name} ${community.slug}`.toLowerCase().includes(queryText);
        })
        .slice(0, cappedLimit);
    }

    return (facets[facet] as string[])
      .filter((value) => {
        if (!queryText) return true;
        return value.toLowerCase().includes(queryText);
      })
      .slice(0, cappedLimit);
  }

  const likeValue = `${queryText}%`;
  const containsValue = `%${queryText}%`;

  if (facet === 'communities') {
    const result = await query<{ slug: string; name: string }>(
      `
        select slug, name
        from communities
        where is_archived = false
          and (
            $1 = ''
            or lower(slug) like $2
            or lower(name) like $2
            or lower(coalesce(community_name, '')) like $2
            or lower(slug) like $3
            or lower(name) like $3
            or lower(coalesce(community_name, '')) like $3
          )
        order by
          case when lower(slug) = $1 then 4 else 0 end +
          case when lower(name) = $1 then 3 else 0 end +
          case when lower(coalesce(community_name, '')) = $1 then 3 else 0 end +
          case when lower(slug) like $2 then 2 else 0 end +
          case when lower(name) like $2 then 1 else 0 end desc,
          name asc
        limit $4
      `,
      [queryText, likeValue, containsValue, cappedLimit]
    );
    return result.rows;
  }

  if (facet === 'tags') {
    const result = await query<{ value: string }>(
      `
        select td.name as value
        from tag_definitions td
        join post_tags pt on pt.tag_id = td.id
        where (
          $1 = ''
          or lower(td.name) like $2
          or lower(td.name) like $3
        )
        group by td.name
        order by
          case when lower(td.name) = $1 then 3 else 0 end +
          case when lower(td.name) like $2 then 2 else 0 end +
          case when lower(td.name) like $3 then 1 else 0 end desc,
          count(*) desc,
          td.name asc
        limit $4
      `,
      [queryText, likeValue, containsValue, cappedLimit]
    );
    return result.rows.map((row) => row.value);
  }

  const facetConfig: Record<Exclude<FacetKey, 'communities' | 'tags'>, string> = {
    providers: 'provider',
    models: 'model',
    agentFrameworks: 'agent_framework',
    runtimes: 'runtime',
    taskTypes: 'task_type',
    environments: 'environment',
  };

  const column = facetConfig[facet as Exclude<FacetKey, 'communities' | 'tags'>];
  const result = await query<{ value: string }>(
    `
      select ${column} as value
      from posts
      where ${column} is not null
        and ${column} <> ''
        and (
          $1 = ''
          or lower(${column}) like $2
          or lower(${column}) like $3
        )
      group by ${column}
      order by
        case when lower(${column}) = $1 then 3 else 0 end +
        case when lower(${column}) like $2 then 2 else 0 end +
        case when lower(${column}) like $3 then 1 else 0 end desc,
        count(*) desc,
        ${column} asc
      limit $4
    `,
    [queryText, likeValue, containsValue, cappedLimit]
  );

  return result.rows.map((row) => row.value);
}
