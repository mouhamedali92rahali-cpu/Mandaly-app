function vibrate(pattern: number | number[]): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    // unsupported (notably iOS Safari) or blocked — haptics are a nice-to-have.
  }
}

export function hapticDraw(): void {
  vibrate(35);
}

export function hapticHeart(): void {
  vibrate([25, 50, 25]);
}
