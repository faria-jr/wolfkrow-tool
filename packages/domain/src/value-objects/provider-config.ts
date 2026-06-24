export const PROVIDER_PROTOCOLS = ['anthropic-compat', 'openai-compatible'] as const;
export type ProviderProtocol = (typeof PROVIDER_PROTOCOLS)[number];

const PRIVATE_IPV4_PREFIXES: readonly RegExp[] = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
];

function isPrivateIPv4(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '0.0.0.0') return true;
  return PRIVATE_IPV4_PREFIXES.some((re) => re.test(hostname));
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname.startsWith('127.');
}

function stripIPv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

function ipv6MappedToIPv4(hostname: string): string | null {
  const hexPart = hostname.slice('::ffff:'.length);
  if (!hexPart) return null;
  const segments = hexPart.split(':');
  if (segments.length !== 2) return null;
  const high = parseInt(segments[0] ?? '', 16);
  const low = parseInt(segments[1] ?? '', 16);
  if (Number.isNaN(high) || Number.isNaN(low)) return null;
  const num = (high << 16) | low;
  return `${(num >>> 24) & 0xff}.${(num >>> 16) & 0xff}.${(num >>> 8) & 0xff}.${num & 0xff}`;
}

const IPV6_LOOPBACK = new Set(['::1', '0:0:0:0:0:0:0:1']);
const IPV6_UNSPECIFIED = new Set(['::', '0:0:0:0:0:0:0:0']);
const PRIVATE_IPV6_PREFIXES: readonly RegExp[] = [/^f[cd]/, /^fe[89ab]/, /^ff/];

function isPrivateIPv6(hostname: string): boolean {
  if (IPV6_LOOPBACK.has(hostname) || IPV6_UNSPECIFIED.has(hostname)) return true;
  if (PRIVATE_IPV6_PREFIXES.some((re) => re.test(hostname))) return true;
  if (hostname.startsWith('::ffff:')) {
    const ipv4 = ipv6MappedToIPv4(hostname);
    if (ipv4 && isPrivateIPv4(ipv4)) return true;
  }
  return false;
}

function isLoopbackIPv6(hostname: string): boolean {
  return IPV6_LOOPBACK.has(hostname);
}

function isPrivateHost(hostname: string): boolean {
  const inner = stripIPv6Brackets(hostname);
  if (inner.includes(':')) return isPrivateIPv6(inner);
  return isPrivateIPv4(inner);
}

function isLoopbackAny(hostname: string): boolean {
  const inner = stripIPv6Brackets(hostname);
  if (inner.includes(':')) return isLoopbackIPv6(inner);
  return isLoopbackHost(inner);
}

function validateBaseUrl(baseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`ProviderConfig: invalid baseUrl ${baseUrl}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`ProviderConfig: baseUrl must use http/https, got ${parsed.protocol}`);
  }
  if (parsed.protocol === 'http:' && !isLoopbackAny(parsed.hostname)) {
    throw new Error('ProviderConfig: http baseUrl allowed only for localhost/loopback; use https otherwise');
  }
  if (isPrivateHost(parsed.hostname) && !isLoopbackAny(parsed.hostname)) {
    throw new Error(`ProviderConfig: baseUrl points to private host ${parsed.hostname}`);
  }
}

export interface ProviderConfigProps {
  id: string;
  displayName: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKeyAccount: string;
  models: readonly string[];
  supportsTools: boolean;
  pricingUrl?: string;
}

export class ProviderConfig {
  private constructor(private readonly props: ProviderConfigProps) {}

  static create(props: ProviderConfigProps): ProviderConfig {
    if (!props.id.trim()) throw new Error('ProviderConfig: id required');
    if (props.models.length === 0) throw new Error('ProviderConfig: at least one model required');
    if (!(PROVIDER_PROTOCOLS as readonly string[]).includes(props.protocol)) {
      throw new Error(`ProviderConfig: invalid protocol ${props.protocol}`);
    }
    validateBaseUrl(props.baseUrl);
    return new ProviderConfig(props);
  }

  get id(): string { return this.props.id; }
  get displayName(): string { return this.props.displayName; }
  get protocol(): ProviderProtocol { return this.props.protocol; }
  get baseUrl(): string { return this.props.baseUrl; }
  get apiKeyAccount(): string { return this.props.apiKeyAccount; }
  get models(): readonly string[] { return this.props.models; }
  get supportsTools(): boolean { return this.props.supportsTools; }
  get pricingUrl(): string | undefined { return this.props.pricingUrl; }

  toJSON(): ProviderConfigProps { return { ...this.props }; }
}
