import { jsPDF } from 'jspdf';
import { ECOSYSTEM_STAGES, LEARNING_SCHOOLS } from '../data/learningEcosystem';

export interface SyllabusProgramData {
  title: string;
  category?: string;
  categoryId?: string;
  schoolName?: string;
  shortDescription?: string;
  longDescription?: string;
  targetAudience?: string;
  deliveryFormat?: string;
  duration?: string;
  prerequisites?: string;
  learningOutcomes?: string[];
  stagesCustom?: {
    discover?: string[];
    build?: string[];
    apply?: string[];
    create?: string[];
    master?: string[];
  };
}

/**
 * Generates and downloads a publication-grade PDF syllabus structured around
 * the proprietary Jaystarbliss DISCOVER-MASTER 5-Stage Learning Framework.
 */
export function generateSyllabusPdf(program: SyllabusProgramData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Colors
  const slate900 = [15, 23, 42];      // #0F172A
  const slate700 = [51, 65, 85];      // #334155
  const slate500 = [100, 116, 139];   // #64748B
  const slate200 = [226, 232, 240];   // #E2E8F0
  const brandRed = [223, 70, 39];     // #DF4627
  const softBg = [248, 250, 252];     // #F8FAFC

  // Find matching school stage details if available
  const matchedSchool = LEARNING_SCHOOLS.find(
    s => s.id === program.categoryId || s.name.toLowerCase() === (program.schoolName || '').toLowerCase()
  ) || LEARNING_SCHOOLS[0];

  const stagesData = {
    discover: program.stagesCustom?.discover || matchedSchool?.stagesFramework?.discover || [
      'Foundational syntax, algorithmic logic & mental models',
      'Diagnostic assessment and personalized goal setting',
      'Development environment setup and safety best practices'
    ],
    build: program.stagesCustom?.build || matchedSchool?.stagesFramework?.build || [
      'Hands-on interactive coding drills and guided exercises',
      'Data structures, functional logic, and interface construction',
      'Weekly mentor review and code quality checkpoints'
    ],
    apply: program.stagesCustom?.apply || matchedSchool?.stagesFramework?.apply || [
      'Building real-world mini-applications and problem solving',
      'Cross-disciplinary integrations and interactive UI features',
      'Debugging methodologies, test suites, and collaborative sessions'
    ],
    create: program.stagesCustom?.create || matchedSchool?.stagesFramework?.create || [
      'Independent capstone project ideation, wireframing & coding',
      'End-to-end deployment and portfolio-ready documentation',
      'Preparation for exhibition, competitions, and showcase portfolios'
    ],
    master: program.stagesCustom?.master || matchedSchool?.stagesFramework?.master || [
      'Peer review leadership, advanced optimization and algorithms',
      'Termly Demo Day showcase presentation before parents & mentors',
      'Verifiable Jaystarbliss Certificate of Technical & Academic Mastery'
    ]
  };

  // Helper: check page break
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeaderFooter();
    }
  };

  const drawHeaderFooter = () => {
    // Top subtle bar
    doc.setFillColor(brandRed[0], brandRed[1], brandRed[2]);
    doc.rect(margin, 8, contentWidth, 1.5, 'F');

    // Bottom Footer
    doc.setFontSize(8);
    doc.setTextColor(slate500[0], slate500[1], slate500[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Jaystarbliss Studios • Learning & Innovation Ecosystem • contact@jaystarbliss.com',
      margin,
      pageHeight - 10
    );
    doc.text(
      `Page ${doc.getNumberOfPages()}`,
      pageWidth - margin,
      pageHeight - 10,
      { align: 'right' }
    );
  };

  // ==========================================
  // PAGE 1: HEADER & PROGRAM SPECIFICATION
  // ==========================================

  // Organization Header
  doc.setFillColor(slate900[0], slate900[1], slate900[2]);
  doc.roundedRect(margin, y, contentWidth, 32, 4, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('JAYSTARBLISS STUDIOS', margin + 8, y + 12);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 210, 225);
  doc.text('MULTI-DISCIPLINARY LEARNING & INNOVATION ECOSYSTEM', margin + 8, y + 18);
  doc.text('ACADEMIC CURRICULUM & DISCOVER-MASTER SYLLABUS', margin + 8, y + 24);

  // Red Accent Badge in Header
  doc.setFillColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.roundedRect(pageWidth - margin - 52, y + 8, 44, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL SYLLABUS', pageWidth - margin - 30, y + 15, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('5-STAGE STANDARD', pageWidth - margin - 30, y + 20, { align: 'center' });

  y += 38;

  // Course Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(slate900[0], slate900[1], slate900[2]);
  const titleLines = doc.splitTextToSize(program.title || 'Curriculum Syllabus', contentWidth);
  doc.text(titleLines, margin, y + 4);
  y += titleLines.length * 7 + 4;

  // Academy Tagline / Subtitle
  const academyLabel = program.category || program.schoolName || matchedSchool?.name || 'Academy Program';
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.text(`${academyLabel.toUpperCase()} • 5-STAGE MASTERY PATHWAY`, margin, y);
  y += 6;

  // Metadata Grid Box
  doc.setFillColor(softBg[0], softBg[1], softBg[2]);
  doc.setDrawColor(slate200[0], slate200[1], slate200[2]);
  doc.roundedRect(margin, y, contentWidth, 24, 3, 3, 'FD');

  const colW = contentWidth / 3;
  
  // Col 1
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(slate500[0], slate500[1], slate500[2]);
  doc.text('TARGET AUDIENCE', margin + 6, y + 8);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(slate900[0], slate900[1], slate900[2]);
  doc.text(program.targetAudience || 'Ages 7–18 / Beginners to Advanced', margin + 6, y + 16);

  // Col 2
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(slate500[0], slate500[1], slate500[2]);
  doc.text('DELIVERY FORMAT', margin + colW + 6, y + 8);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(slate900[0], slate900[1], slate900[2]);
  doc.text(program.deliveryFormat || 'In-Person & Live Online', margin + colW + 6, y + 16);

  // Col 3
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(slate500[0], slate500[1], slate500[2]);
  doc.text('CERTIFICATION', margin + colW * 2 + 6, y + 8);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.text('Verifiable Certificate of Mastery', margin + colW * 2 + 6, y + 16);

  y += 30;

  // Overview / Course Summary
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(slate900[0], slate900[1], slate900[2]);
  doc.text('1. CURRICULUM OVERVIEW & OBJECTIVES', margin, y);
  y += 5;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(slate700[0], slate700[1], slate700[2]);
  const overviewText = program.shortDescription || 
    'This curriculum prepares students to transition from passive consumers of technology and media to active builders, thinkers, and creators. Through progressive hands-on projects, learners master technical fundamentals, problem-solving habits, and industry-standard creative workflows.';
  
  const descLines = doc.splitTextToSize(overviewText, contentWidth);
  doc.text(descLines, margin, y);
  y += descLines.length * 4.5 + 6;

  // ==========================================
  // SECTION 2: 5-STAGE FRAMEWORK BREAKDOWN
  // ==========================================
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(slate900[0], slate900[1], slate900[2]);
  doc.text('2. THE 5-STAGE DISCOVER-MASTER LEARNING FRAMEWORK', margin, y);
  y += 6;

  const stageKeys: (keyof typeof stagesData)[] = ['discover', 'build', 'apply', 'create', 'master'];

  ECOSYSTEM_STAGES.forEach((stage, idx) => {
    checkPageBreak(30);

    const key = stageKeys[idx];
    const bulletItems = stagesData[key] || [];

    // Stage Container Box
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(slate200[0], slate200[1], slate200[2]);
    doc.roundedRect(margin, y, contentWidth, 23 + (bulletItems.length * 4.5), 2, 2, 'FD');

    // Stage Number Pill
    doc.setFillColor(slate900[0], slate900[1], slate900[2]);
    doc.roundedRect(margin + 4, y + 4, 18, 6, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(`STAGE ${stage.stage}`, margin + 13, y + 8.2, { align: 'center' });

    // Stage Name & Tagline
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
    doc.text(stage.name, margin + 25, y + 8.5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slate500[0], slate500[1], slate500[2]);
    doc.text(`•  ${stage.tagline}`, margin + 50, y + 8.5);

    // Stage Description
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(slate700[0], slate700[1], slate700[2]);
    doc.text(stage.description, margin + 6, y + 14);

    // Bullets
    doc.setFont('helvetica', 'normal');
    let bulletY = y + 19;
    bulletItems.forEach((bullet) => {
      doc.setFillColor(brandRed[0], brandRed[1], brandRed[2]);
      doc.circle(margin + 8, bulletY - 1, 0.8, 'F');

      doc.setFontSize(7.8);
      doc.setTextColor(slate900[0], slate900[1], slate900[2]);
      const lines = doc.splitTextToSize(bullet, contentWidth - 16);
      doc.text(lines, margin + 12, bulletY);
      bulletY += lines.length * 4.2;
    });

    y = bulletY + 4;
  });

  // ==========================================
  // SECTION 3: LEARNER & ENROLLMENT PLANNING GUIDE
  // ==========================================
  checkPageBreak(50);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(slate900[0], slate900[1], slate900[2]);
  doc.text('3. LEARNER PLANNING & PACING BLUEPRINT', margin, y);
  y += 6;

  doc.setFillColor(softBg[0], softBg[1], softBg[2]);
  doc.setDrawColor(slate200[0], slate200[1], slate200[2]);
  doc.roundedRect(margin, y, contentWidth, 38, 3, 3, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(slate900[0], slate900[1], slate900[2]);
  doc.text('RECOMMENDED PACING & COMMITMENT:', margin + 6, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(slate700[0], slate700[1], slate700[2]);
  doc.text('• Pacing: 1 to 2 sessions per week (90 to 120 minutes per session) for optimal retention.', margin + 6, y + 13);
  doc.text('• Hands-on Practice: 30–45 minutes of practical project building between mentor sessions.', margin + 6, y + 18);
  doc.text('• Diagnostic Onboarding: Every student/enrollee completes a diagnostic session to calibrate starting level.', margin + 6, y + 23);
  doc.text('• Progress Portal: Regular milestone reports and verifiable code/design project artifacts.', margin + 6, y + 28);
  doc.text('• Capstone Exhibition: Opportunity to present finished works at the termly Demo Day at Stage 5.', margin + 6, y + 33);

  y += 44;

  // Enrollment / Inquiry Callout
  checkPageBreak(25);
  doc.setFillColor(slate900[0], slate900[1], slate900[2]);
  doc.roundedRect(margin, y, contentWidth, 20, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Ready to Enroll or Customize a Pathway?', margin + 8, y + 8);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 210, 225);
  doc.text('Support / WhatsApp: +234 913 651 8194 | +234 913 052 9010 • Email: jaystarblissstudios@gmail.com', margin + 8, y + 14);

  // Draw header / footer across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawHeaderFooter();
  }

  // Download PDF
  const sanitizedTitle = (program.title || 'Course')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 30);
  doc.save(`Jaystarbliss_Syllabus_${sanitizedTitle}.pdf`);
}
