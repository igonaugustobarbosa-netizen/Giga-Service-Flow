import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ServiceOrder, Customer, Technician, Supplier, Part } from '../types';

export const generateServicePDF = (
  order: ServiceOrder,
  customer?: Customer,
  technicians: Technician[] = [],
  supplier?: Supplier
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;

  // Helper for drawing section boxes
  const drawSectionBox = (startY: number, height: number, title: string) => {
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, startY, contentWidth, 7, 'F');
    doc.rect(margin, startY, contentWidth, height);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text(title, margin + 3, startY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
  };

  // Use snapshots or fallbacks
  const customerName = order.customerNameSnapshot || customer.name;
  const customerAddress = order.customerAddressSnapshot || customer.address;
  const companyName = order.companyNameSnapshot || 'ServiceFlow';

  const drawFooter = () => {
    const pageNum = doc.getCurrentPageInfo().pageNumber;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const footerText = `Página ${pageNum} | Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - ${companyName} | Desenvolvedor Giga Eletrica Fone 43996118806 Joaquim Tavora PR`;
    doc.text(footerText, margin, pageHeight - 10);
    doc.setTextColor(0, 0, 0);
  };

  const drawHeader = () => {
    doc.setFillColor(41, 128, 185); // Primary blue
    doc.rect(0, 0, pageWidth, 20, 'F');
    
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    const mainTitle = order.status === 'budget' ? 'ORÇAMENTO' : 'ORDEM DE SERVIÇO';
    doc.text(mainTitle, margin, 13);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const orderNumberLabel = order.status === 'budget' ? 'ORÇAM. Nº:' : 'OS Nº:';
    doc.text(`${orderNumberLabel} ${order.orderNumber || order.id.substring(0, 8).toUpperCase()}`, margin + 70, 13);
    
    const dateToDisplay = order.executionDate || order.createdAt;
    const dateStr = dateToDisplay ? format(new Date(dateToDisplay.replace('Z', '')), 'dd/MM/yyyy HH:mm') : 'N/A';
    doc.text(`Data: ${dateStr}`, pageWidth - margin, 13, { align: 'right' });
  };

  // Header
  drawHeader();
  
  y = 28;

  // Provider Section (Using supplier object or snapshots)
  const providerName = supplier?.name || order.companyNameSnapshot || 'ServiceFlow';
  const providerTaxId = supplier?.taxId || order.companyTaxIdSnapshot;
  const providerAddress = supplier?.address || order.companyAddressSnapshot;
  const providerPhone = supplier?.phone;
  
  const splitProviderAddr = providerAddress ? doc.splitTextToSize(`Endereço: ${providerAddress}`, contentWidth - 10) : [];
  
  let providerBoxHeight = 16;
  if (splitProviderAddr.length > 0) providerBoxHeight += (splitProviderAddr.length * 4) + 2;
  if (supplier?.pixKey || supplier?.paymentDetails) providerBoxHeight += 8;

  drawSectionBox(y, providerBoxHeight, 'DADOS DO PRESTADOR / FORNECEDOR');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(providerName, margin + 5, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  if (providerPhone) {
    doc.text(`Telefone: ${providerPhone}`, margin + 5, y + 18);
    if (providerTaxId) doc.text(`CNPJ/CPF: ${providerTaxId}`, margin + 80, y + 18);
  } else if (providerTaxId) {
    doc.text(`CNPJ/CPF: ${providerTaxId}`, margin + 5, y + 18);
  }
  
  let currentProviderY = y + 24;
  if (splitProviderAddr.length > 0) {
    doc.text(splitProviderAddr, margin + 5, currentProviderY);
    currentProviderY += (splitProviderAddr.length * 4) + 2;
  }
  
  if (supplier?.pixKey) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Chave PIX: ${supplier.pixKey}`, margin + 5, currentProviderY);
    doc.setFont('helvetica', 'normal');
  } else if (supplier?.paymentDetails) {
    doc.text(`Info. Pagamento: ${supplier.paymentDetails}`, margin + 5, currentProviderY);
  }
  
  y += providerBoxHeight + 3;

  // Customer Section
  const splitAddress = customerAddress ? doc.splitTextToSize(`Endereço: ${customerAddress}`, contentWidth - 10) : [];
  
  // Add space for contact info if present
  const hasContact = !!(customer?.contactName || customer?.contactPhone);
  const customerBoxHeight = Math.max(28, (splitAddress.length > 0 ? 22 + (splitAddress.length * 5) : 28)) + (hasContact ? 6 : 0);
  
  drawSectionBox(y, customerBoxHeight, 'DADOS DO CLIENTE');
  doc.setFontSize(9);
  doc.text(`Nome: ${customerName}`, margin + 5, y + 12);
  doc.text(`Telefone: ${customer?.phone || ''}`, margin + 5, y + 18);
  if (customer?.email) doc.text(`Email: ${customer.email}`, margin + 80, y + 18);
  
  let currentCustomerY = y + 24;
  if (hasContact) {
    const contactParts = [];
    if (customer?.contactName) contactParts.push(`Contato: ${customer.contactName}`);
    if (customer?.contactPhone) contactParts.push(`Fone: ${customer.contactPhone}`);
    doc.setFont('helvetica', 'bold');
    doc.text(contactParts.join(' | '), margin + 5, currentCustomerY);
    doc.setFont('helvetica', 'normal');
    currentCustomerY += 6;
  }

  if (customerAddress) {
    doc.text(splitAddress, margin + 5, currentCustomerY);
  }
  
  y += customerBoxHeight + 4;

  // Service Description
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const descriptionText = order.description || 'Nenhum serviço descrito.';
  const descParagraphs = descriptionText.split('\n');
  const descLineHeight = 5;
  
  // Calculate total height needed for description box
  let totalDescHeight = 12; // Base padding
  const processedParagraphs: string[][] = [];
  
  descParagraphs.forEach(para => {
    if (para.trim() === '') {
      totalDescHeight += 3;
      processedParagraphs.push(['']);
    } else {
      const splitLines = doc.splitTextToSize(para, contentWidth - 12);
      totalDescHeight += (splitLines.length * descLineHeight) + 2;
      processedParagraphs.push(splitLines);
    }
  });

  // Calculate if we need to split across pages
  if (y + totalDescHeight > 270) {
    // If it's too big, we should either split or just start on a new page if it's really big
    if (y > 100) { // If we're already past middle, start fresh
      drawFooter();
      doc.addPage();
      drawHeader();
      y = 28;
    }
  }

  drawSectionBox(y, totalDescHeight, 'DESCRIÇÃO DO SERVIÇO');
  let currentParaY = y + 11;
  
  processedParagraphs.forEach(lines => {
    if (currentParaY > 270) {
      drawFooter();
      doc.addPage();
      drawHeader();
      y = 28;
      // Note: This logic is simplified for the description box which usually fits in one or two pages
      // but the drawSectionBox was already drawn above. For a truly robust split, we'd need more complex logic.
      // Given the previous implementation also had a simplified split, we'll keep it manageable.
      currentParaY = 35;
    }
    
    if (lines[0] === '') {
      currentParaY += 3;
    } else {
      doc.text(lines, margin + 5, currentParaY);
      currentParaY += (lines.length * descLineHeight) + 2;
    }
  });

  y += totalDescHeight + 5;

  // Technicians
  const hasTechDetails = (order.technicianDetails && order.technicianDetails.length > 0);
  const techBoxHeight = hasTechDetails ? (order.technicianDetails.length * 6) + 10 : 10;
  
    if (y + techBoxHeight > 270) {
      drawFooter();
      doc.addPage();
      drawHeader();
      y = 28;
    }

    drawSectionBox(y, techBoxHeight, 'TÉCNICOS RESPONSÁVEIS E VALORES');
  
  if (hasTechDetails) {
    doc.setFontSize(7.5);
    order.technicianDetails.forEach((tech, i) => {
      const techTotal = (tech.hours * tech.laborRate) + (tech.km * tech.kmValue);
      const techText = `${tech.name}: R$ ${techTotal.toFixed(2)}`;
      doc.text(techText, margin + 5, y + 11 + (i * 6));
    });
    doc.setFontSize(9);
    y += techBoxHeight + 3;
  } else {
    doc.text(technicians.map(t => t.name).join(', '), margin + 5, y + 10);
    y += techBoxHeight + 3;
  }

  // Parts Table
  if (order.parts.length > 0) {
    const tableHeaderY = y;
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, tableHeaderY, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('PEÇAS E MATERIAIS', margin + 3, tableHeaderY + 5);
    
    y += 11;
    doc.setFontSize(8);
    doc.text('Descrição', margin + 5, y);
    doc.text('Qtd', margin + 110, y);
    doc.text('V. Unitário', margin + 135, y);
    doc.text('Subtotal', margin + 165, y);
    
    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    
    doc.setFont('helvetica', 'normal');
    order.parts.forEach((part: Part) => {
      const partsPageLimit = 270;
      const splitPartName = doc.splitTextToSize(part.name, 100);
      const rowHeight = splitPartName.length * 5;

      if (y + rowHeight > partsPageLimit) { 
        drawFooter();
        doc.addPage(); 
        drawHeader();
        y = 28; 
      }
      doc.text(splitPartName, margin + 5, y);
      doc.text(part.quantity.toString(), margin + 110, y);
      doc.text(`R$ ${part.price.toFixed(2)}`, margin + 135, y);
      doc.text(`R$ ${(part.quantity * part.price).toFixed(2)}`, margin + 165, y);
      y += Math.max(5, rowHeight);
    });
    y += 3;
  }

  // Financial Summary
  const summaryPageLimit = doc.getCurrentPageInfo().pageNumber === 1 ? 210 : 255;
  if (y > summaryPageLimit) { 
    drawFooter();
    doc.addPage(); 
    y = 20; 
  }
  
  const summaryY = y;
  let summaryHeight = 40;
  
  // Increase summary height if multiple technicians, PIX key, payment details or discount are shown
  const showPix = !!supplier?.pixKey;
  const showDetails = supplier?.paymentDetails;
  const showDiscount = (order.discountPercent || 0) > 0;
  
  if (hasTechDetails) {
    summaryHeight += (order.technicianDetails!.length * 6) + 4; // Extra space for tech breakdown
  }
  if (showPix || showDetails) {
    summaryHeight += 6;
  }
  if (showDiscount) {
    summaryHeight += 6;
  }
  
  drawSectionBox(summaryY, summaryHeight, 'RESUMO FINANCEIRO');
  
  const partsTotal = order.parts.reduce((acc, p) => acc + (p.quantity * p.price), 0);
  const kmTotal = order.kmDriven * order.kmValue;
  
  doc.setFontSize(9);
  doc.text('Total em Peças:', margin + 5, summaryY + 13);
  doc.text(`R$ ${partsTotal.toFixed(2)}`, pageWidth - margin - 5, summaryY + 13, { align: 'right' });
  
  let currentSummaryY = summaryY + 19;

  // New Labor section with details
  doc.text('Mão de Obra Total:', margin + 5, currentSummaryY);
  doc.text(`R$ ${order.laborCost.toFixed(2)}`, pageWidth - margin - 5, currentSummaryY, { align: 'right' });
  currentSummaryY += 4;
  
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  if (hasTechDetails) {
    order.technicianDetails!.forEach(tech => {
      doc.text(tech.name, margin + 10, currentSummaryY);
      doc.text(`R$ ${(tech.hours * tech.laborRate).toFixed(2)}`, pageWidth - margin - 10, currentSummaryY, { align: 'right' });
      currentSummaryY += 3.5;
    });
  } else {
    currentSummaryY += 1;
  }
  
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  currentSummaryY += 2;

  // New Displacement section with details
  doc.text(`Deslocamento Total (${order.kmDriven || 0} KM):`, margin + 5, currentSummaryY);
  doc.text(`R$ ${(kmTotal || 0).toFixed(2)}`, pageWidth - margin - 5, currentSummaryY, { align: 'right' });
  currentSummaryY += 4;

  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  if (hasTechDetails) {
    order.technicianDetails!.forEach(tech => {
      doc.text(tech.name, margin + 10, currentSummaryY);
      doc.text(`R$ ${(tech.km * tech.kmValue).toFixed(2)}`, pageWidth - margin - 10, currentSummaryY, { align: 'right' });
      currentSummaryY += 3.5;
    });
  } else {
    currentSummaryY += 1;
  }

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  currentSummaryY += 4;

  if (showDiscount) {
    doc.setTextColor(41, 128, 185); // Blue for discount
    doc.text(`Desconto Aplicado (${order.discountPercent}%):`, margin + 5, currentSummaryY);
    doc.text(`- R$ ${(order.discountValue || 0).toFixed(2)}`, pageWidth - margin - 5, currentSummaryY, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    currentSummaryY += 6;
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
  doc.text('Forma de Pagamento:', margin + 5, currentSummaryY);
  doc.text(getPaymentMethodLabel(order.paymentMethod), margin + 40, currentSummaryY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (showPix) {
    doc.text(`Chave PIX: ${supplier.pixKey}`, margin + 5, currentSummaryY + 6);
  } else if (showDetails) {
    doc.text(`Info. Pagamento: ${supplier.paymentDetails}`, margin + 5, currentSummaryY + 6);
  }
  
  y = summaryY + summaryHeight + 4;

  // Total Highlight
  doc.setFillColor(41, 128, 185);
  doc.rect(margin, y, contentWidth, 12, 'F');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('VALOR TOTAL DA ORDEM:', margin + 5, y + 8);
  doc.text(`R$ ${order.totalValue.toFixed(2)}`, pageWidth - margin - 5, y + 8, { align: 'right' });
  
  y += 25;

  // Signatures Section
  const techsToSign = technicians.length > 0 ? technicians : [{ name: 'TÉCNICO' }] as any[];
  const sigPageLimit = 260;
  
  if (y + (techsToSign.length * 15) > sigPageLimit) {
    drawFooter();
    doc.addPage();
    y = 30;
  }

  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(200, 200, 200);
  
  techsToSign.forEach((tech: any, i: number) => {
    const sigX = margin;
    const sigWidth = 70;
    
    if (tech.signature) {
      try {
        const imgWidth = 40;
        const imgHeight = 15;
        doc.addImage(tech.signature, 'PNG', sigX + (sigWidth - imgWidth)/2, y - 16, imgWidth, imgHeight);
      } catch (e) {
        console.error('Error adding signature to OS:', e);
      }
    }
    
    doc.line(sigX, y, sigX + sigWidth, y);
    doc.text(`ASSINATURA: ${tech.name.toUpperCase()}`, sigX + sigWidth/2, y + 4, { align: 'center' });
    
    if (i === techsToSign.length - 1) {
      const clientSigX = pageWidth - margin - 70;
      doc.line(clientSigX, y, clientSigX + 70, y);
      doc.text('ASSINATURA CLIENTE', clientSigX + 35, y + 4, { align: 'center' });
    }
    
    y += 22;
  });

  drawFooter();

  // Photos Section
  let photoY = y + 5;

  const addPhotoSection = (title: string, photos: string[]) => {
    if (!photos || photos.length === 0) return;
    
    // Check if we need a new page for the title
    if (photoY + 25 > 270) {
      drawFooter();
      doc.addPage();
      photoY = 20;
    } else {
      photoY += 5; // Add some spacing between sections
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

  // Validity Message - ALWAYS ON THE LAST PAGE AT THE BOTTOM
  const totalPages = doc.getNumberOfPages();
  doc.setPage(totalPages);
  
  const validityY = pageHeight - 35; // Position above footer
  
  // Clear space with white background
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, validityY - 2, contentWidth, 22, 'F');

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

  doc.save(`OS_${order.id.substring(0, 8).toUpperCase()}_${customerName.replace(/\s+/g, '_')}.pdf`);
};
