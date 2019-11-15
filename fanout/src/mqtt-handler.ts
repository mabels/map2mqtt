import * as mqtt from 'mqtt';
import * as rx from 'rxjs';
import * as uuid from 'uuid'

import { Config } from './config';
import { Msg } from './msg'
import { Router, EmitRecv } from './router';
import { LogWarn } from './log';

export enum MqttMsgType {
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
export interface MqttPacket {
  packet: mqtt.Packet;
}

export class MqttConnection implements EmitRecv {
  readonly connection: mqtt.Client;
  readonly id = uuid.v4();
  public readonly addr = `mqtt.connection.${this.id}`;
  public readonly emitter =  new rx.Subject<Msg<unknown>>();
  public readonly receiver =  new rx.Subject<Msg<unknown>>();

  constructor(config: Config, rm: Router, server: string) {
    this.connection = mqtt.connect(server);
    this.receiver.subscribe((msg) => {
      if (msg.dst !== this.addr) {
        LogWarn(this, `ignore message which is not for ${this.addr}`);
        return;
      }
      switch (msg.type) {
        case MqttMsgType.Send:
          const my = msg as Msg<MqttMessage>;
          const { topic, message } = my.payload;
          this.connection.publish(topic, message);
          break;
        default:
          LogWarn(this, `ignore message with msgtype ${msg.type}`);
      }
    });
    rm.register(this);
    this.connection.on('packetsend', (p) => {
      this.emitter.next({
        src: this.addr,
        dst: '*',
        type: MqttMsgType.PacketSend,
        payload: p
      });
    });
    this.connection.on('packetreceive', (p) => {
      this.emitter.next({
        src: this.addr,
        dst: '*',
        type: MqttMsgType.PacketReceive,
        payload: p
      });
    });
    this.connection.on('error', (e) => {
      this.emitter.next({
        src: this.addr,
        dst: '*',
        type: MqttMsgType.Error,
        payload: e
      });
    });
    this.connection.on('message', (topic: string, message: string) => {
      this.emitter.next({
        src: this.addr,
        dst: '*',
        type: MqttMsgType.Message,
        payload: { topic, message }
      });
    });
  }
}

class MqttEndPoints implements EmitRecv {
  readonly mqttConnections: MqttConnection[];
  public readonly id = uuid.v4();
  public readonly addr = `mqtt.endPoints.${this.id}`;
  public readonly emitter = new rx.Subject<Msg<unknown>>();
  public readonly receiver = new rx.Subject<Msg<unknown>>();

  constructor(config: Config, rm: Router) {
    this.mqttConnections = config.mqttEndpoints.map(i => new MqttConnection(config, rm, i));
    this.receiver.subscribe((msg) => {
      this.mqttConnections.find(mc => {
        // missing loadbalancing retry and serialization
        mc.receiver.next(msg);
        return true;
      });
    });
    this.mqttConnections.forEach(mc => {
      mc.emitter.subscribe(msg => this.emitter.next(msg));
    });
    rm.register(this);
  }

  public findDestIdFrom(msg: Msg<unknown>) {
    return 'WTF';
  }


}

export function mqttHandler(config: Config, rm: Router) {
  return new MqttEndPoints(config, rm);
}