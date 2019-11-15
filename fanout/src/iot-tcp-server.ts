import { Config } from './config';
import { Router, EmitRecv } from './router';
import * as net from 'net';
import * as rx from 'rxjs';
import { Msg } from './msg';
import * as uuid from 'uuid';

export enum IotTcpConnectionType {
  Close = 'iotTcp.Connection.Close',
  Data = 'iotTcp.Connection.Data',
  Error = 'iotTcp.Connection.Error',
  Connected = 'iotTcp.Connection.Connected',
  Disconnected = 'iotTcp.Connection.Disconnected'
}

interface IotTcpClose {
}

class IotTcpConnection implements EmitRecv<IotTcpClose, Buffer> {
  public readonly emitter = new rx.Subject<Msg<IotTcpClose>>();
  public readonly receiver = new rx.Subject<Msg<Buffer>>();
  readonly id = uuid.v4();
  readonly socket: net.Socket;

  constructor(config: Config, rm: Router, socket: net.Socket) {
    this.socket = socket;
    const key = rm.register(this);
    this.receiver.subscribe((msg) => {
      if (msg.dst !== this.addr || msg.type !== IotTcpConnectionType.Data) {
        console.warn(`ignore iotTcpMsg not for me:${this.addr}:${msg.dst}:${msg.type}`);
        return;
      }
      socket.write(msg.payload);
    });

    socket.on('close', () => {
      rm.unregister(this);
      this.emitter.next({
        src: this.addr,
        dst: '*',
        type: IotTcpConnectionType.Close,
        payload: undefined
      });
      this.emitter.complete();
      this.receiver.complete();
    });
    const onError = (err) => {
      if (err) {
        rm.unregister(this);
        this.emitter.next({
          src: this.addr,
          dst: '*',
          type: IotTcpConnectionType.Error,
          payload: Error(`IotTcpConnection:${this.id}:${key}:${err}`)
        });
        this.emitter.complete();
        this.receiver.complete();
      }
    };
    socket.on('connect', onError);
    socket.on('error', onError);
    socket.on('data', (b) => {
      this.emitter.next({
        src: this.addr,
        dst: '*',
        type: IotTcpConnectionType.Data,
        payload: b
      });
    });
  }
  public get addr() {
    return `iot.tcp.connection.${this.id}-${this.socket!.remoteAddress!.toString()}`;
  }
}

interface IotTcpServer {
  readonly server: net.Server;
  readonly connections: IotTcpConnection[];
}

export type IotConnected = string;
export type IotDisconnected = string;

class IotTcpListen implements EmitRecv<IotConnected|IotDisconnected> {
  readonly servers: IotTcpServer[];
  readonly id = uuid.v4();
  public readonly emitter = new rx.Subject<Msg<IotConnected|IotDisconnected>>();
  public readonly receiver = new rx.Subject<Msg<unknown>>();

  public get addr() {
    return `iot.tcp.listen.${this.id}`;
  }
  constructor(config: Config, rm: Router) {
    rm.register(this);
    this.servers = config.iotTcps.map(c => {
      const connections: IotTcpConnection[] = [];
      const server = net.createServer((socket) => {
        const itc = new IotTcpConnection(config, rm, socket);
        connections.push(itc);
        this.emitter.next({
          src: this.id,
          dst: '*',
          type: IotTcpConnectionType.Connected,
          payload: itc.id
        } as Msg<IotConnected>);
        itc.emitter.subscribe((msg) => {
          if (msg.src !== itc.id) {
            console.warn(`iotTcpListen received from unknown src ${msg.src}!=${itc.id}`);
            return;
          }
          switch (msg.type) {
            case IotTcpConnectionType.Close:
              const idx = connections.findIndex(c => c.id === msg.src);
              if (idx < 0) {
                console.error(`connection not found in connections ${msg.src}`);
                return;
              }
              connections.splice(idx, 1);
              this.emitter.next({
                src: this.id,
                dst: '*',
                type: IotTcpConnectionType.Disconnected,
                payload: itc.id
              } as Msg<IotDisconnected>);
              break;
            default:
              break;
          }
        });
      });
      server.listen(c.port, c.address);
      return {
        server,
        connections
      };
    });
  }
}

export function iotTcpListen(config: Config, rm: Router) {
  return new IotTcpListen(config, rm);
}