import * as rx from 'rxjs';
import { LogError } from './log';
import { SubjectLike } from './subject-like';
import uuid = require('uuid');

export interface Src {
  src: string;
}
export interface Dst {
  dst: string;
}

export interface Transaction {
  transaction: string;
}

export type SrcTransaction = Src & Transaction;
export type DstTransaction = Dst & Transaction;
export type SrcDstTransaction = Src & Dst & Transaction;

export interface Msg<P, TYPE = string> extends SrcDstTransaction {
  type: TYPE;
  payload: P;
}

export type StopHandler = () => void;
export type TypeCb<T> = (msg: T) => void;
export type MsgCb<T, M = string> = TypeCb<Msg<T, M>>;
export type BufferCb = TypeCb<Buffer>;

export class Subject<C extends Msg<T, TT>, T = unknown, TT = string> implements SubjectLike<C> {
  public readonly raw = new rx.Subject<unknown>();

  // we are not on any case on node
  constructor(refMode = process && process.env && process.env.NODE_ENV === 'production') {
    if (refMode) {
      this.next = this.refNext;
      this.subscribe = this.refSubscribe;
    } else {
      this.next = this.serNext;
      this.subscribe = this.serSubscribe;
    }
  }

  private serNext(msg: C) {
    try {
      this.raw.next(JSON.stringify(msg));
    } catch (e) {
      // LogError()
    }
  }
  private serSubscribe(cb: TypeCb<C>) {
    return this.raw.subscribe(msg => cb(JSON.parse(msg as string)));
  }

  private refNext(msg: C) {
    this.raw.next(msg);
  }
  private refSubscribe(cb: TypeCb<C>) {
    return this.raw.subscribe(msg => cb(msg as C));
  }

  public next(_msg: C) { throw Error("next not implemented"); }
  public subscribe(_cb: TypeCb<C>): rx.Subscription { throw Error("subscribe not implemented"); }

}

export function src2dst(src: SrcTransaction): DstTransaction {
  return {
    dst: src.src,
    transaction: src.transaction || uuid.v4()
  };
}

