import { DstTransaction, SrcTransaction } from './msg';
import { Msg } from './msg';
import uuid = require('uuid');
import { EmitRecv } from './emit-recv';


export interface LogOptionsOptional {
  readonly dst?: string;
  readonly transaction?: string;
}

export interface LogOptions {
  readonly dst?: string;
  readonly transaction?: string;
}

function buildDstAndTransaction(msg?: SrcTransaction): LogOptions {
  return {
    dst: (msg && msg.src) || '*',
    transaction: (msg && msg.transaction) || uuid.v4()
  };
}

export type LogEmitMsg = Msg<string, 'log.warn'> | Msg<string, 'log.error'>;

export function LogWarn<E, R>(e: EmitRecv<E, R>, msg: string, srcMsg?: SrcTransaction) {
  e.emitter.next({
    src: e.addr,
    ...buildDstAndTransaction(srcMsg),
    type: 'log.warn',
    payload: msg
  } as unknown as E);
}

export function LogError<E, R>(e: EmitRecv<E, R>, msg: string, srcMsg?: SrcTransaction) {
  e.emitter.next({
    src: e.addr,
    ...buildDstAndTransaction(srcMsg),
    type: 'log.error',
    payload: msg
  } as unknown as E);
}
