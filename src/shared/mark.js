// The echo wordmark, as outlines.
//
// It used to be live text in Bricolage Grotesque, pulled from Google Fonts.
// That is wrong twice over here: GameHub loads no font from the network and
// works in aeroplane mode, so the mark would have fallen back to the system
// grotesque exactly when nobody could fix it — and a logotype that depends on
// a font is a logotype somebody else can change. These are Bricolage Grotesque
// at opsz 96, weight 800, tracked -5%, with the font's own kerning already
// baked in; as outlines, nothing can substitute them.
//
// The h is kept apart from the other three letters. It is the only letter that
// "Edoardo Conforti" does not contain, so it is the only one carrying gold.

export const MARK_VIEWBOX = '0 0 201.10 71.40'
export const MARK_RATIO = 2.8165   // width / height

const E = 'M26.5 71.4Q19 71.4 13.95 69.25Q8.9 67.1 5.8 63.35Q2.7 59.6 1.35 54.8Q0 50 0 44.7Q0 39 1.45 33.8Q2.9 28.6 5.95 24.55Q9 20.5 13.85 18.15Q18.7 15.8 25.5 15.8Q32.3 15.8 37.15 18.15Q42 20.5 44.9 24.7Q47.8 28.9 48.65 34.4Q49.5 39.9 48.4 46.3L10.1 46.9V38.1L36 37.6L33.9 42.7Q34.5 38.1 33.75 34.95Q33 31.8 31 30.15Q29 28.5 25.5 28.5Q21.8 28.5 19.6 30.4Q17.4 32.3 16.5 35.75Q15.6 39.2 15.6 43.9Q15.6 52 18.3 55.7Q21 59.4 26.6 59.4Q29 59.4 30.6 58.8Q32.2 58.2 33.2 57.05Q34.2 55.9 34.6 54.25Q35 52.6 34.9 50.5L49.7 51.3Q50 54.6 49.05 58.1Q48.1 61.6 45.5 64.6Q42.9 67.6 38.25 69.5Q33.6 71.4 26.5 71.4Z'
const C = 'M75.4 71.4Q68.3 71.4 63.2 69.25Q58.1 67.1 54.9 63.3Q51.7 59.5 50.2 54.6Q48.7 49.7 48.7 44.2Q48.7 38.6 50.2 33.55Q51.7 28.5 54.85 24.45Q58 20.4 63.05 18.1Q68.1 15.8 75.2 15.8Q83.6 15.8 88.75 18.95Q93.9 22.1 95.95 27.1Q98 32.1 97.1 37.9L83.1 39Q83.3 35.4 82.35 33.05Q81.4 30.7 79.5 29.55Q77.6 28.4 74.9 28.4Q72.5 28.4 70.65 29.3Q68.8 30.2 67.55 32.05Q66.3 33.9 65.65 36.7Q65 39.5 65 43.4Q65 48.4 66.15 52Q67.3 55.6 69.65 57.5Q72 59.4 75.6 59.4Q79.3 59.4 81.2 57.6Q83.1 55.8 83.7 53.05Q84.3 50.3 83.9 47.6L98.8 48.3Q99.4 52.7 98.4 56.85Q97.4 61 94.55 64.3Q91.7 67.6 86.95 69.5Q82.2 71.4 75.4 71.4Z'
const O = 'M174.8 71.4Q167.2 71.4 161.3 68.35Q155.4 65.3 152.1 59.15Q148.8 53 148.8 43.7Q148.8 34 152.25 27.85Q155.7 21.7 161.65 18.75Q167.6 15.8 175.1 15.8Q182.9 15.8 188.75 18.85Q194.6 21.9 197.85 28.05Q201.1 34.2 201.1 43.6Q201.1 53.3 197.65 59.45Q194.2 65.6 188.25 68.5Q182.3 71.4 174.8 71.4ZM175.2 59.5Q178.3 59.5 180.4 57.75Q182.5 56 183.6 52.6Q184.7 49.2 184.7 44.5Q184.7 39.3 183.5 35.75Q182.3 32.2 180.05 30.3Q177.8 28.4 174.6 28.4Q171.6 28.4 169.5 30.15Q167.4 31.9 166.3 35.3Q165.2 38.7 165.2 43.5Q165.2 51.1 167.85 55.3Q170.5 59.5 175.2 59.5Z'
const H = 'M99 70V42.1V0H115.2V13.2Q115.2 15.3 114.95 18.75Q114.7 22.2 114.25 26.1Q113.8 30 113.35 33.55Q112.9 37.1 112.6 39.5H113.5Q114.4 31.2 116.6 25.95Q118.8 20.7 122.6 18.25Q126.4 15.8 131.8 15.8Q140.3 15.8 144.4 21.85Q148.5 27.9 148.5 40.1V70H132.3V40.8Q132.3 35.2 130.8 32.6Q129.3 30 125.9 30Q122.9 30 120.5 32.25Q118.1 34.5 116.65 39.4Q115.2 44.3 115.2 52.1V70Z'

// Foil, not a flat colour: the band of light lives in a gradient five times
// wider than the letter, clipped to the h. At rest it sits off to one side and
// the h reads as unlit gold; --glint slides it across.
//
// `uid` keeps the gradient and clip ids unique — two marks on one page would
// otherwise share, and the second would silently take the first one's fill.
export function markSvg(uid = 'm', { label = 'echo' } = {}) {
  return `<svg class="echo-mark" viewBox="${MARK_VIEWBOX}" role="img" aria-label="${label}">
  <defs>
    <clipPath id="h-${uid}"><path d="M99 70V42.1V0H115.2V13.2Q115.2 15.3 114.95 18.75Q114.7 22.2 114.25 26.1Q113.8 30 113.35 33.55Q112.9 37.1 112.6 39.5H113.5Q114.4 31.2 116.6 25.95Q118.8 20.7 122.6 18.25Q126.4 15.8 131.8 15.8Q140.3 15.8 144.4 21.85Q148.5 27.9 148.5 40.1V70H132.3V40.8Q132.3 35.2 130.8 32.6Q129.3 30 125.9 30Q122.9 30 120.5 32.25Q118.1 34.5 116.65 39.4Q115.2 44.3 115.2 52.1V70Z"/></clipPath>
    <linearGradient id="foil-${uid}" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" class="s-base"/><stop offset=".32" class="s-base"/>
      <stop offset=".45" class="s-hi"/><stop offset=".5" class="s-spark"/><stop offset=".55" class="s-hi"/>
      <stop offset=".68" class="s-base"/><stop offset="1" class="s-base"/>
    </linearGradient>
  </defs>
  <g class="mark-ink"><path d="${E}"/><path d="${C}"/><path d="${O}"/></g>
  <g clip-path="url(#h-${uid})">
    <rect class="mark-foil" x="-160" y="-20" width="320" height="112" fill="url(#foil-${uid})"/>
  </g>
</svg>`
}
