
import { Router } from '../router';
import { Msg, EmitRecv, EnsureIsForMe, Transaction } from '../msg';
import * as rx from 'rxjs';
import * as uuid from 'uuid';
import { MqttConnection } from './mqtt-connection';
import { LogWarn, LogError } from '../log';
import { deepStrictEqual } from 'assert';

// type MqttEndpointsMsg = 'mqtt.endpoints.add' | 'mqtt.endpoints.added'
//  | 'mqtt.endpoints.delete' | 'mqtt.endpoints.deleted';

export interface MqttEndpointsAddProps {
  readonly connectionString: string;
}

export type MqttEndpointsAdd = Msg<MqttEndpointsAddProps, 'mqtt.endpoints.add'>;

export interface MqttEndpointsAddr extends MqttEndpointsAddProps {
  readonly addr: string;
}

export type MqttEndpointsDelete = Msg<MqttEndpointsAddr, 'mqtt.endpoints.delete'>;

export type MqttEndpointsAdded = Msg<MqttEndpointsAddr, 'mqtt.endpoints.added'>;

export type MqttEndpointsDeleted = Msg<MqttEndpointsAddr, 'mqtt.endpoints.deleted'>;

export type MqttEndPointsMsgRecv = MqttEndpointsAdd | MqttEndpointsDelete;
type MqttEndPointsMsgEmit = MqttEndpointsAdded | MqttEndpointsDeleted;

export interface MqttConnectionContainer extends Transaction {
   connection: MqttConnection;
}

export class MqttEndPoints implements EmitRecv<MqttEndPointsMsgEmit, MqttEndPointsMsgRecv> {
  private readonly mqttConnections: MqttConnectionContainer[] = [];
  public readonly addr = `mqtt.endPoints.${uuid.v4()}`;
  public readonly emitter = new rx.Subject<MqttEndPointsMsgEmit>();
  public readonly receiver = new rx.Subject<MqttEndPointsMsgRecv>();

  constructor(rm: Router) {
    // this.mqttConnections = config.mqttEndpoints.map(i => new MqttConnection(config, rm, i));
    this.receiver.subscribe(EnsureIsForMe(this, (msg) => {
      switch (msg.type) {
        case 'mqtt.endpoints.add':
          // const mymsg = msg as unknown as Msg<MqttConnectionAddProps>;
          const connection = new MqttConnection(rm);
          this.mqttConnections.push({ connection, transaction: msg.transaction });
          this.emitter.next({
            src: this.addr,
            dst: msg.src,
            transaction: msg.transaction,
            type: 'mqtt.endpoints.added',
            payload: {
              ...msg.payload,
              addr: connection.addr
            }
          });
          connection.receiver.next({
            src: this.addr,
            dst: connection.addr,
            transaction: msg.transaction,
            type: 'mqtt.connection.connect',
            payload: msg.payload
          });
          break;
        case 'mqtt.endpoints.delete':
          const c = this.mqttConnections.findIndex(({connection}) => connection.addr === msg.payload.addr);
          if (c < 0) {
            LogError(this, `not found:${msg.payload.addr}`, msg);
            return;
          }
          const conn = this.mqttConnections[c];
          this.emitter.next({
              src: this.addr,
              dst: msg.src,
              type: 'mqtt.endpoints.deleted',
              transaction: msg.transaction || conn.transaction,
              payload: {
                addr: conn.connection.addr,
                connectionString: conn.connection.connectionString
              }
          });
          conn.connection.receiver.next({
            src: this.addr,
            dst: conn.connection.addr,
            transaction: msg.transaction || conn.transaction,
            type: 'mqtt.connection.disconnect',
            payload: {
              addr: conn.connection.addr
            }
          });
          this.mqttConnections.splice(c, 1);
          break;
      }
    }));
    rm.register(this);
  }

}
