import { Router } from '../router';
import { MqttConnection, MqttConnectionEmitMsg, MqttConnectionConnect } from './mqtt-connection';

test('connect disconnect', (done) => {
  const rt = new Router();
  const mc = new MqttConnection(rt);
  const unsubConnect = rt.subscribe<MqttConnectionEmitMsg>(mc, msg => {
    console.log('type', msg);
    done();
  });
  console.log('next', mc.addr);
  rt.next({
    src: 'my',
    dst: mc.addr,
    transaction: 'my',
    type: 'mqtt.connection.connect',
    payload: {
      connectionString: '127.0.0.1:40567'
    }
  } as MqttConnectionConnect);
});

test('unklar', () => {

})

// export type MqttConnectionError = Msg<Error, 'mqtt.connection.error'>;

// export type MqttConnectionPacketSend = Msg<mqtt.Packet, 'mqtt.connection.packetsend'>;
// export type MqttConnectionPacketReceive = Msg<mqtt.Packet, 'mqtt.connection.packetreceive'>;

// export type MqttConnectionConnect = Msg<MqttConnectionProps, 'mqtt.connection.connect'>;
// export type MqttConnectionConnected = Msg<MqttConnectionProps, 'mqtt.connection.connected'>;

// export type MqttConnectionDisconnect = Msg<unknown, 'mqtt.connection.disconnect'>;
// export type MqttConnectionDisconnected = Msg<MqttConnectionProps, 'mqtt.connection.disconnected'>;

// export type MqttConnectionSend = Msg<MqttMessage, 'mqtt.connection.send'>;
// export type MqttConnectionMessage = Msg<MqttMessage, 'mqtt.connection.message'>;