import { Config } from './config';

export function defaultConfig(): Config {
  return {
    mqttEndpoints: ['mqtt://127.0.0.1'],
    iotTcps: [{
      port: 4711,
      address: '::'
    }]
  }
}