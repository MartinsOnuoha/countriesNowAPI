/** Minimal chat client for JSON-only harness calls. */

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
        // Default temperature 0 for deterministic curation.
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

/** Extract JSON from fences; parse failure → null. */
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
