// Battaglia navale — two fleets, two seas, one shot at a time. Game contract.
//
// Best on two phones, each admiral with their own sea in their hand: one
// opens a room, the other joins it with the code. With one phone only, it is
// passed across the table, and between one turn and the next the sea goes
// down with the drawer. With nobody across the table, the computer plays the
// other fleet (solo.js, ai.js).
//
// All four are places of the game's own, and none of them needs a table: the
// menu's circle swells out of the frame and a panel takes the whole screen
// under the header (`panel` below, hub.js, docs/SCENE.md).
import { t } from '../../shared/i18n.js'
import { placeRoom, placeGuest } from './room.js'
import { placeLocal } from './local.js'
import { placeSolo } from './solo.js'

// Built on read so the labels follow the interface language.
const menu = () => [
  { title: t('bs.menu.play'), sub: t('bs.menu.playSub'), phase: 'play', glyph: 'play' },
  { title: t('bs.menu.rules'), sub: t('bs.menu.rulesSub'), phase: 'rules', glyph: 'help' },
  { title: t('bs.menu.stats'), sub: t('bs.menu.statsSub'), phase: 'stats', glyph: 'stats' }
]

// Playing is one thing, so it is one bead: the ways of doing it ride the arc
// on the other side of the circle (`modes`, registry.js).
const modes = () => [
  { title: t('bs.mode.host'), sub: t('bs.mode.hostSub'), phase: 'room', glyph: 'home' },
  { title: t('bs.mode.join'), sub: t('bs.mode.joinSub'), phase: 'join', glyph: 'enter' },
  { title: t('bs.mode.alone'), sub: t('bs.mode.aloneSub'), phase: 'local', glyph: 'phone' },
  { title: t('bs.mode.solo'), sub: t('bs.mode.soloSub'), phase: 'solo', glyph: 'robot' }
]

// The rules as data: the hub rides them on the arc (see mister-white/index.js).
const rules = () => [
  {
    title: t('bs.rules.shortSection'),
    items: [
      { title: t('bs.rules.fleet'), text: t('bs.rules.fleetDesc') },
      { title: t('bs.rules.place'), text: t('bs.rules.placeDesc') },
      { title: t('bs.rules.fire'), text: t('bs.rules.fireDesc') },
      { title: t('bs.rules.goal'), text: t('bs.rules.goalDesc') }
    ]
  },
  {
    title: t('bs.rules.howSection'),
    items: [
      { title: t('bs.rules.room'), text: t('bs.rules.roomDesc') },
      { title: t('bs.rules.alone'), text: t('bs.rules.aloneDesc') },
      { title: t('bs.rules.solo'), text: t('bs.rules.soloDesc') }
    ]
  }
]

// Anything else under the game's address — an old link, a phase that isn't
// one — goes back to the menu.
function mount(container, ctx) {
  ctx.router.go('/battleship')
  return null
}

export default {
  id: 'battleship',
  get name() { return t('bs.name') },
  get description() { return t('bs.description') },
  icon: '⚓',
  glyph: 'ship',
  get rules() { return rules() },
  get menu() { return menu() },
  get modes() { return modes() },
  panel: true,
  places: { room: placeRoom, join: placeGuest, local: placeLocal, solo: placeSolo },
  mount
}
