import { ServiceOrder } from '../types';
import { differenceInDays, parseISO } from 'date-fns';

export interface FollowUpAlert {
  days: number;
  message: string;
  label: string;
}

export const FOLLOW_UP_ALERTS: FollowUpAlert[] = [
  { 
    days: 2, 
    label: 'Primeiro Alerta (2 dias)',
    message: "Olá! Conseguiu ver o orçamento {osNumber} de {osDate} ({supplierName}) que te enviei? Ficou com alguma dúvida?" 
  },
  { 
    days: 5, 
    label: 'Segundo Alerta (5 dias)',
    message: "Passando pra ver se conseguiu analisar o orçamento {osNumber} de {osDate} ({supplierName}). Se precisar ajustar algo ou tirar dúvidas, estou à disposição." 
  },
  { 
    days: 10, 
    label: 'Terceiro Alerta (10 dias)',
    message: "Estou organizando a agenda da próxima semana, ainda tem interesse em executar o serviço do orçamento {osNumber} de {osDate} ({supplierName})?" 
  },
  { 
    days: 15, 
    label: 'Quarto Alerta (15 dias)',
    message: "Como não tive retorno sobre o orçamento {osNumber} de {osDate} ({supplierName}), vou considerar que não será realizado no momento. Se precisar futuramente, fico à disposição!" 
  }
];

export function formatFollowUpMessage(
  message: string, 
  order: ServiceOrder, 
  supplierName: string
): string {
  const osNumber = order.orderNumber || order.id.substring(0, 8).toUpperCase();
  const osDate = parseISO(order.createdAt);
  const formattedDate = osDate.toLocaleDateString('pt-BR');
  
  return message
    .replaceAll('{osNumber}', `N° ${osNumber}`)
    .replaceAll('{osDate}', formattedDate)
    .replaceAll('{supplierName}', supplierName || 'Nossa Empresa');
}

export function getActiveFollowUp(order: ServiceOrder): FollowUpAlert | null {
  if (order.status !== 'budget') return null;

  const createdAt = parseISO(order.createdAt);
  const today = new Date();
  const daysDiff = differenceInDays(today, createdAt);

  const alerts = [...FOLLOW_UP_ALERTS].reverse();
  for (const alert of alerts) {
    if (daysDiff >= alert.days) {
      return alert;
    }
  }

  return null;
}

export function sendWhatsAppMessage(phone: string, message: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
}
