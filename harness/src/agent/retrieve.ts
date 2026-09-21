/** Fixed evidence queries per anomaly (no model-chosen lookups). */

import { config, userAgent } from '../config.ts';
import type { Anomaly, EvidenceItem, ResolvedDataset } from '../types.ts';

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

interface SparqlBinding {
  [key: string]: { value: string; type: string } | undefined;
}

/** Wikidata requires User-Agent; failures → empty evidence. */
async function sparql(query: string, timeoutMs = 45_000): Promise<SparqlBinding[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`, {
      headers: { accept: 'application/sparql-results+json', 'user-agent': userAgent() },
      signal: controller.signal
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { results?: { bindings?: SparqlBinding[] } };
    return body.results?.bindings ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Current currency for a country, with the "stated in" reference where one
 * exists. `P38` is currency; the `pq:P582` filter drops historical values that
 * already have an end date.
 */
export async function wikidataCurrency(qid: string): Promise<EvidenceItem[]> {
  const query = `
    SELECT ?currencyLabel ?code ?start ?refLabel WHERE {
      wd:${qid} p:P38 ?stmt .
      ?stmt ps:P38 ?currency .
      FILTER NOT EXISTS { ?stmt pq:P582 ?end }
      OPTIONAL { ?currency wdt:P498 ?code }
      OPTIONAL { ?stmt pq:P580 ?start }
      OPTIONAL { ?stmt prov:wasDerivedFrom/pr:P248 ?ref }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 10`;

  const retrievedAt = new Date().toISOString();
  return (await sparql(query)).map((b) => ({
    source: 'wikidata',
    url: `https://www.wikidata.org/wiki/${qid}#P38`,
    excerpt:
      `currency=${b.currencyLabel?.value ?? '?'} (ISO 4217 ${b.code?.value ?? '?'})` +
      (b.start?.value ? `, in force from ${b.start.value.slice(0, 10)}` : '') +
      (b.refLabel?.value ? `, stated in ${b.refLabel.value}` : ', no stated-in reference'),
    retrievedAt
  }));
}

/** Population with its point-in-time and source, which is the whole value here. */
export async function wikidataPopulation(qid: string): Promise<EvidenceItem[]> {
  const query = `
    SELECT ?pop ?time ?refLabel WHERE {
      wd:${qid} p:P1082 ?stmt .
      ?stmt ps:P1082 ?pop .
      OPTIONAL { ?stmt pq:P585 ?time }
      OPTIONAL { ?stmt prov:wasDerivedFrom/pr:P248 ?ref }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } ORDER BY DESC(?time) LIMIT 5`;

  const retrievedAt = new Date().toISOString();
  return (await sparql(query)).map((b) => ({
    source: 'wikidata',
    url: `https://www.wikidata.org/wiki/${qid}#P1082`,
    excerpt:
      `population=${b.pop?.value ?? '?'}` +
      (b.time?.value ? ` at ${b.time.value.slice(0, 10)}` : ', undated') +
      (b.refLabel?.value ? `, stated in ${b.refLabel.value}` : ', no stated-in reference'),
    retrievedAt
  }));
}

/** Official and native names, for rename anomalies. */
export async function wikidataNames(qid: string): Promise<EvidenceItem[]> {
  const query = `
    SELECT ?official ?native ?start WHERE {
      OPTIONAL { wd:${qid} p:P1448 ?s . ?s ps:P1448 ?official . OPTIONAL { ?s pq:P580 ?start } }
      OPTIONAL { wd:${qid} wdt:P1705 ?native }
    } LIMIT 10`;

  const retrievedAt = new Date().toISOString();
  return (await sparql(query))
    .filter((b) => b.official || b.native)
    .map((b) => ({
      source: 'wikidata',
      url: `https://www.wikidata.org/wiki/${qid}#P1448`,
      excerpt:
        `official name=${b.official?.value ?? '—'}, native=${b.native?.value ?? '—'}` +
        (b.start?.value ? `, from ${b.start.value.slice(0, 10)}` : ''),
      retrievedAt
    }));
}

/** Evidence keyed by anomaly.field; include raw source disagreement. */
export async function retrieveEvidence(
  anomaly: Anomaly,
  dataset: ResolvedDataset
): Promise<EvidenceItem[]> {
  const evidence: EvidenceItem[] = [];
  const retrievedAt = new Date().toISOString();

  for (const [source, value] of Object.entries(anomaly.sources)) {
    evidence.push({
      source,
      url: `harness://snapshot/${source}`,
      excerpt: `${source} reports ${JSON.stringify(value)} for ${anomaly.entityRef}.${anomaly.field ?? ''}`,
      retrievedAt
    });
  }

  const country = dataset.countries.find((c) => c.iso2 === anomaly.entityRef);
  const qid = country?.wikidataQid;

  if (qid && config.agent.contact) {
    if (anomaly.field === 'primaryCurrency' || anomaly.field === 'currencies') {
      evidence.push(...(await wikidataCurrency(qid)));
      evidence.push({
        source: 'six-4217',
        url: 'https://www.six-group.com/en/products-services/financial-information/data-standards.html',
        excerpt:
          `The ISO 4217 register (list-one.xml) is the maintenance agency's own publication ` +
          `and carries a Pblshd date. It is authoritative over any aggregator.`,
        retrievedAt
      });
    }
    if (anomaly.field === 'population') {
      evidence.push(...(await wikidataPopulation(qid)));
    }
    if (anomaly.field === 'displayName' || anomaly.field === 'isoOfficialName') {
      evidence.push(...(await wikidataNames(qid)));
    }
  }

  return evidence;
}
