import { jsPDF } from 'jspdf';

const makeStableCredentialId = (studentId: string | undefined, studentName: string, moduleTitle: string) => {
  let hash = 0;
  const source = `${studentId || studentName}:${moduleTitle}`;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return `JDS-${hash.toString(36).toUpperCase().padStart(8, '0').slice(-8)}`;
};

export interface ModuleCertificateData {
  studentName: string;
  studentId?: string;
  moduleTitle: string;
  moduleStage?: string; // e.g. "STAGE 1: DISCOVER" or "STAGE 3: APPLY"
  programTrack: string; // e.g. "School of Technology & Programming"
  competencies?: string[];
  issueDate?: string;
  credentialId?: string;
  instructorName?: string;
}

/**
 * Generates and downloads a prestigious, publication-grade Certificate of Module Completion
 * in landscape A4 format using jsPDF vector graphics.
 */
export function generateModuleCertificatePdf(data: ModuleCertificateData): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const centerX = pageWidth / 2;

  const studentName = data.studentName?.trim() || 'Valued Scholar';
  const moduleTitle = data.moduleTitle?.trim() || 'Digital Technology & Innovation Module';
  const moduleStage = data.moduleStage?.trim() || 'MASTERY MILESTONE';
  const programTrack = data.programTrack?.trim() || 'Jaystarbliss Digital Ecosystem';
  const issueDate = data.issueDate || new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const credentialId = data.credentialId || makeStableCredentialId(data.studentId, studentName, moduleTitle);
  const instructorName = data.instructorName || 'Academic Directorate & Lead Mentors';

  // -------------------------------------------------------------
  // 1. Luxury Background & Borders
  // -------------------------------------------------------------
  // Outer Ivory / Soft Warm Background
  doc.setFillColor(254, 253, 250); // #FEFDFA
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Deep Slate Outer Margin Accent Frame
  doc.setFillColor(15, 23, 42); // #0F172A (Slate 900)
  doc.rect(6, 6, pageWidth - 12, pageHeight - 12, 'S');

  // Crimson Accent Border (Double line)
  doc.setDrawColor(223, 70, 39); // #DF4627 (Jaystarbliss Crimson)
  doc.setLineWidth(1.2);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20, 'S');

  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.4);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24, 'S');

  // Decorative Corner Rosettes / Angles
  const cornerSize = 14;
  const drawCornerOrnaments = (x: number, y: number, isRight: boolean, isBottom: boolean) => {
    const dirX = isRight ? -1 : 1;
    const dirY = isBottom ? -1 : 1;
    doc.setDrawColor(223, 70, 39);
    doc.setLineWidth(0.8);
    doc.line(x, y + dirY * 4, x, y + dirY * cornerSize);
    doc.line(x + dirX * 4, y, x + dirX * cornerSize, y);
    doc.setFillColor(223, 70, 39);
    doc.circle(x + dirX * 3, y + dirY * 3, 1.2, 'F');
  };

  drawCornerOrnaments(10, 10, false, false);
  drawCornerOrnaments(pageWidth - 10, 10, true, false);
  drawCornerOrnaments(10, pageHeight - 10, false, true);
  drawCornerOrnaments(pageWidth - 10, pageHeight - 10, true, true);

  // -------------------------------------------------------------
  // 2. Institution Brand Header
  // -------------------------------------------------------------
  // Brand Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text('JAYSTARBLISS STUDIOS', centerX, 24, { align: 'center' });

  // Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(223, 70, 39); // Crimson
  doc.text('INSTITUTE OF DIGITAL INNOVATION & CREATIVE ARTS', centerX, 29, { align: 'center' });

  // Thin separator divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(centerX - 45, 32, centerX + 45, 32);

  // -------------------------------------------------------------
  // 3. Certificate Title
  // -------------------------------------------------------------
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text('CERTIFICATE OF MODULE COMPLETION', centerX, 44, { align: 'center' });

  // Stage Pill / Tagline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`VERIFIED CURRICULUM MILESTONE • ${moduleStage.toUpperCase()}`, centerX, 50, { align: 'center' });

  // -------------------------------------------------------------
  // 4. Recipient Presentation
  // -------------------------------------------------------------
  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text('This credential is officially conferred upon', centerX, 60, { align: 'center' });

  // Student Full Name
  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(15, 23, 42);
  doc.text(studentName, centerX, 74, { align: 'center' });

  // Underline for name
  const nameWidth = Math.min(doc.getTextWidth(studentName) + 16, 180);
  doc.setDrawColor(223, 70, 39);
  doc.setLineWidth(0.9);
  doc.line(centerX - nameWidth / 2, 78, centerX + nameWidth / 2, 78);

  // -------------------------------------------------------------
  // 5. Achievement Narrative & Module Info
  // -------------------------------------------------------------
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(
    'for successfully demonstrating technical proficiency, completing practical laboratory challenges,',
    centerX,
    87,
    { align: 'center' }
  );
  doc.text(
    'and achieving verified mastery in the specialized program module:',
    centerX,
    92.5,
    { align: 'center' }
  );

  // Module Title Banner Box
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.roundedRect(centerX - 85, 98, 170, 18, 3, 3, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(centerX - 85, 98, 170, 18, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(moduleTitle, centerX, 106, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(223, 70, 39);
  doc.text(programTrack, centerX, 112, { align: 'center' });

  // Competencies List (if provided)
  if (data.competencies && data.competencies.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const skillsText = `Core Competencies: ${data.competencies.slice(0, 4).join(' • ')}`;
    doc.text(skillsText, centerX, 123, { align: 'center' });
  }

  // -------------------------------------------------------------
  // 6. Security Seal & Signatures
  // -------------------------------------------------------------
  const sigY = 156;

  // Left Signature: Instructor / Technical Lead
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.5);
  doc.line(35, sigY, 95, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(instructorName, 65, sigY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Lead Technical Instructor / Mentor', 65, sigY + 9, { align: 'center' });

  // Center Official Seal Emblem
  const sealX = centerX;
  const sealY = sigY + 2;

  // Seal Circles
  doc.setDrawColor(223, 70, 39);
  doc.setLineWidth(1.2);
  doc.circle(sealX, sealY, 14, 'S');

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.circle(sealX, sealY, 12, 'S');

  // Star in seal
  doc.setFillColor(223, 70, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(223, 70, 39);
  doc.text('★', sealX, sealY - 3, { align: 'center' });

  doc.setFontSize(6.5);
  doc.text('VERIFIED', sealX, sealY + 2, { align: 'center' });
  doc.text('ACCREDITED', sealX, sealY + 6, { align: 'center' });

  // Right Signature: Academic Director
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - 95, sigY, pageWidth - 35, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Academic Directorate', pageWidth - 65, sigY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Director of Curriculum & Standards', pageWidth - 65, sigY + 9, { align: 'center' });

  // -------------------------------------------------------------
  // 7. Footer Metadata & Verification Code
  // -------------------------------------------------------------
  const footerY = pageHeight - 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);

  doc.text(`Issue Date: ${issueDate}`, 20, footerY);
  doc.text(`Credential ID: ${credentialId}`, centerX, footerY, { align: 'center' });
  doc.text('Verify at: jaystarbliss.com/verify', pageWidth - 20, footerY, { align: 'right' });

  // -------------------------------------------------------------
  // 8. Download Document
  // -------------------------------------------------------------
  const safeStudent = studentName.replace(/[^a-zA-Z0-9]/g, '_');
  const safeModule = moduleTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 24);
  const filename = `Jaystarbliss_Certificate_${safeStudent}_${safeModule}.pdf`;

  doc.save(filename);
}
