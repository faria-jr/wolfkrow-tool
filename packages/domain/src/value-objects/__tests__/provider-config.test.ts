import { describe, expect, it } from 'vitest';

import { ProviderConfig, PROVIDER_PROTOCOLS, normalizeIpv4 } from '../provider-config';

describe('ProviderConfig', () => {
  it('creates a valid anthropic-compat provider', () => {
    const p = ProviderConfig.create({
      id: 'zai',
      displayName: 'Z.ai (GLM)',
      protocol: 'anthropic-compat',
      baseUrl: 'https://api.z.ai/api/anthropic',
      apiKeyAccount: 'zai-api-key',
      models: ['glm-4.7'],
      supportsTools: true,
    });
    expect(p.id).toBe('zai');
    expect(p.supportsTools).toBe(true);
  });

  it('creates a valid openai-compatible provider', () => {
    const p = ProviderConfig.create({
      id: 'ollama',
      displayName: 'Ollama',
      protocol: 'openai-compatible',
      baseUrl: 'http://localhost:11434/v1',
      apiKeyAccount: 'ollama',
      models: ['llama-3'],
      supportsTools: false,
    });
    expect(p.protocol).toBe('openai-compatible');
    expect(p.supportsTools).toBe(false);
  });

  it('rejects empty id', () => {
    expect(() =>
      ProviderConfig.create({
        id: '',
        displayName: 'X',
        protocol: 'openai-compatible',
        baseUrl: 'https://x',
        apiKeyAccount: 'x',
        models: ['m1'],
        supportsTools: false,
      }),
    ).toThrow('id required');
  });

  it('rejects empty models array', () => {
    expect(() =>
      ProviderConfig.create({
        id: 'x',
        displayName: 'X',
        protocol: 'openai-compatible',
        baseUrl: 'https://x',
        apiKeyAccount: 'x',
        models: [],
        supportsTools: false,
      }),
    ).toThrow('at least one model');
  });

  it('PROVIDER_PROTOCOLS contains both valid protocols', () => {
    expect(PROVIDER_PROTOCOLS).toContain('anthropic-compat');
    expect(PROVIDER_PROTOCOLS).toContain('openai-compatible');
  });

  it('exposes toJSON returning all props', () => {
    const p = ProviderConfig.create({
      id: 'a',
      displayName: 'A',
      protocol: 'anthropic-compat',
      baseUrl: 'https://a',
      apiKeyAccount: 'a',
      models: ['m1'],
      supportsTools: true,
    });
    const json = p.toJSON();
    expect(json.id).toBe('a');
    expect(json.models).toEqual(['m1']);
  });

  it('exposes optional pricingUrl', () => {
    const p = ProviderConfig.create({
      id: 'b',
      displayName: 'B',
      protocol: 'anthropic-compat',
      baseUrl: 'https://b',
      apiKeyAccount: 'b',
      models: ['m1'],
      supportsTools: false,
      pricingUrl: 'https://b/pricing',
    });
    expect(p.pricingUrl).toBe('https://b/pricing');
  });

  it('rejects non-http protocols', () => {
    expect(() =>
      ProviderConfig.create({
        id: 'x', displayName: 'X', protocol: 'openai-compatible',
        baseUrl: 'file:///etc/passwd', apiKeyAccount: 'x', models: ['m1'], supportsTools: false,
      }),
    ).toThrow('http/https');
  });

  it('rejects http for non-loopback hosts', () => {
    expect(() =>
      ProviderConfig.create({
        id: 'x', displayName: 'X', protocol: 'openai-compatible',
        baseUrl: 'http://api.example.com/v1', apiKeyAccount: 'x', models: ['m1'], supportsTools: false,
      }),
    ).toThrow('localhost/loopback');
  });

  it('rejects private hosts (SSRF)', () => {
    expect(() =>
      ProviderConfig.create({
        id: 'x', displayName: 'X', protocol: 'openai-compatible',
        baseUrl: 'https://169.254.169.254/latest/meta-data/', apiKeyAccount: 'x', models: ['m1'], supportsTools: false,
      }),
    ).toThrow('private host');
  });

  it('allows IPv6 loopback [::1] over https', () => {
    expect(() =>
      ProviderConfig.create({
        id: 'x', displayName: 'X', protocol: 'openai-compatible',
        baseUrl: 'https://[::1]/v1', apiKeyAccount: 'x', models: ['m1'], supportsTools: false,
      }),
    ).not.toThrow();
  });

  it('allows IPv6 loopback [::1] over http', () => {
    expect(() =>
      ProviderConfig.create({
        id: 'x', displayName: 'X', protocol: 'openai-compatible',
        baseUrl: 'http://[::1]/v1', apiKeyAccount: 'x', models: ['m1'], supportsTools: false,
      }),
    ).not.toThrow();
  });

  it('rejects IPv6 unspecified [::] as private host', () => {
    expect(() =>
      ProviderConfig.create({
        id: 'x', displayName: 'X', protocol: 'openai-compatible',
        baseUrl: 'https://[::]/v1', apiKeyAccount: 'x', models: ['m1'], supportsTools: false,
      }),
    ).toThrow('private host');
  });

  it('rejects IPv6 link-local [fe80::...]', () => {
    expect(() =>
      ProviderConfig.create({
        id: 'x', displayName: 'X', protocol: 'openai-compatible',
        baseUrl: 'https://[fe80::1]/v1', apiKeyAccount: 'x', models: ['m1'], supportsTools: false,
      }),
    ).toThrow('private host');
  });

  it('rejects IPv6 unique-local [fc00::...] and [fd00::...]', () => {
    expect(() =>
      ProviderConfig.create({
        id: 'x', displayName: 'X', protocol: 'openai-compatible',
        baseUrl: 'https://[fc00::1]/v1', apiKeyAccount: 'x', models: ['m1'], supportsTools: false,
      }),
    ).toThrow('private host');
    expect(() =>
      ProviderConfig.create({
        id: 'x', displayName: 'X', protocol: 'openai-compatible',
        baseUrl: 'https://[fd00::1]/v1', apiKeyAccount: 'x', models: ['m1'], supportsTools: false,
      }),
    ).toThrow('private host');
  });

  it('rejects IPv4-mapped IPv6 [::ffff:127.0.0.1]', () => {
    expect(() =>
      ProviderConfig.create({
        id: 'x', displayName: 'X', protocol: 'openai-compatible',
        baseUrl: 'https://[::ffff:127.0.0.1]/v1', apiKeyAccount: 'x', models: ['m1'], supportsTools: false,
      }),
    ).toThrow('private host');
  });

  it('rejects IPv4-mapped IPv6 [::ffff:169.254.169.254]', () => {
    expect(() =>
      ProviderConfig.create({
        id: 'x', displayName: 'X', protocol: 'openai-compatible',
        baseUrl: 'https://[::ffff:169.254.169.254]/latest', apiKeyAccount: 'x', models: ['m1'], supportsTools: false,
      }),
    ).toThrow('private host');
  });

  it('allows public IPv6 host', () => {
    expect(() =>
      ProviderConfig.create({
        id: 'x', displayName: 'X', protocol: 'openai-compatible',
        baseUrl: 'https://[2606:4700:4700::1111]/v1', apiKeyAccount: 'x', models: ['m1'], supportsTools: false,
      }),
    ).not.toThrow();
  });

  it('rejects 0.0.0.0', () => {
    expect(() =>
      ProviderConfig.create({
        id: 'x', displayName: 'X', protocol: 'openai-compatible',
        baseUrl: 'https://0.0.0.0/v1', apiKeyAccount: 'x', models: ['m1'], supportsTools: false,
      }),
    ).toThrow('private host');
  });
});

describe('ProviderConfig SSRF — numeric IP bypass vectors', () => {
  // Helper: build the minimal props object for a custom provider.
  const props = (baseUrl: string) => ({
    id: 'x', displayName: 'X', protocol: 'openai-compatible' as const,
    baseUrl, apiKeyAccount: 'x', models: ['m1'], supportsTools: false,
  });

  // These vectors resolve to private-but-NOT-loopback addresses (cloud metadata,
  // internal subnets) and MUST be blocked regardless of numeric encoding.
  const blockedVectors: Array<[string, string]> = [
    ['cloud metadata decimal', 'https://2852039166/'],
    ['cloud metadata octal', 'https://0251.0376.0251.0376/'],
    ['IPv4-mapped IPv6 hex', 'https://[::ffff:7f00:1]/'],
    ['IPv4-mapped IPv6 metadata hex', 'https://[::ffff:a9fe:a9fe]/'],
  ];

  for (const [label, baseUrl] of blockedVectors) {
    it(`rejects ${label} (${baseUrl}) — resolves to private/loopback`, () => {
      expect(() => ProviderConfig.create(props(baseUrl))).toThrow();
    });
  }

  // Loopback over https is explicitly permitted by policy (matches existing
  // https://127.0.0.1/ and https://[::1]/ allowances). Numeric encodings of
  // 127.0.0.1 must be treated identically to its dotted form.
  it('allows loopback https via decimal single-int (2130706433 → 127.0.0.1)', () => {
    expect(() => ProviderConfig.create(props('https://2130706433/'))).not.toThrow();
  });

  it('allows loopback https via octal per-octet (0177.0.0.1)', () => {
    expect(() => ProviderConfig.create(props('https://0177.0.0.1/'))).not.toThrow();
  });

  it('rejects http for numeric-encoded non-loopback (0177.0.0.1 → 127.0.0.1 still loopback-ok)', () => {
    // 127.0.0.1 IS loopback, so http is allowed — this documents the policy.
    expect(() => ProviderConfig.create(props('http://0177.0.0.1:11434/v1'))).not.toThrow();
  });

  it('allows public IP literal https://8.8.8.8/', () => {
    expect(() => ProviderConfig.create(props('https://8.8.8.8/'))).not.toThrow();
  });

  it('allows public https://api.anthropic.com/', () => {
    expect(() => ProviderConfig.create(props('https://api.anthropic.com/'))).not.toThrow();
  });

  it('allows public https://api.openai.com/', () => {
    expect(() => ProviderConfig.create(props('https://api.openai.com/'))).not.toThrow();
  });
});

describe('normalizeIpv4', () => {
  it('canonicalizes decimal single-int', () => {
    expect(normalizeIpv4('2130706433')).toBe('127.0.0.1');
  });

  it('canonicalizes octal per-octet', () => {
    expect(normalizeIpv4('0177.0.0.1')).toBe('127.0.0.1');
  });

  it('canonicalizes hex single-int', () => {
    expect(normalizeIpv4('0x7f000001')).toBe('127.0.0.1');
  });

  it('canonicalizes mixed hex+short (0x7f.1)', () => {
    expect(normalizeIpv4('0x7f.1')).toBe('127.0.0.1');
  });

  it('canonicalizes dotted decimal already-canonical', () => {
    expect(normalizeIpv4('127.0.0.1')).toBe('127.0.0.1');
  });

  it('canonicalizes short form 127.1', () => {
    expect(normalizeIpv4('127.1')).toBe('127.0.0.1');
  });

  it('canonicalizes cloud metadata decimal', () => {
    expect(normalizeIpv4('2852039166')).toBe('169.254.169.254');
  });

  it('returns null for non-IP hostname', () => {
    expect(normalizeIpv4('api.anthropic.com')).toBeNull();
  });

  it('returns null for integer overflow (99999999999)', () => {
    expect(normalizeIpv4('99999999999')).toBeNull();
  });

  it('returns null for octet overflow (0x100.0.0.1)', () => {
    expect(normalizeIpv4('0x100.0.0.1')).toBeNull();
  });

  it('returns null for octet > 255 decimal (192.168.1.300)', () => {
    expect(normalizeIpv4('192.168.1.300')).toBeNull();
  });

  it('returns null for too many octets (1.2.3.4.5)', () => {
    expect(normalizeIpv4('1.2.3.4.5')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeIpv4('')).toBeNull();
  });
});
