// 十进制字符串移动小数点，避免百分数展示时浮点运算或截断公共来源精度。
export function netLossPercent(rate) {
  if (rate === null || rate === undefined || rate === '') return ''
  const match = String(rate).match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i)
  if (!match) return ''
  const digits = match[1] + (match[2] || '')
  const point = match[1].length + Number(match[3] || 0) + 2
  if (Math.abs(point) > 100) return ''
  const value = point <= 0 ? `0.${'0'.repeat(-point)}${digits}`
    : point >= digits.length ? digits + '0'.repeat(point - digits.length)
      : `${digits.slice(0, point)}.${digits.slice(point)}`
  const [integer, fraction = ''] = value.split('.')
  const decimal = fraction.replace(/0+$/, '')
  return `${integer.replace(/^0+(?=\d)/, '')}${decimal ? `.${decimal}` : ''}`
}
