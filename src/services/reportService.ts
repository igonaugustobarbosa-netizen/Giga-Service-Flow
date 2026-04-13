import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ServiceOrder, Customer, Supplier } from '../types';

export const generateReportPDF = (
  orders: ServiceOrder[],
  customers: Customer[],
  suppliers: Supplier[],
  filters: {
    status?: string;
    startDate?: string;
    endDate?: string;
    customerId?: string;
    supplierId?: string;
  }
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  // Header
  doc.setFillColor(41, 128, 185);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE FATURAMENTO', margin, 22);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, 30);

  y = 45;

  // Filters Summary
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Filtros aplicados:', margin, y);
  y += 6;
  
  const filterTexts = [];
  if (filters.status) filterTexts.push(`Status: ${filters.status}`);
  if (filters.startDate) filterTexts.push(`De: ${format(new Date(filters.startDate), 'dd/MM/yyyy')}`);
  if (filters.endDate) filterTexts.push(`Até: ${format(new Date(filters.endDate), 'dd/MM/yyyy')}`);
  if (filters.customerId) {
    const c = customers.find(c => c.id === filters.customerId);
    if (c) filterTexts.push(`Cliente: ${c.name}`);
  }
  if (filters.supplierId) {
    const s = suppliers.find(s => s.id === filters.supplierId);
    if (s) filterTexts.push(`Fornecedor: ${s.name}`);
  }

  if (filterTexts.length > 0) {
    doc.setFontSize(8);
    doc.text(filterTexts.join(' | '), margin, y);
    y += 10;
  } else {
    doc.setFontSize(8);
    doc.text('Nenhum filtro aplicado (Todos os registros)', margin, y);
    y += 10;
  }

  // Table Header
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  
  doc.text('Nº OS', margin + 2, y + 6);
  doc.text('Data Exec.', margin + 20, y + 6);
  doc.text('Cliente', margin + 45, y + 6);
  doc.text('Status', margin + 110, y + 6);
  doc.text('Valor (R$)', pageWidth - margin - 2, y + 6, { align: 'right' });

  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  let totalBilling = 0;

  orders.forEach((order) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
      // Repeat header on new page if needed, but let's keep it simple for now
    }

    const customer = customers.find(c => c.id === order.customerId);
    const dateToDisplay = order.executionDate || order.createdAt;
    const dateStr = format(new Date(dateToDisplay.replace('Z', '')), 'dd/MM/yy');
    const statusLabel = 
      order.status === 'budget' ? 'Orçamento' : 
      order.status === 'in-progress' ? 'Em Aberto' : 
      order.status === 'closed' ? 'Fechada' :
      order.status === 'paid' ? 'Faturada Paga' :
      'Aguardando Pagamento';
    
    doc.text(order.orderNumber || order.id.substring(0, 5), margin + 2, y);
    doc.text(dateStr, margin + 20, y);
    doc.text(customer?.name.substring(0, 30) || 'N/A', margin + 45, y);
    doc.text(statusLabel, margin + 110, y);
    doc.text(order.totalValue.toFixed(2), pageWidth - margin - 2, y, { align: 'right' });

    totalBilling += order.totalValue;
    y += 7;
    
    // Draw a very light line
    doc.setDrawColor(245, 245, 245);
    doc.line(margin, y - 5, pageWidth - margin, y - 5);
  });

  y += 10;

  // Summary Box
  if (!filters.status && orders.length > 0) {
    const breakdown = {
      budget: orders.filter(o => o.status === 'budget').reduce((acc, o) => acc + o.totalValue, 0),
      'in-progress': orders.filter(o => o.status === 'in-progress').reduce((acc, o) => acc + o.totalValue, 0),
      closed: orders.filter(o => o.status === 'closed').reduce((acc, o) => acc + o.totalValue, 0),
      paid: orders.filter(o => o.status === 'paid').reduce((acc, o) => acc + o.totalValue, 0),
      'pending-payment': orders.filter(o => o.status === 'pending-payment').reduce((acc, o) => acc + o.totalValue, 0),
    };

    if (y > 220) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('RESUMO POR STATUS:', margin, y);
    y += 7;

    const statusRows = [
      { label: 'Orçamentos:', value: breakdown.budget },
      { label: 'Em Andamento:', value: breakdown['in-progress'] },
      { label: 'Fechadas:', value: breakdown.closed },
      { label: 'Faturadas Pagas:', value: breakdown.paid },
      { label: 'Aguardando Pagamento:', value: breakdown['pending-payment'] },
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    statusRows.forEach(row => {
      doc.text(row.label, margin + 5, y);
      doc.text(`R$ ${row.value.toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' });
      y += 6;
    });

    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y - 2, pageWidth - margin, y - 2);
  }

  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor(41, 128, 185);
  doc.rect(margin, y, pageWidth - (margin * 2), 15, 'F');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBTOTAL GERAL:', margin + 5, y + 10);
  doc.text(`R$ ${totalBilling.toFixed(2)}`, pageWidth - margin - 5, y + 10, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('ServiceFlow - Sistema de Gestão de Serviços', margin, doc.internal.pageSize.getHeight() - 10);

  doc.save(`Relatorio_Faturamento_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
};
