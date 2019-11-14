export interface IotTcp {
  readonly port: number;
  readonly address: string;
}
export interface Config {
  readonly mqttEndpoints: string[];
  readonly iotTcps: IotTcp[];
}