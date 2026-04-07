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
  Trash2
} from 'lucide-react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '../components/ui/Badge';
import { generateServicePDF } from '../services/pdfService';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../components/AuthGuard';

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userData, isAdmin } = useAuth();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);

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
      if (snapshot.exists()) {
        const orderData = { id: snapshot.id, ...snapshot.data() } as ServiceOrder;
        
        // Security check (redundant but good for UX)
        if (!isAdmin && orderData.tenantId !== userData.tenantId) {
          navigate('/orders');
          return;
        }

        setOrder(orderData);

        // Load customer
        const custSnap = await getDoc(doc(db, 'customers', orderData.customerId));
        if (custSnap.exists()) {
          setCustomer({ id: custSnap.id, ...custSnap.data() } as Customer);
        }

        // Load technicians
        const techPromises = (orderData.technicianIds || []).map(tid => getDoc(doc(db, 'technicians', tid)));
        const techSnaps = await Promise.all(techPromises);
        setTechnicians(techSnaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() } as Technician)));

        // Load supplier
        if (orderData.supplierId) {
          const supplierSnap = await getDoc(doc(db, 'suppliers', orderData.supplierId));
          if (supplierSnap.exists()) {
            setSupplier({ id: supplierSnap.id, ...supplierSnap.data() } as Supplier);
          }
        } else {
          setSupplier(null);
        }
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `serviceOrders/${id}`);
      navigate('/orders');
    });

    return () => unsubscribe();
  }, [id, userData, isAdmin, navigate]);

  const handleGeneratePDF = () => {
    if (order && customer) {
      generateServicePDF(order, customer, technicians, supplier || undefined);
    }
  };

  const handleCloseOrder = async () => {
    if (!id) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Encerrar Ordem de Serviço',
      description: 'Deseja encerrar esta ordem de serviço?',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'serviceOrders', id), {
            status: 'closed',
            updatedAt: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `serviceOrders/${id}`);
        }
      }
    });
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

  if (loading) return <div>Carregando...</div>;
  if (!order || !customer) return <div>Ordem de serviço não encontrada.</div>;

  const partsTotal = order.parts.reduce((acc, p) => acc + (p.quantity * p.price), 0);
  const kmTotal = order.kmDriven * order.kmValue;

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
        <div className="flex items-center gap-2">
          {order.status !== 'closed' && (
            <Button variant="outline" className="gap-2 text-green-600 border-green-200 hover:bg-green-50" onClick={handleCloseOrder}>
              <CheckCircle2 className="w-4 h-4" />
              Encerrar
            </Button>
          )}
          <Button variant="outline" className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/5" onClick={handleDeleteOrder}>
            <Trash2 className="w-4 h-4" />
            Excluir
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleGeneratePDF}>
            <FileText className="w-4 h-4" />
            Gerar PDF
          </Button>
          <Link to={`/orders/${order.id}/edit`}>
            <Button className="gap-2">
              <Edit2 className="w-4 h-4" />
              Editar
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Main Info */}
          <Card className="border-none shadow-sm bg-orange-50/20 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Descrição do Serviço</CardTitle>
              {getStatusBadge(order.status)}
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-lg leading-relaxed">{order.description}</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div className="text-sm">
                    <p className="text-muted-foreground">Criado em</p>
                    <p className="font-bold">{format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
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
                          <img src={part.photoUrl} alt={part.name} className="w-full h-full object-cover" />
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
                  <div className="grid grid-cols-2 gap-4">
                    {order.beforePhotos.map((photo, index) => (
                      <div key={index} className="aspect-square rounded-xl overflow-hidden border">
                        <img src={photo} alt={`Antes ${index}`} className="w-full h-full object-cover" />
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
                  <div className="grid grid-cols-2 gap-4">
                    {order.afterPhotos.map((photo, index) => (
                      <div key={index} className="aspect-square rounded-xl overflow-hidden border">
                        <img src={photo} alt={`Depois ${index}`} className="w-full h-full object-cover" />
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
                <p className="font-bold">{customer.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Telefone</p>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  <p className="font-bold">{customer.phone}</p>
                </div>
              </div>
              {customer.email && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <p className="font-bold truncate">{customer.email}</p>
                  </div>
                </div>
              )}
              {customer.address && (
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
                <span>R$ {order.laborCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm opacity-80">
                <span>Deslocamento:</span>
                <span>R$ {kmTotal.toFixed(2)}</span>
              </div>

              {order.paymentMethod === 'pix' && supplier?.pixKey && (
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
    </div>
  );
}
