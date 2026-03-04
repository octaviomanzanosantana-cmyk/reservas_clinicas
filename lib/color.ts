export function darkenHex(hex: string, amount = 18): string {
  const safeHex = hex.replace("#", "");
  const normalized = safeHex.length === 3
    ? safeHex
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
    : safeHex;

  const num = Number.parseInt(normalized, 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0x00ff) - amount);
  const b = Math.max(0, (num & 0x0000ff) - amount);

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function hexToRgba(hex: string, alpha = 1): string {
  const safeHex = hex.replace("#", "");
  const normalized = safeHex.length === 3
    ? safeHex
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
    : safeHex;

  const num = Number.parseInt(normalized, 16);
  const r = num >> 16;
  const g = (num >> 8) & 0x00ff;
  const b = num & 0x0000ff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
