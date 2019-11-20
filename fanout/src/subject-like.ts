import * as rx from 'rxjs';

export type Subscription = rx.Subscription;

export interface SubjectLike<T> {
  next(msg: T): void;
  subscribe(cb: (msg: T) => void): Subscription;
}
