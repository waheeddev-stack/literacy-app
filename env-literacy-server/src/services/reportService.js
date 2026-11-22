// Builds report documents once (sections of tables) and renders them as CSV or PDF.
import PDFDocument from 'pdfkit';
import { toCsv } from '../utils/csv.js';
import { classAnalytics, institutionAnalytics } from './analyticsService.js';
import { env } from '../config/env.js';

const TYPE_LABEL = { aligned: 'Aligned', knowledge_heavy: 'Knowledge-heavy', practice_heavy: 'Practice-heavy' };
const cell = v => (v == null ? '-' : v);
const scoreCols = ['Knowledge', 'Practice', 'Gap', 'Sustainability Index', 'Status'];
const scoreCells = a => a.hidden ? [`hidden (<${env.minGroupSize} students)`, '', '', '', ''] : [cell(a.K), cell(a.P), cell(a.gap), cell(a.SI), a.type ? TYPE_LABEL[a.type] : '-'];

export async function institutionReport(institutionId, viewerGlobal = false) {
  const d = await institutionAnalytics(institutionId, { viewerGlobal });
  const i = d.institution, s = d.institution_score;
  return {
    title: `Sustainability report - ${i.name}`,
    subtitle: `${i.type === 'school' ? 'School' : 'College'}${i.ward_or_area ? ' - ' + i.ward_or_area : ''} - generated ${new Date().toISOString().slice(0, 10)}. Aggregates only; no individual student data.`,
    sections: [
      { heading: 'Summary', columns: ['Metric', 'Value'], rows: [
        ['Students', d.counts.students], ['Teachers', d.counts.teachers], ['Classes', d.counts.classes],
        ['Average knowledge (K)', cell(d.overall.K)], ['Average practice (P)', cell(d.overall.P)], ['Gap (K-P)', cell(d.overall.gap)],
        ['Average student SI', cell(s.student_si)], ['Campus audit %', cell(s.audit_pct)], ['Institution score', cell(s.score)],
      ] },
      { heading: 'By topic', columns: ['Topic', ...scoreCols], rows: d.topics.map(t => [t.name, ...scoreCells(t)]) },
      { heading: 'By grade band', columns: ['Grade band', 'Students', ...scoreCols], rows: d.grade_bands.map(g => [g.grade_band, g.n, ...scoreCells(g)]) },
      { heading: 'By class', columns: ['Class', 'Grade band', 'Teacher', 'Students', ...scoreCols], rows: d.classes.map(c => [c.name, c.grade_band, c.teacher_name, c.student_count, ...scoreCells(c)]) },
      { heading: 'Campus audit by term', columns: ['Term', 'Score %'], rows: (d.audit?.history || []).map(a => [a.term_label, cell(a.total_score)]) },
      { heading: 'Trend by term', columns: ['Term', 'Knowledge', 'Practice', 'Gap', 'Sustainability Index'], rows: d.trend.map(t => [t.period, cell(t.K), cell(t.P), cell(t.gap), cell(t.SI)]) },
    ],
  };
}

export async function classReport(classId) {
  const d = await classAnalytics(classId);
  return {
    title: `Class report - ${d.class.name}`,
    subtitle: `Grade band ${d.class.grade_band} - teacher ${d.class.teacher_name} - generated ${new Date().toISOString().slice(0, 10)}`,
    sections: [
      { heading: 'Class averages by topic', columns: ['Topic', ...scoreCols], rows: d.topics.map(t => [t.name, ...scoreCells(t)]) },
      { heading: 'Students', columns: ['Name', ...scoreCols, 'Support note'], rows: d.students.map(s => [s.name, ...scoreCells(s), s.support_reason || '']) },
    ],
  };
}

export function reportToCsv(report) {
  const rows = [[report.title], [report.subtitle], []];
  for (const s of report.sections) { rows.push([s.heading], s.columns, ...s.rows, []); }
  return toCsv(rows);
}

// Streams a simple tabular PDF into `res`.
export function reportToPdf(report, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.pipe(res);
  const width = doc.page.width - 96;
  doc.font('Helvetica-Bold').fontSize(16).text(report.title);
  doc.font('Helvetica').fontSize(9).fillColor('#6B6B6B').text(report.subtitle).fillColor('#1A1A1A').moveDown();

  for (const s of report.sections) {
    if (!s.rows.length) continue;
    if (doc.y > doc.page.height - 140) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#2E7D5B').text(s.heading).fillColor('#1A1A1A').moveDown(0.3);
    const colW = width / s.columns.length;
    const row = (cells, bold) => {
      if (doc.y > doc.page.height - 70) doc.addPage();
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
      const h = Math.max(...cells.map(c => doc.heightOfString(String(c ?? ''), { width: colW - 6 })));
      cells.forEach((c, idx) => doc.text(String(c ?? ''), 48 + idx * colW, y, { width: colW - 6 }));
      doc.y = y + h + 4;
      doc.moveTo(48, doc.y - 2).lineTo(48 + width, doc.y - 2).strokeColor('#E6E6E1').lineWidth(0.5).stroke();
    };
    row(s.columns, true);
    s.rows.forEach(r => row(r, false));
    doc.moveDown();
  }
  doc.end();
}
