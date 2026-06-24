import { randomUUID } from 'node:crypto';

export type PipelineMessageRole = 'user' | 'assistant' | 'system';

export interface PipelineMessageProps {
 id: string;
 projectId: string;
 phaseId: string;
 role: PipelineMessageRole;
 content: string;
 createdAt: Date;
}

export type PipelineMessageCreateInput = Pick<
 PipelineMessageProps,
 'projectId' | 'phaseId' | 'role' | 'content'
>;

/**
 * a persisted AI exchange (user prompt + assistant output) for a pipeline phase.
 * The assistant content doubles as the phase artifact body (written to disk by ArtifactWriter).
 */
export class PipelineMessage {
 readonly id: string;
 readonly projectId: string;
 readonly phaseId: string;
 readonly role: PipelineMessageRole;
 readonly content: string;
 readonly createdAt: Date;

 private constructor(props: PipelineMessageProps) {
 this.id = props.id;
 this.projectId = props.projectId;
 this.phaseId = props.phaseId;
 this.role = props.role;
 this.content = props.content;
 this.createdAt = props.createdAt;
 }

 static create(input: PipelineMessageCreateInput): PipelineMessage {
 return new PipelineMessage({
 id: randomUUID(),
 projectId: input.projectId,
 phaseId: input.phaseId,
 role: input.role,
 content: input.content,
 createdAt: new Date(),
 });
 }

 static fromProps(props: PipelineMessageProps): PipelineMessage {
 return new PipelineMessage(props);
 }

 toProps(): PipelineMessageProps {
 return {
 id: this.id,
 projectId: this.projectId,
 phaseId: this.phaseId,
 role: this.role,
 content: this.content,
 createdAt: this.createdAt,
 };
 }
}
