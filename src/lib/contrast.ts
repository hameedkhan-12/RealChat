/**
 * WCAG contrast utilities.
 */

/**
 * Parse a hex color (#rgb, #rgba, #rrggbb, #rrggbbaa) to {r,g,b,a}.
 */
export function parseHex(hex: string): { r: number; g: number; b: number; a: number } | null {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16)
    const g = parseInt(h[1] + h[1], 16)
    const b = parseInt(h[2] + h[2], 16)
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null
    return { r, g, b, a: 1 }
  }
  if (h.length === 4) {
    const r = parseInt(h[0] + h[0], 16)
    const g = parseInt(h[1] + h[1], 16)
    const b = parseInt(h[2] + h[2], 16)
    const a = parseInt(h[3] + h[3], 16) / 255
    if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return null
    return { r, g, b, a }
  }
  if (h.length === 6) {
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null
    return { r, g, b, a: 1 }
  }
  if (h.length === 8) {
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    const a = parseInt(h.substring(6, 8), 16) / 255
    if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return null
    return { r, g, b, a }
  }
  return null
}

/**
 * Relative luminance per WCAG.
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const sRGB = (c: number) => {
    const cNorm = c / 255
    return cNorm <= 0.03928 ? cNorm / 12.92 : Math.pow((cNorm + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * sRGB(r) + 0.7152 * sRGB(g) + 0.0722 * sRGB(b)
}

/**
 * Contrast ratio between two colors (1 to 21).
 */
export function contrastRatio(color1: string, color2: string): number | null {
  const c1 = parseHex(color1)
  const c2 = parseHex(color2)
  if (!c1 || !c2) return null
  const l1 = relativeLuminance(c1.r, c1.g, c1.b)
  const l2 = relativeLuminance(c2.r, c2.g, c2.b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * WCAG AA normal text requires contrast ratio >= 4.5:1.
 * WCAG AA large text (18pt+ or 14pt+ bold) requires >= 3:1.
 */
export function passesWCAGAA(color1: string, color2: string, largeText = false): boolean | null {
  const ratio = contrastRatio(color1, color2)
  if (ratio === null) return null
  return ratio >= (largeText ? 3 : 4.5)
}

/**
 * Given a background color, suggest a text color (black or white) for best contrast.
 */
export function suggestTextColor(background: string): 'black' | 'white' {
  const c = parseHex(background)
  if (!c) return 'black'
  const lum = relativeLuminance(c.r, c.g, c.b)
  return lum > 0.5 ? 'black' : 'white'
}
