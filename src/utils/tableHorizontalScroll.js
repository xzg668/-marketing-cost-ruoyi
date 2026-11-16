/** Keep an upper scrollbar aligned with the table's own scroll viewport. */
export function connectTableHorizontalScroll({ viewport, bar, spacer, content, onOverflow, createObserver = callback => new ResizeObserver(callback) }) {
  let disposed = false
  const maximum = () => Math.max(0, viewport.scrollWidth - viewport.clientWidth)
  function fromTable() {
    if (disposed || viewport.clientWidth <= 0) return
    const left = Math.max(0, Math.min(maximum(), viewport.scrollLeft))
    if (Math.abs(bar.scrollLeft - left) > 0.5) bar.scrollLeft = left
  }
  function fromBar() {
    if (disposed || viewport.clientWidth <= 0) return
    const left = Math.max(0, Math.min(maximum(), bar.scrollLeft))
    if (Math.abs(viewport.scrollLeft - left) > 0.5) viewport.scrollLeft = left
  }
  function refresh() {
    if (disposed) return
    const width = viewport.clientWidth
    if (width <= 0) { onOverflow(false); return }
    bar.style.width = `${width}px`
    spacer.style.width = `${viewport.scrollWidth}px`
    onOverflow(maximum() > 1)
    fromTable()
  }
  const observer = createObserver(refresh)
  observer.observe(viewport)
  if (content) observer.observe(content)
  viewport.addEventListener('scroll', fromTable, { passive: true })
  bar.addEventListener('scroll', fromBar, { passive: true })
  refresh()
  return {
    refresh,
    destroy() {
      disposed = true
      observer.disconnect()
      viewport.removeEventListener('scroll', fromTable)
      bar.removeEventListener('scroll', fromBar)
    },
  }
}
