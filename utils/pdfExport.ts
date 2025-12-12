import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EmbryoFile } from '../types';

export const generateEmbryoReport = (file: EmbryoFile) => {
  if (!file.result) return;

  const doc = new jsPDF();
  const result = file.result;
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- Header ---
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("EmbryoLens AI Report", 15, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(`Patient ID: ${file.patientData?.id || 'N/A'}`, 15, 30);
  doc.text(`Age: ${file.patientData?.age || 'N/A'}`, 60, 30);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 15, 20, { align: 'right' });
  doc.text(`Ref: ${result.id.slice(0, 8)}`, pageWidth - 15, 30, { align: 'right' });

  // --- Score Summary ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text("Assessment Summary", 15, 55);

  doc.setFontSize(40);
  doc.setTextColor(13, 148, 136); // Teal 600
  doc.text(result.gardnerScore, 15, 75);
  
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text(`AI Grade: ${result.aiGrade}`, 60, 65);
  doc.text(`Implantation Prob: ${result.implantationProbability}%`, 60, 75);

  // Aneuploidy Badge
  if (result.aneuploidyRisk === 'High') {
    doc.setTextColor(220, 38, 38); // Red
    doc.text(`High Aneuploidy Risk`, 60, 85);
  } else {
    doc.setTextColor(22, 163, 74); // Green
    doc.text(`Risk Profile: ${result.aneuploidyRisk}`, 60, 85);
  }

  // --- Clinical Alerts ---
  let currentY = 100;
  if (result.anomalies && result.anomalies.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(220, 38, 38); // Red
    doc.text("Clinical Alerts Detected", 15, currentY);
    
    currentY += 7;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    result.anomalies.forEach((alert) => {
      doc.text(`• ${alert}`, 20, currentY);
      currentY += 5;
    });
    currentY += 10;
  }

  // --- Morphokinetic Timeline ---
  if (result.timeline && result.timeline.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Morphokinetic Timeline", 15, currentY);
    
    const timelineBody = result.timeline.map(t => [
      t.stage,
      t.timeHours ? `${t.timeHours} hpi` : '-',
      t.status,
      t.description
    ]);

    (doc as any).autoTable({
      startY: currentY + 5,
      head: [['Stage', 'Time', 'Status', 'Observation']],
      body: timelineBody,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        2: { textColor: [100, 100, 100] }
      }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 15;
  } else {
    currentY += 5;
  }

  // --- Morphology Table ---
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Morphology Metrics", 15, currentY);

  const tableBody = [
    ['Expansion Grade', result.morphology.expansion],
    ['Inner Cell Mass (ICM)', result.morphology.innerCellMass],
    ['Trophectoderm (TE)', result.morphology.trophectoderm],
    ['Fragmentation Level', `${result.morphology.fragmentationLevel}%`],
    ['Symmetry Score', `${result.morphology.symmetry}/100`],
    ['Recommendation', result.recommendation],
  ];

  (doc as any).autoTable({
    startY: currentY + 5,
    head: [['Metric', 'Value']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: [13, 148, 136] }, // Teal header
  });

  // --- Clinical Findings Text ---
  let findingsY = (doc as any).lastAutoTable.finalY + 15;
  
  // Check for page break
  if (findingsY > 250) {
    doc.addPage();
    findingsY = 20;
  }

  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Detailed Clinical Findings", 15, findingsY);
  
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const splitFindings = doc.splitTextToSize(result.clinicalFindings, pageWidth - 30);
  doc.text(splitFindings, 15, findingsY + 7);

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Disclaimer: AI-generated analysis. Final clinical decision rests with the Embryologist.", 15, pageHeight - 10);

  doc.save(`EmbryoReport_${file.patientData?.id}_${result.gardnerScore}.pdf`);
};