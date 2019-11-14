import * as mqtt from 'mqtt';
import * as rx from 'rxjs';
import * as uuid from 'uuid'

import { Config } from './config';
import { Msg } from './msg'
import { ReceiverMap, EmitRecv } from './receiver-map';

export enum MqttMsgType {
  Error = 'mqtt.Error',
  Message = 'mqtt.Message',
  PacketSend = 'mqtt.PacketSend',
  PacketReceive = 'mqtt.PacketReceive',
  Send = 'mqtt.Send'
}

export class MqttMessage {
  topic: string;
  message: string;
}
export class MqttPacket {
  packet: mqtt.Packet;
}

export class MqttConnection implements EmitRecv {
  readonly connection: mqtt.Client;
  readonly uuid: string;
  public readonly emitter: rx.Subject<Msg<unknown>>;
  public readonly receiver: rx.Subject<Msg<unknown>>;

  constructor(config: Config, rm: ReceiverMap, server: string) {
    this.uuid = uuid.v4();
    this.receiver = new rx.Subject();
    this.connection = mqtt.connect(server);
    this.receiver.subscribe((msg) => {
      if (msg.dst !== this.uuid) {
        console.warn(`ignore message which is not for ${this.uuid}`);
        return;
      }
      switch (msg.type) {
        case MqttMsgType.Send:
          const my = msg as Msg<MqttMessage>;
          const { topic, message } = my.payload;
          this.connection.publish(topic, message);
          break;
        default:
          console.warn(`ignore message with msgtype ${msg.type}`);
      }
    });
    this.emitter = new rx.Subject();
    rm.register(`mqtt.Connection.${server}`, this)
    this.connection.on('packetsend', (p) => {
      this.emitter.next({
        src: this.uuid,
        dst: '*',
        type: MqttMsgType.PacketSend,
        payload: p
      });
    });
    this.connection.on('packetreceive', (p) => {
      this.emitter.next({
        src: this.uuid,
        dst: '*',
        type: MqttMsgType.PacketReceive,
        payload: p
      });
    });
    this.connection.on('error', (e) => {
      this.emitter.next({
        src: this.uuid,
        dst: '*',
        type: MqttMsgType.Error,
        payload: e
      });
    });
    this.connection.on('message', (topic: string, message: string) => {
      this.emitter.next({
        src: this.uuid,
        dst: '*',
        type: MqttMsgType.Message,
        payload: { topic, message }
      });
    });
  }
}

export function mqttHandler(config: Config, rm: ReceiverMap) {
  config.mqttEndpoints.map(i => new MqttConnection(config, rm, i));
}