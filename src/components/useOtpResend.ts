import { useCallback, useEffect, useState } from 'react'

const OTP_RESEND_COOLDOWN_SECONDS = 30

export function useOtpResend() {
  const [secondsRemaining, setSecondsRemaining] = useState(OTP_RESEND_COOLDOWN_SECONDS)

  useEffect(() => {
    const timer = window.setInterval(() => setSecondsRemaining((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const resend = useCallback((onResend: () => void) => {
    if (secondsRemaining > 0) return
    onResend()
    setSecondsRemaining(OTP_RESEND_COOLDOWN_SECONDS)
  }, [secondsRemaining])

  return { secondsRemaining, canResend: secondsRemaining === 0, resend }
}
