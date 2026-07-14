import { readFileSync, statSync } from 'node:fs'
import {
  getSectionOffsets,
  getMarkOffsets,
  getCharacterMarks,
  getCharacterHeartOffset,
} from '../src/parseSave.js'

const path = 'rep+persistentgamedata1.dat'
const st = statSync(path)
const data = new Uint8Array(readFileSync(path))
const sections = getSectionOffsets(data)
const ci = 17
const offs = getMarkOffsets(sections, ci)
const marks = getCharacterMarks(data, sections, ci)
const MARKS = [
  'Heart',
  'Isaac',
  'Satan',
  'BossRush',
  '???',
  'Lamb',
  'Mega',
  'Greed',
  'Hush',
  'Delirium',
  'Mother',
  'Beast',
]

console.log('file', path, 'size', st.size, 'mtime', st.mtime.toISOString())
console.log('sections[1]=0x' + sections[1].toString(16))
console.log('T.Isaac Heart@0x' + getCharacterHeartOffset(sections, ci).toString(16))
console.log('\n=== parsed marks (correct gaps) ===')
for (let i = 0; i < 12; i++) {
  const o = offs[i]
  const bytes = [...data.subarray(o, o + 4)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
  console.log(
    String(i).padStart(2),
    MARKS[i].padEnd(10),
    '@0x' + o.toString(16).padStart(4, '0'),
    'val=' + marks[i],
    '[' + bytes + ']',
  )
}

console.log('\n=== if you wrote 12 consecutive slots from Heart (wrong after mark 8) ===')
const heart = getCharacterHeartOffset(sections, ci)
for (let i = 0; i < 12; i++) {
  const o = heart + i * 4
  const v = data[o] | (data[o + 1] << 8)
  console.log('  consec', i, '@0x' + o.toString(16), '=', v)
}

console.log('\n=== hex dump 0x60E for 0x200 bytes (non-zero highlights) ===')
for (let o = 0x60e; o < 0x60e + 0x200; o += 16) {
  const slice = [...data.subarray(o, o + 16)]
  const hex = slice.map((b) => b.toString(16).padStart(2, '0')).join(' ')
  const any = slice.some((b) => b !== 0)
  if (any) console.log('0x' + o.toString(16), hex)
}
