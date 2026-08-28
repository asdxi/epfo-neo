import type { MemberNotice } from './types'

export const demoNotices: MemberNotice[] = [
  { id: 'kyc-verification-reminder', title: 'Keep your Aadhaar-linked mobile number active', body: 'Aadhaar OTP verification is needed for selected member services.', publishedOn: '2026-08-28', isNew: true, attachment: 'pdf', attachmentLabel: 'View Attachment' },
  { id: 'claim-profile-reminder', title: 'Check your profile before submitting a claim', body: 'Confirm your contact details and KYC status are up to date.', publishedOn: '2026-08-26', isNew: true, attachment: 'none' },
  { id: 'passbook-recording-time', title: 'Passbook updates may take time to appear', body: 'Recent contribution records can take time to be posted after processing.', publishedOn: '2026-08-20', isNew: false, attachment: 'pdf', attachmentLabel: 'View Attachment' },
  { id: 'request-status-updates', title: 'Updates are available in Requests', body: 'Submitted transfer, claim and correction requests show their latest recorded status there.', publishedOn: '2026-08-12', isNew: false, attachment: 'none' },
]
