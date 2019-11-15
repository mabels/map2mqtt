import { mqttHandler } from "./mqtt-handler";
import { defaultConfig } from './default-config';
import { receiverMap, StopHandler } from './router';
import { iotTcpListen, IotTcpConnectionType, IotConnected, IotDisconnected } from './iot-tcp-server';
import { Msg } from './msg';

(async () => {
  const config = defaultConfig();
  const rm = receiverMap(config);
  const mqtt = mqttHandler(config, rm);
  const iotTcp = iotTcpListen(config, rm);

  rm.subscribe(iotTcp.id, msg => {
    const my = msg as Msg<IotConnected|IotDisconnected>;
    let stopHandler: StopHandler;
    switch (msg.type) {
      case IotTcpConnectionType.Connected:
        stopHandler = rm.subscribeBuffer(my.payload, buffer => {
          rm.next(mqtt.addr, {
            src: my.src,
            dst: mqtt.addr,
            type: undefined,
            payload: undefined
          });
        });
        break;
      case IotTcpConnectionType.Disconnected:
        stopHandler();
        break;
    }
  });
  rm.subscribe(mqtt.addr, msg => {
    const destId = mqtt.findDestIdFrom(msg);
    rm.nextBuffer(destId, Buffer.from(`SendTo:${destId}`));
  });
});