const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createGameServer } = require('./server.cjs');

(async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sammalpolku-test-'));
  const data = path.join(temporary, 'scores.json');
  let server;
  try {
    server = createGameServer(data);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let base = 'http://127.0.0.1:' + server.address().port;
    const post = value => fetch(base + '/api/scores', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value)
    });
    assert.deepEqual(await (await fetch(base + '/api/scores')).json(), []);
    assert.equal((await fetch(base + '/')).status, 200);
    assert.equal((await fetch(base + '/data/scores.json')).status, 404);
    for (const value of [null, {}, { name: ' ', timeMs: 1000 }, { name: 'A', timeMs: -1 },
      { name: 'A', timeMs: 1.5 }, { name: 'x'.repeat(25), timeMs: 1000 }]) {
      assert.equal((await post(value)).status, 400);
    }
    for (let i = 12; i >= 1; i--) {
      assert.equal((await post({ name: 'Pelaaja ä ' + i, timeMs: i * 1000 })).status, 201);
    }
    const records = await (await fetch(base + '/api/scores')).json();
    assert.equal(records.length, 10);
    assert.equal(records[0].timeMs, 1000);
    assert.equal(records[9].timeMs, 10000);
    assert.deepEqual(await (await fetch(base + '/api/scores?mode=test')).json(), []);
    assert.equal((await fetch(base + '/api/scores?mode=test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Testipelaaja', timeMs: 1234 })
    })).status, 201);
    assert.deepEqual(await (await fetch(base + '/api/scores')).json(), records);
    assert.equal((await (await fetch(base + '/api/scores?mode=test')).json())[0].name, 'Testipelaaja');
    await new Promise(resolve => server.close(resolve));
    server = createGameServer(data);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = 'http://127.0.0.1:' + server.address().port;
    assert.deepEqual(await (await fetch(base + '/api/scores')).json(), records);
    assert.equal((await (await fetch(base + '/api/scores?mode=test')).json())[0].timeMs, 1234);
    console.log('PASS: shared top 10 API, input validation, Finnish names, persistent scores, private file access.');
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    if (fs.existsSync(data)) fs.unlinkSync(data);
    if (fs.existsSync(data + '.test')) fs.unlinkSync(data + '.test');
    fs.rmdirSync(temporary);
  }

  const noop = () => {};
  const context = new Proxy({}, { get: () => noop, set: () => true });
  const elements = {}, storage = new Map();
  let now = 0;
  function element() {
    return {
      textContent: '', value: '', hidden: false, disabled: false, children: [], handlers: {},
      addEventListener(type, fn) { this.handlers[type] = fn; }, getContext: () => context,
      appendChild(child) { this.children.push(child); }, replaceChildren() { this.children = []; }
    };
  }
  const environment = {
    assert, URLSearchParams, location: { protocol: 'file:', search: '' },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    performance: { now: () => now }, requestAnimationFrame: noop, window: { addEventListener: noop },
    document: { hidden: false, addEventListener: noop, querySelectorAll: () => [], createElement: element,
      getElementById: id => elements[id] ||= element() }
  };
  vm.createContext(environment);
  const run = code => vm.runInContext(code, environment);
  run(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]);
  await run('refreshRecords()');
  await elements['score-form'].handlers.submit({ preventDefault: noop });
  assert.equal(storage.size, 0);
  run(`function routeTo(tx,ty) {
    const queue = [[player.x,player.y,[]]], seen = new Set([player.x+','+player.y]);
    for (let i=0; i<queue.length; i++) {
      const [x,y,route] = queue[i];
      if (x===tx && y===ty) return route;
      for (const [dir,[dx,dy]] of Object.entries(directions)) {
        const nx=x+dx, ny=y+dy, key=nx+','+ny;
        if (maze[ny]?.[nx]===0 && !seen.has(key)
          && !(nx===exitCell.x && ny===exitCell.y && collected<COIN_COUNT)) {
          seen.add(key); queue.push([nx,ny,[...route,dir]]);
        }
      }
    }
    throw Error('Unreachable');
  }`);
  for (let i=0; i<5; i++) {
    run(`assert.equal(levelIndex,${i}); assert.equal(SIZE,${10+i*5}); assert.equal(coins.size,${5+i});
      for (const coin of [...coins]) routeTo(...coin.split(',').map(Number)).forEach(move);`);
    now += 12345;
    run('routeTo(exitCell.x,exitCell.y).forEach(move);');
  }
  run('assert(won); assert.equal(scoreForm.hidden,false);');
  const name = '<img src=x onerror=alert(1)>';
  environment.document.getElementById('player-name').value = name;
  await elements['score-form'].handlers.submit({ preventDefault: noop });
  assert.equal(JSON.parse([...storage.values()][0]).length, 1);
  assert.equal(elements['records-body'].children[0].children[1].textContent, name.slice(0, 24));
  assert(elements['score-form'].hidden);
  await elements['score-form'].handlers.submit({ preventDefault: noop });
  assert.equal(JSON.parse([...storage.values()][0]).length, 1);
  run('reset(); assert(!won); assert.equal(levelIndex,0); assert(scoreForm.hidden);');
  console.log('PASS: five levels, victory score form, local saving, safe names, duplicate prevention, restart.');

  const testElements = {};
  const testEnvironment = { ...environment, location: { protocol: 'https:', hostname: 'suvisyrjalainen.github.io', search: '?test=1' },
    document: { ...environment.document, getElementById: id => testElements[id] ||= element() } };
  vm.createContext(testEnvironment);
  const testRun = code => vm.runInContext(code, testEnvironment);
  testRun(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]);
  testRun(run('routeTo.toString()'));
  await testRun('refreshRecords()');
  testRun(`assert.equal(LEVEL_COUNT,1); assert.equal(SIZE,10); assert.equal(COIN_COUNT,5);
    player = {x:8,y:7}; move('down'); assert(!won); assert.equal(player.y,7);
    player = {x:1,y:1};
    for (const coin of [...coins]) routeTo(...coin.split(',').map(Number)).forEach(move);`);
  now += 15000;
  testRun(`routeTo(exitCell.x,exitCell.y).forEach(move);
    assert(won); assert.equal(levelIndex,0); assert.equal(SIZE,10); assert(!scoreForm.hidden);`);
  now += 10000;
  testRun('const endTime=elapsed; frame(99999); assert.equal(elapsed,endTime);');
  testEnvironment.document.getElementById('player-name').value = 'Pikatesti';
  await testElements['score-form'].handlers.submit({ preventDefault: noop });
  assert.equal(storage.size, 2);
  assert.equal(JSON.parse(storage.get('sammalpolku-test-10-v1'))[0].name, 'Pikatesti');
  assert.equal(JSON.parse(storage.get('sammalpolku-five-levels-v1')).length, 1);
  testRun('reset(); assert(!won); assert.equal(SIZE,10); assert.equal(elapsed,0); assert(scoreForm.hidden);');
  console.log('PASS: GitHub Pages test mode, locked door, immediate victory, timer stop, separate browser and server test records.');
})().catch(error => { console.error(error); process.exitCode = 1; });
