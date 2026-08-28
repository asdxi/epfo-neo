import { formatDate, formatMoney, formatWageMonth } from './calculations'
import type { AccountState, GeneratedReport, ReportFormat } from './types'

const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function createReportRecord(input: { id: string; periodLabel: string; startsOn: string; endsOn: string; format: ReportFormat; requestedOn: string; background: boolean; deliverToEmail: boolean }): GeneratedReport {
  return {
    id: input.id,
    name: `EPFO Passbook Statement - ${input.periodLabel}`,
    periodLabel: input.periodLabel,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    format: input.format,
    state: input.background ? 'preparing' : 'ready',
    requestedOn: input.requestedOn,
    generatedOn: input.background ? null : input.requestedOn,
    expiresOn: addDays(input.requestedOn, 90),
    deliveryState: input.deliverToEmail ? 'mock-sent-to-verified-email' : 'not-requested',
  }
}

export const isReportExpired = (report: GeneratedReport, today: string): boolean => report.expiresOn < today

const reportRows = (account: AccountState, startsOn: string, endsOn: string) => account.ledger.contributions
  .filter((record) => record.wageMonth >= startsOn.slice(0, 7) && record.wageMonth <= endsOn.slice(0, 7))
  .sort((a, b) => a.wageMonth.localeCompare(b.wageMonth))
  .map((record) => {
    const employer = account.employments.find((item) => item.id === record.employmentId)
    return [
      formatWageMonth(record.wageMonth),
      formatDate(record.recordedOn),
      employer?.employer ?? 'Unavailable',
      record.pfWage ?? 'Unavailable',
      record.employeeEpf ?? 'Unavailable',
      record.employerEpf ?? 'Unavailable',
      record.eps ?? 'Unavailable',
      record.status,
    ]
  })

const pdfEscape = (value: string): string => value.replace(/([\\()])/g, '\\$1').replace(/[^\x20-\x7E]/g, '?')

export function buildPdfStatement(account: AccountState, report: GeneratedReport): Uint8Array {
  const rows = reportRows(account, report.startsOn, report.endsOn)
  const rowsPerPage = 24
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage))
  const officialBalance = account.ledger.contributions.reduce((total, item) => total + (item.employeeEpf ?? 0) + (item.employerEpf ?? 0), 0)
    + account.ledger.officialInterestCredits.reduce((total, item) => total + item.amount, 0)
    - account.ledger.withdrawals.reduce((total, item) => total + item.amount, 0)
  const fontObjectId = 3
  const pageObjectIds = Array.from({ length: pageCount }, (_, index) => 4 + index * 2)
  const contentObjectIds = pageObjectIds.map((id) => id + 1)
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  pageObjectIds.forEach((pageObjectId, pageIndex) => {
    const pageRows = rows.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage)
    const isLastPage = pageIndex === pageCount - 1
    const lines = [
      'EPFO Member Services - Synthetic Passbook Statement',
      `Member: ${account.member.name}`,
      `UAN: ${account.member.uan}`,
      `Period: ${report.periodLabel} | Page ${pageIndex + 1} of ${pageCount}`,
      `Generated: ${formatDate(report.generatedOn ?? report.requestedOn)}`,
      '',
      'Wage Month | Recorded On | Employer | Employee EPF | Employer EPF | EPS | Status',
      ...pageRows.map((row) => `${row[0]} | ${row[1]} | ${String(row[2]).slice(0, 24)} | ${row[4]} | ${row[5]} | ${row[6]} | ${row[7]}`),
      ...(isLastPage ? [
        '',
        `Current official EPF balance: ${formatMoney(officialBalance).replace('₹', 'INR ')}`,
        'EPS amounts are shown separately and are not added to the EPF balance.',
        'All data in this statement is fictional and generated for the prototype.',
      ] : []),
    ]
    const content = lines.map((line, index) => `BT /F1 ${index === 0 ? 14 : 8} Tf 40 ${800 - index * 22} Td (${pdfEscape(line)}) Tj ET`).join('\n')
    objects[pageObjectId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectIds[pageIndex]} 0 R >>`
    objects[contentObjectIds[pageIndex] - 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  })
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new TextEncoder().encode(pdf)
}

const xmlEscape = (value: unknown): string => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function buildExcelStatement(account: AccountState, report: GeneratedReport): string {
  const headings = ['Wage Month', 'Recorded On', 'Employer', 'PF Wage', 'Employee EPF', 'Employer EPF', 'EPS', 'Status']
  const rows = reportRows(account, report.startsOn, report.endsOn)
  const rowXml = [headings, ...rows].map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="${typeof cell === 'number' ? 'Number' : 'String'}">${xmlEscape(cell)}</Data></Cell>`).join('')}</Row>`).join('')
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Title>${xmlEscape(report.name)}</Title></DocumentProperties><Worksheet ss:Name="Passbook"><Table>${rowXml}</Table></Worksheet></Workbook>`
}
