import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
    technicianIds: string[];
    groupByTech?: boolean;
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
  doc.setFillColor(49, 46, 129); // Indigo-900
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

  y = 50;

  // Filters Summary
  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);
  doc.setFont('helvetica', 'bold');
  doc.text('FILTROS APLICADOS', margin, y);
  y += 6;
  
  const filterTexts = [];
  if (filters.status !== 'all') filterTexts.push(`Status: ${filters.status === 'open' ? 'Aberta' : filters.status === 'in-progress' ? 'Em Andamento' : 'Encerrada'}`);
  if (filters.billingStatus !== 'all') filterTexts.push(`Cobrança: ${filters.billingStatus === 'billed' ? 'Cobrado' : 'Pendente'}`);
  if (filters.customerId !== 'all') {
    const c = customers.find(c => c.id === filters.customerId);
    if (c) filterTexts.push(`Cliente: ${c.name}`);
  }
  if (filters.technicianIds.length > 0 && !filters.technicianIds.includes('all')) {
    if (filters.groupByTech) {
      filterTexts.push(`Técnicos: (Vários Selecionados)`);
    } else {
      const selectedTechNames = technicians
        .filter(t => filters.technicianIds.includes(t.id))
        .map(t => t.name)
        .join(', ');
      if (selectedTechNames) filterTexts.push(`Técnicos: ${selectedTechNames}`);
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  if (filterTexts.length > 0) {
    const splitFilters = doc.splitTextToSize(filterTexts.join('  •  '), pageWidth - 2 * margin);
    doc.text(splitFilters, margin, y);
    y += (splitFilters.length * 4) + 6;
  } else {
    doc.text('Todos os registros selecionados', margin, y);
    y += 10;
  }

  let totalValue = 0;
  let totalKmValue = 0;
  let totalIgonKmValue = 0;
  let totalPendingValue = 0;
  let totalKm = 0;
  let totalHours = 0;

  const techSummary: Record<string, { name: string; hours: number; laborValue: number; kmValue: number }> = {};

  const tableBody = orders.map((order) => {
    const customerName = order.customerNameSnapshot || customers.find(c => c.id === order.customerId)?.name || 'N/A';
    const dateStr = format(new Date(order.scheduledDate), 'dd/MM/yy');
    const statusLabel = 
      order.status === 'open' ? 'Aberta' : 
      order.status === 'in-progress' ? 'Em Andamento' : 
      'Encerrada';
    
    const billedSessions = order.workSessions?.filter(s => s.billed) || [];
    const pendingSessions = order.workSessions?.filter(s => !s.billed) || [];
    const totalSessions = order.workSessions?.length || 0;
    const billedCount = billedSessions.length;
    const billingLabel = `${billedCount}/${totalSessions}`;
    const isPending = pendingSessions.length > 0 || totalSessions === 0;

    const calcSessionHours = (sessions: any[]) => sessions.reduce((acc, s) => acc + (s.duration || 0), 0);

    let workedHours = 0;
    if (filters.billingStatus === 'billed') {
      workedHours = calcSessionHours(billedSessions);
    } else if (filters.billingStatus === 'pending') {
      workedHours = calcSessionHours(pendingSessions);
    } else {
      workedHours = calcSessionHours(order.workSessions || []);
    }

    const isAllTechs = filters.technicianIds.includes('all') || filters.technicianIds.length === 0;
    const sessionsToSum = (filters.billingStatus === 'billed' ? billedSessions : 
                          filters.billingStatus === 'pending' ? pendingSessions : 
                          (order.workSessions || []))
                          .filter(s => isAllTechs || (s.technicianIds || []).some(tId => filters.technicianIds.includes(tId)));

    const isPartOfOsReport = isAllTechs || (order.technicianIds || []).some(tId => filters.technicianIds.includes(tId));
    const anySessionsBilledReport = order.workSessions && order.workSessions.some(s => s.billed);
    const noSessionsBilledReport = !order.workSessions || order.workSessions.length === 0 || !order.workSessions.some(s => s.billed);

    // KM Calculation
    const uniqueDays = new Set((order.workSessions || []).map(s => {
      try {
        return format(new Date(s.startTime), 'yyyy-MM-dd');
      } catch (e) {
        return 'invalid-date';
      }
    })).size;
    
    const baseDailyKm = order.dailyKmOverride || (order.kmDriven && uniqueDays > 0 ? (order.kmDriven / uniqueDays) : (order.estimatedKm || 0));
    const sessionKmValue = uniqueDays > 0 ? (baseDailyKm * (order.kmRate || 0)) : 0;
    
    // totalValue for the OS
    const estimatedTotalKmValue = (uniqueDays * sessionKmValue);
    const totalKmVal = order.kmTotalValue || estimatedTotalKmValue;

    let baseKmValueReport = 0;
    let baseIgonKmValueReport = 0;
    
    // session (daily) values for report
    let sessionKmValueReport = 0;
    let sessionIgonKmValueReport = 0;
    
    const kmRecipientDetail = order.technicianDetails?.find(td => td.receivesKm);
    const effectiveKmRecipientId = kmRecipientDetail ? kmRecipientDetail.technicianId : order.technicianIds?.[0];
    const kmRecipientTech = technicians.find(t => t.id === effectiveKmRecipientId);
    const isIgonRecipient = kmRecipientTech?.name?.toLowerCase().includes('igon');

    const isRecipientFiltered = isAllTechs || (effectiveKmRecipientId && filters.technicianIds.includes(effectiveKmRecipientId));

    if (!isAllTechs) {
      if (isRecipientFiltered) {
        if (isIgonRecipient) { 
          baseIgonKmValueReport = totalKmVal; 
          sessionIgonKmValueReport = sessionKmValue;
        } else { 
          baseKmValueReport = totalKmVal; 
          sessionKmValueReport = sessionKmValue;
        }
      }
    } else {
      if (isIgonRecipient) { 
        baseIgonKmValueReport = totalKmVal; 
        sessionIgonKmValueReport = sessionKmValue;
      } else { 
        baseKmValueReport = totalKmVal; 
        sessionKmValueReport = sessionKmValue;
      }
    }

    let kmValueToInclude = 0;
    let igonKmValueToInclude = 0;
    let sessionKmToInclude = 0;
    let sessionIgonKmToInclude = 0;

    if (isPartOfOsReport) {
      if (filters.billingStatus === 'all' || 
         (filters.billingStatus === 'billed' && anySessionsBilledReport) ||
         (filters.billingStatus === 'pending' && noSessionsBilledReport)) {
        kmValueToInclude = baseKmValueReport;
        igonKmValueToInclude = baseIgonKmValueReport;
        sessionKmToInclude = sessionKmValueReport;
        sessionIgonKmToInclude = sessionIgonKmValueReport;
      }
    }

    let orderTotalValue = 0;
    let orderDailyValue = 0;
    const labor = sessionsToSum.reduce((acc, s) => {
      const h = s.duration || 0;
      const sessionLabor = (s.technicianIds || []).reduce((sAcc: number, tId: string) => {
        // Only include labor for technicians selected in the filter
        if (!isAllTechs && !filters.technicianIds.includes(tId)) return sAcc;

        const r = order.technicianDetails?.find(td => td.technicianId === tId)?.laborRate || 
                  technicians.find(t => t.id === tId)?.defaultLaborHourValue || 0;
        return sAcc + (h * r);
      }, 0);
      return acc + sessionLabor;
    }, 0);

    orderTotalValue = labor + kmValueToInclude + igonKmValueToInclude;
    orderDailyValue = labor + sessionKmToInclude + sessionIgonKmToInclude;
    
    // Update workedHours for the row to reflect only selected technicians
    workedHours = sessionsToSum.reduce((acc, s) => {
      const techCount = (s.technicianIds || []).filter(tId => isAllTechs || filters.technicianIds.includes(tId)).length;
      return acc + (s.duration || 0) * (isAllTechs ? (s.technicianIds || []).length : techCount);
    }, 0);

    // Update tech summary (we'll keep using totals for the summary section of the PDF)
    order.technicianDetails?.forEach(td => {
      if (!isAllTechs && !filters.technicianIds.includes(td.technicianId)) return;
      const t = technicians.find(tech => tech.id === td.technicianId);
      if (t) {
        if (!techSummary[td.technicianId]) {
          techSummary[td.technicianId] = { name: t.name, hours: 0, laborValue: 0, kmValue: 0 };
        }
        const techSessions = (order.workSessions || []).filter(s => s.technicianIds?.includes(td.technicianId));
        const h = calcSessionHours(techSessions);
        techSummary[td.technicianId].hours += h;
        techSummary[td.technicianId].laborValue += (h * td.laborRate);
        const isPrimary = order.technicianIds && order.technicianIds[0] === td.technicianId;
        const isRecipient = td.receivesKm || (isAllTechs && !order.technicianDetails?.some(d => d.receivesKm) && isPrimary);
        const isIgon = t.name?.toLowerCase().includes('igon');
        if (!isAllTechs ? (td.technicianId === effectiveKmRecipientId) : isRecipient) {
          if (isIgon) techSummary[td.technicianId].kmValue += igonKmValueToInclude;
          else techSummary[td.technicianId].kmValue += kmValueToInclude;
        }
      }
    });

    const laborOnlyValue = orderTotalValue - kmValueToInclude - igonKmValueToInclude;
    totalValue += laborOnlyValue;
    totalKmValue += kmValueToInclude;
    totalIgonKmValue += igonKmValueToInclude;
    if (isPending) totalPendingValue += laborOnlyValue;
    totalKm += order.kmDriven || 0;
    totalHours += workedHours;

    return [
      order.workOrderNumber,
      dateStr,
      customerName,
      statusLabel,
      billingLabel,
      `${workedHours.toFixed(1)}h`,
      sessionIgonKmToInclude > 0 ? `R$ ${sessionIgonKmToInclude.toFixed(2)}` : '-',
      orderDailyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Nº OS', 'Data', 'Cliente', 'Status', 'Cobrança', 'Hrs.', 'KM Igon (Dia)', 'Valor Dia (R$)']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 15 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 20 },
      4: { cellWidth: 15 },
      5: { cellWidth: 12 },
      6: { cellWidth: 20 },
      7: { halign: 'right', cellWidth: 25 }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const val = data.cell.raw as string;
        if (val === 'Aberta') data.cell.styles.textColor = [79, 70, 229];
        else if (val === 'Em Andamento') data.cell.styles.textColor = [245, 158, 11];
        else if (val === 'Encerrada') data.cell.styles.textColor = [16, 185, 129];
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // Tech Summary Table
  if (Object.keys(techSummary).length > 0) {
    if (y + 30 > pageHeight - margin) { doc.addPage(); y = margin; }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text('RESUMO POR TÉCNICO', margin, y);
    y += 6;
    
    let techTableBody: any[] = [];

    if (filters.groupByTech) {
      const summary = Object.values(techSummary).reduce((acc, s) => {
        acc.hours += s.hours;
        acc.laborValue += s.laborValue;
        acc.kmValue += s.kmValue;
        return acc;
      }, { hours: 0, laborValue: 0, kmValue: 0 });

      const total = summary.laborValue + (summary.kmValue || 0);
      techTableBody = [[
        'Técnicos',
        `${summary.hours.toFixed(1)}h`,
        `R$ ${summary.laborValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${(summary.kmValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]];
    } else {
      techTableBody = Object.values(techSummary).map((s: any) => {
        const total = s.laborValue + (s.kmValue || 0);
        return [
          s.name,
          `${s.hours.toFixed(1)}h`,
          `R$ ${s.laborValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `R$ ${(s.kmValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ];
      });
    }

    autoTable(doc, {
      startY: y,
      head: [['Técnico', 'Horas', 'Mão de Obra', 'KM', 'Total']],
      body: techTableBody,
      theme: 'striped',
      headStyles: { fillColor: [55, 65, 81], fontSize: 9 },
      styles: { fontSize: 8 },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' }
      }
    });
    
    y = (doc as any).lastAutoTable.finalY + 15;
  }

  // Final Summary Card
  if (y + 50 > pageHeight - margin) { doc.addPage(); y = margin; }

  const summaryBoxHeight = 40;
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, pageWidth - (margin * 2), summaryBoxHeight, 'F');
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin, y + summaryBoxHeight);
  
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  
  const col1 = margin + 5;
  const col2 = margin + 65;
  const col3 = margin + 125;
  
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL DE OS:', col1, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${orders.length}`, col1 + 25, y + 10);
  
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR MO:', col2, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(`R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, col2 + 25, y + 10);
  
  doc.setFont('helvetica', 'bold');
  doc.text('KM EQUIPE:', col3, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(`R$ ${totalKmValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, col3 + 25, y + 10);
  
  doc.setFont('helvetica', 'bold');
  doc.text('HRS. TRAB:', col1, y + 20);
  doc.setFont('helvetica', 'normal');
  doc.text(`${totalHours.toFixed(1)}h`, col1 + 25, y + 20);
  
  doc.setFont('helvetica', 'bold');
  doc.text('PENDENTE:', col2, y + 20);
  doc.setFont('helvetica', 'normal');
  doc.text(`R$ ${totalPendingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, col2 + 25, y + 20);

  doc.setFont('helvetica', 'bold');
  doc.text('KM IGON (DIÁRIO):', col3, y + 20);
  doc.setFont('helvetica', 'normal');
  doc.text(`R$ ${totalIgonKmValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, col3 + 35, y + 20);
  
  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL GERAL:', col1, y + 32);
  doc.text(`R$ ${(totalValue + totalKmValue + totalIgonKmValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, y + 32, { align: 'right' });

  // Add Page Numbers
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  doc.save(`Relatorio_OS_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
};
