import * as msg from './msg';

function testMsgSubject(ref: boolean, done: any) {
  const subject = new msg.Subject<msg.Msg<string>>(ref);
  const count = 10;
  let mycount = 0;
  const unsub = subject.subscribe(msg => {
    try {
      if (mycount > count) {
        fail('should not occor');
      }
      expect(msg).toEqual({
          src: `src${mycount}`,
          dst: `dst${mycount}`,
          transaction: `tra${mycount}`,
          type: `type${mycount}`,
          payload: `payload${mycount}`
      });
      ++mycount;
      if (count == mycount) {
        unsub.unsubscribe();
        done();
      }
    } catch (e) {
      done(e);
    }
  });
  Array(count * 2).fill(undefined).forEach((_, i) => {
    subject.next({
      src: `src${i}`,
      dst: `dst${i}`,
      transaction: `tra${i}`,
      type: `type${i}`,
      payload: `payload${i}`
    });
  });
}

test('by reference pass', (done) => {
  testMsgSubject(true, done);
});

test('by ser pass', (done) => {
  testMsgSubject(false, done);
});
