import assert from 'node:assert/strict'
import test from 'node:test'

import type {PixelComponent} from '../src/lib/types.js'

import {canNudge, nudgeComponents, type NudgeDirection} from '../src/lib/nudge.js'

function component(id: string, x: number, y: number, width = 5, height = 3): PixelComponent {
  return {
    id,
    type: 'chosung',
    typeIndex: 0,
    conditions: {},
    bitmap: Array.from({length: height}, (_, r) => Array.from({length: width}, (_, c) => +(r === y && c === x))),
  }
}

test('moves every component in all four directions without changing dimensions or inputs', () => {
  const source = [component('a', 2, 1), {...component('b', 1, 1), type: 'jongsung' as const}]
  const original = structuredClone(source)
  const destinations = {up: [2, 0], down: [2, 2], left: [1, 1], right: [3, 1]} as const
  for (const direction of Object.keys(destinations) as NudgeDirection[]) {
    const moved = nudgeComponents(source, direction)!
    const [x, y] = destinations[direction]
    assert.equal(moved[0].bitmap[y][x], 1)
    assert.equal(moved.length, 2)
    for (const c of moved) {
      assert.equal(c.bitmap.length, 3)
      assert.equal(c.bitmap[0].length, 5)
      assert.equal(
        c.bitmap.flat().reduce((a, b) => a + b, 0),
        1,
      )
    }
    const opposite = {up: 'down', down: 'up', left: 'right', right: 'left'} as const
    assert.deepEqual(nudgeComponents(moved, opposite[direction]), source)
  }
  assert.deepEqual(source, original)
})

test('one edge pixel blocks the whole operation, including an edited draft', () => {
  const edges = {up: [2, 0], down: [2, 2], left: [0, 1], right: [4, 1]} as const
  for (const direction of Object.keys(edges) as NudgeDirection[]) {
    const [x, y] = edges[direction]
    const source = [component('a', 2, 1), component('draft', x, y)]
    const original = structuredClone(source)
    assert.equal(canNudge(source, direction), false)
    assert.equal(nudgeComponents(source, direction), null)
    assert.deepEqual(source, original)
  }
  assert.equal(nudgeComponents([], 'up'), null)
  assert.equal(canNudge([component('empty', -1, -1)], 'right'), false)
  assert.equal(canNudge([component('single', 0, 0, 1, 1)], 'down'), false)
})
