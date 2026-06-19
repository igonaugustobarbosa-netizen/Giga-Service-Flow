import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ServiceOrder, Customer, Technician, Supplier, Part, Settings } from '../types';

export const generateCommercialProposalPDF = (
  order: ServiceOrder,
  customer?: Customer,
  technicians: Technician[] = [],
  supplier?: Supplier,
  settings?: Settings | null,
  detailed?: boolean,
  detailedKM?: boolean
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let y = 0;

  const companyName = supplier?.name || order.companyNameSnapshot || settings?.companyName || 'ServiceFlow';
  const customerName = order.customerNameSnapshot || customer?.name || 'Cliente';
  const orderNumber = order.orderNumber || order.id.substring(0, 8).toUpperCase();
  const dateStr = format(new Date(), 'dd/MM/yyyy');

  // ... (branding code remains same)
  doc.setFillColor(41, 128, 185);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('PROPOSTA COMERCIAL', margin, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ref: Orçamento Nº ${orderNumber}`, margin, 32);

  // Info Section (Side by Side)
  doc.setTextColor(50, 50, 50);
  y = 55;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PREPARADO PARA:', margin, y);
  doc.text('APRESENTADO POR:', pageWidth / 2 + 10, y);
  
  doc.setFont('helvetica', 'normal');
  doc.text(customerName, margin, y + 5);
  if (customer?.contactName) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Contato: ${customer.contactName}`, margin, y + 10);
    doc.setFont('helvetica', 'normal');
    if (customer?.email) doc.text(customer.email, margin, y + 15);
    if (customer?.phone) doc.text(customer.phone, margin, y + 20);
    y += 5; // Adjustment for extra line
  } else {
    if (customer?.email) doc.text(customer.email, margin, y + 10);
    if (customer?.phone) doc.text(customer.phone, margin, y + 15);
  }

  doc.text(companyName, pageWidth / 2 + 10, y + 5);
  if (supplier?.email) doc.text(supplier.email, pageWidth / 2 + 10, y + 10);
  if (supplier?.phone) doc.text(supplier.phone, pageWidth / 2 + 10, y + 15);

  y = 80;
  doc.setDrawColor(230, 230, 230);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // 1. Escopo
  doc.setTextColor(41, 128, 185);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('1. ESCOPO DO SERVIÇO', margin, y);
  
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  y += 7;
  
  const description = order.description || 'Descrição não informada.';
  const lines = description.split('\n');
  
  lines.forEach(line => {
    const splitDesc = doc.splitTextToSize(line.trim() === '' ? ' ' : line, contentWidth);
    
    splitDesc.forEach((descLine: string) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
        doc.setTextColor(41, 128, 185);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('1. ESCOPO DO SERVIÇO (CONTINUAÇÃO)', margin, y);
        y += 10;
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
      }
      doc.text(descLine, margin, y);
      y += 5;
    });
    
    if (line.trim() === '') y += 3; // Slightly more space for empty lines
  });
  y += 5;

  // Function to ensure we have space for a new section box or multiline row
  const checkSpace = (needed: number, title?: string) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 20;
      if (title) {
        doc.setTextColor(41, 128, 185);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`${title} (CONTINUAÇÃO)`, margin, y);
        y += 10;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
      }
      return true;
    }
    return false;
  };

  // 2. Materiais (if any)
  if (order.parts.length > 0) {
    checkSpace(20, '2. MATERIAIS E EQUIPAMENTOS');
    doc.setTextColor(41, 128, 185);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('2. MATERIAIS E EQUIPAMENTOS', margin, y);
    y += 6;

    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(8);
    doc.text('Item', margin + 5, y + 5);
    doc.text('Qtd', margin + 110, y + 5);
    doc.text('Subtotal', margin + 140, y + 5);
    y += 10;

    doc.setFont('helvetica', 'normal');
    order.parts.forEach(p => {
      checkSpace(8);
      doc.text(p.name, margin + 5, y);
      doc.text(p.quantity.toString(), margin + 110, y);
      doc.text(`R$ ${(p.quantity * p.price).toFixed(2)}`, margin + 140, y);
      y += 5;
    });
    y += 5;
  }

  // 3. Investimento
  checkSpace(30, '3. INVESTIMENTO');
  doc.setTextColor(41, 128, 185);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. INVESTIMENTO', margin, y);
  y += 7;

  const partsTotal = order.parts.reduce((acc, p) => acc + (p.quantity * p.price), 0);
  
  // Recalculate totals dynamically to be robust
  const techLaborTotal = (order.technicianDetails || []).reduce((acc, t) => acc + (Number(t.hours) * Number(t.laborRate)), 0);
  const laborTotal = (order.technicianDetails && order.technicianDetails.length > 0) 
    ? techLaborTotal 
    : (Number(order.laborCost) || 0);

  const techKmTotal = (order.technicianDetails || []).reduce((acc, t) => acc + (Number(t.km) * Number(t.kmValue)), 0);
  const kmTotal = (order.technicianDetails && order.technicianDetails.length > 0)
    ? techKmTotal
    : (Number(order.kmDriven || 0) * Number(order.kmValue || 0));

  const drawRow = (label: string, value: string, isTotal = false) => {
    checkSpace(10);
    if (isTotal) {
      doc.setFillColor(41, 128, 185);
      doc.rect(margin, y - 4, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'normal');
    }
    doc.text(label, margin + 5, y + 1);
    doc.text(value, pageWidth - margin - 5, y + 1, { align: 'right' });
    y += 8;
  };

  if (detailed) {
    drawRow('Mão de Obra e Serviços:', `R$ ${laborTotal.toFixed(2)}`);
    
    if (order.technicianDetails && order.technicianDetails.length > 0) {
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      order.technicianDetails.forEach(tech => {
        checkSpace(6);
        doc.text(`   ${tech.name}: R$ ${(tech.hours * tech.laborRate).toFixed(2)} (${tech.hours}h)`, margin + 5, y - 2);
        y += 4;
      });
      doc.setFontSize(9);
      y += 2;
    }
  }

  drawRow('Materiais e Equipamentos:', `R$ ${partsTotal.toFixed(2)}`);

  if (detailedKM) {
    drawRow(`Deslocamento e Logística (${(order.kmDriven || 0) || (order.technicianDetails?.reduce((acc, t) => acc + (t.km || 0), 0) || 0)} KM):`, `R$ ${kmTotal.toFixed(2)}`);
    
    if (order.technicianDetails && order.technicianDetails.length > 0) {
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      order.technicianDetails.forEach(tech => {
        checkSpace(6);
        doc.text(`   ${tech.name}: R$ ${(tech.km * tech.kmValue).toFixed(2)} (${tech.km} KM)`, margin + 5, y - 2);
        y += 4;
      });
      doc.setFontSize(9);
      y += 2;
    }
  }
  
  if ((order.discountValue || 0) > 0) {
    doc.setTextColor(41, 128, 185);
    drawRow(`Desconto Aplicado (${order.discountPercent}%):`, `- R$ ${order.discountValue?.toFixed(2)}`);
  }

  drawRow('VALOR TOTAL DA PROPOSTA:', `R$ ${order.totalValue.toFixed(2)}`, true);

  // Footer for internal identification
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`${companyName} | Proposta Comercial Ref: ${orderNumber} | Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  doc.save(`Proposta_${orderNumber}_${customerName.replace(/\s+/g, '_')}.pdf`);
};
