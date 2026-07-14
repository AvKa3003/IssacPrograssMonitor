/**
 * Разведка блока completion marks (post-it) в persistentgamedata.dat
 *   node scripts/probe-checklist.js [path-to.dat]
 *
 * Карта байтов (формулы + абсолютные адреса под текущий файл)
 * продублирована в шапке src/parseSave.js
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getSectionOffsets,
  getCharacterHeartOffset,
  getMarkOffsets,
  getCharacterMarks,
  CHARACTER_COUNT,
} from '../src/parseSave.js'

const path = resolve(process.argv[2] || 'rep+persistentgamedata1.dat')
const buf = readFileSync(path)
const data = new Uint8Array(buf)

const MARKS = [
  "Mom's Heart",
  'Isaac',
  'Satan',
  'Boss Rush',
  '???',
  'The Lamb',
  'Mega Satan',
  'Ultra Greed',
  'Hush',
  'Delirium',
  'Mother',
  'The Beast',
]

const CHARS = [
  'Isaac',
  'Magdalene',
  'Cain',
  'Judas',
  '???',
  'Eve',
  'Samson',
  'Azazel',
  'Lazarus',
  'Eden',
  'The Lost',
  'Lilith',
  'Keeper',
  'Apollyon',
  'Forgotten',
  'Bethany',
  'Jacob & Esau',
  'T. Isaac',
  'T. Magdalene',
  'T. Cain',
  'T. Judas',
  'T. ???',
  'T. Eve',
  'T. Samson',
  'T. Azazel',
  'T. Lazarus',
  'T. Eden',
  'T. Lost',
  'T. Lilith',
  'T. Keeper',
  'T. Apollyon',
  'T. Forgotten',
  'T. Bethany',
  'T. Jacob',
]

const sections = getSectionOffsets(data)
const s1 = sections[1]

console.log('file:', path)
console.log('size:', data.length)
console.log('header:', Buffer.from(data.subarray(0, 16)).toString('ascii'))
console.log(`\nsections[1] (stats+marks) = 0x${s1.toString(16)} (${s1})`)
console.log('Heart formula:')
console.log('  0..13  → sections[1] + 0x6C + idx*4')
console.log('  14     → sections[1] + 0x32C')
console.log('  15..33 → sections[1] + 0x31C + idx*4')

console.log('\n=== Heart start per character ===')
for (let ci = 0; ci < CHARACTER_COUNT; ci++) {
  const heart = getCharacterHeartOffset(sections, ci)
  const marks = getCharacterMarks(data, sections, ci)
  const compact = marks
    .map((v) => (v === 0 ? '.' : v === 1 ? 'n' : v === 2 ? 'H' : String(v)))
    .join('')
  console.log(
    `${String(ci).padStart(2)} ${CHARS[ci].padEnd(14)} Heart@0x${heart
      .toString(16)
      .padStart(4, '0')}  ${compact}  [${marks.join(',')}]`,
  )
}

console.log('\n=== Isaac (0) all mark offsets ===')
const isaacOffs = getMarkOffsets(sections, 0)
const isaacMarks = getCharacterMarks(data, sections, 0)
for (let i = 0; i < 12; i++) {
  console.log(
    `  ${MARKS[i].padEnd(14)} @ 0x${isaacOffs[i].toString(16).padStart(4, '0')} = ${isaacMarks[i]}`,
  )
}

console.log('\n=== T. Isaac (17) all mark offsets ===')
const tiOffs = getMarkOffsets(sections, 17)
const tiMarks = getCharacterMarks(data, sections, 17)
for (let i = 0; i < 12; i++) {
  console.log(
    `  ${MARKS[i].padEnd(14)} @ 0x${tiOffs[i].toString(16).padStart(4, '0')} = ${tiMarks[i]}`,
  )
}
