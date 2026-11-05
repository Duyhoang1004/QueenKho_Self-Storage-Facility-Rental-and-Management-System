import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { compressImageToDataUrl, createMockEvidenceDataUrl } from '../src/utils/imageEvidence.js'

const original = { FileReader: globalThis.FileReader, Image: globalThis.Image, document: globalThis.document }
afterEach(() => Object.assign(globalThis, original))

function imageEnvironment(width, height, failure = '') {
  const canvas = { width: 0, height: 0 }
  let drawn
  let encoding
  globalThis.FileReader = class {
    readAsDataURL() {
      queueMicrotask(() => failure === 'reader' ? this.onerror() : this.onload({ target: { result: 'data:image/png;base64,test' } }))
    }
  }
  globalThis.Image = class {
    constructor() { this.width = width; this.height = height }
    set src(value) {
      queueMicrotask(() => failure === 'image' ? this.onerror() : this.onload())
    }
  }
  canvas.getContext = () => ({ drawImage: (...args) => { drawn = args } })
  canvas.toDataURL = (...args) => { encoding = args; return 'data:image/jpeg;base64,compressed' }
  globalThis.document = { createElement: name => { assert.equal(name, 'canvas'); return canvas } }
  return { canvas, get drawn() { return drawn }, get encoding() { return encoding } }
}

for (const [width, height, expectedWidth, expectedHeight] of [
  [1600, 800, 800, 400], [800, 1600, 400, 800], [1600, 1600, 800, 800],
  [400, 200, 400, 200], [800, 800, 800, 800],
]) {
  test(`evidence ${width}x${height} preserves aspect ratio within 800px`, async () => {
    const environment = imageEnvironment(width, height)
    assert.equal(await compressImageToDataUrl({}), 'data:image/jpeg;base64,compressed')
    assert.equal(environment.canvas.width, expectedWidth)
    assert.equal(environment.canvas.height, expectedHeight)
    assert.deepEqual(environment.drawn.slice(1), [0, 0, expectedWidth, expectedHeight])
    assert.deepEqual(environment.encoding, ['image/jpeg', 0.75])
  })
}

test('unreadable evidence file rejects instead of leaving upload pending forever', async () => {
  imageEnvironment(100, 100, 'reader')
  await assert.rejects(compressImageToDataUrl({}), /Không đọc được file ảnh/)
})

test('invalid image data reports a usable validation failure', async () => {
  imageEnvironment(100, 100, 'image')
  await assert.rejects(compressImageToDataUrl({}), /Định dạng ảnh không hợp lệ/)
})

test('demo evidence URI preserves Vietnamese labels', () => {
  const uri = createMockEvidenceDataUrl('Ô kho A — trước bàn giao')
  assert.ok(uri.startsWith('data:image/svg+xml;utf8,'))
  const svg = decodeURIComponent(uri.slice(uri.indexOf(',') + 1))
  assert.ok(svg.includes('Ô kho A — trước bàn giao'))
  assert.ok(svg.includes('ẢNH BẰNG CHỨNG HIỆN TRƯỜNG'))
})
