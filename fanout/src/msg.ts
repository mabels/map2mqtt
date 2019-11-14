
export interface Msg<T> {
  src: string;
  dst: string;
  type: string;
  payload: T
}
