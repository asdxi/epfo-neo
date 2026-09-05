import type { MemberNotice } from './types'

export const demoNotices: MemberNotice[] = [
  { id: 'kyc-verification-reminder', title: 'Keep Your Aadhaar-Linked Mobile Number Active', body: 'Aadhaar OTP verification is needed for selected member services.', publishedOn: '2026-08-28', isNew: true, attachment: 'pdf', attachmentLabel: 'View Attachment' },
  { id: 'claim-profile-reminder', title: 'Check Your Profile Before Submitting a Claim', body: 'Confirm your contact details and KYC status are up to date.', publishedOn: '2026-08-26', isNew: true, attachment: 'none' },
  { id: 'passbook-recording-time', title: 'Passbook Updates May Take Time to Appear', body: 'Recent contribution records can take time to be posted after processing.', publishedOn: '2026-08-20', isNew: false, attachment: 'pdf', attachmentLabel: 'View Attachment' },
  { id: 'request-status-updates', title: 'Updates Are Available in Requests', body: 'Submitted transfer, claim and correction requests show their latest recorded status there.', publishedOn: '2026-08-12', isNew: false, attachment: 'none' },
]
