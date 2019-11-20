import { Router, RouterEmitMsg } from "./router";
import * as rx from "rxjs";
import { Msg, Subject } from "./msg";
import { EmitRecv } from './emit-recv';
import { Subscription } from './subject-like';

interface UnsubscriberTestProps<T> {
  msgFactory(id: string): T;
  subscribe(rt: Router, ep: string, cb: (buf: T) => void): Subscription;
  expect(e: string, buf: T): void;
}

interface RouterEmitRecv<E, R> {
  router: Router,
  endpoint: EmitRecv<E, R>;
}

function createTestRouterRaw<E = unknown, R = unknown>(): RouterEmitRecv<E, R> {
  const router = new Router();
  const endpoint: EmitRecv<E, R> = {
    addr: "test",
    emitter: new rx.Subject<E>(),
    receiver: new rx.Subject<R>()
  };
  router.register(endpoint);
  return { router, endpoint };
}

function createTestRouterMsg<E extends Msg<EE, EEE>,
                             R extends Msg<RR, RRR>,
                             EE = unknown, EEE = string,
                             RR = unknown, RRR = string>(): RouterEmitRecv<E, R> {
  const router = new Router();
  const endpoint: EmitRecv<E, R> = {
    addr: "test",
    emitter: new Subject<E, EE, EEE>(),
    receiver: new Subject<R, RR, RRR>()
  };
  router.register(endpoint);
  return { router, endpoint };
}

async function unsubscriberTest<T extends Msg<C>, C = unknown>(props: UnsubscriberTestProps<T>) {
  const { router, endpoint }  = createTestRouterMsg();
  await new Promise((rs, rj) => {
    try {
      let calledWithoutUnsub = 0;
      let calledWithUnsub = 0;
      props.subscribe(router, endpoint.addr, buf => {
        try {
          ++calledWithoutUnsub;
          props.expect(`msg${calledWithoutUnsub}`, buf);
          if (calledWithoutUnsub == 2) {
            expect(calledWithUnsub).toBe(1);
            rs();
          }
        } catch (e) {
          rj(e);
        }
      });
      const unsub = props.subscribe(router, endpoint.addr, buf => {
        try {
          calledWithUnsub++;
          props.expect("msg1", buf);
          unsub.unsubscribe();
        } catch (e) {
          rj(e);
        }
      });
      endpoint.emitter.next(props.msgFactory("msg1"));
      endpoint.emitter.next(props.msgFactory("msg2"));
    } catch (e) {
      rj(e);
    }
  });
}


interface SubscriberTestProps {
  msgFactory(id: string): Buffer;
  subscribe(rt: Router, ep: string, cb: (buf: Buffer | RouterEmitMsg) => void): Subscription;
  expect(e: string, buf: Buffer | RouterEmitMsg): void;
}


async function subscriberTest(props: SubscriberTestProps) {
  return new Promise((rs, rj) => {
    const { router } = createTestRouterMsg();
    const msgs = 10;
    const routes: EmitRecv[] = [
      {
        addr: "test1",
        emitter: new Subject(),
        receiver: new Subject()
      },
      {
        addr: "test2",
        emitter: new Subject(),
        receiver: new Subject()
      }
    ];
    let totalCount = 0;
    routes.forEach(ep => {
      router.register(ep);
      const unsub = props.subscribe(router, ep.addr, buf => {
        try {
          props.expect(`msg:${ep.addr}:${totalCount++ % msgs}`, buf);
          if (
            routes[routes.length - 1].addr === ep.addr &&
            totalCount >= routes.length * msgs
          ) {
            unsub.unsubscribe();
            // send after unsup
            routes.forEach(ep => {
              Array(msgs)
                .fill(undefined)
                .forEach((_, i) => {
                  ep.emitter.next(props.msgFactory(`msg:${ep.addr}:${i}`) as any);
                });
            });
            setTimeout(rs, 50);
          }
        } catch (e) {
          rj(e);
        }
      });
    });
    routes.forEach(ep => {
      Array(msgs)
        .fill(undefined)
        .forEach((_, i) => {
          ep.emitter.next(props.msgFactory(`msg:${ep.addr}:${i}`));
        });
    });
  });
}

test("router addr", () => {
  const r1 = createTestRouterRaw();
  const r2 = createTestRouterMsg();
  expect(r1.router.addr.length).toBeGreaterThan(5);
  expect(r1.router.addr).not.toBe(r2.router.addr);
});

function catchToDone<T>(done: any, cb: (msg: T) => void) {
  return (msg: T) => {
    try {
      cb(msg);
    } catch (e) {
      done(e);
    }
  };
}
test('self registered', (done) => {
  const { router } = createTestRouterMsg();
  router.subscribe(router.addr, catchToDone(done, (msg) => {
    expect(msg).toEqual({
      src: 'test',
      dst: router.addr,
      transaction: 'test',
      type: 'router.registed',
      payload: router
    });
    done();
  }));
  router.emitter.next({
    src: 'test',
    dst: router.addr,
    transaction: 'test',
    type: 'router.registed',
    payload: router
  });
});

test("router dispose", async () => {
  return new Promise((rs, rj) => {
    const { router, endpoint } = createTestRouterMsg();
    let called = 0;
    router.subscribe<RouterEmitMsg>(router.addr, msg => {
      if (called++ == 0 && msg.type === 'router.error') {
        return;
      }
      fail("not yet");
    });
    router.unregister({
      addr: router.addr,
      emitter: new rx.Subject(),
      receiver: new rx.Subject()
    });
    router.dispose();
    // test is Router stopped
    router.unregister({
      addr: router.addr,
      emitter: new rx.Subject(),
      receiver: new rx.Subject()
    });
    setTimeout(() => {
      rs();
    }, 50);
  });
});

test("router test unregistered nextBuffer", async () => {
  return new Promise((rs, rj) => {
    const { router } = createTestRouterMsg();
    let transaction: string;
    router.emitter.subscribe(msg => {
      if (msg.type === 'log.error') {
        expect(msg).toEqual({
          dst: "Test",
          payload: "endpoint was not found Test",
          src: router.addr,
          transaction,
          type: "log.error"
        });
        rs();
        return;
      }
      rj("never called");
    });
    transaction = router.next("Test", "Test");
  });
});

test("router test unregistered subscribeBuffer", async () => {
  return new Promise((rs, rj) => {
    const { router } = createTestRouterMsg();
    router.subscribe<RouterEmitMsg>(router.addr, msg => {
      if (msg.type === 'log.error') {
        expect(msg).toEqual({
          dst: "Test",
          payload: "endpoint was not found Test",
          src: router.addr,
          type: "log.error"
        });
        rs();
        return;
      }
      rj("never called");
    });
    router.subscribe("Test", msg => { /* */ });
  });
});

test("router test unregistered next", async () => {
  return new Promise((rs, rj) => {
    const { router } = createTestRouterMsg();
    router.emitter.subscribe(msg => {
      if (msg.type === 'log.error') {
        expect(msg).toEqual({
          dst: "Test",
          payload: "endpoint was not found Test",
          src: router.addr,
          type: "log.error"
        });
        rs();
        return;
      }
      rj("never called");
    });
    router.nextMsg({
      src: router.addr,
      dst: "Test",
      type: "Test",
      transaction: 'Test',
      payload: "Test"
    });
  });
});

test("router test unregistered nextBuffer", async () => {
  return new Promise((rs, rj) => {
    const { router } = createTestRouterMsg();
    router.emitter.subscribe(msg => {
      if (msg.type === 'log.error') {
        expect(msg).toEqual({
          dst: "Test",
          payload: "endpoint was not found Test",
          src: router.addr,
          type: "log.error"
        });
        rs();
        return;
      }
      rj("never called");
    });
    router.next("Test", Buffer.from("Test"));
  });
});

test("router test unregistered next", async () => {
  return new Promise((rs, rj) => {
    const { router } = createTestRouterMsg();
    router.emitter.subscribe(msg => {
      if (msg.type === 'log.error') {
        expect(msg).toEqual({
          dst: "Test",
          payload: "endpoint was not found Test",
          src: router.addr,
          type: "log.error"
        });
        rs();
        return;
      }
      rj("never called");
    });
    router.nextMsg({
      src: router.addr,
      dst: "Test",
      type: "Test",
      transaction: 'Test',
      payload: "Test"
    });
  });
});

test("router test register unregister ", async () => {
  return new Promise((rs, rj) => {
    const { router } = createTestRouterMsg();
    const toRegister = ["test1", "test2"];
    let order = 0;
    const tests = [
      (addr: string, msg: RouterEmitMsg) => {
        // unregister nothing registered
        if (msg.type === 'router.error') {
          expect(msg).toEqual({
            dst: addr,
            payload: {
              addr: addr,
              msg: `unregister was not found:${addr}`
            },
            type: msg.type,
            src: router.addr
          });
          return;
        }
        fail(`never reached:1:${msg.type}`);
      },
      (addr: string, msg: RouterEmitMsg) => {
        // register
        if (msg.type === 'router.registed') {
          expect(msg).toEqual({
            dst: "*",
            payload: msg.payload,
            type: msg.type,
            src: router.addr
          });
          return;
        }
        fail("never reached");
      },
      (addr: string, msg: RouterEmitMsg) => {
        // unregister prev register
        if (msg.type === 'router.unregisted') {
          expect(msg).toEqual({
            dst: "*",
            payload: msg.payload,
            type: msg.type,
            src: router.addr
          });
          return;
        }
        fail(`never reached:${msg.type}:${msg.payload}`);
      },
      (addr: string, msg: RouterEmitMsg) => {
        // unregister prev unregister
        if (msg.type === 'router.error') {
          expect(msg).toEqual({
            dst: addr,
            payload: {
              addr: addr,
              msg: `unregister was not found:${addr}`
            },
            type: msg.type,
            src: router.addr
          });
          return;
        }
        fail("never reached");
      },
      (addr: string, msg: RouterEmitMsg) => {
        // register
        if (msg.type === 'router.unregisted') {
          expect(msg).toEqual({
            dst: "*",
            payload: msg.payload,
            type: msg.type,
            src: router.addr
          });
          return;
        }
        fail("never reached");
      }
    ];
    router.emitter.subscribe(msg => {
      expect(msg.src).toBe(router.addr);
      const testidx = ~~(order / toRegister.length);
      const idx = order++ % toRegister.length;
      const addr = toRegister[idx];
      try {
        // console.log('testIdx', order, testidx, tests.length, idx);
        tests[testidx](addr, msg);
        if (testidx + 1 == tests.length && idx + 1 == toRegister.length) {
          rs();
        }
      } catch (e) {
        router.dispose();
        rj(e);
      }
    });
    toRegister.forEach(j =>
      router.unregister({
        addr: j,
        emitter: new rx.Subject(),
        receiver: new rx.Subject()
      })
    );
    toRegister.forEach(j =>
      router.register({
        addr: j,
        emitter: new rx.Subject(),
        receiver: new rx.Subject()
      })
    );
    toRegister.forEach(j =>
      router.unregister({
        addr: j,
        emitter: new rx.Subject(),
        receiver: new rx.Subject()
      })
    );
    toRegister.forEach(j =>
      router.unregister({
        addr: j,
        emitter: new rx.Subject(),
        receiver: new rx.Subject()
      })
    );
    toRegister.forEach(j =>
      router.register({
        addr: j,
        emitter: new rx.Subject(),
        receiver: new rx.Subject()
      })
    );
  });
});

test("nextBuffer", async () => {
  return new Promise((rs, rj) => {
    const { router } = createTestRouterRaw();
    const msgs = 10;
    const routes: EmitRecv[] = [
      {
        addr: "test1",
        emitter: new rx.Subject(),
        receiver: new rx.Subject()
      },
      {
        addr: "test2",
        emitter: new rx.Subject(),
        receiver: new rx.Subject()
      }
    ];
    let totalCount = 0;
    routes.forEach(ep => {
      router.register(ep);
      ep.receiver.subscribe(_buffer => {
        try {
          expect(((_buffer as unknown) as Buffer).toString()).toBe(
            `${ep.addr}:${totalCount++ % msgs}`
          );
          if (
            routes[routes.length - 1].addr === ep.addr &&
            totalCount >= routes.length * msgs
          ) {
            rs();
          }
        } catch (e) {
          rj(e);
        }
      });
    });
    routes.forEach(ep => {
      Array(msgs)
        .fill(undefined)
        .forEach((_, i) => {
          router.next(ep.addr, Buffer.from(`${ep.addr}:${i}`));
        });
    });
  });
});

test("unsubscribe subscribeBuffer", async () => {
  return unsubscriberTest<Buffer>({
    msgFactory: (id: string): Buffer => {
      return Buffer.from(id);
    },
    subscribe: (
      rt: Router,
      ep: string,
      cb: (buf: Buffer) => void
    ) => {
      return rt.subscribe(ep, cb);
    },
    expect: (e: string, buf: Buffer | RouterEmitMsg) => {
      expect(buf.toString()).toBe(e);
    }
  });
});

test("unsubscribe subscribe", async () => {
  return unsubscriberTest({
    msgFactory(id: string): Buffer {
      return Buffer.from(JSON.stringify({
        src: "test1",
        dst: "*",
        type: "register.error",
        payload: {
          addr: "oo",
          msg: id
        }
      }));
    },
    subscribe(
      rt: Router,
      ep: string,
      cb: (buf: Buffer | RouterEmitMsg) => void
    ) {
      return rt.subscribe<Buffer | RouterEmitMsg>(ep, msg => cb(msg));
    },
    expect(e: string, buf: Buffer | RouterEmitMsg) {
      expect(buf).toEqual({
           dst: "*",
           payload: {
             addr: "oo",
             msg: e
           },
           src: "test1",
           type: "register.error",
      });
    }
  });
});

test("subscribeBuffer", () => {
  return subscriberTest({
    msgFactory(id: string): Buffer {
      return Buffer.from(id);
    },
    subscribe(rt: Router, ep: string, cb: (buf: Buffer | RouterEmitMsg) => void) {
      return rt.subscribe(ep, cb);
    },
    expect(e: string, buf: Buffer | RouterEmitMsg) {
      expect(buf.toString()).toBe(e);
    }
  });
});

test("next", async () => {
  return new Promise((rs, rj) => {
    const { router } = createTestRouterMsg();
    const msgs = 10;
    const routes: EmitRecv[] = [
      {
        addr: "test1",
        emitter: new rx.Subject(),
        receiver: new rx.Subject()
      },
      {
        addr: "test2",
        emitter: new rx.Subject(),
        receiver: new rx.Subject()
      }
    ];
    let totalCount = 0;
    routes.forEach(ep => {
      router.register(ep);
      ep.receiver.subscribe(msg => {
        try {
          const i = totalCount++ % msgs;
          expect(msg).toEqual({
            src: `src:${ep.addr}:${i}`,
            dst: ep.addr,
            type: `type:${ep.addr}:${i}`,
            payload: `payload:${ep.addr}:${i}`
          });
          if (
            routes[routes.length - 1].addr === ep.addr &&
            totalCount >= routes.length * msgs
          ) {
            rs();
          }
        } catch (e) {
          rj(e);
        }
      });
    });
    routes.forEach(ep => {
      Array(msgs)
        .fill(undefined)
        .forEach((_, i) => {
          router.nextMsg({
            src: `src:${ep.addr}:${i}`,
            dst: ep.addr,
            type: `type:${ep.addr}:${i}`,
            transaction: `trans:${ep.addr}:${i}`,
            payload: `payload:${ep.addr}:${i}`
          });
        });
    });
  });
  // public next<T>(endPoint: string, msg: Msg<T | Error>) {
});

test("subscribe", () => {
  return subscriberTest({
    msgFactory(id: string): Buffer {
      return Buffer.from(JSON.stringify({
        src: "test1",
        dst: "*",
        type: "register.error",
        payload: {
          addr: "oo",
          msg: id
        }
      }));
    },
    subscribe(rt: Router, ep: string, cb: (buf: Buffer | RouterEmitMsg) => void) {
      return rt.subscribe(ep, cb);
    },
    expect(e: string, buf: Buffer | RouterEmitMsg) {
      expect(buf).toEqual({
           dst: "*",
           payload: {
             addr: "oo",
             msg: e
           },
           src: "test1",
           type: "register.error"
      });
    }
  });
});
