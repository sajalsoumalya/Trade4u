/**
 * Single source of truth for LLM providers.
 *
 * Every provider needs the same four things — a base URL, the env var its key
 * travels in, how to list its models, and how to send one chat message — so
 * they live in one table here instead of being re-spelled as a switch case in
 * trading.js and a lookup map in botEngine.js.
 *
 * Auth styles:
 *   bearer    — Authorization: Bearer <key>   (OpenAI-compatible; the default)
 *   anthropic — x-api-key + anthropic-version
 *   google    — ?key=<key> in the query string
 */

const OPENAI_CAPS = ['reasoning', 'tools', 'vision'];

// Shape every provider's model list into the object the client expects.
const model = (id, name, extra = {}) => ({
  id,
  name: name || id,
  cost: 'Paid',
  context: 128000,
  maxOutput: 8192,
  capabilities: OPENAI_CAPS,
  ...extra,
});

export const PROVIDERS = {
  opencode: {
    base: 'https://opencode.ai/zen/v1',
    envVar: 'OPENCODE_API_KEY',
    // OpenCode serves the model list and chat without credentials.
    keyOptional: true,
    defaults: { cost: 'Free', context: 256000, maxOutput: 16384, capabilities: [...OPENAI_CAPS, 'open weights'] },
    fallbackModels: ['minimax-m2.5-free', 'ring-2.6-1t-free', 'nemotron-3-super-free'],
  },
  openai: {
    base: 'https://api.openai.com/v1',
    envVar: 'OPENAI_API_KEY',
    // Trim the catalogue down to the chat-capable families.
    filter: (m) => m.id && (m.id.startsWith('gpt-') || m.id.startsWith('o')),
    defaults: { context: 128000, maxOutput: 16384 },
    fallbackModels: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'],
  },
  anthropic: {
    base: 'https://api.anthropic.com/v1',
    envVar: 'ANTHROPIC_API_KEY',
    auth: 'anthropic',
    chatPath: '/messages',
    defaults: { context: 200000, maxOutput: 8192 },
    fallbackModels: ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-6'],
  },
  google: {
    base: 'https://generativelanguage.googleapis.com/v1',
    envVar: 'GOOGLE_API_KEY',
    auth: 'google',
    defaults: { context: 1048576, maxOutput: 8192 },
    fallbackModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  },
  deepseek: {
    base: 'https://api.deepseek.com',
    envVar: 'DEEPSEEK_API_KEY',
    defaults: { context: 262144, maxOutput: 16384, capabilities: ['reasoning', 'tools', 'code'] },
    fallbackModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  openrouter: {
    base: 'https://openrouter.ai/api/v1',
    envVar: 'OPENROUTER_API_KEY',
    // OpenRouter's catalogue is public — list it with or without a key.
    keyOptional: true,
    map: (m) => model(m.id, m.name, {
      context: m.context_length || 128000,
      maxOutput: m.top_provider?.max_completion_tokens || 8192,
      capabilities: ['reasoning', 'tools'],
    }),
    fallbackModels: ['anthropic/claude-sonnet-4-6', 'openai/gpt-4.1-mini', 'google/gemini-2.5-flash', 'deepseek/deepseek-chat'],
  },
  nvidia_nim: {
    base: 'https://integrate.api.nvidia.com/v1',
    envVar: 'NVIDIA_NIM_API_KEY',
    defaults: { context: 131072, maxOutput: 8192, capabilities: ['reasoning', 'tools', 'code'] },
    fallbackModels: ['nvidia/llama-3.1-nemotron-70b-instruct', 'deepseek-ai/deepseek-v3', 'meta/llama-3.2-90b-vision-instruct'],
  },
  xai: {
    base: 'https://api.x.ai/v1',
    envVar: 'XAI_API_KEY',
    defaults: { context: 131072, maxOutput: 8192 },
    fallbackModels: ['grok-4', 'grok-3', 'grok-3-mini'],
  },
  qwen: {
    base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    envVar: 'QWEN_API_KEY',
    defaults: { context: 131072, maxOutput: 8192 },
    fallbackModels: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  },
  glm: {
    base: 'https://api.z.ai/api/paas/v4',
    envVar: 'GLM_API_KEY',
    defaults: { context: 131072, maxOutput: 8192 },
    fallbackModels: ['glm-4.6', 'glm-4.5-air'],
  },
  // Any OpenAI-compatible endpoint the user points us at. It has no base of
  // its own — the URL arrives per request and is stored per user — and no
  // suggestion list, since we cannot know what an arbitrary gateway serves.
  custom: {
    base: '',
    envVar: 'CUSTOM_API_KEY',
    requiresBaseUrl: true,
    defaults: { context: 128000, maxOutput: 8192 },
    fallbackModels: [],
  },
};

// 'nvidia' was accepted as an alias before nvidia_nim became the canonical id.
const ALIASES = { nvidia: 'nvidia_nim' };

export function getProvider(name) {
  const key = ALIASES[name] || name;
  return PROVIDERS[key] || PROVIDERS.openai;
}

/**
 * Tidy a user-typed endpoint into the collection root we can append to.
 *
 * People paste whatever their gateway's docs show, so accept a full chat
 * endpoint or a stray trailing slash and reduce both to the base that
 * `${base}/models` and `${base}/chat/completions` can be built from.
 */
export function normalizeBaseUrl(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let url = raw.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    // A bare host needs a scheme. Loopback and private ranges are where local
    // model servers live (Ollama, LM Studio, vLLM, LiteLLM) and they serve
    // plain HTTP, so defaulting those to https would break the commonest
    // reason to reach for a custom endpoint at all.
    const isLocal = /^(localhost|127\.0\.0\.1|\[?::1\]?|0\.0\.0\.0|host\.docker\.internal|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url);
    url = `${isLocal ? 'http' : 'https'}://${url}`;
  }
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/(chat\/completions|completions|models)$/i, '');
  return url;
}

/** True when this provider cannot be used without a user-supplied base URL. */
export function requiresBaseUrl(name) {
  return !!getProvider(name).requiresBaseUrl;
}

// Overlay a per-request base URL. An explicit URL wins even for a known
// provider, so a corporate proxy can stand in front of any of them.
function withBase(p, baseUrl) {
  const base = normalizeBaseUrl(baseUrl);
  return base ? { ...p, base } : p;
}

/** The env var a provider's API key is expected to arrive in. */
export function envVarFor(name) {
  return getProvider(name).envVar;
}

/** True when the provider can be used with no API key at all. */
export function isKeyOptional(name) {
  return !!getProvider(name).keyOptional;
}

function listUrl(p, apiKey) {
  if (p.auth === 'google') return `${p.base}/models?key=${encodeURIComponent(apiKey || '')}`;
  return `${p.base}/models`;
}

function authHeaders(p, apiKey) {
  if (!apiKey) return {};
  if (p.auth === 'anthropic') return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  if (p.auth === 'google') return {};
  return { Authorization: `Bearer ${apiKey}` };
}

function chatUrl(p, apiKey, modelId) {
  if (p.auth === 'google') {
    return `${p.base}/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey || '')}`;
  }
  return `${p.base}${p.chatPath || '/chat/completions'}`;
}

// Pull the model array out of a provider's list response. Google nests under
// `models` with a "models/" id prefix; everyone else uses `data`.
function extractModels(p, body) {
  if (p.auth === 'google') {
    return (body.models || [])
      .map((m) => {
        const id = (m.name || '').replace('models/', '');
        return id ? model(id, m.displayName || m.display_name, p.defaults) : null;
      })
      .filter(Boolean);
  }
  const rows = body.data || [];
  const mapper = p.map || ((m) => model(m.id, m.display_name || m.name, p.defaults));
  return rows.filter(p.filter || (() => true)).map(mapper).filter((m) => m && m.id);
}

/**
 * List a provider's models, falling back to a static suggestion list.
 * `source` is 'live' when the provider answered, 'fallback' otherwise — the
 * client uses it to prompt for a missing key.
 */
export async function listModels(providerName, apiKey, baseUrl) {
  const p = withBase(getProvider(providerName), baseUrl);
  let models = [];
  let error = null;

  // A custom endpoint has no default and no suggestions, so say what is
  // missing rather than returning a silently empty dropdown.
  if (p.requiresBaseUrl && !p.base) {
    return { models: [], source: 'fallback', error: 'Base URL required' };
  }

  if (apiKey || p.keyOptional) {
    try {
      const resp = await fetch(listUrl(p, apiKey), { headers: authHeaders(p, apiKey) });
      if (resp.ok) {
        models = extractModels(p, await resp.json());
        if (models.length === 0) error = 'Endpoint returned no models';
      } else {
        error = `HTTP ${resp.status} from ${p.base}/models`;
      }
    } catch (e) {
      error = `Could not reach ${p.base}/models — ${e.message}`;
    }
  } else {
    error = 'API key required';
  }

  if (models.length > 0) return { models, source: 'live' };
  const fallback = (p.fallbackModels || []).map((id) => model(id, id, p.defaults));
  return { models: fallback, source: 'fallback', error };
}

/** Read the assistant's reply out of a provider-shaped chat response. */
function extractReply(p, data) {
  if (p.auth === 'anthropic') return data.content?.[0]?.text;
  if (p.auth === 'google') return data.candidates?.[0]?.content?.parts?.[0]?.text;
  return data.choices?.[0]?.message?.content;
}

function chatBody(p, modelId) {
  const messages = [{ role: 'user', content: 'Reply with just: OK' }];
  if (p.auth === 'anthropic') return { model: modelId, max_tokens: 50, messages };
  if (p.auth === 'google') return { contents: [{ parts: [{ text: 'Reply with just: OK' }] }] };
  return { model: modelId, messages, max_tokens: 20, temperature: 0 };
}

/**
 * Two-step credential check: validate the key against the model list, then
 * send one real chat message so the configured model is exercised too.
 */
export async function testConnection(providerName, apiKey, modelId, baseUrl) {
  const p = withBase(getProvider(providerName), baseUrl);
  const endpointUrl = p.base;
  let keyOk = false;
  let error = null;

  if (p.requiresBaseUrl && !p.base) {
    return { ok: false, error: 'Base URL required', endpointUrl: '', llmResponse: null, keyOk: false };
  }

  if (!apiKey) {
    if (p.keyOptional) keyOk = true;
    else error = 'API key required';
  } else {
    try {
      const vr = await fetch(listUrl(p, apiKey), { headers: authHeaders(p, apiKey) });
      keyOk = vr.ok;
      if (!vr.ok) error = `Key validation: HTTP ${vr.status}`;
    } catch (e) {
      error = `Key validation failed: ${e.message}`;
    }
  }

  let llmResponse = null;
  const target = modelId || (p.fallbackModels || [])[0];
  // A custom endpoint has no suggestion list to borrow a name from, so with no
  // model chosen yet there is nothing to send. Report the key check alone
  // rather than posting a request with no model and surfacing its complaint.
  if (keyOk && !target) {
    return { ok: true, error: null, endpointUrl, llmResponse: 'Key accepted — pick a model to test a call', keyOk };
  }
  if (keyOk && (apiKey || p.keyOptional)) {
    try {
      const r = await fetch(chatUrl(p, apiKey, target), {
        method: 'POST',
        headers: { ...authHeaders(p, apiKey), 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody(p, target)),
      });
      if (r.ok) {
        const data = await r.json();
        llmResponse = extractReply(p, data) || JSON.stringify(data).slice(0, 200);
      } else {
        const text = await r.text().catch(() => '');
        llmResponse = `HTTP ${r.status}: ${text.slice(0, 200)}`;
      }
    } catch (e) {
      llmResponse = `Request failed: ${e.message}`;
    }
  }

  const chatFailed = !!llmResponse && llmResponse.startsWith('HTTP');
  return {
    ok: keyOk && !chatFailed && !error,
    error: error || (chatFailed ? llmResponse : null),
    endpointUrl,
    llmResponse,
    keyOk,
  };
}
