// Battaglia navale — two fleets, two seas, one shot at a time. Game contract.
//
// Best on two phones, each admiral with their own sea in their hand: one
// opens a room, the other joins it with the code. With one phone only, it is
// passed across the table, and between one turn and the next the sea goes
// down with the drawer.
//
// All three are places on the game's own table: the menu's circle becomes it,
// as it does for "Gioca" in the other games (see hub.js and docs/SCENE.md).
import { t } from '../../shared/i18n.js'
import { placeRoom, placeGuest } from './room.js'
import { placeLocal } from './local.js'

// Built on read so the labels follow the interface language.
const menu = () => [
  { title: t('bs.menu.play'), sub: t('bs.menu.playSub'), phase: 'room', glyph: 'play' },
  { title: t('bs.menu.join'), sub: t('bs.menu.joinSub'), phase: 'join', glyph: 'enter' },
  { title: t('bs.menu.alone'), sub: t('bs.menu.aloneSub'), phase: 'local', glyph: 'phone' },
  { title: t('bs.menu.rules'), sub: t('bs.menu.rulesSub'), phase: 'rules', glyph: 'help' },
  { title: t('bs.menu.stats'), sub: t('bs.menu.statsSub'), phase: 'stats', glyph: 'stats' }
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
      { title: t('bs.rules.alone'), text: t('bs.rules.aloneDesc') }
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
  places: { room: placeRoom, join: placeGuest, local: placeLocal },
  mount
}
