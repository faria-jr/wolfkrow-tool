export type ArtifactKind = 'image' | 'audio' | 'mcp_app' | 'text';

export interface ArtifactData {
  imageBase64?: string;
  mimeType?: string;
  prompt?: string;
  filePath?: string;
  viewId?: string;
  excalidrawFile?: string;
  audioBase64?: string;
  [key: string]: unknown;
}

export interface ArtifactProps {
  id: string;
  type: ArtifactKind;
  toolName: string;
  title?: string;
  data: ArtifactData;
}

export class Artifact {
  private constructor(private readonly props: ArtifactProps) {}

  static create(props: ArtifactProps): Artifact {
    if (!props.id) throw new Error('Artifact: id required');
    if (!props.toolName) throw new Error('Artifact: toolName required');
    if (!props.data || typeof props.data !== 'object')
      throw new Error('Artifact: data must be an object');
    return new Artifact(props);
  }

  get id(): string {
    return this.props.id;
  }
  get type(): ArtifactKind {
    return this.props.type;
  }
  get toolName(): string {
    return this.props.toolName;
  }
  get title(): string | undefined {
    return this.props.title;
  }
  get data(): ArtifactData {
    return this.props.data;
  }

  toJSON(): ArtifactProps {
    return { ...this.props, data: { ...this.props.data } };
  }
}

export function isArtifact(value: unknown): value is Artifact {
  return value instanceof Artifact;
}
