import { useEffect, useRef, useState } from 'react'

interface PhotoCropModalProps { sourceUrl: string; onCancel: () => void; onSave: (dataUrl: string) => void }

export function PhotoCropModal({ sourceUrl, onCancel, onSave }: PhotoCropModalProps) {
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const dialogRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel(); return }
      if (event.key !== 'Tab') return
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button, input') ?? []).filter((item) => !item.hasAttribute('disabled'))
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])
  const save = () => {
    const image = imageRef.current
    if (!image) return
    const canvas = document.createElement('canvas')
    canvas.width = 700; canvas.height = 900
    const context = canvas.getContext('2d')
    if (!context) return
    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * zoom
    const width = image.naturalWidth * scale; const height = image.naturalHeight * scale
    const overflowX = Math.max(0, width - canvas.width); const overflowY = Math.max(0, height - canvas.height)
    context.drawImage(image, -(overflowX / 2) + (offsetX / 100) * (overflowX / 2), -(overflowY / 2) + (offsetY / 100) * (overflowY / 2), width, height)
    onSave(canvas.toDataURL('image/jpeg', 0.9))
  }
  return <div className="ux4g-modal-backdrop app-modal-backdrop"><section ref={dialogRef} className="ux4g-modal app-modal photo-crop-modal" role="dialog" aria-modal="true" aria-labelledby="photo-crop-title"><div className="ux4g-modal-header"><h2 id="photo-crop-title">Crop Photograph</h2></div><div className="ux4g-modal-body"><p>Position your face inside the passport-photo preview, then crop and save.</p><div className="photo-crop-preview"><img ref={imageRef} src={sourceUrl} alt="Crop preview" style={{ transform: `translate(${offsetX / 5}%, ${offsetY / 5}%) scale(${zoom})` }} /></div><div className="photo-crop-controls"><label htmlFor="photo-crop-zoom">Zoom<input id="photo-crop-zoom" type="range" min="1" max="2.5" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label><label htmlFor="photo-crop-horizontal">Horizontal Position<input id="photo-crop-horizontal" type="range" min="-100" max="100" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} /></label><label htmlFor="photo-crop-vertical">Vertical Position<input id="photo-crop-vertical" type="range" min="-100" max="100" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} /></label></div><div className="service-flow-actions"><button ref={cancelRef} className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={onCancel}>Cancel</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={save}>Crop And Save</button></div></div></section></div>
}
