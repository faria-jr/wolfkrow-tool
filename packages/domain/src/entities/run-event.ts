import { randomUUID } from 'node:crypto';

/**
 * A persisted event from a long-running workflow (Harness coder/evaluator
 * stream, Pipeline phase stream). Stored as an append-only log keyed by
 * `runRef` (e.g. `harness:<projectId>` or `pipeline:<phaseId>`) so the console
 * can REPLAY the timeline after a disconnect/refresh instead of showing a
 * blank view.
 *
 * `payload` is the raw SSE-shaped object the stream emitted — kept as an opaque
 * JSON blob so we don't have to model every event variant here.
 */

export type WorkflowKind = 'harness' | 'pipeline';

export interface RunEventProps {
  id: string;
  runRef: string;
  /** Discriminator for which console owns this event. */
  workflow: WorkflowKind;
  /** SSE event type, e.g. 'coder-chunk', 'feature_done', 'progress', 'done'. */
  eventType: string;
  payload: Record<string, unknown>;
  seq: number;
  createdAt: Date;
}

export type RunEventCreateInput = Pick<
  RunEventProps,
  'runRef' | 'workflow' | 'eventType' | 'payload' | 'seq'
>;

export class RunEvent {
  readonly id: string;
  readonly runRef: string;
  readonly workflow: WorkflowKind;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly seq: number;
  readonly createdAt: Date;

  private constructor(props: RunEventProps) {
    this.id = props.id;
    this.runRef = props.runRef;
    this.workflow = props.workflow;
    this.eventType = props.eventType;
    this.payload = props.payload;
    this.seq = props.seq;
    this.createdAt = props.createdAt;
  }

  static create(input: RunEventCreateInput): RunEvent {
    return new RunEvent({
      id: randomUUID(),
      runRef: input.runRef,
      workflow: input.workflow,
      eventType: input.eventType,
      payload: input.payload,
      seq: input.seq,
      createdAt: new Date(),
    });
  }

  static fromProps(props: RunEventProps): RunEvent {
    return new RunEvent(props);
  }

  toProps(): RunEventProps {
    return {
      id: this.id,
      runRef: this.runRef,
      workflow: this.workflow,
      eventType: this.eventType,
      payload: this.payload,
      seq: this.seq,
      createdAt: this.createdAt,
    };
  }
}
