import { Config } from './config';
import { Msg } from './msg';
import * as rx from 'rxjs';
import * as uuid from 'uuid';
import { LogWarn, LogError, LogMsg, LogMsgStr } from './log';

export interface EmitRecv<E = unknown, R = unknown> {
  readonly addr: string;
  readonly emitter: rx.Subject<E>;
  readonly receiver: rx.Subject<R>;
}

export type StopHandler = () => void;
export type MsgCb<T> = (msg: Msg<T>) => void;
export type BufferCb = (msg: Buffer) => void;

export enum RouterMsgType {
  Register = 'router.register',
  RegisterError = 'register.error',
  Registered = 'router.registered',
  UnRegister = 'router.unregister',
  UnRegistered = 'router.unregistered'
}

export declare type RouterMsgTypeString =
  'router.register' |
  'register.error' |
  'router.registered' |
  'router.unregister' |
  'router.unregistered' | LogMsgStr;

export interface RouterError {
  addr: string;
  msg: string;
}

export interface RouterMsg extends Msg<EmitRecv | RouterError> {
  readonly type: RouterMsgTypeString;
  readonly payload: EmitRecv | RouterError;
}

export class Router implements EmitRecv<RouterMsg, RouterMsg> {
  readonly map: Map<String, EmitRecv> = new Map();
  readonly subscription: rx.Subscription;

  public readonly emitter = new rx.Subject<RouterMsg>(); // outer subscribe to
  public readonly receiver = new rx.Subject<RouterMsg>(); // outer call only next
  public readonly addr = `router.map.${uuid.v4()}`;

  private emitError(dst: string, msg: RouterError) {
    this.emitter.next({
      src: this.addr,
      dst,
      type: RouterMsgType.RegisterError,
      payload: msg
    })
  }

  constructor() {
    this.subscription = this.receiver.subscribe(msg => {
      if (msg.dst !== this.addr) {
        LogWarn(this, `Router received:${msg.dst}:${this.addr}`);
        return;
      }
      switch (msg.type) {
        case RouterMsgType.Register:
          if (this.map.has(msg.payload.addr)) {
            this.emitError(msg.src, {
              addr: msg.payload.addr,
              msg: `can't not double register:${msg.payload.addr}`
            });
            return;
          }
          this.map.set(msg.payload.addr, msg.payload as EmitRecv);
          this.emitter.next({
            src: this.addr,
            dst: '*',
            type: RouterMsgType.Registered,
            payload: msg.payload
          });
          break;
        case RouterMsgType.UnRegister:
          const unreg = this.map.get(msg.payload.addr);
          if (!unreg) {
            this.emitError(msg.src, {
              addr: msg.payload.addr,
              msg: `unregister was not found:${msg.payload.addr}`
            });
            return;
          }
          this.map.delete(msg.payload.addr);
          this.emitter.next({
            src: this.addr,
            dst: '*',
            type: RouterMsgType.UnRegistered,
            payload: unreg
          });
          break;
      }
    });
  }

  public dispose() {
    this.subscription.unsubscribe();
  }

  public register(pair: EmitRecv) {
    this.receiver.next({
      src: pair.addr,
      dst: this.addr,
      type: RouterMsgType.Register,
      payload: pair
    });
  }
  public unregister(pair: EmitRecv) {
    this.receiver.next({
      src: pair.addr,
      dst: this.addr,
      type: RouterMsgType.UnRegister,
      payload: pair
    });

  }

  /*
  private get(key: string): EmitRecv {
    return this.map.get(key);
  }
  */

  public next<T>(msg: Msg<T | Error>) {
    this.nextBuffer(msg.dst, msg as any);
  }

  public subscribe<T>(endPoint: string, msgCb: MsgCb<T>): StopHandler {
    return this.subscribeBuffer(endPoint, (buf) => {
      try {
        msgCb(JSON.parse(buf.toString('utf-8')));
      } catch (e) {
        LogError(this, e.toString());
      }
    });
  }

  public nextBuffer(endPoint: string, buf: Buffer) {
    const er = this.map.get(endPoint);
    if (!er) {
      LogError(this, `endpoint was not found ${endPoint}`, endPoint);
      return false;
    }
    er.receiver.next(buf as unknown as any);
  }

  public subscribeBuffer(endPoint: string, msg: BufferCb): StopHandler {
    const er = this.map.get(endPoint);
    if (!er) {
      LogError(this, `endpoint was not found ${endPoint}`, endPoint);
      return () => {};
    }
    const sub = er.emitter.subscribe(buf => {
      msg(buf as unknown as Buffer);
    });
    return () => {
      sub.unsubscribe();
    }
  }
}

export function receiverMap(config: Config) {
  return new Router();
}