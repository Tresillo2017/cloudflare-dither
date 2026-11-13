/** Scale factor that fits a natural-size artwork inside a box, keeping its aspect. */
export const fitScale = (box: { width: number; height: number }, natural: number): number => {
  if (natural <= 0) return 1;
  const scale = Math.min(box.width, box.height) / natural;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
};
