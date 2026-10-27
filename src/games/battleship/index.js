// Battaglia navale — two fleets, two seas, one shot at a time. Game contract.
//
// Best on two phones, each admiral with their own sea in their hand: one
// opens a room, the other joins it with the code. With one phone only, it is
// passed across the table and a screen with no sea on it stands between one
// turn and the next.
import { t } from '../../shared/i18n.js'
import { mountRoom, mountGuest } from './room.js'
import { mountLocal } from './local.js'

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

const SCREENS = { room: mountRoom, join: mountGuest, local: mountLocal }

function mount(container, ctx, phase) {
  const screen = SCREENS[phase]
  const toMenu = () => (ctx.exitToMenu ? ctx.exitToMenu() : ctx.router.go('/battleship'))
  // Anything else — an old address, a reload mid-match (the match lived in
  // memory, as it should) — goes back to the menu.
  if (!screen) { toMenu(); return null }
  return screen(container, ctx, { exit: toMenu })
}

export default {
  id: 'battleship',
  get name() { return t('bs.name') },
  get description() { return t('bs.description') },
  icon: '⚓',
  glyph: 'ship',
  get rules() { return rules() },
  get menu() { return menu() },
  mount
}
