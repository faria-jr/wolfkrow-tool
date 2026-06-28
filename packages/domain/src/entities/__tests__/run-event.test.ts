import { describe, expect, it } from 'vitest';

import { RunEvent } from '../run-event';

describe('RunEvent', () => {
  it('create() assigns id + createdAt and preserves the payload', () => {
    const e = RunEvent.create({
      runRef: 'harness:p1',
      workflow: 'harness',
      eventType: 'coder-chunk',
      payload: { delta: 'hi', featureIndex: 0 },
      seq: 3,
    });
    expect(e.id).toBeTruthy();
    expect(e.runRef).toBe('harness:p1');
    expect(e.workflow).toBe('harness');
    expect(e.eventType).toBe('coder-chunk');
    expect(e.seq).toBe(3);
    expect(e.payload).toEqual({ delta: 'hi', featureIndex: 0 });
    expect(e.createdAt).toBeInstanceOf(Date);
  });

  it('toProps() round-trips through fromProps()', () => {
    const e = RunEvent.create({
      runRef: 'pipeline:phase1',
      workflow: 'pipeline',
      eventType: 'progress',
      payload: { stage: 'design' },
      seq: 0,
    });
    const again = RunEvent.fromProps(e.toProps());
    expect(again.toProps()).toEqual(e.toProps());
  });

  it('supports the pipeline workflow kind', () => {
    const e = RunEvent.create({
      runRef: 'pipeline:phase2',
      workflow: 'pipeline',
      eventType: 'done',
      payload: {},
      seq: 9,
    });
    expect(e.workflow).toBe('pipeline');
  });
});
