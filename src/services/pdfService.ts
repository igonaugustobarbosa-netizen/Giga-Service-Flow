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
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;

  const drawFooter = () => {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Desenvolvedor Giga Elétrica Fone 43 996118806`, margin, pageHeight - 10);
  };

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
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEM DE SERVIÇO', margin, 17);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`OS Nº: ${order.orderNumber || order.id.substring(0, 8).toUpperCase()}`, margin + 80, 17);
  
  const dateToDisplay = order.executionDate || order.createdAt;
  const dateStr = dateToDisplay ? format(new Date(dateToDisplay.replace('Z', '')), 'dd/MM/yyyy HH:mm') : 'N/A';
  doc.text(`Data: ${dateStr}`, pageWidth - margin, 17, { align: 'right' });
  
  y = 35;

  // Customer Section
  const customerBoxHeight = 32;
  drawSectionBox(y, customerBoxHeight, 'DADOS DO CLIENTE');
  doc.setFontSize(10);
  doc.text(`Nome: ${customer.name}`, margin + 5, y + 14);
  doc.text(`Telefone: ${customer.phone}`, margin + 5, y + 21);
  if (customer.email) doc.text(`Email: ${customer.email}`, margin + 80, y + 21);
  if (customer.address) {
    const splitAddr = doc.splitTextToSize(`Endereço: ${customer.address}`, contentWidth - 10);
    doc.text(splitAddr, margin + 5, y + 28);
  }
  
  y += customerBoxHeight + 5;

  // Supplier Section (if exists)
  if (supplier) {
    let supplierBoxHeight = 25;
    if (supplier.address) supplierBoxHeight += 12;
    if (supplier.pixKey) supplierBoxHeight += 7;
    if (supplier.paymentDetails && !supplier.pixKey) supplierBoxHeight += 7;

    drawSectionBox(y, supplierBoxHeight, 'FORNECEDOR');
    doc.text(`Nome: ${supplier.name}`, margin + 5, y + 14);
    doc.text(`Telefone: ${supplier.phone}`, margin + 5, y + 21);
    if (supplier.taxId) doc.text(`CNPJ: ${supplier.taxId}`, margin + 80, y + 21);
    
    let currentSupplierY = y + 28;
    if (supplier.address) {
      const splitAddr = doc.splitTextToSize(`Endereço: ${supplier.address}`, contentWidth - 10);
      doc.text(splitAddr, margin + 5, currentSupplierY);
      currentSupplierY += 8;
    }
    
    if (supplier.pixKey) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Chave PIX: ${supplier.pixKey}`, margin + 5, currentSupplierY);
      doc.setFont('helvetica', 'normal');
    } else if (supplier.paymentDetails) {
      doc.text(`Info. Pagamento: ${supplier.paymentDetails}`, margin + 5, currentSupplierY);
    }
    
    y += supplierBoxHeight + 5;
  }

  // Service Description
  const splitDescription = doc.splitTextToSize(order.description, contentWidth - 10);
  const descHeight = (splitDescription.length * 6) + 12;
  drawSectionBox(y, descHeight, 'DESCRIÇÃO DO SERVIÇO');
  doc.text(splitDescription, margin + 5, y + 13);
  y += descHeight + 5;

  // Technicians
  drawSectionBox(y, 12, 'TÉCNICOS RESPONSÁVEIS');
  doc.text(technicians.map(t => t.name).join(', '), margin + 5, y + 11);
  y += 18;

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
      const pageLimit = doc.getCurrentPageInfo().pageNumber === 1 ? 245 : 270;
      if (y > pageLimit) { 
        drawFooter();
        doc.addPage(); 
        y = 20; 
      }
      doc.text(part.name, margin + 5, y);
      doc.text(part.quantity.toString(), margin + 100, y);
      doc.text(`R$ ${part.price.toFixed(2)}`, margin + 130, y);
      doc.text(`R$ ${(part.quantity * part.price).toFixed(2)}`, margin + 165, y);
      y += 7;
    });
    y += 5;
  }

  // Financial Summary
  const summaryPageLimit = doc.getCurrentPageInfo().pageNumber === 1 ? 205 : 230;
  if (y > summaryPageLimit) { 
    drawFooter();
    doc.addPage(); 
    y = 20; 
  }
  
  const summaryY = y;
  let summaryHeight = 45;
  
  // Increase summary height if PIX key, payment details or discount are shown
  const showPix = !!supplier?.pixKey;
  const showDetails = supplier?.paymentDetails;
  const showDiscount = (order.discountPercent || 0) > 0;
  
  if (showPix || showDetails) {
    summaryHeight += 8;
  }
  if (showDiscount) {
    summaryHeight += 7;
  }
  
  drawSectionBox(summaryY, summaryHeight, 'RESUMO FINANCEIRO');
  
  const partsTotal = order.parts.reduce((acc, p) => acc + (p.quantity * p.price), 0);
  const kmTotal = order.kmDriven * order.kmValue;
  
  doc.setFontSize(10);
  doc.text('Total em Peças:', margin + 5, summaryY + 15);
  doc.text(`R$ ${partsTotal.toFixed(2)}`, pageWidth - margin - 5, summaryY + 15, { align: 'right' });
  
  const laborLabel = order.laborRate 
    ? `Mão de Obra (${order.hoursWorked}h x R$ ${order.laborRate.toFixed(2)}):`
    : `Mão de Obra (${order.hoursWorked}h):`;
  doc.text(laborLabel, margin + 5, summaryY + 22);
  doc.text(`R$ ${order.laborCost.toFixed(2)}`, pageWidth - margin - 5, summaryY + 22, { align: 'right' });
  
  doc.text(`Deslocamento (${order.kmDriven}km):`, margin + 5, summaryY + 29);
  doc.text(`R$ ${kmTotal.toFixed(2)}`, pageWidth - margin - 5, summaryY + 29, { align: 'right' });

  let financialYOffset = 36;
  if (showDiscount) {
    doc.setTextColor(41, 128, 185); // Blue for discount
    doc.text(`Desconto Aplicado (${order.discountPercent}%):`, margin + 5, summaryY + financialYOffset);
    doc.text(`- R$ ${(order.discountValue || 0).toFixed(2)}`, pageWidth - margin - 5, summaryY + financialYOffset, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    financialYOffset += 7;
  }
  
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
  doc.text('Forma de Pagamento:', margin + 5, summaryY + financialYOffset);
  doc.text(getPaymentMethodLabel(order.paymentMethod), margin + 45, summaryY + financialYOffset);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (showPix) {
    doc.text(`Chave PIX: ${supplier.pixKey}`, margin + 5, summaryY + financialYOffset + 7);
  } else if (showDetails) {
    doc.text(`Info. Pagamento: ${supplier.paymentDetails}`, margin + 5, summaryY + financialYOffset + 7);
  }
  
  y += summaryHeight + 5;

  // Total Highlight
  doc.setFillColor(41, 128, 185);
  doc.rect(margin, y, contentWidth, 12, 'F');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('VALOR TOTAL DA ORDEM:', margin + 5, y + 8);
  doc.text(`R$ ${order.totalValue.toFixed(2)}`, pageWidth - margin - 5, y + 8, { align: 'right' });

  // Validity Message - ALWAYS ON PAGE 1 AT THE BOTTOM
  const drawValidityOnPage1 = () => {
    const currentPage = doc.getCurrentPageInfo().pageNumber;
    doc.setPage(1);
    
    const validityY = pageHeight - 35; // Position above footer
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text('Validade da Proposta:', margin, validityY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const validityText = 'Esta proposta tem validade de 30 (trinta) dias a partir da data de emissão. Após este período, os valores e condições poderão sofrer alterações sem aviso prévio.';
    const splitValidity = doc.splitTextToSize(validityText, contentWidth);
    doc.text(splitValidity, margin, validityY + 5);
    
    doc.setPage(currentPage);
  };

  drawValidityOnPage1();
  drawFooter();

  // Photos Section
  let photoY = 20;
  let firstPhotoPage = true;

  const addPhotoSection = (title: string, photos: string[]) => {
    if (!photos || photos.length === 0) return;
    
    if (firstPhotoPage) {
      doc.addPage();
      firstPhotoPage = false;
    } else {
      // Check if we need a new page for the title
      if (photoY + 25 > 270) {
        drawFooter();
        doc.addPage();
        photoY = 20;
      } else {
        photoY += 5; // Add some spacing between sections
      }
    }
    
    // Title for photo section
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, photoY, contentWidth, 8, 'F');
    doc.rect(margin, photoY, contentWidth, 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(title, margin + 3, photoY + 6);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    
    photoY += 12;
    
    const photoSize = (contentWidth - 5) / 2;
    photos.forEach((photo, index) => {
      // Check if we need a new page for the next photo row
      if (photoY + photoSize > 270) {
        drawFooter();
        doc.addPage();
        photoY = 20;
      }
      
      const x = margin + (index % 2 === 0 ? 0 : photoSize + 5);
      
      try {
        // Use 'auto' or undefined for format to let jsPDF detect it
        doc.addImage(photo, 'JPEG', x, photoY, photoSize, photoSize, undefined, 'FAST');
      } catch (e) {
        console.error('Erro ao adicionar imagem ao PDF:', e);
        doc.setDrawColor(200, 200, 200);
        doc.rect(x, photoY, photoSize, photoSize);
        doc.setFontSize(8);
        doc.text('Erro ao carregar imagem', x + 5, photoY + photoSize/2);
      }
      
      if (index % 2 !== 0 || index === photos.length - 1) {
        photoY += photoSize + 5;
      }
    });

    drawFooter(); // Final footer for the current photo page
  };

  addPhotoSection('FOTOS: ANTES', order.beforePhotos);
  addPhotoSection('FOTOS: DEPOIS', order.afterPhotos);

  doc.save(`OS_${order.id.substring(0, 8).toUpperCase()}_${customer.name.replace(/\s+/g, '_')}.pdf`);
};
