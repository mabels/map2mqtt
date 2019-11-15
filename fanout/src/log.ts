import { EmitRecv } from './router';
import { Msg } from './msg';


export enum LogMsgType {
  Error = 'log.error',
  Warn = 'log.warn'
}

export type LogMsgStr = 'log.warn' | 'log.error';
export interface LogMsg extends Msg<string> {
  type: LogMsgStr;
}

export function LogWarn<E, R>(e: EmitRecv<E, R>, msg: string, dst = '*') {
  e.emitter.next({
    src: e.addr,
    dst,
    type: LogMsgType.Warn,
    payload: msg
  } as unknown as E);
}

export function LogError<E, R>(e: EmitRecv<E, R>, msg: string, dst = '*') {
  e.emitter.next({
    src: e.addr,
    dst,
    type: LogMsgType.Error,
    payload: msg
  } as unknown as E);
}