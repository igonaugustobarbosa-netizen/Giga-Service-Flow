import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, HeadingLevel, WidthType, VerticalAlign, PageBreak } from 'docx';
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
        ...(customer?.contactName || customer?.contactPhone ? [
          new Paragraph({ 
            children: [
              new TextRun({ text: "Contato: ", bold: true }),
              new TextRun({ text: `${customer.contactName || ''}${customer.contactName && customer.contactPhone ? ' | ' : ''}${customer.contactPhone || ''}` })
            ] 
          })
        ] : []),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        // Service Description
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "DESCRIÇÃO DO SERVIÇO", bold: true, color: "2980b9", size: 18 })],
        }),
        ...(order.description ? order.description.split('\n').map(line => 
          new Paragraph({
            children: [new TextRun({ text: line })],
            spacing: { after: 120 }
          })
        ) : [
          new Paragraph({ children: [new TextRun({ text: "Nenhum serviço descrito." })] })
        ]),

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
        new Paragraph({ children: [new TextRun({ text: `Cliente: ${customer?.name || order.customerNameSnapshot || 'N/A'}` })] }),
        ...(customer?.contactName ? [
          new Paragraph({ children: [new TextRun({ text: `Contato: ${customer.contactName}` })] })
        ] : []),
        new Paragraph({ children: [new TextRun({ text: `Data do Relatório: ${dateStr}` })] }),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "DETALHES DO SERVIÇO", bold: true, color: "2980b9", size: 18 })],
        }),
        ...(reportData.description ? reportData.description.split('\n').map(line => 
          new Paragraph({
            children: [new TextRun({ text: line })],
            spacing: { after: 120 }
          })
        ) : [
          new Paragraph({ children: [new TextRun({ text: "Não informada." })] })
        ]),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "PROCEDIMENTOS REALIZADOS", bold: true, color: "2980b9", size: 18 })],
        }),
        ...(reportData.procedures ? reportData.procedures.split('\n').map(line => 
          new Paragraph({
            children: [new TextRun({ text: line })],
            spacing: { after: 120 }
          })
        ) : [
          new Paragraph({ children: [new TextRun({ text: "Não informados." })] })
        ]),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "NÃO CONFORMIDADES ENCONTRADAS", bold: true, color: "2980b9", size: 18 })],
        }),
        ...(reportData.nonConformities ? reportData.nonConformities.split('\n').map(line => 
          new Paragraph({
            children: [new TextRun({ text: line })],
            spacing: { after: 120 }
          })
        ) : [
          new Paragraph({ children: [new TextRun({ text: "Nenhuma não conformidade relatada." })] })
        ]),

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

export const generateCommercialProposalWord = async (
  order: ServiceOrder,
  customer?: Customer,
  technicians: Technician[] = [],
  supplier?: Supplier,
  settings?: Settings | null
) => {
  const companyName = supplier?.name || order.companyNameSnapshot || settings?.companyName || 'ServiceFlow';
  const customerName = order.customerNameSnapshot || customer?.name || 'Cliente';
  const orderNumber = order.orderNumber || order.id.substring(0, 8).toUpperCase();
  const dateStr = format(new Date(), 'dd/MM/yyyy');

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Title
        new Paragraph({
          children: [
            new TextRun({ text: "PROPOSTA COMERCIAL", bold: true, size: 40, color: "2980b9" }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Ref: Orçamento Nº ${orderNumber}`, size: 20 }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),

        // Roles info
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({ children: [new TextRun({ text: "PREPARADO PARA:", bold: true, color: "2980b9", size: 18 })] }),
                    new Paragraph({ children: [new TextRun({ text: customerName, size: 18 })] }),
                    ...(customer?.contactName ? [
                      new Paragraph({ children: [new TextRun({ text: `Contato: ${customer.contactName}`, size: 18, bold: true })] })
                    ] : []),
                    new Paragraph({ children: [new TextRun({ text: customer?.email || '', size: 18 })] }),
                    new Paragraph({ children: [new TextRun({ text: customer?.phone || '', size: 18 })] }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({ children: [new TextRun({ text: "APRESENTADO POR:", bold: true, color: "2980b9", size: 18 })] }),
                    new Paragraph({ children: [new TextRun({ text: companyName, size: 18 })] }),
                    new Paragraph({ children: [new TextRun({ text: supplier?.email || '', size: 18 })] }),
                    new Paragraph({ children: [new TextRun({ text: supplier?.phone || '', size: 18 })] }),
                  ],
                }),
              ],
            }),
          ],
        }),

        new Paragraph({ text: "", spacing: { before: 200, after: 200 } }),

        // 1. Escopo
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "1. ESCOPO DO SERVIÇO", bold: true, color: "2980b9", size: 24 })],
          spacing: { before: 200, after: 100 }
        }),
        ...(order.description ? order.description.split('\n').map(line => 
          new Paragraph({
            children: [new TextRun({ text: line, size: 18 })],
            spacing: { after: 100 }
          })
        ) : [
          new Paragraph({
            children: [new TextRun({ text: "Descrição não informada.", size: 18 })],
            spacing: { after: 200 }
          })
        ]),

        // 2. Materiais
        ...(order.parts.length > 0 ? [
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "2. MATERIAIS E EQUIPAMENTOS", bold: true, color: "2980b9", size: 24 })],
            spacing: { before: 200, after: 100 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Item", bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Qtd", bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Subtotal", bold: true, size: 18 })] })] }),
                ],
              }),
              ...order.parts.map(p => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.name, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.quantity.toString(), size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `R$ ${(p.quantity * p.price).toFixed(2)}`, size: 18 })] })] }),
                ],
              })),
            ],
          }),
        ] : []),

        // 3. Investimento
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "3. INVESTIMENTO", bold: true, color: "2980b9", size: 24 })],
          spacing: { before: 400, after: 200 }
        }),
        
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Mão de Obra e Serviços", size: 18 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `R$ ${(order.laborCost || 0).toFixed(2)}`, size: 18 })], alignment: AlignmentType.RIGHT })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Materiais e Equipamentos", size: 18 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `R$ ${(order.parts.reduce((acc, p) => acc + (p.quantity * p.price), 0)).toFixed(2)}`, size: 18 })], alignment: AlignmentType.RIGHT })] }),
              ],
            }),
            ...( ( (order.kmDriven || 0) * (order.kmValue || 0) ) > 0 ? [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Deslocamento e Logística", size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `R$ ${((order.kmDriven || 0) * (order.kmValue || 0)).toFixed(2)}`, size: 18 })], alignment: AlignmentType.RIGHT })] }),
                ],
              })
            ] : []),
            new TableRow({
              children: [
                new TableCell({ 
                  shading: { fill: "2980b9" },
                  children: [new Paragraph({ children: [new TextRun({ text: "VALOR TOTAL DA PROPOSTA", bold: true, color: "ffffff", size: 18 })] })] 
                }),
                new TableCell({ 
                  shading: { fill: "2980b9" },
                  children: [new Paragraph({ children: [new TextRun({ text: `R$ ${order.totalValue.toFixed(2)}`, bold: true, color: "ffffff", size: 18 })], alignment: AlignmentType.RIGHT })] 
                }),
              ],
            }),
          ],
        }),

        // 4. Condições
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "4. CONDIÇÕES GERAIS", bold: true, color: "2980b9", size: 24 })],
          spacing: { before: 400, after: 200 }
        }),
        new Paragraph({ children: [new TextRun({ text: `• Forma de Pagamento: ${order.paymentMethod === 'pix' ? 'PIX' : order.paymentMethod || 'A combinar'}`, size: 18 })] }),
        new Paragraph({ children: [new TextRun({ text: '• Validade: 30 dias para esta proposta.', size: 18 })] }),
        new Paragraph({ children: [new TextRun({ text: '• Garantia: 90 dias para serviços e materiais (conforme fabricante).', size: 18 })] }),
        new Paragraph({ children: [new TextRun({ text: '• Nota: Prazo de execução conforme disponibilidade técnica.', size: 18 })] }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `Proposta_${orderNumber}_${customerName.replace(/\s+/g, '_')}.docx`;
  saveAs(blob, fileName);
};
