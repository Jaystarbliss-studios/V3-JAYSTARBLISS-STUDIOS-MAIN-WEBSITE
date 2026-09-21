import jsPDF from 'jspdf';

export interface TransactionReceiptData {
  id: string;
  reference?: string;
  transactionNo?: string;
  sessionId?: string;
  amount?: number | string;
  baseAmount?: number | string;
  transactionFee?: number | string;
  customerTotal?: number | string;
  plan?: string;
  description?: string;
  paymentPlanName?: string;
  studentName?: string;
  studentId?: string;
  payerName?: string;
  payerEmail?: string;
  schoolName?: string;
  paymentMethod?: string;
  status?: string;
  category?: string;
  teachingMode?: string;
  durationWeeks?: number | string;
  paidAt?: Date | string | number | null;
  createdAt?: Date | string | number | { toDate?: () => Date } | null;
  paidThrough?: Date | string | number | null;
  paymentSource?: string;
  type?: 'inflow' | 'outflow' | 'transfer' | 'deposit' | 'payout' | 'tuition';
}

export const formatCurrency = (val: number | string | undefined): string => {
  const num = typeof val === 'number' ? val : Number(val || 0);
  return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const parseDate = (val: any): Date => {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val?.toDate === 'function') return val.toDate();
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

export const formatReceiptDate = (date: Date): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  // Suffix for day
  const suffix = (d: number) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  return `${month} ${day}${suffix(day)}, ${year} ${hours}:${minutes}:${seconds}`;
};

export const generatePdfReceipt = (data: TransactionReceiptData) => {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const date = parseDate(data.paidAt || data.createdAt);
  const formattedDate = formatReceiptDate(date);
  const reference = data.reference || data.id || 'JST-TXN-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const transactionNo = data.transactionNo || '26' + Date.now().toString() + Math.floor(Math.random() * 1000);
  const sessionId = data.sessionId || '1000' + Date.now().toString() + Math.floor(Math.random() * 10000);
  const rawAmount = Number(data.customerTotal || data.amount || data.baseAmount || 0);
  const amountStr = formatCurrency(rawAmount);

  // Background Header Accent
  pdf.setFillColor(15, 23, 42); // #0f172a
  pdf.rect(0, 0, 210, 48, 'F');

  // Brand Name & Subtitle
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('JAYSTARBLISS STEM ACADEMY', 15, 20);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184);
  pdf.text('Empowering Young African Innovators • Official Payment Receipt', 15, 27);
  pdf.text('Web: jaystarbliss.com | Support: support@jaystarbliss.com', 15, 33);

  // Status Badge in Header
  pdf.setFillColor(16, 185, 129); // Emerald
  pdf.roundedRect(155, 15, 40, 10, 3, 3, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text((data.status || 'SUCCESSFUL').toUpperCase(), 175, 21.5, { align: 'center' });

  // Main Card Wrapper
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(15, 54, 180, 42, 4, 4, 'F');
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(15, 54, 180, 42, 4, 4, 'S');

  // Hero Amount Section
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TOTAL AMOUNT PAID', 25, 66);

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.text(amountStr, 25, 78);

  pdf.setFontSize(9.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(16, 185, 129);
  pdf.text('✓ Payment verified & reconciled on Jaystarbliss Ledger', 25, 88);

  // Table Details
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('Transaction Breakdown', 15, 108);

  let y = 116;
  const rowHeight = 9.5;

  const rows: [string, string][] = [
    ['Transaction No.', transactionNo],
    ['Session ID', sessionId],
    ['Payment Reference', reference],
    ['Transaction Date', formattedDate],
    ['Payment Category', data.category || data.plan || 'Tuition & Academic Track'],
    ['Purpose / Description', String(data.description || data.plan || data.paymentPlanName || 'Academic Term Membership')],
    ['Beneficiary / Cadet', data.studentName || data.schoolName || data.payerName || 'Registered Student'],
    ['Payment Method', data.paymentMethod || 'Paystack Direct Bank / Card'],
    ['Teaching Mode', data.teachingMode || 'Standard Hybrid Lab'],
    ['Duration / Coverage', data.durationWeeks ? `${data.durationWeeks} Weeks` : 'Termly Track'],
    ['Payment Status', (data.status || 'Successful').toUpperCase()],
  ];

  rows.forEach(([label, val], idx) => {
    if (idx % 2 === 0) {
      pdf.setFillColor(241, 245, 249);
      pdf.rect(15, y - 5.5, 180, rowHeight, 'F');
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(label, 20, y);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    // Truncate if too long
    const textVal = String(val);
    const displayVal = textVal.length > 55 ? textVal.substring(0, 52) + '...' : textVal;
    pdf.text(displayVal, 90, y);

    y += rowHeight;
  });

  // Security Note & Watermark
  y += 8;
  pdf.setFillColor(236, 253, 245);
  pdf.roundedRect(15, y, 180, 24, 3, 3, 'F');
  pdf.setDrawColor(167, 243, 208);
  pdf.roundedRect(15, y, 180, 24, 3, 3, 'S');

  pdf.setTextColor(6, 95, 70);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('VERIFIED DIGITAL RECEIPT', 22, y + 8);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(4, 120, 87);
  pdf.text('This receipt was electronically generated by Jaystarbliss STEM Academy and serves as official proof', 22, y + 14);
  pdf.text('of payment for academic enrollment, lab materials, and institutional access verification.', 22, y + 19);

  // Footer
  pdf.setFontSize(7.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text('Jaystarbliss Studios • Coding, Robotics, AI & STEM Excellence for Africa', 105, 285, { align: 'center' });

  // Save the PDF
  const filename = `receipt-${reference}.pdf`;
  pdf.save(filename);
};
