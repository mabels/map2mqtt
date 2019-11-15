import { Router, RouterMsgType, RouterMsg, EmitRecv } from "./router";
import * as rx from "rxjs";
import { LogMsgType } from "./log";

test("router addr", () => {
  const r1 = new Router();
  const r2 = new Router();
  expect(r1.addr.length).toBeGreaterThan(5);
  expect(r1.addr).not.toBe(r2.addr);
});

test("router dispose", async () => {
  return new Promise((rs, rj) => {
    const rt = new Router();
    let called = 0;
    rt.emitter.subscribe(msg => {
      if (called++ == 0 && msg.type === RouterMsgType.RegisterError) {
        return;
      }
      fail("not yet");
    });
    rt.unregister({
      addr: rt.addr,
      emitter: new rx.Subject(),
      receiver: new rx.Subject(),
    });
    rt.dispose();
    // test is Router stopped
    rt.unregister({
      addr: rt.addr,
      emitter: new rx.Subject(),
      receiver: new rx.Subject(),
    });
    setTimeout(() => {
      rs();
    }, 50);
  });
});

test("router test unregistered nextBuffer", async () => {
  return new Promise((rs, rj) => {
    const rt = new Router();
    rt.emitter.subscribe(msg => {
      if (msg.type === LogMsgType.Error) {
        expect(msg).toEqual({
          dst: "Test",
          payload: "endpoint was not found Test",
          src: rt.addr,
          type: "log.error",
        });
        rs();
        return;
      }
      rj("never called");
    });
    rt.nextBuffer("Test", Buffer.from("Test"));
  });
});

test("router test unregistered subscribeBuffer", async () => {
  return new Promise((rs, rj) => {
    const rt = new Router();
    rt.emitter.subscribe(msg => {
      if (msg.type === LogMsgType.Error) {
        expect(msg).toEqual({
          dst: "Test",
          payload: "endpoint was not found Test",
          src: rt.addr,
          type: "log.error",
        });
        rs();
        return;
      }
      rj("never called");
    });
    rt.subscribeBuffer('Test', msg => {});
  });
});


test("router test unregistered next", async () => {
  return new Promise((rs, rj) => {
    const rt = new Router();
    rt.emitter.subscribe(msg => {
      if (msg.type === LogMsgType.Error) {
        expect(msg).toEqual({
          dst: "Test",
          payload: "endpoint was not found Test",
          src: rt.addr,
          type: "log.error",
        });
        rs();
        return;
      }
      rj("never called");
    });
    rt.next({
      src: rt.addr,
      dst: 'Test',
      type: 'Test',
      payload: 'Test'
    });
  });
})

test("router test unregistered nextBuffer", async () => {
  return new Promise((rs, rj) => {
    const rt = new Router();
    rt.emitter.subscribe(msg => {
      if (msg.type === LogMsgType.Error) {
        expect(msg).toEqual({
          dst: "Test",
          payload: "endpoint was not found Test",
          src: rt.addr,
          type: "log.error",
        });
        rs();
        return;
      }
      rj("never called");
    });
    rt.nextBuffer("Test", Buffer.from('Test'));
  });
})

test("router test unregistered next", async () => {
  return new Promise((rs, rj) => {
    const rt = new Router();
    rt.emitter.subscribe(msg => {
      if (msg.type === LogMsgType.Error) {
        expect(msg).toEqual({
          dst: "Test",
          payload: "endpoint was not found Test",
          src: rt.addr,
          type: "log.error",
        });
        rs();
        return;
      }
      rj("never called");
    });
    rt.next({
      src: rt.addr,
      dst: 'Test',
      type: 'Test',
      payload: 'Test'
    });
  });
})


test("router test register unregister ", async () => {
  return new Promise((rs, rj) => {
    const rt = new Router();
    const toRegister = ["test1", "test2"];
    let order = 0;
    const tests = [
      (addr: string, msg: RouterMsg) => {
        // unregister nothing registered
        if (msg.type === RouterMsgType.RegisterError) {
          expect(msg).toEqual({
            dst: addr,
            payload: {
              addr: addr,
              msg: `unregister was not found:${addr}`,
            },
            type: msg.type,
            src: rt.addr,
          });
          return;
        }
        fail(`never reached:1:${msg.type}`);
      },
      (addr: string, msg: RouterMsg) => {
        // register
        if (msg.type === RouterMsgType.Registered) {
          expect(msg).toEqual({
            dst: "*",
            payload: msg.payload,
            type: msg.type,
            src: rt.addr,
          });
          return;
        }
        fail("never reached");
      },
      (addr: string, msg: RouterMsg) => {
        // unregister prev register
        if (msg.type === RouterMsgType.UnRegistered) {
          expect(msg).toEqual({
            dst: "*",
            payload: msg.payload,
            type: msg.type,
            src: rt.addr,
          });
          return;
        }
        fail(`never reached:${msg.type}:${msg.payload}`);
      },
      (addr: string, msg: RouterMsg) => {
        // unregister prev unregister
        if (msg.type === RouterMsgType.RegisterError) {
          expect(msg).toEqual({
            dst: addr,
            payload: {
              addr: addr,
              msg: `unregister was not found:${addr}`,
            },
            type: msg.type,
            src: rt.addr,
          });
          return;
        }
        fail("never reached");
      },
      (addr: string, msg: RouterMsg) => {
        // register
        if (msg.type === RouterMsgType.Registered) {
          expect(msg).toEqual({
            dst: "*",
            payload: msg.payload,
            type: msg.type,
            src: rt.addr,
          });
          return;
        }
        fail("never reached");
      },
    ];
    rt.emitter.subscribe(msg => {
      expect(msg.src).toBe(rt.addr);
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
        rt.dispose();
        rj(e);
      }
    });
    toRegister.forEach(j =>
      rt.unregister({
        addr: j,
        emitter: new rx.Subject(),
        receiver: new rx.Subject(),
      })
    );
    toRegister.forEach(j =>
      rt.register({
        addr: j,
        emitter: new rx.Subject(),
        receiver: new rx.Subject(),
      })
    );
    toRegister.forEach(j =>
      rt.unregister({
        addr: j,
        emitter: new rx.Subject(),
        receiver: new rx.Subject(),
      })
    );
    toRegister.forEach(j =>
      rt.unregister({
        addr: j,
        emitter: new rx.Subject(),
        receiver: new rx.Subject(),
      })
    );
    toRegister.forEach(j =>
      rt.register({
        addr: j,
        emitter: new rx.Subject(),
        receiver: new rx.Subject(),
      })
    );
  });
});

test("nextBuffer", async () => {
  return new Promise((rs, rj) => {
    const rt = new Router();
    const msgs = 10;
    const routes: EmitRecv[] = [
      {
        addr: "test1",
        emitter: new rx.Subject(),
        receiver: new rx.Subject(),
      },
      {
        addr: "test2",
        emitter: new rx.Subject(),
        receiver: new rx.Subject(),
      },
    ];
    let totalCount = 0;
    routes.forEach(ep => {
      rt.register(ep);
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
          rt.nextBuffer(ep.addr, Buffer.from(`${ep.addr}:${i}`));
        });
    });
  });
});

test("subscribeBuffer", () => {
  return new Promise((rs, rj) => {
    const rt = new Router();
    const msgs = 10;
    const routes: EmitRecv[] = [
      {
        addr: "test1",
        emitter: new rx.Subject(),
        receiver: new rx.Subject(),
      },
      {
        addr: "test2",
        emitter: new rx.Subject(),
        receiver: new rx.Subject(),
      },
    ];
    let totalCount = 0;
    console.log(`1:xxx`);
    routes.forEach(ep => {
      console.log(`2:xxx`);
      rt.register(ep);
      console.log(`3:xxx`);
      rt.subscribeBuffer(ep.addr, buf => {
        console.log(`xxxx`, ep.addr, buf);
        try {
          expect(buf.toString()).toBe(`${ep.addr}:${totalCount++ % msgs}`);
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
    console.log(``);
    routes.forEach(ep => {
      Array(msgs)
        .fill(undefined)
        .forEach((_, i) => {
          rt.nextBuffer(ep.addr, Buffer.from(`msg:${ep.addr}:${i}`));
        });
    });
  });

  //public subscribeBuffer(endPoint: string, msg: BufferCb): StopHandler {
});

test("next", async () => {
  return new Promise((rs, rj) => {
    const rt = new Router();
    const msgs = 10;
    const routes: EmitRecv[] = [
      {
        addr: "test1",
        emitter: new rx.Subject(),
        receiver: new rx.Subject(),
      },
      {
        addr: "test2",
        emitter: new rx.Subject(),
        receiver: new rx.Subject(),
      },
    ];
    let totalCount = 0;
    routes.forEach(ep => {
      rt.register(ep);
      ep.receiver.subscribe(msg => {
        try {
          const i = totalCount++ % msgs;
          expect(msg).toEqual({
            src: `src:${ep.addr}:${i}`,
            dst: ep.addr,
            type: `type:${ep.addr}:${i}`,
            payload: `payload:${ep.addr}:${i}`,
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
          rt.next({
            src: `src:${ep.addr}:${i}`,
            dst: ep.addr,
            type: `type:${ep.addr}:${i}`,
            payload: `payload:${ep.addr}:${i}`,
          });
        });
    });
  });
  // public next<T>(endPoint: string, msg: Msg<T | Error>) {
});

test("subscribe", () => {
  //public subscribe<T>(endPoint: string, msgCb: MsgCb<T>): StopHandler {
});
