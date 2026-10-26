const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = {THREE: {}, window: {}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'src/js/koumon-heads.js'), 'utf8'), context);
const decode = context.window.KM_HEADS.decodePackedIndices;
const encoding = 'delta-zigzag-varint';
const base64 = bytes => Buffer.from(bytes).toString('base64');

function encode(indices) {
  const bytes = [];
  let previous = 0;
  for (const index of indices) {
    const delta = index - previous;
    previous = index;
    let value = delta >= 0 ? delta * 2 : -delta * 2 - 1;
    do {
      const rest = Math.floor(value / 128);
      bytes.push(value % 128 + (rest ? 128 : 0));
      value = rest;
    } while (value);
  }
  return base64(bytes);
}

test('head delta indices round-trip signed jumps and uint16 boundaries', () => {
  const indices = [0, 1, 1, 65534, 0, 32768, 65534, 65533, 63, 64, 127, 128];
  let seed = 48317;
  for (let i = 0; i < 4096; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    indices.push(seed % 65535);
  }
  assert.deepEqual(Array.from(decode(encode(indices), indices.length, encoding, 65535)), indices);
  assert.deepEqual(Array.from(decode('', 0, encoding, 0)), []);
});

test('head decoder retains legacy little-endian uint16 support', () => {
  const indices = [0, 32768, 65534, 4];
  const raw = Buffer.alloc(indices.length * 2);
  indices.forEach((value, i) => raw.writeUInt16LE(value, i * 2));
  assert.deepEqual(Array.from(decode(raw.toString('base64'), indices.length, undefined, 65535)), indices);
  assert.throws(() => decode(base64([0]), 1, undefined, 2), /Incomplete/);
});

test('head decoder rejects truncated, excess and malformed index streams', () => {
  assert.throws(() => decode(base64([128]), 1, encoding, 3), /Incomplete.*varint/);
  assert.throws(() => decode(encode([0]), 2, encoding, 3), /Incomplete/);
  assert.throws(() => decode(encode([0, 1]), 1, encoding, 3), /Excess/);
  assert.throws(() => decode(base64([128, 128, 128, 0]), 1, encoding, 3), /overflow/);
  assert.throws(() => decode(base64([128, 0]), 1, encoding, 3), /Noncanonical/);
  assert.throws(() => decode('!AAA', 1, encoding, 3), /base64/);
  assert.throws(() => decode('AA', 1, encoding, 3), /base64/);
  assert.throws(() => decode('AAA\n', 1, encoding, 3), /base64/);
  assert.throws(() => decode(encode([0]), 1, 'unknown', 3), /Unsupported/);
});

test('head decoder rejects indices outside the mesh and invalid dimensions', () => {
  assert.throws(() => decode(base64([1]), 1, encoding, 3), /bounds/);
  assert.throws(() => decode(encode([3]), 1, encoding, 3), /bounds/);
  assert.throws(() => decode(base64([255, 255, 127]), 1, encoding, 3), /overflow/);
  assert.throws(() => decode(base64([3, 0]), 1, undefined, 3), /bounds/);
  assert.throws(() => decode('', -1, encoding, 3), /dimensions/);
  assert.throws(() => decode('', 0, encoding, 65536), /dimensions/);
});

test('all head parts have complete bounded indices and distinct low LOD grooms', () => {
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/js/koumon-head-assets.js'), 'utf8'), context);
  const assets = context.window.KM_HEAD_ASSETS;
  for (const [id, cast] of Object.entries(assets.cast)) {
    assert.deepEqual(Object.keys(cast.lod.low).sort(), Object.keys(cast.lod.high).sort(), id);
    for (const [lod, parts] of Object.entries(cast.lod)) {
      for (const [kind, mesh] of Object.entries(parts)) {
        const indices = decode(assets.indices[mesh.i], mesh.t * 3, assets.indexEncoding, mesh.v);
        assert.equal(indices.length, mesh.t * 3, `${id}/${lod}/${kind}`);
        if (lod === 'low') assert.ok(mesh.v < cast.lod.high[kind].v, `${id}/${kind} low is simpler`);
      }
    }
  }
});
