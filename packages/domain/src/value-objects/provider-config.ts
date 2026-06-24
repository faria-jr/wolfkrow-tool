export const PROVIDER_PROTOCOLS = ['anthropic-compat', 'openai-compatible'] as const;
export type ProviderProtocol = (typeof PROVIDER_PROTOCOLS)[number];

function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.startsWith('127.')) return true;
  if (lower.startsWith('10.')) return true;
  if (lower.startsWith('192.168.')) return true;
  if (lower.startsWith('172.')) {
    const second = parseInt(lower.split('.')[1] ?? '0', 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (lower.startsWith('169.254.')) return true;
  return false;
}

function isLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === 'localhost' || lower.startsWith('127.');
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
  if (parsed.protocol === 'http:' && !isLoopbackHost(parsed.hostname)) {
    throw new Error('ProviderConfig: http baseUrl allowed only for localhost/loopback; use https otherwise');
  }
  if (isPrivateHost(parsed.hostname) && !isLoopbackHost(parsed.hostname)) {
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
