import { useEffect, useRef, useState } from 'react'
import demoFace from '../assets/face-auth-demo.png'

interface FaceAuthenticationDemoProps {
  modal?: boolean
  onComplete: () => void
  onContinueForNow?: () => void
  onClose?: () => void
}

/** Demo-only simulation. It never opens a camera or sends biometric data. */
export function FaceAuthenticationDemo({ modal = false, onComplete, onContinueForNow, onClose }: FaceAuthenticationDemoProps) {
  const [aligned, setAligned] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const containerRef = useRef<HTMLDivElement>(null)
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (aligned) return
    const timer = window.setTimeout(() => setAligned(true), 1400)
    return () => window.clearTimeout(timer)
  }, [aligned])

  useEffect(() => {
    if (!modal) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    firstButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose?.(); return }
      if (event.key !== 'Tab') return
      const buttons = Array.from(containerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])
      if (!buttons.length) return
      const first = buttons[0]
      const last = buttons.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      opener?.focus()
    }
  }, [modal, onClose])

  const content = <div ref={containerRef} className="face-auth-demo">
    <div className={`face-auth-capture ${aligned ? 'is-aligned' : 'is-positioning'}`} aria-live="polite">
      <img src={demoFace} alt="Fictional illustrated face used for the demo" />
      <span className="face-auth-guide" aria-hidden="true" />
    </div>
    <p className="face-auth-state" role="status">{aligned ? 'Face Positioned Correctly' : 'Positioning Face in Guide'}</p>
    <p>This is a demo simulation. No camera, biometric data or UIDAI verification is used.</p>
    <div className="service-flow-actions">
      {modal && <button ref={firstButtonRef} className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={onClose}>Cancel</button>}
      {onContinueForNow && <button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={onContinueForNow}>Continue for Now</button>}
      <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" disabled={!aligned} onClick={onComplete}>Capture And Continue</button>
    </div>
  </div>

  if (!modal) return content
  return <div className="ux4g-modal-backdrop app-modal-backdrop"><section className="ux4g-modal app-modal" role="dialog" aria-modal="true" aria-labelledby="face-auth-title"><div className="ux4g-modal-header"><h2 id="face-auth-title">Complete Face Authentication</h2></div><div className="ux4g-modal-body">{content}</div></section></div>
}
