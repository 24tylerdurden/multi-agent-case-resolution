import { EventEmitter } from 'events';

export type TriageEvent = {
  type: 'plan_built' | 'tool_update' | 'fallback_triggered' | 'decision_finalized';
  data: any;
  ts: string;
};

class TriageHub {
  private streams = new Map<string, { emitter: EventEmitter; history: TriageEvent[] }>();

  create(runId: string) {
    const emitter = new EventEmitter();
    const obj = { emitter, history: [] as TriageEvent[] };
    this.streams.set(runId, obj);
    return obj;
  }

  get(runId: string) {
    return this.streams.get(runId);
  }

  emit(runId: string, event: TriageEvent) {
    const stream = this.streams.get(runId);
    if (!stream) return;
    stream.history.push(event);
    stream.emitter.emit('event', event);
  }
}

const hub = new TriageHub();
export default hub;
