export const PROVIDER_PROTOCOLS = ['anthropic-compat', 'openai-compatible'] as const;
export type ProviderProtocol = (typeof PROVIDER_PROTOCOLS)[number];

const PRIVATE_IPV4_PREFIXES: readonly RegExp[] = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
];

/**
 * Canonicalizes an IPv4 hostname expressed in any numeric form into dotted
 * decimal (`a.b.c.d`). Recognizes:
 *  - single 32-bit decimal integer  (`2130706433` → `127.0.0.1`)
 *  - single hex integer             (`0x7f000001` → `127.0.0.1`)
 *  - octal per octet                (`0177.0.0.1` → `127.0.0.1`)
 *  - hex per octet                  (`0x7f.0.0.1` → `127.0.0.1`)
 *  - short forms (1-3 octets)       (`127.1` → `127.0.0.1`)
 *  - mixed radix per octet          (`0x7f.1` → `127.0.0.1`)
 *
 * Returns the canonical `a.b.c.d` string, or `null` when the input is not a
 * numeric IPv4 representation (e.g. a DNS hostname) or overflows 32 bits.
 *
 * Pure (no I/O) — safe for the domain package.
 */
export function normalizeIpv4(hostname: string): string | null {
  const raw = hostname.trim()
  if (!raw) return null
  return raw.includes('.') ? normalizeDottedIpv4(raw) : normalizeSingleIpv4(raw)
}

/**
 * Canonicalizes a dotted IPv4 form (1-4 octets, BSD inet_aton semantics).
 * Each octet may use a radix prefix (0x=hex, 0=octal, else decimal).
 */
function normalizeDottedIpv4(raw: string): string | null {
  const parts = raw.split('.')
  if (parts.length < 1 || parts.length > 4) return null

  const octets: number[] = []
  for (const part of parts) {
    const oct = parseOctet(part)
    if (oct === null) return null
    octets.push(oct)
  }

  // Pack octets into a 32-bit value: the last octet occupies the low bits,
  // earlier octets shift left. With <4 octets the trailing value absorbs the
  // remainder (e.g. `127.1` → 127<<24 | 1).
  let value = 0n
  for (let i = 0; i < octets.length - 1; i++) {
    value = (value << 8n) | BigInt(octets[i]!)
  }
  const last = BigInt(octets[octets.length - 1]!)
  const remainingBits = BigInt((4 - (octets.length - 1)) * 8)
  if (last >= 1n << remainingBits) return null
  value = (value << remainingBits) | last
  return bigintToDotted(value)
}

/**
 * Canonicalizes a non-dotted single-integer IPv4 form (decimal or hex).
 * Bare octal single-ints (`0177`) are rejected as non-standard.
 */
function normalizeSingleIpv4(raw: string): string | null {
  if (/^0[0-9]+$/.test(raw)) return null
  const radix = raw.toLowerCase().startsWith('0x') ? 16 : 10
  const single = parseInt(raw, radix)
  if (!Number.isFinite(single) || single < 0 || single > 0xffffffff) return null
  return bigintToDotted(BigInt(single))
}

/**
 * Parses a single octet that may use a radix prefix:
 *  - `0x...` → hex
 *  - `0...` → octal
 *  - otherwise → decimal
 * Returns the numeric value (0-255) or null on parse failure / overflow.
 */
function parseOctet(part: string): number | null {
  if (part === '') return null
  const lower = part.toLowerCase()
  let radix = 10
  let digits = part
  if (lower.startsWith('0x')) {
    radix = 16
    digits = part.slice(2)
  } else if (part.length > 1 && part.startsWith('0')) {
    radix = 8
    digits = part.slice(1)
  }
  if (digits === '') return null
  if (!digits.match(/^[0-9a-fA-F]+$/)) return null
  const value = parseInt(digits, radix)
  if (!Number.isFinite(value) || value < 0 || value > 255) return null
  return value
}

function bigintToDotted(value: bigint): string | null {
  if (value < 0n || value > 0xffffffffn) return null
  const a = Number((value >> 24n) & 0xffn)
  const b = Number((value >> 16n) & 0xffn)
  const c = Number((value >> 8n) & 0xffn)
  const d = Number(value & 0xffn)
  return `${a}.${b}.${c}.${d}`
}

function isPrivateIPv4(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '0.0.0.0') return true
  const canonical = normalizeIpv4(hostname)
  const subject = canonical ?? hostname
  return PRIVATE_IPV4_PREFIXES.some((re) => re.test(subject))
}

function isLoopbackHost(hostname: string): boolean {
  if (hostname === 'localhost') return true
  const canonical = normalizeIpv4(hostname)
  const subject = canonical ?? hostname
  return subject.startsWith('127.')
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

/**
 * Public SSRF gate for infra adapters: true when the hostname points at a
 * private or loopback address (in any numeric encoding). Used by the infra
 * DNS-rebinding revalidation to check the resolved IP at connection time.
 *
 * Mirrors the policy in {@link validateBaseUrl}: a host is blocked when it is
 * private and NOT loopback over https, OR non-loopback over http. For the raw
 * host check (used post-resolution) we treat loopback as allowed — the caller
 * (infra guard) re-applies the http/https distinction if needed.
 */
export function isSsrfBlockedHost(hostname: string): boolean {
  return isPrivateHost(hostname)
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
