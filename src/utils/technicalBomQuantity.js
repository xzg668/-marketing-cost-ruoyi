// Keep decimal digits intact when Java sends BigDecimal strings such as 0E-8.
export function technicalBomQuantity(value) {
  const text = String(value ?? '')
  const match = /^(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/.exec(text)
  if (!match) return text
  const exponent = Number(match[3])
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 128) return text
  const digits = match[1] + (match[2] || '')
  const point = match[1].length + exponent
  if (point <= 0) return '0.' + '0'.repeat(-point) + digits
  if (point >= digits.length) return digits + '0'.repeat(point - digits.length)
  return digits.slice(0, point) + '.' + digits.slice(point)
}
