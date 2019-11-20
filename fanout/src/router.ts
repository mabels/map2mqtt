import { Config } from './config';
import { EmitRecv, EnsureIsForMe } from './emit-recv';
import * as uuid from 'uuid';
import { LogWarn, LogError, LogEmitMsg } from './log';
import { Subject, Msg, src2dst, TypeCb, SrcTransaction, SrcDstTransaction, DstTransaction } from './msg';
import { Subscription, SubjectLike } from './subject-like';

/*
export enum RouterMsgType {
  Register = 'router.register',
  RegisterError = 'register.error',
  Registered = 'router.registered',
  UnRegister = 'router.unregister',
  UnRegistered = 'router.unregistered'
}

export declare type RouterMsgTypeString =
  'register.error' |
  'router.register' |
  'router.registered' |
  'router.unregister' |
  'router.unregistered' | LogMsgStr;
*/

export interface RouterError {
  readonly addr: string;
  readonly msg: string;
}

export interface EndPoint {
  readonly addr: string;
  readonly transaction?: string;
}

export type RouterEmitMsg = Msg<RouterError, 'router.error'>
  | Msg<EmitRecv, 'router.registed'>
  | Msg<EmitRecv, 'router.unregisted'>
  | LogEmitMsg;
export type RouterRecvMsg = Msg<EmitRecv, 'router.register'> | Msg<EmitRecv, 'router.unregister'>;

export class ErrorSubject implements SubjectLike<LogEmitMsg> {
  readonly cb: TypeCb<LogEmitMsg>[] = [];
  readonly msgs: any[] = [];

  next(msg: LogEmitMsg): void {
    this.msgs.push(msg);
  }

  subscribe(cb: TypeCb<LogEmitMsg>): Subscription {
    return
  }


}

export class ErrorEmitRecv implements EmitRecv<LogEmitMsg, LogEmitMsg> {
  public readonly addr: string = `Error:${uuid.v4()}`;
  public readonly emitter: SubjectLike<LogEmitMsg> = new Subject<LogEmitMsg>();
  public readonly receiver: SubjectLike<LogEmitMsg> = this.emitter;

  constructor(msg: String) {
    this.emitter.subscribe(() => )
  }


}

export class Router implements EmitRecv<RouterEmitMsg, RouterRecvMsg> {
  private readonly map: Map<String, EmitRecv> = new Map();
  private readonly subscription: Subscription;

  public readonly emitter: SubjectLike<RouterEmitMsg> = new Subject<RouterEmitMsg>(); // outer subscribe to
  public readonly receiver: SubjectLike<RouterRecvMsg> = new Subject<RouterRecvMsg>(); // outer call only next
  public readonly addr: string = `router.map.${uuid.v4()}`;

  private emitError(src: SrcTransaction, msg: RouterError) {
    this.emitter.next({
      src: this.addr,
      dst: src.src,
      transaction: src.transaction,
      type: 'router.error',
      payload: msg
    });
  }

  constructor() {
    this.subscription = this.receiver.subscribe(EnsureIsForMe(this, msg => {
      switch (msg.type) {
        case 'router.register':
          if (this.map.has(msg.payload.addr)) {
            this.emitError(msg, {
              addr: msg.payload.addr,
              msg: `can't not double register:${msg.payload.addr}`
            });
            return;
          }
          this.map.set(msg.payload.addr, msg.payload as EmitRecv);
          this.emitter.next({
            src: this.addr,
            ...src2dst(msg),
            type: 'router.registed',
            payload: msg.payload
          });
          break;
        case 'router.unregister':
          const unreg = this.map.get(msg.payload.addr);
          if (!unreg) {
            this.emitError(msg, {
              addr: msg.payload.addr,
              msg: `unregister was not found:${msg.payload.addr}`
            });
            return;
          }
          this.map.delete(msg.payload.addr);
          this.emitter.next({
            src: this.addr,
            ...src2dst(msg),
            type: 'router.unregisted',
            payload: unreg
          });
          break;
      }
    }));
    this.register(this);
  }

  public dispose() {
    this.subscription.unsubscribe();
  }

  public register(pair: EmitRecv, transaction = uuid.v4()) {
    this.receiver.next({
      src: pair.addr,
      dst: this.addr,
      transaction,
      type: 'router.register',
      payload: pair
    });
  }
  public unregister(pair: EmitRecv, transaction = uuid.v4()) {
    this.receiver.next({
      src: pair.addr,
      dst: this.addr,
      transaction,
      type: 'router.unregister',
      payload: pair
    });
  }

  /*
  private get(key: string): EmitRecv {
    return this.map.get(key);
  }
  */

  public route<E, R>(inEp: string | EndPoint): EmitRecv<E, R> {
    let endPoint: SrcTransaction;
    if (typeof inEp === 'string') {
      endPoint = { src: inEp, transaction: uuid.v4() };
    } else {
      endPoint = { src: inEp.addr, transaction: inEp.transaction || uuid.v4() };
    }
    const er = this.map.get(endPoint.src) as EmitRecv<E, R>;
    if (!er) {
      LogError(this, `endpoint was not found ${endPoint}`, endPoint);
      const id = uuid();
      return {
        addr: `Error:${id}`,
        emitter: new ErrorSubject(),
        receiver: new ErrorSubject()
      }
      // return endPoint.transaction;
    }
    return er;
  }


  // public nextMsg<T>(msg: Msg<T>) {
  //   return this.next({ addr: msg.dst, transaction: msg.transaction }, msg);
  // }

  // public next<T>(inEp: string | EndPoint, msg: T) {
  //   let endPoint: SrcTransaction;
  //   if (typeof inEp === 'string') {
  //     endPoint = { src: inEp, transaction: uuid.v4() };
  //   } else {
  //     endPoint = { src: inEp.addr, transaction: inEp.transaction || uuid.v4() };
  //   }
  //   const er = this.map.get(endPoint.src);
  //   if (!er) {
  //     LogError(this, `endpoint was not found ${endPoint}`, endPoint);
  //     return endPoint.transaction;
  //   }
  //   er.receiver.next(msg as T);
  //   return endPoint.transaction;
  // }

  // public subscribe<T>(endPoint: string, msg: TypeCb<T>): Subscription {
  //   const er = this.map.get(endPoint);
  //   if (!er) {
  //     LogError(this, `endpoint was not found ${endPoint}`/*, endPoint */);
  //     return {
  //       unsubscribe: () => { /* */ },
  //     } as Subscription;
  //   }
  //   const sub = er.emitter.subscribe(buf => {
  //     msg(buf as T);
  //   });
  //   return sub;
  // }
}

export function receiverMap(config: Config) {
  return new Router();
}