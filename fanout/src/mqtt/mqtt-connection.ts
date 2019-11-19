import * as mqtt from 'mqtt';
import * as rx from 'rxjs';
import * as uuid from 'uuid';
import { Msg, EmitRecv, EnsureIsForMe } from '../msg';
import { Router, src2dst, } from '../router';
import { LogWarn, LogError } from '../log';
import { connect } from 'http2';
import { timingSafeEqual } from 'crypto';

export enum MqttMsg {
  Error = 'mqtt.Error',
  Message = 'mqtt.Message',
  PacketSend = 'mqtt.PacketSend',
  PacketReceive = 'mqtt.PacketReceive',
  Send = 'mqtt.Send'
}

export interface MqttMessage {
  readonly topic: string;
  readonly message: string;
}
/*
export interface MqttPacket {
  packet: mqtt.Packet;
}
*/

export interface MqttConnectionProps {
  readonly connectionString: string;
}

export type MqttConnectionError = Msg<Error, 'mqtt.connection.error'>;

export type MqttConnectionPacketSend = Msg<mqtt.Packet, 'mqtt.connection.packetsend'>;
export type MqttConnectionPacketReceive = Msg<mqtt.Packet, 'mqtt.connection.packetreceive'>;

export type MqttConnectionConnect = Msg<MqttConnectionProps, 'mqtt.connection.connect'>;
export type MqttConnectionConnected = Msg<MqttConnectionProps, 'mqtt.connection.connected'>;

export type MqttConnectionDisconnect = Msg<unknown, 'mqtt.connection.disconnect'>;
export type MqttConnectionDisconnected = Msg<MqttConnectionProps, 'mqtt.connection.disconnected'>;

export type MqttConnectionSend = Msg<MqttMessage, 'mqtt.connection.send'>;
export type MqttConnectionMessage = Msg<MqttMessage, 'mqtt.connection.message'>;

export type MqttConnectionRecvMsg = MqttConnectionSend |  MqttConnectionConnect | MqttConnectionDisconnect;
export type MqttConnectionEmitMsg = MqttConnectionError
  | MqttConnectionMessage
  | MqttConnectionPacketReceive
  | MqttConnectionPacketSend
  | MqttConnectionConnected
  | MqttConnectionDisconnected;

export class MqttConnection implements EmitRecv<MqttConnectionEmitMsg, MqttConnectionRecvMsg> {
  private connection?: mqtt.Client;
  public connectionString?: string;
  public readonly addr: string = `mqtt.connection.${uuid.v4()}`;
  public readonly emitter = new rx.Subject<MqttConnectionEmitMsg>();
  public readonly receiver = new rx.Subject<MqttConnectionRecvMsg>();

  constructor(rm: Router) {
    rm.register(this);
    rm.subscribe(this.addr, EnsureIsForMe(this, (msg) => {
      console.log(`Hallo`, msg.type);
      switch (msg.type) {
        case 'mqtt.connection.send':
          if (!this.connection) {
            LogError(this, `need to connect first`, msg);
            return;
          }
          const { topic, message } = msg.payload;
          this.connection.publish(topic, message);
          return;
        case 'mqtt.connection.connect':
          if (this.connection) {
            LogWarn(this, `double connect on: ${this.addr}`, msg);
            return;
          }
          this.connect(rm, msg);
          return;
        case 'mqtt.connection.disconnect':
          if (!this.connection) {
            LogWarn(this, `try to disconnect on not connected: ${this.addr}`, msg);
            return;
          }
          this.disconnect(rm, msg);
          return;
      }
      LogWarn(this, `ignore message with msgtype ${(msg as Msg<unknown>).type}`, msg);
    }));
  }

  private disconnect(rm: Router, msg: MqttConnectionDisconnect) {
    this.connection.end(true, {}, () => {
      rm.next({
        src: this.addr,
        ...src2dst(msg),
        type: 'mqtt.connection.disconnected',
        payload: { connectionString: this.connectionString }
      });
    });
  }

  private connect(rm: Router, msg: MqttConnectionConnect) {
    console.log('-1');
    this.connectionString = msg.payload.connectionString;
    this.connection = mqtt.connect(msg.payload.connectionString);
    console.log('-2');
    rm.next({
      src: this.addr,
      ...src2dst(msg),
      transaction: msg.transaction,
      type: 'mqtt.connection.connected',
      payload: { connectionString: this.connectionString }
    });
    console.log('-3');
    this.connection.on('packetsend', (p) => {
      rm.next({
        src: this.addr,
        ...src2dst(msg),
        type: 'mqtt.connection.packetsend',
        payload: p
      });
    });
    this.connection.on('packetreceive', (p) => {
      rm.next({
        src: this.addr,
        ...src2dst(msg),
        type: 'mqtt.connection.packetreceive',
        payload: p
      });
    });
    this.connection.on('error', (e) => {
      rm.next({
        src: this.addr,
        ...src2dst(msg),
        type: 'mqtt.connection.error',
        payload: e
      });
    });
    this.connection.on('message', (topic: string, message: string) => {
      rm.next({
        src: this.addr,
        ...src2dst(msg),
        type: 'mqtt.connection.message',
        payload: { topic, message }
      });
    });
    console.log('-4');
  }
}
