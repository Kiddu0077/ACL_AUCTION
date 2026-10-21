/** Draw balanced pools without changing the source roster or favoring a team. */
export function drawTeamPools<T>(
  teams: readonly T[],
  random: () => number = Math.random,
): { A: T[]; B: T[] } {
  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const midpoint = Math.ceil(shuffled.length / 2);
  return { A: shuffled.slice(0, midpoint), B: shuffled.slice(midpoint) };
}
