import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ServiceOrder, Settings, Supplier } from '../types';

export interface TechnicalReportData {
  description: string;
  procedures: string;
  nonConformities: string;
}

export const generateTechnicalReport = (
  order: ServiceOrder,
  customer?: any | null,
  technicians: any[] = [],
  settings?: Settings | null,
  reportData?: TechnicalReportData,
  supplier?: Supplier | null
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  // Helper for text wrapping and positioning
  let y = 20;
  const checkNewPage = (height: number) => {
    if (y + height > 280) {
      doc.addPage();
      y = 20;
      return true;
    }
    return false;
  };

  // Header Background
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Title
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO TÉCNICO DE SERVIÇO', margin, 12);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const companyName = supplier?.name || order.companyNameSnapshot || settings?.companyName || 'Giga Elétrica';
  const companyTaxId = supplier?.taxId || order.companyTaxIdSnapshot || settings?.companyTaxId;
  const companyPhone = supplier?.phone;
  const companyAddress = supplier?.address || order.companyAddressSnapshot || settings?.companyAddress;
  
  doc.text(`Empresa: ${companyName}`, margin, 18);
  
  if (companyTaxId) doc.text(`CNPJ/CPF: ${companyTaxId}`, margin + 80, 18);
  if (companyPhone) doc.text(`Fone: ${companyPhone}`, margin + 140, 18);
  
  let headerY = 23;
  if (companyAddress) {
    const splitAddrHeader = doc.splitTextToSize(`Endereço: ${companyAddress}`, contentWidth - 10);
    doc.text(splitAddrHeader, margin, headerY);
    headerY += (splitAddrHeader.length * 4) + 1;
  }
  
  const techNames = technicians.length > 0 
    ? technicians.map((t: any) => t.name).join(' / ') 
    : 'Responsável não informado';
  const splitTechNames = doc.splitTextToSize(`Técnicos: ${techNames}`, contentWidth - 85);
  doc.text(splitTechNames, margin, headerY);
  headerY += (splitTechNames.length * 4) + 5;

  y = headerY > 42 ? headerY : 42;
  doc.setTextColor(0, 0, 0);

  // Column Layout for Dados do Cliente e Info do Serviço
  const colWidth = contentWidth / 2 - 5;
  
  // Section: Cliente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(37, 99, 235);
  doc.text('DADOS DO CLIENTE', margin, y);
  y += 1.5;
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + colWidth, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(`Cliente: ${customer?.name || order.customerNameSnapshot || 'N/A'}`, margin, y);
  y += 4;
  if (customer?.contactName || customer?.contactPhone) {
    const contactText = `${customer?.contactName || ''}${customer?.contactName && customer?.contactPhone ? ' - ' : ''}${customer?.contactPhone || ''}`;
    doc.setFont('helvetica', 'bold');
    doc.text(`Contato: ${contactText}`, margin, y);
    doc.setFont('helvetica', 'normal');
    y += 4;
  }
  const splitAddr = doc.splitTextToSize(`Endereço: ${customer?.address || order.customerAddressSnapshot || 'N/A'}`, colWidth);
  doc.text(splitAddr, margin, y);
  y += (splitAddr.length * 4);
  doc.text(`Telefone: ${customer?.phone || 'N/A'}`, margin, y);

  const leftColumnY = y;

  // Section: Serviço (Right Column)
  y = 42;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(37, 99, 235);
  doc.text('INFORMAÇÕES DO SERVIÇO', margin + colWidth + 10, y);
  y += 1.5;
  doc.line(margin + colWidth + 10, y, pageWidth - margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  const dateToDisplay = order.executionDate || order.createdAt;
  const dateStr = dateToDisplay ? format(new Date(dateToDisplay.replace('Z', '')), 'dd/MM/yyyy') : 'N/A';
  doc.text(`Data: ${dateStr}`, margin + colWidth + 10, y);
  y += 4;
  doc.text(`OS Nº: ${order.orderNumber || order.id.substring(0, 8).toUpperCase()}`, margin + colWidth + 10, y);
  y += 4;
  doc.text(`Tempo Executado: ${order.hoursWorked || 0} horas`, margin + colWidth + 10, y);

  y = Math.max(leftColumnY, y) + 8;

  // Helper for compact sections
  const drawCompactSection = (title: string, content: string, color: [number, number, number] = [37, 99, 235]) => {
    checkNewPage(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(title, margin, y);
    y += 1.5;
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    
    const splitText = doc.splitTextToSize(content || 'N/A', contentWidth);
    checkNewPage(splitText.length * 4 + 4);
    doc.text(splitText, margin, y);
    y += (splitText.length * 4) + 6;
  };

  // Sections
  drawCompactSection('DESCRIÇÃO DO SERVIÇO', reportData?.description || order.description || 'N/A');
  drawCompactSection('PROCEDIMENTOS TÉCNICOS', reportData?.procedures || 'N/A');
  
  if (reportData?.nonConformities) {
    drawCompactSection('NÃO CONFORMIDADES', reportData.nonConformities, [220, 38, 38]);
  }

  // Materials (Compact table)
  if (order.parts && order.parts.length > 0) {
    checkNewPage(15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(37, 99, 235);
    doc.text('MATERIAIS E EQUIPAMENTOS', margin, y);
    y += 1.5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
    
    doc.setFontSize(7.5);
    doc.text('QTD', margin + 2, y);
    doc.text('DESCRIÇÃO DO ITEM', margin + 20, y);
    y += 3;
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
    
    doc.setFont('helvetica', 'normal');
    order.parts.forEach(p => {
      const splitPartName = doc.splitTextToSize(p.name, contentWidth - 25);
      const rowHeight = splitPartName.length * 4;
      checkNewPage(rowHeight);
      doc.text(p.quantity.toString(), margin + 2, y);
      doc.text(splitPartName, margin + 20, y);
      y += Math.max(4, rowHeight);
    });
    y += 5;
  }

  // Footnote message
  if (settings?.technicalReportDefaultMessage) {
    checkNewPage(12);
    y += 2;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    const splitMsg = doc.splitTextToSize(settings.technicalReportDefaultMessage, pageWidth - (margin * 2));
    doc.text(splitMsg, margin, y);
    doc.setTextColor(0, 0, 0);
    y += (splitMsg.length * 3.5) + 4;
  }

  // Signatures
  y += 5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');

  const techsToSign = technicians.length > 0 ? technicians : [{ name: 'TÉCNICO' }];
  
  // Calculate total signature block height to avoid splitting signatures between pages
  const totalSignatureHeight = (techsToSign.length * 25) + 10;
  checkNewPage(totalSignatureHeight);

  techsToSign.forEach((tech: any) => {
    y += 18;
    
    // Add signature image if available
    if (tech.signature) {
      try {
        const sigWidth = 40;
        const sigHeight = 15;
        doc.addImage(tech.signature, 'PNG', margin + (70 - sigWidth) / 2, y - 16, sigWidth, sigHeight);
      } catch (e) {
        console.error('Error adding tech signature to report:', e);
      }
    }
    
    doc.line(margin, y, margin + 70, y);
    doc.text(`ASSINATURA: ${tech.name.toUpperCase()}`, margin + 35, y + 4, { align: 'center' });
    y += 5;
  });

  // Place client signature next to the last tech
  const lastTechY = y - 5;
  doc.line(pageWidth - margin - 70, lastTechY, pageWidth - margin, lastTechY);
  doc.text('ASSINATURA CLIENTE', pageWidth - margin - 35, lastTechY + 4, { align: 'center' });

  y += 10;

  // Photos (Very compact grid) after signatures
  const handlePhotosOnOnePage = (photos: string[], title: string) => {
    if (photos.length > 0) {
      if (checkNewPage(45)) y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(37, 99, 235);
      doc.text(title, margin, y);
      y += 5;
      
      let xPos = margin;
      const imgSize = 32;
      const spacing = 4;

      photos.forEach((photo) => {
        if (xPos + imgSize > pageWidth - margin) {
          xPos = margin;
          y += imgSize + spacing;
          checkNewPage(imgSize + spacing);
        }
        try {
          doc.addImage(photo, 'JPEG', xPos, y, imgSize, imgSize);
        } catch (e) {
          console.error(e);
        }
        xPos += imgSize + spacing;
      });
      y += imgSize + 8;
    }
  };

  handlePhotosOnOnePage(order.beforePhotos || [], 'REGISTRO FOTOGRÁFICO: INÍCIO');
  handlePhotosOnOnePage(order.afterPhotos || [], 'REGISTRO FOTOGRÁFICO: CONCLUSÃO');


  // Page numbering
  const pageCount = (doc.internal as any).pages?.length - 1 || 1;
  const developerInfo = "Desenvolvedor Giga Eletrica Fone 43996118806 Joaquim Tavora PR";
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const footerText = `Página ${i} de ${pageCount} | Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} | ${developerInfo}`;
    doc.text(footerText, pageWidth / 2, 290, { align: 'center' });
  }

  const fileName = `RELATORIO_TECNICO_${order.orderNumber || order.id.substring(0, 8)}.pdf`;
  doc.save(fileName);
};
