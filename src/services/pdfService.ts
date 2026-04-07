import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ServiceOrder, Customer, Technician, Part } from '../types';

export const generateServicePDF = (
  order: ServiceOrder,
  customer: Customer,
  technicians: Technician[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text('Orçamento de Serviço', margin, y);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Data: ${format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}`, pageWidth - margin - 40, y);
  
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  
  y += 15;
  
  // Customer Info
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(customer.name, margin + 20, y);
  
  y += 7;
  doc.text(`Telefone: ${customer.phone}`, margin, y);
  if (customer.email) {
    doc.text(`Email: ${customer.email}`, margin + 60, y);
  }
  
  y += 7;
  if (customer.address) {
    doc.text(`Endereço: ${customer.address}`, margin, y);
  }

  y += 15;
  
  // Service Details
  doc.setFont('helvetica', 'bold');
  doc.text('Descrição do Serviço:', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  const splitDescription = doc.splitTextToSize(order.description, pageWidth - (margin * 2));
  doc.text(splitDescription, margin, y);
  y += (splitDescription.length * 7) + 5;

  // Technicians
  doc.setFont('helvetica', 'bold');
  doc.text('Técnicos:', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.text(technicians.map(t => t.name).join(', '), margin, y);
  y += 15;

  // Parts Table
  if (order.parts.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Peças:', margin, y);
    y += 7;
    
    // Table Header
    doc.setFontSize(10);
    doc.text('Peça', margin, y);
    doc.text('Qtd', margin + 80, y);
    doc.text('Preço Unit.', margin + 110, y);
    doc.text('Total', margin + 150, y);
    
    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;
    
    doc.setFont('helvetica', 'normal');
    order.parts.forEach((part: Part) => {
      doc.text(part.name, margin, y);
      doc.text(part.quantity.toString(), margin + 80, y);
      doc.text(`R$ ${part.price.toFixed(2)}`, margin + 110, y);
      doc.text(`R$ ${(part.quantity * part.price).toFixed(2)}`, margin + 150, y);
      y += 7;
    });
    y += 10;
  }

  // Costs
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo de Custos:', margin, y);
  y += 10;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const partsTotal = order.parts.reduce((acc, p) => acc + (p.quantity * p.price), 0);
  doc.text(`Total Peças: R$ ${partsTotal.toFixed(2)}`, margin, y);
  y += 7;
  
  doc.text(`Mão de Obra: R$ ${order.laborCost.toFixed(2)} (${order.hoursWorked}h)`, margin, y);
  y += 7;
  
  const kmTotal = order.kmDriven * order.kmValue;
  doc.text(`Deslocamento: R$ ${kmTotal.toFixed(2)} (${order.kmDriven}km x R$ ${order.kmValue.toFixed(2)})`, margin, y);
  
  y += 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`VALOR TOTAL: R$ ${order.totalValue.toFixed(2)}`, margin, y);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Gerado por ServiceFlow', margin, doc.internal.pageSize.getHeight() - 10);

  doc.save(`orcamento_${order.id.substring(0, 8)}_${customer.name.replace(/\s+/g, '_')}.pdf`);
};
