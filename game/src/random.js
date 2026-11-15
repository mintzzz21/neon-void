// A small seeded random number generator (mulberry32): the same seed gives the same game,
// which is what makes the screenshot scenes repeatable. Every random choice in the game
// goes through one of these helpers, never Math.random, so a staged scene is identical
// every time it is rendered.

export function createRandom(seed) {
  let a = seed | 0;
  const random = function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  random.range = (min, max) => min + random() * (max - min);
  random.int = (min, max) => Math.floor(random.range(min, max + 1));
  random.pick = (items) => items[Math.floor(random() * items.length)];
  random.angle = () => random() * Math.PI * 2;
  random.chance = (p) => random() < p;
  return random;
}
