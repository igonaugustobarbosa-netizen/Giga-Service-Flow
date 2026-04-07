import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ServiceOrder, Customer, Technician, Supplier, Part } from '../types';

export const generateServicePDF = (
  order: ServiceOrder,
  customer: Customer,
  technicians: Technician[],
  supplier?: Supplier
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let y = 20;

  // Helper for drawing section boxes
  const drawSectionBox = (startY: number, height: number, title: string) => {
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, startY, contentWidth, 8, 'F');
    doc.rect(margin, startY, contentWidth, height);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(title, margin + 3, startY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
  };

  // Header
  doc.setFillColor(41, 128, 185); // Primary blue
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEM DE SERVIÇO', margin, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`OS Nº: ${order.orderNumber || order.id.substring(0, 8).toUpperCase()}`, margin, 32);
  doc.text(`Data: ${format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}`, pageWidth - margin - 45, 25);
  
  y = 50;

  // Customer Section
  const customerBoxHeight = 30;
  drawSectionBox(y, customerBoxHeight, 'DADOS DO CLIENTE');
  doc.setFontSize(10);
  doc.text(`Nome: ${customer.name}`, margin + 5, y + 15);
  doc.text(`Telefone: ${customer.phone}`, margin + 5, y + 22);
  if (customer.email) doc.text(`Email: ${customer.email}`, margin + 80, y + 22);
  if (customer.address) doc.text(`Endereço: ${customer.address}`, margin + 5, y + 29);
  
  y += customerBoxHeight + 10;

  // Supplier Section (if exists)
  if (supplier) {
    const supplierBoxHeight = 30;
    drawSectionBox(y, supplierBoxHeight, 'FORNECEDOR');
    doc.text(`Nome: ${supplier.name}`, margin + 5, y + 15);
    doc.text(`Telefone: ${supplier.phone}`, margin + 5, y + 22);
    if (supplier.taxId) doc.text(`CNPJ: ${supplier.taxId}`, margin + 80, y + 22);
    if (supplier.address) doc.text(`Endereço: ${supplier.address}`, margin + 5, y + 29);
    y += supplierBoxHeight + 10;
  }

  // Service Description
  const splitDescription = doc.splitTextToSize(order.description, contentWidth - 10);
  const descHeight = (splitDescription.length * 6) + 15;
  drawSectionBox(y, descHeight, 'DESCRIÇÃO DO SERVIÇO');
  doc.text(splitDescription, margin + 5, y + 15);
  y += descHeight + 10;

  // Technicians
  drawSectionBox(y, 15, 'TÉCNICOS RESPONSÁVEIS');
  doc.text(technicians.map(t => t.name).join(', '), margin + 5, y + 13);
  y += 25;

  // Parts Table
  if (order.parts.length > 0) {
    const tableHeaderY = y;
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, tableHeaderY, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('PEÇAS E MATERIAIS', margin + 3, tableHeaderY + 6);
    
    y += 15;
    doc.setFontSize(9);
    doc.text('Descrição', margin + 5, y);
    doc.text('Qtd', margin + 100, y);
    doc.text('V. Unitário', margin + 130, y);
    doc.text('Subtotal', margin + 165, y);
    
    y += 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;
    
    doc.setFont('helvetica', 'normal');
    order.parts.forEach((part: Part) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(part.name, margin + 5, y);
      doc.text(part.quantity.toString(), margin + 100, y);
      doc.text(`R$ ${part.price.toFixed(2)}`, margin + 130, y);
      doc.text(`R$ ${(part.quantity * part.price).toFixed(2)}`, margin + 165, y);
      y += 7;
    });
    y += 5;
  }

  // Financial Summary
  if (y > 230) { doc.addPage(); y = 20; }
  
  const summaryY = y;
  let summaryHeight = 45;
  
  // Increase summary height if PIX key or payment details are shown
  const showPix = order.paymentMethod === 'pix' && supplier?.pixKey;
  const showDetails = supplier?.paymentDetails;
  
  if (showPix || showDetails) {
    summaryHeight += 8;
  }
  
  drawSectionBox(summaryY, summaryHeight, 'RESUMO FINANCEIRO');
  
  const partsTotal = order.parts.reduce((acc, p) => acc + (p.quantity * p.price), 0);
  const kmTotal = order.kmDriven * order.kmValue;
  
  doc.setFontSize(10);
  doc.text('Total em Peças:', margin + 5, summaryY + 15);
  doc.text(`R$ ${partsTotal.toFixed(2)}`, pageWidth - margin - 5, summaryY + 15, { align: 'right' });
  
  doc.text(`Mão de Obra (${order.hoursWorked}h):`, margin + 5, summaryY + 22);
  doc.text(`R$ ${order.laborCost.toFixed(2)}`, pageWidth - margin - 5, summaryY + 22, { align: 'right' });
  
  doc.text(`Deslocamento (${order.kmDriven}km):`, margin + 5, summaryY + 29);
  doc.text(`R$ ${kmTotal.toFixed(2)}`, pageWidth - margin - 5, summaryY + 29, { align: 'right' });
  
  const getPaymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'pix': return 'PIX';
      case 'cash': return 'Dinheiro';
      case 'credit': return 'Cartão de Crédito';
      case 'debit': return 'Cartão de Débito';
      default: return 'Não informado';
    }
  };
  
  doc.setFont('helvetica', 'bold');
  doc.text('Forma de Pagamento:', margin + 5, summaryY + 38);
  doc.text(getPaymentMethodLabel(order.paymentMethod), margin + 45, summaryY + 38);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (showPix) {
    doc.text(`Chave PIX: ${supplier.pixKey}`, margin + 5, summaryY + 45);
  } else if (showDetails) {
    doc.text(`Info. Pagamento: ${supplier.paymentDetails}`, margin + 5, summaryY + 45);
  }
  
  y += summaryHeight + 5;

  // Total Highlight
  doc.setFillColor(41, 128, 185);
  doc.rect(margin, y, contentWidth, 12, 'F');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('VALOR TOTAL DA ORDEM:', margin + 5, y + 8);
  doc.text(`R$ ${order.totalValue.toFixed(2)}`, pageWidth - margin - 5, y + 8, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - ServiceFlow`, margin, doc.internal.pageSize.getHeight() - 10);

  doc.save(`OS_${order.id.substring(0, 8).toUpperCase()}_${customer.name.replace(/\s+/g, '_')}.pdf`);
};
