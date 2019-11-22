import { EmitRecv } from './router';


type MyReceiveMsg = IotListen|IotClose|IotCloseAll;
type MyEmitterMsg = IotBound|IotClosed;

class ConnectionManager implements EmitRecv<MyEmitterMsg, MyReceiveMsg> {
  readonly servers: IotTcpServer[] = [];
  public readonly emitter = new rx.Subject<MyEmitterMsg>();
  public readonly receiver = new rx.Subject<MyReceiveMsg>();
  public readonly addr = `iot.tcp.manager.${uuid.v4}`;

  private close(msg: IotClose) {
      c.server.close();
      rm.next({
        src: this.addr,
        dst: '*',
        type: IotTcpConnectionType.Closed,
        payload: c.endpoint
      });
      c.connections.forEach((cc) => {
        rm.next({
          src: this.addr,
          dst: '*',
          type: msg.type,
          payload: cc
        });
      });
    }
  }

  private listen(msg: IotListen) {
    const ep = msg.payload;
      const connections: IotTcpConnection[] = [];
      const server = net.createServer((socket) => {
        const itc = new IotTcpConnection(config, rm, socket);
        connections.push(itc);
        this.emitter.next({
          src: this.addr,
          dst: '*',
          type: IotTcpConnectionType.Connected,
          payload: itc.id
        } as Msg<IotConnected>);
        itc.emitter.subscribe((msg) => {
          if (msg.src !== itc.id) {
            console.warn(`iotTcpListen received from unknown src ${msg.src}!=${itc.id}`);
            return;
          }
          switch (msg.type) {
            case IotTcpConnectionType.Close:
              const idx = connections.findIndex(c => c.id === msg.src);
              if (idx < 0) {
                console.error(`connection not found in connections ${msg.src}`);
                return;
              }
              connections.splice(idx, 1);
              this.emitter.next({
                src: this.addr,
                dst: '*',
                type: IotTcpConnectionType.Disconnected,
                payload: itc.id
              } as Msg<IotDisconnected>);
              break;
            default:
              break;
          }
        });
      });
      server.listen(ep.port, ep.address || '[::]');
      this.emitter.next({
        src: this.addr,
        dst: '*',
        type: IotTcpConnectionType.Bound,
        payload: ep
      });
  }

  constructor(config: IotTcpListenProps, rm: Router) {
    rm.register(this);
    rm.subscribe(this.addr, (msg) => {
      if (msg.dst !== this.addr) {
        LogWarn(this, 'message to for me');
        return;
      }
      switch (msg.type) {
        case IotTcpConnectionType.CloseAll:
          this.servers.forEach(s => {
            rm.next({
              src: this.addr,
              dst: msg.dst,
              type: IotTcpConnectionType.Close,
              payload: s.endpoint
            })
          })
          break;
        case IotTcpConnectionType.Close:
          this.close(msg);
          break;
        case IotTcpConnectionType.Listen:
          this.listen(msg);
          break;
      }
    });
  }
}