import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WorkOrder, Customer, Technician } from '../types';

export const generateWorkOrderReportPDF = (
  orders: WorkOrder[],
  customers: Customer[],
  technicians: Technician[],
  filters: {
    customerId: string;
    status: string;
    billingStatus: string;
    technicianId: string;
  }
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 20;

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const footerText = `Giga Elétrica | Página ${pageNum} de ${totalPages}`;
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
  };

  const companyName = 'Giga Elétrica';

  // Header
  doc.setFillColor(49, 46, 129); // Indigo-900 for a more premium look
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Serviços', margin, 18);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 255);
  doc.text(companyName, margin, 26);
  doc.text(`Fone: (43) 99611-8806`, margin, 31);
  
  doc.setFontSize(9);
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - margin, 31, { align: 'right' });

  y = 52;

  // Filters Summary
  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);
  doc.setFont('helvetica', 'bold');
  doc.text('FILTROS APLICADOS', margin, y);
  y += 5;
  
  const filterTexts = [];
  if (filters.status !== 'all') filterTexts.push(`Status: ${filters.status}`);
  if (filters.billingStatus !== 'all') filterTexts.push(`Cobrança: ${filters.billingStatus}`);
  if (filters.customerId !== 'all') {
    const c = customers.find(c => c.id === filters.customerId);
    if (c) filterTexts.push(`Cliente: ${c.name}`);
  }
  if (filters.technicianId !== 'all') {
    const t = technicians.find(t => t.id === filters.technicianId);
    if (t) filterTexts.push(`Técnico: ${t.name}`);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  if (filterTexts.length > 0) {
    doc.text(filterTexts.join('  •  '), margin, y);
    y += 12;
  } else {
    doc.text('Todos os registros selecionados', margin, y);
    y += 12;
  }

  // Table Header
  const tableHeaderHeight = 10;
  doc.setFillColor(79, 70, 229); // Indigo-600
  doc.rect(margin, y, pageWidth - (margin * 2), tableHeaderHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  
  const colOs = margin + 2;
  const colData = margin + 18;
  const colCliente = margin + 38;
  const colStatus = margin + 85;
  const colCobranca = margin + 105;
  const colHrs = margin + 130;
  const colKmIgon = margin + 150;
  const colValor = pageWidth - margin - 2;

  doc.text('Nº OS', colOs, y + 6.5);
  doc.text('Data', colData, y + 6.5);
  doc.text('Cliente', colCliente, y + 6.5);
  doc.text('Status', colStatus, y + 6.5);
  doc.text('Cobrança', colCobranca, y + 6.5);
  doc.text('Hrs.', colHrs, y + 6.5);
  doc.text('KM Igon', colKmIgon, y + 6.5);
  doc.text('Valor (R$)', colValor, y + 6.5, { align: 'right' });

  y += tableHeaderHeight;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  let totalValue = 0;
  let totalKmValue = 0;
  let totalIgonKmValue = 0;
  let totalPendingValue = 0;
  let totalKm = 0;
  let totalHours = 0;

  const techSummary: Record<string, { name: string; hours: number; laborValue: number; kmValue: number }> = {};

  orders.forEach((order, index) => {
    if (y > 275) {
      doc.addPage();
      // Draw a small header on new page
      doc.setFillColor(79, 70, 229);
      doc.rect(margin, 15, pageWidth - (margin * 2), 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Nº OS', colOs, 20);
      doc.text('Data', colData, 20);
      doc.text('Cliente', colCliente, 20);
      doc.text('Status', colStatus, 20);
      doc.text('Cobrança', colCobranca, 20);
      doc.text('Hrs.', colHrs, 20);
      doc.text('KM Igon', colKmIgon, 20);
      doc.text('Valor (R$)', colValor, 20, { align: 'right' });
      y = 28;
    }

    // Zebra striping
    if (index % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y - 5, pageWidth - (margin * 2), 8, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55); // Gray-800
    doc.setFontSize(8);

    const customerName = order.customerNameSnapshot || customers.find(c => c.id === order.customerId)?.name || 'N/A';
    const dateStr = format(new Date(order.scheduledDate.replace('Z', '')), 'dd/MM/yy');
    const statusLabel = 
      order.status === 'open' ? 'Aberta' : 
      order.status === 'in-progress' ? 'Em Andamento' : 
      'Encerrada';
    
    let orderHours = 0;
    let orderValue = 0;
    const billedSessions = order.workSessions?.filter(s => s.billed) || [];
    const pendingSessions = order.workSessions?.filter(s => !s.billed) || [];
    const totalSessions = order.workSessions?.length || 0;
    const billedCount = billedSessions.length;
    const billingLabel = `${billedCount}/${totalSessions}`;
    const isPending = pendingSessions.length > 0 || totalSessions === 0;

    // Helper to calculate session hours
    const calcSessionHours = (sessions: any[]) => sessions.reduce((acc, s) => acc + (s.duration || 0), 0);

    // Calculate specific values based on filters
    let workedHours = 0;
    if (filters.billingStatus === 'billed') {
      workedHours = calcSessionHours(billedSessions);
    } else if (filters.billingStatus === 'pending') {
      workedHours = calcSessionHours(pendingSessions);
    } else {
      workedHours = calcSessionHours(order.workSessions || []);
    }

    const orderTotalHours = order.totalWorkedHours || 0;

    // Filter sessions by technician if applicable
    const sessionsToSum = (filters.billingStatus === 'billed' ? billedSessions : 
                          filters.billingStatus === 'pending' ? pendingSessions : 
                          (order.workSessions || []))
                          .filter(s => filters.technicianId === 'all' || s.technicianIds?.includes(filters.technicianId));

    const isPartOfOsReport = filters.technicianId === 'all' || order.technicianIds?.includes(filters.technicianId);
    const anySessionsBilledReport = order.workSessions && order.workSessions.some(s => s.billed);
    const noSessionsBilledReport = !order.workSessions || order.workSessions.length === 0 || !order.workSessions.some(s => s.billed);

    // Calculate base KM value based on tech details or legacy fields
    let baseKmValueReport = 0;
    let baseIgonKmValueReport = 0;
    if (filters.technicianId !== 'all') {
      const tech = technicians.find(t => t.id === filters.technicianId);
      const isIgon = tech?.name?.toLowerCase().includes('igon');
      
      const techDetail = order.technicianDetails?.find(td => td.technicianId === filters.technicianId);
      const val = techDetail ? techDetail.km * techDetail.kmValue : (order.kmTotalValue || ((order.kmDriven || 0) * (order.kmRate || 0)));

      if (isIgon) {
        baseIgonKmValueReport = val;
        baseKmValueReport = 0;
      } else {
        baseKmValueReport = val;
        baseIgonKmValueReport = 0;
      }
    } else {
      if (order.technicianDetails && order.technicianDetails.length > 0) {
        order.technicianDetails.forEach(td => {
          const tech = technicians.find(t => t.id === td.technicianId);
          const isIgon = tech?.name?.toLowerCase().includes('igon');
          const val = td.km * td.kmValue;
          if (isIgon) baseIgonKmValueReport += val;
          else baseKmValueReport += val;
        });
      } else {
        const primaryTechId = order.technicianIds?.[0];
        const primaryTech = technicians.find(t => t.id === primaryTechId);
        const isIgonPrimary = primaryTech?.name?.toLowerCase().includes('igon');
        
        const val = order.kmTotalValue || ((order.kmDriven || 0) * (order.kmRate || 0));
        if (isIgonPrimary) {
          baseIgonKmValueReport = val;
          baseKmValueReport = 0;
        } else {
          baseKmValueReport = val;
          baseIgonKmValueReport = 0;
        }
      }
    }

    let kmValueToInclude = 0;
    let igonKmValueToInclude = 0;
    if (isPartOfOsReport) {
      if (filters.billingStatus === 'all') {
        kmValueToInclude = baseKmValueReport;
        igonKmValueToInclude = baseIgonKmValueReport;
      } else if (filters.billingStatus === 'billed' && anySessionsBilledReport) {
        kmValueToInclude = baseKmValueReport;
        igonKmValueToInclude = baseIgonKmValueReport;
      } else if (filters.billingStatus === 'pending' && noSessionsBilledReport) {
        kmValueToInclude = baseKmValueReport;
        igonKmValueToInclude = baseIgonKmValueReport;
      }
    }

    if (filters.technicianId !== 'all') {
      workedHours = calcSessionHours(sessionsToSum);
      const rate = order.technicianDetails?.find(td => td.technicianId === filters.technicianId)?.laborRate || 
                   technicians.find(t => t.id === filters.technicianId)?.defaultLaborHourValue || 0;
      orderValue = (workedHours * rate) + kmValueToInclude + igonKmValueToInclude;
    } else {
      // For all techs, sum up their individual labor portions
      orderValue = sessionsToSum.reduce((acc, s) => {
        const h = s.duration || 0;
        const sessionLabor = (s.technicianIds || []).reduce((sAcc: number, tId: string) => {
          const r = order.technicianDetails?.find(td => td.technicianId === tId)?.laborRate || 
                    technicians.find(t => t.id === tId)?.defaultLaborHourValue || 0;
          return sAcc + (h * r);
        }, 0);
        return acc + sessionLabor;
      }, 0) + kmValueToInclude + igonKmValueToInclude;
    }

    // Collect summary for technicians
    order.technicianDetails?.forEach(td => {
      // Only summarize if no filter or matches filter
      if (filters.technicianId !== 'all' && td.technicianId !== filters.technicianId) return;

      const t = technicians.find(tech => tech.id === td.technicianId);
      if (t) {
        if (!techSummary[td.technicianId]) {
          techSummary[td.technicianId] = { name: t.name, hours: 0, laborValue: 0, kmValue: 0 };
        }
        const techSessions = (order.workSessions || []).filter(s => s.technicianIds?.includes(td.technicianId));
        const h = calcSessionHours(techSessions);
        techSummary[td.technicianId].hours += h;
        techSummary[td.technicianId].laborValue += (h * td.laborRate);
        
        // Attribute KM to primary technician in the summary to avoid double counting for 'all' report
        // But if filtering by tech, always attribute to that tech if they are in the OS
        const isPrimary = order.technicianIds && order.technicianIds[0] === td.technicianId;
        const isIgon = t.name?.toLowerCase().includes('igon');
        
        if (filters.technicianId !== 'all' || isPrimary) {
          if (isIgon) {
            techSummary[td.technicianId].kmValue += igonKmValueToInclude;
          } else {
            techSummary[td.technicianId].kmValue += kmValueToInclude;
          }
        }
      }
    });
    
    doc.text(order.workOrderNumber, colOs, y);
    doc.text(dateStr, colData, y);
    doc.text(customerName.substring(0, 32), colCliente, y);
    
    // Status color
    if (order.status === 'open') doc.setTextColor(79, 70, 229);
    else if (order.status === 'in-progress') doc.setTextColor(245, 158, 11);
    else doc.setTextColor(16, 185, 129);
    doc.text(statusLabel, colStatus, y);
    
    doc.setTextColor(31, 41, 55);
    doc.text(billingLabel, colCobranca, y);
    doc.text(`${workedHours.toFixed(1)}h`, colHrs, y);
    doc.text(igonKmValueToInclude > 0 ? `R$ ${igonKmValueToInclude.toFixed(2)}` : '-', colKmIgon, y);

    doc.setFont('helvetica', 'bold');
    doc.text(orderValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), colValor, y, { align: 'right' });

    const laborOnlyValue = orderValue - kmValueToInclude - igonKmValueToInclude;
    totalValue += laborOnlyValue;
    totalKmValue += kmValueToInclude;
    totalIgonKmValue += igonKmValueToInclude;
    if (isPending) totalPendingValue += laborOnlyValue;
    totalKm += order.kmDriven || 0;
    totalHours += workedHours;
    y += 8;
  });

  y += 10;

  if (Object.keys(techSummary).length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text('RESUMO POR TÉCNICO', margin, y);
    y += 6;
    
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    
    doc.setFontSize(9);
    Object.values(techSummary).forEach((s: any, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, y - 4, pageWidth - (margin * 2), 6, 'F');
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text(s.name, margin + 2, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${s.hours.toFixed(1)}h`, margin + 65, y);
      doc.text(`MO: R$ ${s.laborValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 85, y);
      doc.text(`KM: R$ ${(s.kmValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 125, y);
      
      const total = s.laborValue + (s.kmValue || 0);
      doc.setFont('helvetica', 'bold');
      doc.text(`R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - margin - 2, y, { align: 'right' });
      y += 6;
    });
    y += 12;
  }

  if (y > 230) {
    doc.addPage();
    y = 20;
  }

  // Summary Card
  const summaryBoxHeight = 35;
  doc.setFillColor(243, 244, 246); // Gray-100
  doc.rect(margin, y, pageWidth - (margin * 2), summaryBoxHeight, 'F');
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin, y + summaryBoxHeight);
  
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.setFont('helvetica', 'bold');
  
  const labelY1 = y + 8;
  const labelY2 = y + 18;
  const labelY3 = y + 30;

  doc.text(`TOTAL DE OS:`, margin + 5, labelY1);
  doc.setFont('helvetica', 'normal');
  doc.text(`${orders.length}`, margin + 35, labelY1);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`VALOR MO:`, margin + 65, labelY1);
  doc.setFont('helvetica', 'normal');
  doc.text(`R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 90, labelY1);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`KM EQUIPE:`, margin + 125, labelY1);
  doc.setFont('helvetica', 'normal');
  doc.text(`R$ ${totalKmValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 155, labelY1);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`HRS. TRAB:`, margin + 5, labelY2);
  doc.setFont('helvetica', 'normal');
  doc.text(`${totalHours.toFixed(1)}h`, margin + 35, labelY2);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`PENDENTE:`, margin + 65, labelY2);
  doc.setFont('helvetica', 'normal');
  doc.text(`R$ ${totalPendingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 90, labelY2);

  doc.setFont('helvetica', 'bold');
  doc.text(`KM IGON (DIÁRIO):`, margin + 125, labelY2);
  doc.setFont('helvetica', 'normal');
  doc.text(`R$ ${totalIgonKmValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 165, labelY2);
  
  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL GERAL:', margin + 5, labelY3);
  doc.text(`R$ ${(totalValue + totalKmValue + totalIgonKmValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, labelY3, { align: 'right' });

  // Final Footer
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  doc.save(`Relatorio_OS_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
};
