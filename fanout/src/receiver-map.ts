import { Config } from './config';
import { Msg } from './msg';
import * as rx from 'rxjs';

export interface EmitRecv<E = unknown, R = unknown> {
  emitter: rx.Subject<Msg<E>>;
  receiver: rx.Subject<Msg<R>>;
}
export class ReceiverMap {
  readonly map: Map<String, EmitRecv> = new Map();
  public register(key: string, pair: EmitRecv) {
    if (this.map.has(key)) {
      throw Error(`You can't not double register:${key}`)
    }
    this.map.set(key, pair);
    return key;
  }
  public unregister(key: string) {
    this.map.delete(key);
  }

  public get(key: string): EmitRecv {
    return this.map.get(key);
  }
}

export function receiverMap(config: Config) {
  return new ReceiverMap();
}