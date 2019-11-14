import { mqttHandler } from "./mqtt-handler";
import { defaultConfig } from './default-config';
import { receiverMap } from './receiver-map';
import { iotTcpListen, IotTcpConnectionType, IotConnected, IotDisconnected } from './iot-tcp-server';
import { Msg } from './msg';

(async () => {
  const config = defaultConfig();
  const rm = receiverMap(config);
  const mqtt = mqttHandler(config, rm);
  const iotTcp = iotTcpListen(config, rm);
  rm.get(`iotTcp.listen.${iotTcp.id}`).emitter.subscribe(msg => {
    const my = msg as Msg<IotConnected|IotDisconnected>;
    switch (msg.type) {
      case IotTcpConnectionType.Connected:
        rm.get(my.payload).emitter.subscribe((msg) => {
          rm.get(`mqtt`).receiver.next({

          });
        });
        rm.get('mqtt').emitter.subscribe((msg) => {
          rm.get(id).receiver.next({

          });
        });
        break;
      case IotTcpConnectionType.Disconnected:
    }
  });
});