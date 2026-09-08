import { useOtpResend } from './useOtpResend'

export function OtpResend({ onResend }: { onResend: () => void }) {
  const { secondsRemaining, canResend, resend } = useOtpResend()
  return <div className="otp-resend">
    <span>Didn’t receive the OTP?</span>
    <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" disabled={!canResend} onClick={() => resend(onResend)}>
      {canResend ? 'Resend OTP' : `Resend OTP in ${secondsRemaining}s`}
    </button>
  </div>
}
