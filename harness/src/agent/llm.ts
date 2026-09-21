/**
 * Thin OpenAI-compatible chat client.
 *
 * Deliberately not an SDK. The harness makes two kinds of call — cheap
 * over-production and expensive refutation — and both want strict JSON back.
 * Everything else an SDK offers is surface area we would have to keep current.
 */

import { config, userAgent } from '../config.ts';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider to constrain output to JSON. */
  json?: boolean;
  timeoutMs?: number;
}

export interface ChatResult {
  content: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

export async function chat(options: ChatOptions): Promise<ChatResult> {
  if (!config.agent.apiKey) throw new Error('HARNESS_API_KEY is not set');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 120_000);

  try {
    const res = await fetch(`${config.agent.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.agent.apiKey}`,
        'user-agent': userAgent(),
        // OpenRouter attributes traffic by these; harmless elsewhere.
        'http-referer': 'https://countriesnow.space',
        'x-title': 'CountriesNow Harness'
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        // Curation is adjudication, not creative writing. Determinism matters
        // more than variety, so temperature defaults to zero.
        temperature: options.temperature ?? 0,
        max_tokens: options.maxTokens ?? 2048,
        ...(options.json ? { response_format: { type: 'json_object' } } : {})
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 400)}`);
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('model returned no content');

    return {
      content,
      model: body.model ?? options.model,
      promptTokens: body.usage?.prompt_tokens,
      completionTokens: body.usage?.completion_tokens
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse JSON from a model response.
 *
 * Models wrap JSON in prose or fences even when told not to, so the fenced
 * block is extracted before parsing. A parse failure returns null rather than
 * throwing: one malformed response should cost one candidate, not the run.
 */
export function parseJson<T>(content: string): T | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(content);
  const raw = (fenced?.[1] ?? content).trim();

  try {
    return JSON.parse(raw) as T;
  } catch {
    // Last resort: the outermost brace-delimited span.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
