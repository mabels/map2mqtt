import { Router } from "../router";
import { MqttEndPoints, MqttEndPointsMsgRecv } from "./mqtt-endpoints";

function addConnections(
  {
    rm,
    mqe,
    connections,
  }: {
    rm: Router;
    mqe: MqttEndPoints;
    connections: number;
  },
  done: () => void,
  error: (o: any) => void
) {
  let count = 0;
  const unsubAdd = rm.subscribe<MqttEndPointsMsgRecv>(mqe, msg => {
    try {
      expect(msg.type).toBe("mqtt.endpoints.added");
      expect(msg.dst).toBe(`me-${count}`);
      expect(msg.src).toBe(mqe.addr);
      expect(msg.transaction).toBe(`tr-${count}`);
      expect(msg.payload.connectionString).toBe(`mqtt://${count}`);
      ++count;
      if (count >= connections) {
        unsubAdd();
        done();
      }
    } catch (e) {
      error(e);
    }
  });

  Array(connections)
    .fill(undefined)
    .forEach((_, i) => {
      rm.next({
        src: `me-${i}`,
        dst: mqe.addr,
        transaction: `tr-${i}`,
        type: "mqtt.endpoints.add",
        payload: {
          connectionString: `mqtt://${i}`,
        },
      });
    });
}

function deleteConnections(
  {
    rm,
    mqe,
    connections,
  }: {
    rm: Router;
    mqe: MqttEndPoints;
    connections: number;
  },
  done: () => void,
  error: (o: any) => void
) {
  return function() {
    let count = 0;
    const unsubDeleted = rm.subscribe<MqttEndPointsMsgRecv>({src: mqe.addr, transaction: mqe.addr }, msg => {
      try {
        expect(msg.type).toBe("mqtt.endpoints.deleted");
        expect(msg.dst).toBe(`me-${count}`);
        expect(msg.src).toBe(mqe.addr);
        expect(msg.transaction).toBe(`tr-${count}`);
        expect(msg.payload.connectionString).toBe(`mqtt://${count}`);
        ++count;
        if (count >= connections) {
          unsubDeleted();
          done();
        }
      } catch (e) {
        error(e);
      }
    });

    Array(connections)
      .fill(undefined)
      .forEach((_, i) => {
        rm.next({
          src: `me-${i}`,
          dst: mqe.addr,
          transaction: `tr-${i}`,
          type: "mqtt.endpoints.delete",
          payload: {
            connectionString: `mqtt://${i}`,
          },
        });
      });
  };
}

function unknownDeleteConnections(
  {
    rm,
    mqe,
    connections,
  }: {
    rm: Router;
    mqe: MqttEndPoints;
    connections: number;
  },
  done: () => void,
  error: (o: any) => void
) {
  return function() {
    let count = 0;
    const unsubDeleted = rm.subscribe<MqttEndPointsMsgRecv>({ src: mqe.addr, transaction: mqe.addr }, msg => {
      try {
        expect(msg.type).toBe("log.error");
        expect(msg.dst).toBe(`me-${count}`);
        expect(msg.src).toBe(mqe.addr);
        expect(msg.transaction).toBe(`tr-${count}`);
        expect(msg.payload.connectionString).toBe(`mqtt://${count}`);
        ++count;
        if (count >= connections) {
          unsubDeleted();
          done();
        }
      } catch (e) {
        error(e);
      }
    });

    Array(connections)
      .fill(undefined)
      .forEach((_, i) => {
        rm.next({
          src: `me-${i}`,
          dst: mqe.addr,
          transaction: `tr-${i}`,
          type: "mqtt.endpoints.delete",
          payload: {
            connectionString: `mqtt://${i}`,
          },
        });
      });
  };
}

test("add and delete", done => {
  const rm = new Router();
  const mqe = new MqttEndPoints(rm);
  const connections = 4;
  addConnections(
    { rm, mqe, connections },
    deleteConnections(
      { rm, mqe, connections },
      unknownDeleteConnections({ rm, mqe, connections }, done, done),
      done
    ),
    done
  );
});

/*
type MqttEndpointsMsg = 'mqtt.endpoints.add' | 'mqtt.endpoints.added'
  | 'mqtt.endpoints.delete' | 'mqtt.endpoints.deleted';

export interface MqttEndpointsAddProps {
  readonly connectionString: string;
}

export interface MqttEndpointsAdd extends Msg<MqttEndpointsAddProps> {
  readonly type: 'mqtt.endpoints.add';
}

export interface MqttEndpointsAddr extends MqttEndpointsAddProps {
  readonly addr: string;
}

export interface MqttEndpointsDelete extends Msg<MqttEndpointsAddr> {
  readonly type: 'mqtt.endpoints.delete';
}

export interface MqttEndpointsAdded extends Msg<MqttEndpointsAddr> {
  readonly type: 'mqtt.endpoints.added';
}

export interface MqttEndpointsDeleted extends Msg<MqttEndpointsAddr> {
  readonly type: 'mqtt.endpoints.deleted';
}


type MqttEndPointsMsgRecv = MqttEndpointsAdd | MqttEndpointsDelete;
type MqttEndPointsMsgEmit = MqttEndpointsAdded | MqttEndpointsDeleted;

*/
