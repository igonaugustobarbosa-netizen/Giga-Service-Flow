import React, { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ServiceOrder, Customer, Technician, Supplier } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { 
  FileText, 
  Edit2, 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Clock, 
  Truck, 
  Wrench,
  User,
  Building2,
  Phone,
  Mail,
  Camera,
  CreditCard,
  CheckCircle2,
  Trash2,
  DollarSign
} from 'lucide-react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '../components/ui/Badge';
import { generateServicePDF } from '../services/pdfService';
import { cn, handleFirestoreError, OperationType, parseDateSafely } from '../lib/utils';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { useAuth } from '../components/AuthGuard';
import { getActiveFollowUp, sendWhatsAppMessage, formatFollowUpMessage } from '../services/followUpService';
import { MessageSquare, Bell } from 'lucide-react';
import { logActivity } from '../services/activityService';
import { toast } from 'sonner';

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userData, isAdmin } = useAuth();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [closeOrderDialog, setCloseOrderDialog] = useState(false);

  const handleDeletePhoto = async (type: 'before' | 'after', index: number) => {
    if (!order || !id) return;
    
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Foto',
      description: 'Tem certeza que deseja excluir esta foto permanentemente?',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          const updatedPhotos = type === 'before' 
            ? [...(order.beforePhotos || [])].filter((_, i) => i !== index)
            : [...(order.afterPhotos || [])].filter((_, i) => i !== index);
          
          await updateDoc(doc(db, 'serviceOrders', id), {
            [type === 'before' ? 'beforePhotos' : 'afterPhotos']: updatedPhotos
          });
          
          if (userData) {
            logActivity({
              type: 'update',
              entity: 'order',
              entityId: id,
              entityName: `${order.orderNumber || id} (Foto excluída)`,
              userId: userData.id,
              userName: userData.name,
              tenantId: userData.tenantId
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `serviceOrders/${id}`);
        }
      }
    });
  };

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'default' | 'destructive';
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
    variant: 'default'
  });

  useEffect(() => {
    if (!id || !userData) return;

    const unsubscribe = onSnapshot(doc(db, 'serviceOrders', id), async (snapshot) => {
      try {
        if (snapshot.exists()) {
          const orderData = { id: snapshot.id, ...snapshot.data() } as ServiceOrder;
          
          // Security check (redundant but good for UX)
          // Relaxed for backward compatibility with orders that might not have tenantId
          if (!isAdmin && orderData.tenantId && userData.tenantId && orderData.tenantId !== userData.tenantId) {
            navigate('/orders');
            return;
          }

          // Set order immediately so basic info shows up
          setOrder(orderData);

          // Load related data in parallel with independent error handling
          const loadRelatedData = async () => {
            // Load customer
            try {
              if (orderData.customerId) {
                const custSnap = await getDoc(doc(db, 'customers', orderData.customerId));
                if (custSnap.exists()) {
                  setCustomer({ id: custSnap.id, ...custSnap.data() } as Customer);
                }
              }
            } catch (err) {
              console.error('Erro ao carregar cliente:', err);
            }

            // Load technicians
            try {
              const ids = orderData.technicianIds || [];
              if (ids.length > 0) {
                const techPromises = ids.map(tid => getDoc(doc(db, 'technicians', tid)));
                const techSnaps = await Promise.all(techPromises);
                setTechnicians(techSnaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() } as Technician)));
              } else {
                setTechnicians([]);
              }
            } catch (err) {
              console.error('Erro ao carregar técnicos:', err);
            }

            // Load supplier
            try {
              if (orderData.supplierId) {
                const supplierSnap = await getDoc(doc(db, 'suppliers', orderData.supplierId));
                if (supplierSnap.exists()) {
                  setSupplier({ id: supplierSnap.id, ...supplierSnap.data() } as Supplier);
                }
              } else {
                setSupplier(null);
              }
            } catch (err) {
              console.error('Erro ao carregar fornecedor:', err);
            }
          };

          loadRelatedData();
        } else {
          toast.error('Ordem de serviço não encontrada.');
          navigate('/orders');
        }
      } catch (error) {
        console.error('Erro ao processar dados da ordem:', error);
        toast.error('Erro ao carregar detalhes da ordem.');
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error('Erro no snapshot da ordem:', error);
      toast.error('Sem permissão para acessar esta ordem.');
      navigate('/orders');
    });

    return () => unsubscribe();
  }, [id, userData, isAdmin, navigate]);

  const handleGeneratePDF = () => {
    if (order) {
      if (customer) {
        generateServicePDF(order, customer, technicians, supplier || undefined);
      } else {
        toast.error('Não é possível gerar o PDF pois o cliente original foi excluído. Por favor, edite a ordem e selecione um novo cliente.');
      }
    }
  };

  const handleCloseOrder = () => {
    setCloseOrderDialog(true);
  };

  const handleStatusUpdate = async (status: ServiceOrder['status']) => {
    if (!id) return;
    
    try {
      await updateDoc(doc(db, 'serviceOrders', id), {
        status,
        updatedAt: new Date().toISOString()
      });

      if (order && userData) {
        logActivity({
          type: 'update',
          entity: 'order',
          entityId: id,
          entityName: `${order.orderNumber || id} (Status: ${status})`,
          userId: userData.id,
          userName: userData.name,
          tenantId: userData.tenantId
        });
      }

      setCloseOrderDialog(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `serviceOrders/${id}`);
    }
  };

  const handleDeleteOrder = async () => {
    if (!id) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Ordem de Serviço',
      description: 'Tem certeza que deseja excluir esta ordem de serviço? Esta ação não pode ser desfeita.',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'serviceOrders', id));
          navigate('/orders');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `serviceOrders/${id}`);
        }
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'budget': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-sm px-3 py-1">Orçamento</Badge>;
      case 'in-progress': return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 text-sm px-3 py-1">Em Andamento</Badge>;
      case 'closed': return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-sm px-3 py-1">Fechada</Badge>;
      case 'paid': return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-sm px-3 py-1">Faturada Paga</Badge>;
      case 'pending-payment': return <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200 text-sm px-3 py-1">Aguardando Pagamento</Badge>;
      default: return null;
    }
  };

  const getPaymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'pix': return 'PIX';
      case 'cash': return 'Dinheiro';
      case 'credit': return 'Cartão de Crédito';
      case 'debit': return 'Cartão de Débito';
      default: return 'Não informado';
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <span className="ml-3">Carregando detalhes...</span>
    </div>
  );
  
  if (!order) return (
    <div className="p-8 text-center">
      <p className="text-destructive mb-4">Ordem de serviço não encontrada.</p>
      <Link to="/orders">
        <Button variant="outline">Voltar para Ordens</Button>
      </Link>
    </div>
  );

  // Even if customer is deleted, we should show the order information
  // We'll show "Cliente excluído" if customer is null
  const displayCustomerName = customer?.name || 'Cliente não encontrado (ou excluído)';

  const partsTotal = (order.parts || []).reduce((acc, p) => acc + (Number(p.quantity || 0) * Number(p.price || 0)), 0);
  const kmTotal = (Number(order.kmDriven) || 0) * (Number(order.kmValue) || 0);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/orders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Detalhes da Ordem</h1>
            <p className="text-muted-foreground font-mono">OS N° {order.orderNumber || order.id.substring(0, 8).toUpperCase()}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className={cn(
              "gap-2 border-green-200 hover:bg-green-50",
              (order.status === 'closed' || order.status === 'paid' || order.status === 'pending-payment') ? "text-primary border-primary/20 hover:bg-primary/5" : "text-green-600"
            )}
            onClick={handleCloseOrder}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline">{ (order.status === 'closed' || order.status === 'paid' || order.status === 'pending-payment') ? 'Status' : 'Encerrar' }</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/5" onClick={handleDeleteOrder}>
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Excluir</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleGeneratePDF}>
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Link to={`/orders/${order.id}/edit`}>
            <Button size="sm" className="gap-2">
              <Edit2 className="w-4 h-4" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Follow-up Alert */}
          {order.status === 'budget' && (() => {
            const alert = getActiveFollowUp(order);
            if (!alert) return null;
            return (
              <Card className="border-none shadow-lg bg-blue-600 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Bell className="w-24 h-24" />
                </div>
                <CardContent className="p-6 relative">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 animate-bounce">
                      <MessageSquare className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-xl font-bold mb-1">{alert.label}</h3>
                      <p className="text-blue-100 italic mb-4">"{alert.message}"</p>
                      <Button 
                        className="bg-white text-blue-600 hover:bg-blue-50 gap-2 font-bold"
                        onClick={() => {
                          if (customer?.phone) {
                            const formattedMessage = formatFollowUpMessage(alert.message, order, supplier?.name || '');
                            sendWhatsAppMessage(customer.phone, formattedMessage);
                          } else {
                            toast.error('Não é possível enviar o WhatsApp pois o cliente or telefone não foram encontrados.');
                          }
                        }}
                      >
                        <MessageSquare className="w-5 h-5" />
                        Enviar Lembrete via WhatsApp
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Main Info */}
          <Card className="border-none shadow-sm bg-orange-50/20 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Descrição do Serviço</CardTitle>
              {getStatusBadge(order.status)}
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-lg leading-relaxed">{order.description}</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div className="text-sm">
                    <p className="text-muted-foreground">Data da Abertura</p>
                    <p className="font-bold">
                      {order.createdAt ? (() => {
                        try {
                          // Strip 'Z' to force local time interpretation and avoid day shift
                          const dateStr = order.createdAt.includes('Z') ? order.createdAt.replace('Z', '') : order.createdAt;
                          return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: ptBR });
                        } catch (e) {
                          return 'Data inválida';
                        }
                      })() : 'Não informada'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div className="text-sm">
                    <p className="text-muted-foreground">Data de Execução</p>
                    <p className="font-bold">
                      {format(parseDateSafely(order.executionDate || order.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <div className="text-sm">
                    <p className="text-muted-foreground">Horas</p>
                    <p className="font-bold">{order.hoursWorked}h trabalhadas</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-primary" />
                  <div className="text-sm">
                    <p className="text-muted-foreground">Deslocamento</p>
                    <p className="font-bold">{order.kmDriven} km</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  <div className="text-sm">
                    <p className="text-muted-foreground">Pagamento</p>
                    <p className="font-bold">{getPaymentMethodLabel(order.paymentMethod)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parts */}
          <Card className="border-none shadow-sm bg-orange-50/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                Peças e Materiais
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.parts.length === 0 ? (
                <p className="text-muted-foreground italic">Nenhuma peça utilizada.</p>
              ) : (
                <div className="space-y-4">
                  {order.parts.map((part, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 rounded-xl border bg-background">
                      <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden border flex-shrink-0">
                        {part.photoUrl ? (
                          <img src={part.photoUrl} alt={part.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Camera className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{part.name}</p>
                        <p className="text-sm text-muted-foreground">Qtd: {part.quantity} • R$ {part.price.toFixed(2)}/un</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">R$ {(part.quantity * part.price).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Photos: Before and After */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {order.beforePhotos && order.beforePhotos.length > 0 && (
              <Card className="border-none shadow-sm bg-orange-50/20 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-primary" />
                    Fotos: Antes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {order.beforePhotos.map((photo, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded-xl border bg-background/50 group">
                        <div className="w-20 h-20 rounded-lg overflow-hidden border shrink-0">
                          <img src={photo} alt={`Antes ${index}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">Foto {index + 1}</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 bg-background/50 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all shrink-0"
                          onClick={() => handleDeletePhoto('before', index)}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {order.afterPhotos && order.afterPhotos.length > 0 && (
              <Card className="border-none shadow-sm bg-orange-50/20 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-primary" />
                    Fotos: Depois
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {order.afterPhotos.map((photo, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded-xl border bg-background/50 group">
                        <div className="w-20 h-20 rounded-lg overflow-hidden border shrink-0">
                          <img src={photo} alt={`Depois ${index}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">Foto {index + 1}</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 bg-background/50 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all shrink-0"
                          onClick={() => handleDeletePhoto('after', index)}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-8">
          {/* Customer Info */}
          <Card className="border-none shadow-sm bg-orange-50/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-bold">{customer?.name || 'Cliente excluído'}</p>
              </div>
              {customer?.phone && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary" />
                    <p className="font-bold">{customer.phone}</p>
                  </div>
                </div>
              )}
              {customer?.email && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <p className="font-bold truncate">{customer.email}</p>
                  </div>
                </div>
              )}
              {customer?.address && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Endereço</p>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary mt-1" />
                    <p className="font-bold text-sm">{customer.address}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Supplier Info */}
          {supplier && (
            <Card className="border-none shadow-sm bg-orange-50/20 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Fornecedor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Nome / Razão Social</p>
                  <p className="font-bold">{supplier.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary" />
                    <p className="font-bold">{supplier.phone}</p>
                  </div>
                </div>
                {supplier.taxId && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">CNPJ</p>
                    <p className="font-bold">{supplier.taxId}</p>
                  </div>
                )}
                {supplier.pixKey && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Chave PIX</p>
                    <p className="font-bold text-primary">{supplier.pixKey}</p>
                  </div>
                )}
                {supplier.paymentDetails && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Info. Pagamento</p>
                    <p className="font-bold">{supplier.paymentDetails}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Technicians */}
          <Card className="border-none shadow-sm bg-orange-50/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                Técnicos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {technicians.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg bg-background border">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs">
                      {t.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.specialty}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          {order.location && (
            <Card className="border-none shadow-sm bg-orange-50/20 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Localização do Serviço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm font-bold">{order.location.address}</p>
                <div className="aspect-video rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                  <a 
                    href={`https://www.google.com/maps?q=${order.location.latitude},${order.location.longitude}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full h-full flex flex-col items-center justify-center hover:bg-accent transition-colors"
                  >
                    <MapPin className="w-8 h-8 text-primary mb-2" />
                    <span className="text-xs font-medium">Ver no Google Maps</span>
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          <Card className="border-none shadow-sm bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle>Resumo Financeiro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm opacity-80">
                <span>Peças:</span>
                <span>R$ {partsTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm opacity-80">
                <span>Mão de Obra:</span>
                <div className="text-right">
                  {order.laborRate ? (
                    <p className="text-[10px] italic">({order.hoursWorked}h x R$ {order.laborRate.toFixed(2)})</p>
                  ) : null}
                  <span>R$ {order.laborCost.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-between text-sm opacity-80">
                <span>Deslocamento:</span>
                <span>R$ {kmTotal.toFixed(2)}</span>
              </div>

              {(order.discountPercent || 0) > 0 && (
                <div className="flex justify-between text-sm text-white font-medium">
                  <span>Desconto ({order.discountPercent}%):</span>
                  <span>- R$ {(order.discountValue || 0).toFixed(2)}</span>
                </div>
              )}

              {supplier?.pixKey && (
                <div className="mt-4 p-3 rounded-lg bg-white/10 border border-white/20">
                  <p className="text-[10px] uppercase font-bold text-white/70 mb-1">Chave PIX para Pagamento</p>
                  <p className="text-sm font-mono break-all text-white">
                    {supplier.pixKey}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-primary-foreground/20 flex justify-between text-2xl font-bold">
                <span>TOTAL:</span>
                <span>R$ {order.totalValue.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
      />

      <Dialog open={closeOrderDialog} onOpenChange={setCloseOrderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar Ordem de Serviço</DialogTitle>
            <p className="text-muted-foreground text-sm">Escolha o status final para esta ordem de serviço:</p>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-4">
            <Button 
              variant="outline" 
              className="justify-start h-14 px-4 border-green-200 hover:bg-green-50 hover:text-green-700"
              onClick={() => handleStatusUpdate('closed')}
            >
              <CheckCircle2 className="w-5 h-5 mr-3 text-green-600" />
              <div className="text-left">
                <p className="font-bold">Fechada</p>
                <p className="text-xs text-muted-foreground">Serviço concluído (padrão)</p>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="justify-start h-14 px-4 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={() => handleStatusUpdate('paid')}
            >
              <DollarSign className="w-5 h-5 mr-3 text-emerald-600" />
              <div className="text-left">
                <p className="font-bold">Faturada Paga</p>
                <p className="text-xs text-muted-foreground">Pagamento já recebido</p>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="justify-start h-14 px-4 border-purple-200 hover:bg-purple-50 hover:text-purple-700"
              onClick={() => handleStatusUpdate('pending-payment')}
            >
              <Clock className="w-5 h-5 mr-3 text-purple-600" />
              <div className="text-left">
                <p className="font-bold">Aguardando Pagamento</p>
                <p className="text-xs text-muted-foreground">Serviço feito, aguardando PIX/Cartão</p>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloseOrderDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
