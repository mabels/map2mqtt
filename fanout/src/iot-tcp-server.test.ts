import { iotTcpListen } from './iot-tcp-server';
import { Router } from './router';

test('iop-tcp', () => {
  const rt = new Router();
  iotTcpListen({
    endpoints: [{
      port: 28888
    }, {
      port: 28889
    }]
  }, rt);
});