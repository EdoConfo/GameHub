# GameHub

Before adding a game, a screen or any transition, read `docs/SCENE.md`.
The app is one world seen through a moving camera: if something is on screen
and something happens, it can never disappear all at once. The world is not
static: its things animate and morph into one another (circle B becomes the
table), and new transitions should look for such a morph first. Nothing may
`clear(root)`, build a second `.canvas`, or cover the world with a
full-screen layer; games render into places the hub gives them.
