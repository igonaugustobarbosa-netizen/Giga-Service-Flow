import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, HeadingLevel, WidthType, VerticalAlign } from 'docx';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { ServiceOrder, Customer, Technician, Supplier, Settings } from '../types';

export const generateServiceWord = async (
  order: ServiceOrder,
  customer?: Customer,
  technicians: Technician[] = [],
  supplier?: Supplier,
  settings?: Settings
) => {
  const companyName = supplier?.name || order.companyNameSnapshot || settings?.companyName || 'ServiceFlow';
  const orderTitle = order.status === 'budget' ? 'ORÇAMENTO' : 'ORDEM DE SERVIÇO';
  const orderNumber = order.orderNumber || order.id.substring(0, 8).toUpperCase();
  const dateStr = order.executionDate ? format(new Date(order.executionDate.replace('Z', '')), 'dd/MM/yyyy HH:mm') : format(new Date(), 'dd/MM/yyyy HH:mm');

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Header Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: orderTitle, bold: true, size: 24, color: "2980b9" }),
                      ],
                    }),
                  ],
                  borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [
                        new TextRun({ text: `Nº: ${orderNumber}`, bold: true, size: 20 }),
                        new TextRun({ text: ` | Data: ${dateStr}`, size: 20 }),
                      ],
                    }),
                  ],
                  borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                }),
              ],
            }),
          ],
        }),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        // Provider Info
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "DADOS DO PRESTADOR / FORNECEDOR", bold: true, color: "2980b9", size: 18 })],
        }),
        new Paragraph({ children: [new TextRun({ text: companyName, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: `CNPJ/CPF: ${supplier?.taxId || order.companyTaxIdSnapshot || settings?.companyTaxId || 'N/A'}` })] }),
        new Paragraph({ children: [new TextRun({ text: `Endereço: ${supplier?.address || order.companyAddressSnapshot || settings?.companyAddress || 'N/A'}` })] }),
        new Paragraph({ children: [new TextRun({ text: `Telefone: ${supplier?.phone || 'N/A'}` })] }),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        // Customer Info
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "DADOS DO CLIENTE", bold: true, color: "2980b9", size: 18 })],
        }),
        new Paragraph({ children: [new TextRun({ text: customer?.name || order.customerNameSnapshot || 'N/A', bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: `CNPJ/CPF: ${customer?.taxId || order.customerTaxIdSnapshot || 'N/A'}` })] }),
        new Paragraph({ children: [new TextRun({ text: `Endereço: ${customer?.address || order.customerAddressSnapshot || 'N/A'}` })] }),
        new Paragraph({ children: [new TextRun({ text: `Telefone: ${customer?.phone || 'N/A'}` })] }),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        // Service Description
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "DESCRIÇÃO DO SERVIÇO", bold: true, color: "2980b9", size: 18 })],
        }),
        new Paragraph({ children: [new TextRun({ text: order.description || "Nenhum serviço descrito." })] }),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        // Parts Table
        ...(order.parts.length > 0 ? [
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "PEÇAS E MATERIAIS", bold: true, color: "2980b9", size: 18 })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Item", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Qtd", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Preço Unit.", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Total", bold: true })] })] }),
                ],
              }),
              ...order.parts.map(part => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: part.name })] }),
                  new TableCell({ children: [new Paragraph({ text: part.quantity.toString() })] }),
                  new TableCell({ children: [new Paragraph({ text: `R$ ${part.price.toFixed(2)}` })] }),
                  new TableCell({ children: [new Paragraph({ text: `R$ ${(part.quantity * part.price).toFixed(2)}` })] }),
                ],
              })),
            ],
          }),
        ] : []),

        new Paragraph({ text: "", spacing: { after: 400 } }),

        // Summary
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: "Peças: ", bold: true }),
            new TextRun({ text: `R$ ${(order.parts || []).reduce((acc, p) => acc + (p.quantity * p.price), 0).toFixed(2)}` }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: "Mão de Obra: ", bold: true }),
            new TextRun({ text: `R$ ${(order.laborCost || 0).toFixed(2)}` }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: "Deslocamento: ", bold: true }),
            new TextRun({ text: `R$ ${(Number(order.kmDriven) * Number(order.kmValue)).toFixed(2)}` }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: "TOTAL: ", bold: true, size: 28, color: "2980b9" }),
            new TextRun({ text: `R$ ${order.totalValue.toFixed(2)}`, bold: true, size: 28, color: "2980b9" }),
          ],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${order.status === 'budget' ? 'Orcamento' : 'OS'}_${orderNumber}.docx`;
  saveAs(blob, fileName);
};

export const generateTechnicalReportWord = async (
  order: ServiceOrder,
  customer: Customer | null,
  technicians: Technician[],
  settings: Settings | null,
  reportData: {
    description: string;
    procedures: string;
    nonConformities: string;
  },
  supplier?: Supplier | null
) => {
  const companyName = supplier?.name || order.companyNameSnapshot || settings?.companyName || 'ServiceFlow';
  const orderNumber = order.orderNumber || order.id.substring(0, 8).toUpperCase();
  const dateStr = format(new Date(), 'dd/MM/yyyy HH:mm');

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: "RELATÓRIO TÉCNICO", bold: true, size: 24, color: "2980b9" }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),

        new Paragraph({ children: [new TextRun({ text: `Empresa: ${companyName}`, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: `OS Nº: ${orderNumber}` })] }),
        new Paragraph({ children: [new TextRun({ text: `Data do Relatório: ${dateStr}` })] }),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "DETALHES DO SERVIÇO", bold: true, color: "2980b9", size: 18 })],
        }),
        new Paragraph({ children: [new TextRun({ text: reportData.description || "Não informada." })] }),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "PROCEDIMENTOS REALIZADOS", bold: true, color: "2980b9", size: 18 })],
        }),
        new Paragraph({ children: [new TextRun({ text: reportData.procedures || "Não informados." })] }),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "NÃO CONFORMIDADES ENCONTRADAS", bold: true, color: "2980b9", size: 18 })],
        }),
        new Paragraph({ children: [new TextRun({ text: reportData.nonConformities || "Nenhuma não conformidade relatada." })] }),

        new Paragraph({ text: "", spacing: { after: 400 } }),

        new Paragraph({
          children: [
            new TextRun({ text: "_______________________________________", bold: true }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Assinatura do Técnico", size: 16 }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `Relatorio_Tecnico_${orderNumber}.docx`;
  saveAs(blob, fileName);
};
