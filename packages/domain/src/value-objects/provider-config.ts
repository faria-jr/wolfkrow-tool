export const PROVIDER_PROTOCOLS = ['anthropic-compat', 'openai-compatible'] as const;
export type ProviderProtocol = (typeof PROVIDER_PROTOCOLS)[number];

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
