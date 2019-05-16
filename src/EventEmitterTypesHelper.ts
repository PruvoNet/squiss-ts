'use strict';

export type MatchingKeys<TRecord, TMatch, K extends keyof TRecord = keyof TRecord> =
    K extends (TRecord[K] extends TMatch ? K : never) ? K : never;

export type VoidKeys<Record> = MatchingKeys<Record, void>;

export interface EventEmitterOverride<TEventRecord,
    TEmitRecord = TEventRecord,
    EventVK extends VoidKeys<TEventRecord> = VoidKeys<TEventRecord>,
    EventNVK extends Exclude<keyof TEventRecord, EventVK> = Exclude<keyof TEventRecord, EventVK>,
    EmitVK extends VoidKeys<TEmitRecord> = VoidKeys<TEmitRecord>,
    EmitNVK extends Exclude<keyof TEmitRecord, EmitVK> = Exclude<keyof TEmitRecord, EmitVK>> {
    on<P extends EventNVK>(event: P, listener: (m: TEventRecord[P]) => void): this;
    on<P extends EventVK>(event: P, listener: () => void): this;
    emit<P extends EmitNVK>(event: P, payload: TEmitRecord[P]): boolean;
    emit<P extends EmitVK>(event: P): boolean;
}
