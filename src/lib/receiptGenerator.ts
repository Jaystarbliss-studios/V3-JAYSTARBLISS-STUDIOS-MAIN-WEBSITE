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
  fullProgramFee?: number | string;
  paymentPercentage?: number | string;
  remainingBalance?: number | string;
  selectedPrograms?: string;
  plan?: string;
  description?: string;
  paymentPlanName?: string;
  programName?: string;
  programmeName?: string;
  studentName?: string;
  studentId?: string;
  studentNames?: string[] | string;
  studentCount?: number;
  studentsCount?: number;
  payerName?: string;
  userName?: string;
  payerRole?: string;
  userRole?: string;
  payerEmail?: string;
  schoolName?: string;
  schoolId?: string;
  tutorName?: string;
  tutorId?: string;
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

/**
 * Normalizes and formats the full receipt details
 * ensuring: "PROGRAMME FEE NAME" - "USERNAME"
 * and extracting detailed user role, payer name, beneficiary, and multi-student details.
 */
export const getReceiptDetails = (data: Partial<TransactionReceiptData> | any) => {
  if (!data) {
    return {
      displayTitle: 'Tuition Fee - Cadet',
      programName: 'STEM Programme',
      payerName: 'Customer',
      payerRole: 'Student',
      roleLabel: 'Cadet / Student',
      studentName: '',
      studentList: [] as string[],
      studentCount: 1,
      beneficiary: 'Registered Cadet',
      schoolName: '',
      isMultipleStudents: false,
      isParentPaidForStudent: false
    };
  }

  // 1. Resolve Programme Name
  let rawProg = String(
    data.programName || 
    data.programmeName || 
    data.plan || 
    data.paymentPlanName || 
    data.description || 
    ''
  ).trim();

  // Clean out legacy generic prefixes if a dash is present
  if (rawProg.startsWith('Tuition Payment - ') || rawProg.startsWith('Tuition - ') || rawProg.startsWith('Partner School - ')) {
    const parts = rawProg.split(' - ');
    if (parts.length > 1) rawProg = parts.slice(1).join(' - ');
  }
  if (rawProg.toLowerCase() === 'institutional lab fee' && data.schoolName) {
    rawProg = 'Digital Literacy (Entry Level)';
  }
  const programName = rawProg || 'Digital Literacy & STEM Track';

  // 2. Resolve Role
  const rawRole = String(data.payerRole || data.userRole || data.role || '').toLowerCase();
  let payerRole = 'Student';
  let roleLabel = 'Cadet / Student';

  if (rawRole.includes('school') || Boolean(data.schoolId) || Boolean(data.schoolName && !data.parentId)) {
    payerRole = 'School';
    roleLabel = 'School / Partner Institution';
  } else if (rawRole.includes('parent') || Boolean(data.parentId) || (data.studentName && data.payerName && data.studentName !== data.payerName)) {
    payerRole = 'Parent';
    roleLabel = 'Parent / Guardian';
  } else if (rawRole.includes('tutor') || rawRole.includes('staff') || rawRole.includes('instructor')) {
    payerRole = 'Staff';
    roleLabel = 'Staff / Faculty Member';
  } else if (rawRole.includes('admin')) {
    payerRole = 'Admin';
    roleLabel = 'Platform Administrator';
  }

  // 3. Resolve Payer Name (who actually paid)
  let payerName = String(
    data.payerName || 
    data.userName || 
    (payerRole === 'School' ? data.schoolName : '') || 
    data.customerName || 
    data.userEmail || 
    data.email || 
    ''
  ).trim();

  if (!payerName) {
    if (payerRole === 'School') payerName = data.schoolName || 'Partner School';
    else if (payerRole === 'Parent') payerName = 'Parent / Guardian';
    else if (data.studentName) payerName = data.studentName;
    else payerName = 'Registered Student';
  }

  // 4. Resolve Student(s) & Beneficiary
  let studentNames: string[] = [];
  if (Array.isArray(data.studentNames)) {
    studentNames = data.studentNames.filter(Boolean);
  } else if (typeof data.studentNames === 'string' && data.studentNames.trim()) {
    studentNames = data.studentNames.split(',').map((s: string) => s.trim()).filter(Boolean);
  } else if (data.studentName) {
    studentNames = [data.studentName.trim()];
  }

  const studentCount = Number(data.studentCount || data.studentsCount || (studentNames.length > 0 ? studentNames.length : 1));
  const isMultipleStudents = studentCount > 1 || studentNames.length > 1;
  const primaryStudentName = studentNames[0] || data.studentName || '';
  const isParentPaidForStudent = payerRole === 'Parent' && Boolean(primaryStudentName);

  let beneficiary = '';
  if (payerRole === 'School') {
    const sName = data.schoolName || payerName;
    beneficiary = isMultipleStudents 
      ? `${sName} (${studentCount} Enrolled Cadets)` 
      : `${sName} (Institutional Lab Cohort)`;
  } else if (isParentPaidForStudent) {
    if (isMultipleStudents) {
      beneficiary = `${studentNames.join(', ')} (${studentCount} Cadets) • Paid by Parent: ${payerName}`;
    } else {
      beneficiary = `${primaryStudentName} (Cadet) • Paid by Parent: ${payerName}`;
    }
  } else if (primaryStudentName) {
    beneficiary = `${primaryStudentName} (Direct Cadet Enrollment)`;
  } else {
    beneficiary = `${payerName} (${roleLabel})`;
  }

  // 5. Construct Canonical Display Title: "PROGRAMME FEE NAME" - "USERNAME"
  // E.g. "Digital Literacy (Entry Level) - South Gold Montessori School"
  // OR "Pre Developers phase I - Eno Torru"
  let targetEntity = '';
  if (payerRole === 'School') {
    targetEntity = data.schoolName || payerName;
  } else if (isParentPaidForStudent) {
    targetEntity = isMultipleStudents ? `${studentNames.join(' & ')} (Parent: ${payerName})` : primaryStudentName;
  } else {
    targetEntity = primaryStudentName || payerName;
  }

  const displayTitle = `${programName} - ${targetEntity}`;

  return {
    displayTitle,
    programName,
    payerName,
    payerRole,
    roleLabel,
    studentName: primaryStudentName,
    studentList: studentNames,
    studentCount,
    beneficiary,
    schoolName: data.schoolName || (payerRole === 'School' ? payerName : ''),
    isMultipleStudents,
    isParentPaidForStudent
  };
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

  const details = getReceiptDetails(data);

  // Background Header Accent
  pdf.setFillColor(15, 23, 42); // #0f172a
  pdf.rect(0, 0, 210, 48, 'F');

  // Brand Name & Subtitle
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.text('JAYSTARBLISS STEM ACADEMY', 15, 19);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text('Empowering Young African Innovators • Official Electronic Payment Receipt', 15, 26);
  pdf.text('Portal: app.jaystarbliss.com | Billing Support: finance@jaystarbliss.com', 15, 32);

  // Status Badge in Header
  pdf.setFillColor(16, 185, 129); // Emerald
  pdf.roundedRect(155, 14, 40, 10, 3, 3, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text((data.status || 'SUCCESSFUL').toUpperCase(), 175, 20.5, { align: 'center' });

  // Main Card Wrapper
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(15, 52, 180, 42, 4, 4, 'F');
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(15, 52, 180, 42, 4, 4, 'S');

  // Hero Section
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'bold');
  pdf.text('RECEIPT FOR: ' + details.displayTitle.toUpperCase(), 22, 63);

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(amountStr, 22, 75);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(16, 185, 129);
  pdf.text('✓ Verified & Reconciled on Jaystarbliss Ledger', 22, 85);

  // Table Details
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Official Transaction Breakdown', 15, 104);

  let y = 112;
  const rowHeight = 8.8;

  const rows: [string, string][] = [
    ['Transaction No.', transactionNo],
    ['Session ID', sessionId],
    ['Payment Reference', reference],
    ['Transaction Date', formattedDate],
    ['Programme / Fee Name', details.programName],
    ...(data.selectedPrograms ? [
      ['Selected Program Tracks', String(data.selectedPrograms)] as [string, string]
    ] : []),
    ...(data.paymentPercentage && Number(data.paymentPercentage) < 100 ? [
      ['Payment Mode / Percentage', `${data.paymentPercentage}% Installment Settlement`] as [string, string],
      ['Full Invoice Amount', formatCurrency(data.fullProgramFee || data.amount)] as [string, string],
      ['Remaining Balance Due', formatCurrency(data.remainingBalance || 0)] as [string, string],
    ] : []),
    ['Paid By (Payer Name)', details.payerName],
    ['Payer Portal Role', `${details.roleLabel} (${details.payerRole})`],
    ['Beneficiary / Cadet(s)', details.beneficiary],
    ...(details.isMultipleStudents && details.studentList.length > 0 ? [
      ['Enrolled Student List', `${details.studentCount} Cadets: ${details.studentList.join(', ')}`] as [string, string]
    ] : []),
    ['Payment Method', data.paymentMethod || 'Paystack Direct Bank / Card'],
    ['Teaching Delivery Mode', data.teachingMode || 'Standard Hybrid STEM Delivery'],
    ['Duration / Coverage', data.durationWeeks ? `${data.durationWeeks} Weeks` : 'Termly Track'],
    ['Settlement Status', (data.status || 'Successful').toUpperCase()],
  ];

  rows.forEach(([label, val], idx) => {
    if (idx % 2 === 0) {
      pdf.setFillColor(241, 245, 249);
      pdf.rect(15, y - 5.5, 180, rowHeight, 'F');
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(label, 19, y);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    const textVal = String(val);
    const displayVal = textVal.length > 58 ? textVal.substring(0, 55) + '...' : textVal;
    pdf.text(displayVal, 78, y);

    y += rowHeight;
  });

  // Security Note & Watermark
  y += 6;
  pdf.setFillColor(236, 253, 245);
  pdf.roundedRect(15, y, 180, 22, 3, 3, 'F');
  pdf.setDrawColor(167, 243, 208);
  pdf.roundedRect(15, y, 180, 24, 3, 3, 'S');

  pdf.setTextColor(6, 95, 70);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text('OFFICIAL VERIFIED DIGITAL STATEMENT', 22, y + 7);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(4, 120, 87);
  pdf.text('This receipt was electronically generated by Jaystarbliss STEM Academy and serves as official proof', 22, y + 13);
  pdf.text('of payment for academic enrollment, curriculum licensing, and student access verification.', 22, y + 18);

  // Footer
  pdf.setFontSize(7.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text('Jaystarbliss Studios • Coding, Robotics, AI & STEM Excellence for Africa', 105, 285, { align: 'center' });

  // Save the PDF
  const filename = `receipt-${reference}.pdf`;
  pdf.save(filename);
};

