import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WorkOrder, Customer, Settings, Technician } from '../types';

export interface PDFOptions {
  includeDetails?: boolean;
}

export const generateWorkOrderPDF = (
  wo: WorkOrder,
  customer: Customer | null,
  technicians: Technician[],
  settings: Settings | null,
  options: PDFOptions = {}
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text('ORDEM DE SERVIÇO', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Nº: ${wo.workOrderNumber}`, pageWidth - margin, 20, { align: 'right' });
  
  // Company Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(settings?.companyName || 'Empresa de Serviços', margin, 35);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(settings?.companyAddress || '', margin, 40);
  doc.text(settings?.companyTaxId ? `CNPJ/CPF: ${settings.companyTaxId}` : '', margin, 45);
  
  doc.line(margin, 50, pageWidth - margin, 50);
  
  // Customer Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE', margin, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Nome: ${customer?.name || wo.customerNameSnapshot || 'Não informado'}`, margin, 65);
  doc.text(`Telefone: ${customer?.phone || ''}`, margin, 70);
  doc.text(`Endereço: ${customer?.address || ''}`, margin, 75);
  
  doc.line(margin, 80, pageWidth - margin, 80);
  
  // Service Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIÇÃO DO SERVIÇO', margin, 90);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const splitDescription = doc.splitTextToSize(wo.description, pageWidth - 2 * margin);
  doc.text(splitDescription, margin, 95);
  
  let currentY = 95 + (splitDescription.length * 5) + 10;
  
  // Details Table
  autoTable(doc, {
    startY: currentY,
    head: [['Data Executada', 'Status', 'Horas Est.', 'Trabalhadas', 'Restante']],
    body: [[
      wo.scheduledDate ? format(new Date(wo.scheduledDate), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'Não informada',
      wo.status === 'open' ? 'Aberta' : wo.status === 'in-progress' ? 'Em Andamento' : 'Encerrada',
      wo.laborHours?.toString() || '0',
      wo.totalWorkedHours?.toString() || '0',
      wo.remainingHours?.toString() || '0'
    ]],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] } // Indigo-600
  });
  
  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Work Sessions History
  if (wo.workSessions && wo.workSessions.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('HISTÓRICO DE SESSÕES DE TRABALHO', margin, currentY);
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Início', 'Fim', 'Duração']],
      body: wo.workSessions.map(session => [
        format(new Date(session.startTime), "dd/MM/yyyy HH:mm"),
        format(new Date(session.endTime), "dd/MM/yyyy HH:mm"),
        `${session.duration}h`
      ]),
      foot: [[
        'TOTAL TRABALHADO',
        '',
        `${wo.totalWorkedHours || 0}h`
      ]],
      theme: 'striped',
      headStyles: { fillColor: [50, 50, 50] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // Worked Hours per Technician Summary
  if (wo.workSessions && wo.workSessions.length > 0) {
    const techHoursMap: Record<string, number> = {};
    wo.workSessions.forEach(session => {
      session.technicianIds?.forEach(techId => {
        techHoursMap[techId] = (techHoursMap[techId] || 0) + session.duration;
      });
    });

    const techWorkedSummary = Object.entries(techHoursMap).map(([id, hours]) => {
      const tech = technicians.find(t => t.id === id);
      if (options.includeDetails) {
        const hourlyRate = tech?.defaultLaborHourValue || 0;
        const totalValue = hours * hourlyRate;
        return [
          tech?.name || 'Técnico Desconhecido',
          `${hours.toFixed(2)}h`,
          `R$ ${hourlyRate.toFixed(2)}`,
          `R$ ${totalValue.toFixed(2)}`
        ];
      }
      return [tech?.name || 'Técnico Desconhecido', `${hours.toFixed(2)}h`];
    });

    if (techWorkedSummary.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL DE HORAS POR TÉCNICO', margin, currentY);
      
      autoTable(doc, {
        startY: currentY + 5,
        head: options.includeDetails 
          ? [['Técnico', 'Total Horas', 'Valor Hora', 'Total a Pagar']]
          : [['Técnico', 'Total Horas']],
        body: techWorkedSummary,
        theme: 'striped',
        headStyles: { fillColor: [60, 60, 60] }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }
  }

  // Technician Detailed Work (from Budget)
  if (options.includeDetails && wo.technicianDetails && wo.technicianDetails.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALHAMENTO DE MÃO DE OBRA', margin, currentY);
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Técnico', 'Horas', 'Vlr Hora', 'Total']],
      body: wo.technicianDetails.map(t => [
        t.name,
        `${t.hours}h`,
        `R$ ${t.laborRate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${(t.hours * t.laborRate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]),
      foot: [[
        'TOTAL MÃO DE OBRA',
        '',
        '',
        `R$ ${wo.technicianDetails.reduce((sum, t) => sum + (t.hours * t.laborRate), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]],
      theme: 'striped',
      headStyles: { fillColor: [100, 100, 100] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALHAMENTO DE DESLOCAMENTO', margin, currentY);
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Técnico', 'KM', 'Vlr KM', 'Total']],
      body: wo.technicianDetails.map(t => [
        t.name,
        `${t.km || 0} km`,
        `R$ ${(t.kmValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${((t.km || 0) * (t.kmValue || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]),
      foot: [[
        'TOTAL DESLOCAMENTO',
        '',
        '',
        `R$ ${wo.technicianDetails.reduce((sum, t) => sum + ((t.km || 0) * (t.kmValue || 0)), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]],
      theme: 'striped',
      headStyles: { fillColor: [100, 100, 100] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Technicians responsible (Original selection)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TÉCNICOS RESPONSÁVEIS', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const techNames = wo.technicianIds
    .map(id => technicians.find(t => t.id === id)?.name)
    .filter(Boolean)
    .join(', ');
  doc.text(techNames || 'Nenhum técnico atribuído', margin, currentY + 5);
  
  currentY += 25;
  
  // Signatures
  if (currentY + 40 > 280) {
    doc.addPage();
    currentY = 20;
  }
  
  doc.line(margin, currentY + 20, margin + 70, currentY + 20);
  doc.text('Assinatura do Técnico', margin + 35, currentY + 25, { align: 'center' });
  
  doc.line(pageWidth - margin - 70, currentY + 20, pageWidth - margin, currentY + 20);
  doc.text('Assinatura do Cliente', pageWidth - margin - 35, currentY + 25, { align: 'center' });
  
  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Página ${i} de ${pageCount}`,
      pageWidth / 2,
      285,
      { align: 'center' }
    );
  }
  
  doc.save(`OS_${wo.workOrderNumber}_${(customer?.name || 'Cliente').replace(/\s+/g, '_')}.pdf`);
};
