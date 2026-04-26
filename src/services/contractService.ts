import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ServiceOrder, Customer, Settings } from '../types';

export const generateContractPDF = (
  order: ServiceOrder,
  customer?: any | null,
  supplier?: any | null,
  settings?: Settings | null,
  customClauses?: string
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;

  // Contractor info (CONTRATADA) - Priority to Supplier, fallback to Settings
  const contractorName = supplier?.name || order.supplierId || settings?.companyName || '________________';
  const contractorTaxId = supplier?.taxId || '________________';
  const contractorAddress = supplier?.address || settings?.companyAddress || '________________________________';
  
  // Client info (CONTRATANTE) - Priority to Customer
  const customerName = order.customerNameSnapshot || customer?.name || '________________';
  const customerTaxId = order.customerTaxIdSnapshot || customer?.taxId || '________________';
  const customerAddress = order.customerAddressSnapshot || customer?.address || '________________________________';

  const drawFooter = () => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Página ${i} de ${pageCount} - Contrato de Prestação de Serviços - ${contractorName}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }
  };

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  const checkNewPage = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 30) {
      doc.addPage();
      y = 25;
      return true;
    }
    return false;
  };

  // Identification
  checkNewPage(40);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. AS PARTES', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  // Contractor details
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRATADA (PRESTADORA):', margin, y);
  doc.setFont('helvetica', 'normal');
  const contractorText = `${contractorName}, inscrita no CNPJ/CPF sob o nº ${contractorTaxId}, com sede em ${contractorAddress}.`;
  const splitContractor = doc.splitTextToSize(contractorText, contentWidth - 5);
  doc.text(splitContractor, margin, y + 5);
  y += (splitContractor.length * 5) + 10;

  // Client details
  checkNewPage(25);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRATANTE (CLIENTE):', margin, y);
  doc.setFont('helvetica', 'normal');
  const clientText = `${customerName}, inscrito no CNPJ/CPF sob o nº ${customerTaxId}, residente ou com sede em ${customerAddress}.`;
  const splitClient = doc.splitTextToSize(clientText, contentWidth - 5);
  doc.text(splitClient, margin, y + 5);
  y += (splitClient.length * 5) + 12;

  // Object
  checkNewPage(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('2. OBJETO DO CONTRATO', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const objectText = `O presente contrato tem por objeto a prestação de serviços de: ${order.description}. Referente à Ordem de Serviço Nº ${order.orderNumber || order.id.substring(0, 8).toUpperCase()}.`;
  const splitObject = doc.splitTextToSize(objectText, contentWidth);
  doc.text(splitObject, margin, y);
  y += splitObject.length * 5 + 12;

  // Values and Payment
  checkNewPage(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('3. VALOR E CONDIÇÕES DE PAGAMENTO', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const paymentText = `Pelos serviços ora contratados, a CONTRATANTE pagará à CONTRATADA o valor total de R$ ${order.totalValue.toFixed(2)} (${numberToPortuguese(order.totalValue)}), através da forma de pagamento: ${getPaymentMethodLabel(order.paymentMethod)}.`;
  const splitPayment = doc.splitTextToSize(paymentText, contentWidth);
  doc.text(splitPayment, margin, y);
  y += splitPayment.length * 5 + 12;

  // Deadline
  checkNewPage(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('4. PRAZO E EXECUÇÃO', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const executionDate = order.executionDate || order.createdAt;
  let formattedDate = 'A definir';
  
  try {
    if (executionDate) {
      const dateStr = typeof executionDate === 'string' && executionDate.includes('Z') 
        ? executionDate.replace('Z', '') 
        : executionDate;
      formattedDate = format(new Date(dateStr), 'dd/MM/yyyy');
    }
  } catch (e) {
    console.error('Erro ao formatar data de execução:', e);
  }

  const deadlineText = `A execução dos serviços está prevista para ser iniciada na data de ${formattedDate}, salvo impedimentos de força maior ou condições climáticas desfavoráveis quando aplicável.`;
  const splitDeadline = doc.splitTextToSize(deadlineText, contentWidth);
  doc.text(splitDeadline, margin, y);
  y += splitDeadline.length * 5 + 15;

  // Customized Clauses
  const finalClauses = customClauses || settings?.contractClauses;
  if (finalClauses) {
    checkNewPage(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('5. CLÁUSULAS GERAIS', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const splitClauses = doc.splitTextToSize(finalClauses, contentWidth);
    
    // Split clauses if they are too long for one page
    for (let i = 0; i < splitClauses.length; i++) {
        if (y > pageHeight - 30) {
            doc.addPage();
            y = 25;
        }
        doc.text(splitClauses[i], margin, y);
        y += 5;
    }
    y += 10;
  }

  // Signatures
  if (y + 60 > pageHeight - 20) {
    doc.addPage();
    y = 25;
  } else {
    y += 10;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const cityDateText = `Localidade: __________________________, Data: ${format(new Date(), 'dd/MM/yyyy')}`;
  doc.text(cityDateText, margin, y);
  y += 35;

  const sigWidth = 70;
  const sigSpacing = (contentWidth - (sigWidth * 2)) / 2;
  
  // Contractor Signature
  doc.line(margin + 5, y, margin + 5 + sigWidth, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CONTRATADA', margin + 5 + sigWidth / 2, y + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(contractorName, margin + 5 + sigWidth / 2, y + 9, { align: 'center' });

  // Client Signature
  doc.line(pageWidth - margin - 5 - sigWidth, y, pageWidth - margin - 5, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CONTRATANTE', pageWidth - margin - 5 - sigWidth / 2, y + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(customerName, pageWidth - margin - 5 - sigWidth / 2, y + 9, { align: 'center' });

  drawFooter();

  doc.save(`Contrato_${order.orderNumber || order.id.substring(0, 8).toUpperCase()}_${customerName.replace(/\s+/g, '_')}.pdf`);
};

const getPaymentMethodLabel = (method?: string) => {
  switch (method) {
    case 'pix': return 'PIX';
    case 'cash': return 'Dinheiro';
    case 'credit': return 'Cartão de Crédito';
    case 'debit': return 'Cartão de Débito';
    default: return 'A combinar';
  }
};

// Simple converter for BRL values
function numberToPortuguese(num: number): string {
  const formatCurrency = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  return formatCurrency.format(num);
}
