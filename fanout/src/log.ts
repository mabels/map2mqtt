import { EmitRecv, DstTransaction, SrcTransaction } from './msg';
import { Msg } from './msg';
import uuid = require('uuid');


export enum LogMsgType {
  Error = 'log.error',
  Warn = 'log.warn'
}

export type LogMsgStr = 'log.warn' | 'log.error';
export interface LogMsg extends Msg<string> {
  readonly type: LogMsgStr;
}

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

export function LogWarn<E, R>(e: EmitRecv<E, R>, msg: string, srcMsg?: SrcTransaction) {
  e.emitter.next({
    src: e.addr,
    ...buildDstAndTransaction(srcMsg),
    type: LogMsgType.Warn,
    payload: msg
  } as unknown as E);
}

export function LogError<E, R>(e: EmitRecv<E, R>, msg: string, srcMsg?: SrcTransaction) {
  e.emitter.next({
    src: e.addr,
    ...buildDstAndTransaction(srcMsg),
    type: LogMsgType.Error,
    payload: msg
  } as unknown as E);
}