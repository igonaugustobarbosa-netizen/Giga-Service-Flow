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
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  
  // Header with title bar
  doc.setFillColor(41, 128, 185); // Professional Blue
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEM DE SERVIÇO', margin, 17);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº: ${wo.workOrderNumber}`, pageWidth - margin, 12, { align: 'right' });
  doc.text(`Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - margin, 18, { align: 'right' });

  // Info Section
  doc.setTextColor(40, 40, 40);
  
  // 1. PROVIDER BLOCK (Left)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PRESTADOR DE SERVIÇO', margin, 35);
  
  doc.setFontSize(10);
  doc.text(settings?.companyName || 'Empresa de Serviços', margin, 41);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  let providerY = 46;
  if (settings?.companyTaxId) {
    doc.text(`CNPJ/CPF: ${settings.companyTaxId}`, margin, providerY);
    providerY += 4;
  }
  if (settings?.companyAddress) {
    const splitAddr = doc.splitTextToSize(`End: ${settings.companyAddress}`, (pageWidth / 2) - margin - 5);
    doc.text(splitAddr, margin, providerY);
    providerY += (splitAddr.length * 4);
  }

  // 2. CUSTOMER BLOCK (Right)
  const customerX = (pageWidth / 2) + 5;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', customerX, 35);
  
  doc.setFontSize(10);
  doc.text(customer?.name || wo.customerNameSnapshot || 'Não informado', customerX, 41);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  let customerY = 46;
  if (customer?.phone) {
    doc.text(`Fone: ${customer.phone}`, customerX, customerY);
    customerY += 4;
  }
  if (customer?.address) {
    const splitCustAddr = doc.splitTextToSize(`End: ${customer.address}`, pageWidth - margin - customerX);
    doc.text(splitCustAddr, customerX, customerY);
    customerY += (splitCustAddr.length * 4);
  }

  // Supplier info if exists
  let supplierY = 0;
  if (wo.supplierNameSnapshot) {
    supplierY = Math.max(providerY, customerY) + 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('FORNECEDOR', margin, supplierY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(wo.supplierNameSnapshot, margin, supplierY + 6);
    supplierY += 12;
  }

  const separatorY = Math.max(providerY, customerY, supplierY) + 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, separatorY, pageWidth - margin, separatorY);
  
  // Service Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const serviceInfoY = separatorY + 10;
  doc.text('DESCRIÇÃO DO SERVIÇO', margin, serviceInfoY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const splitDescription = doc.splitTextToSize(wo.description, pageWidth - 2 * margin);
  doc.text(splitDescription, margin, serviceInfoY + 6);
  
  let currentY = serviceInfoY + 6 + (splitDescription.length * 5) + 8;
  
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
      head: [['Início', 'Fim', 'Duração', 'Procedimento']],
      body: wo.workSessions.map(session => [
        format(new Date(session.startTime), "dd/MM/yyyy HH:mm"),
        format(new Date(session.endTime), "dd/MM/yyyy HH:mm"),
        `${session.duration}h`,
        session.description || '-'
      ]),
      foot: [[
        'TOTAL TRABALHADO',
        '',
        `${wo.totalWorkedHours || 0}h`,
        ''
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
    const footerText = `${settings?.companyName || 'ServiceFlow'} | Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Página ${i} de ${pageCount}`;
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }
  
  doc.save(`OS_${wo.workOrderNumber}_${(customer?.name || 'Cliente').replace(/\s+/g, '_')}.pdf`);
};
