/**
 * Resolving which provider, models and API key a run should use.
 *
 * This lived in three places — the trading routes, the analysis route and the
 * bot engine — and only one of them consulted the per-provider key store. A
 * user whose chosen provider sat in neither the primary nor the fallback slot
 * would therefore pass the Settings connection test but have their bot run with
 * a different provider's key. One implementation now serves all three.
 */
import db from './db.js';
import { decrypt } from './cryptoHelper.js';
import { logger } from './logger.js';

const MASKED_KEYS = ['●●●●●●●●', '******'];

/** True when the client sent a placeholder rather than a real key. */
export const isMaskedKey = (k) => !k || MASKED_KEYS.includes(k) || k.includes('●');

const DEFAULTS = {
  provider: 'opencode',
  model: 'minimax-m2.5-free',
};

/** The provider -> encrypted-key map, tolerating absent or corrupt JSON. */
export function parseProviderKeys(config) {
  try {
    return JSON.parse(config?.provider_keys || '{}');
  } catch {
    return {};
  }
}

const safeDecrypt = (value) => {
  if (!value) return '';
  try {
    return decrypt(value);
  } catch (err) {
    logger.warn('llmConfig', `Could not decrypt stored key — ${err.message}`);
    return '';
  }
};

export function loadRawConfig(uid) {
  try {
    return db.prepare('SELECT * FROM llm_config WHERE uid = ?').get(uid) || null;
  } catch (err) {
    logger.error('llmConfig', `Config lookup failed — ${err.message}`);
    return null;
  }
}

/**
 * The stored key for `provider`, decrypted.
 *
 * Checks the primary slot, then the fallback slot, then the per-provider store,
 * so a key saved for any provider is found regardless of which slot it occupies.
 * `isFallback` only decides which slot to fall back on when nothing matched.
 */
export function resolveStoredKey(uid, provider, isFallback = false) {
  const config = loadRawConfig(uid);
  if (!config) return '';

  if (provider && provider === config.provider && config.api_key) return safeDecrypt(config.api_key);
  if (provider && provider === config.fallback_provider && config.fallback_api_key) {
    return safeDecrypt(config.fallback_api_key);
  }

  const perProvider = parseProviderKeys(config);
  if (provider && perProvider[provider]) return safeDecrypt(perProvider[provider]);

  return safeDecrypt(isFallback ? config.fallback_api_key : config.api_key);
}

/**
 * Settle on the provider, models and key for an engine run.
 *
 * Precedence is explicit request > the user's saved primary > their configured
 * fallback > the built-in defaults, so a bot with its own provider pinned keeps
 * using it while an unconfigured one still starts.
 */
export function resolveEngineConfig(uid, overrides = {}) {
  const config = loadRawConfig(uid);

  const provider =
    overrides.provider || config?.provider || config?.fallback_provider || DEFAULTS.provider;
  const quickModel =
    overrides.quickModel || config?.quick_model || config?.fallback_quick_model || DEFAULTS.model;
  const deepModel =
    overrides.deepModel || config?.deep_model || config?.fallback_deep_model || DEFAULTS.model;

  const apiKey = isMaskedKey(overrides.apiKey)
    ? resolveStoredKey(uid, provider)
    : overrides.apiKey;

  return { provider, quickModel, deepModel, apiKey: apiKey || '' };
}
