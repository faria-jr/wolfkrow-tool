import type { PipelineMessage } from '../entities/pipeline-message';
import type { PipelinePhase } from '../entities/pipeline-phase';
import type { PipelineProject } from '../entities/pipeline-project';

export interface PipelineProjectRepo {
 findById(id: string): Promise<PipelineProject | null>;
 findByUserId(userId: string): Promise<PipelineProject[]>;
 save(project: PipelineProject): Promise<PipelineProject>;
 delete(id: string): Promise<void>;
}

export interface PipelinePhaseRepo {
 findById(id: string): Promise<PipelinePhase | null>;
 findByProjectId(projectId: string): Promise<PipelinePhase[]>;
 save(phase: PipelinePhase): Promise<PipelinePhase>;
}

export interface PipelineMessageRepo {
 save(message: PipelineMessage): Promise<PipelineMessage>;
 /** Persist a batch atomically (one transaction); used for user+assistant pairs. */
 saveMany(messages: PipelineMessage[]): Promise<void>;
 findByPhaseId(phaseId: string): Promise<PipelineMessage[]>;
 findByProjectId(projectId: string): Promise<PipelineMessage[]>;
}

/**
 * writes a phase artifact (assistant output) to durable storage and returns its path.
 * Implementations persist to disk; the returned path is stored on PipelinePhase.artifactPath.
 */
export interface ArtifactWriter {
 write(key: string, content: string): Promise<string>;
}
