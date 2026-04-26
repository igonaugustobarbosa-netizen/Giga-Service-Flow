import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ServiceOrder, Customer, Supplier } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { 
  Plus, 
  Search, 
  Eye, 
  Trash2, 
  Calendar,
  DollarSign,
  Clock,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { Label } from '../components/ui/Label';
import { cn, handleFirestoreError, OperationType, parseDateSafely } from '../lib/utils';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { useAuth } from '../components/AuthGuard';
import { where } from 'firebase/firestore';
import { getActiveFollowUp, sendWhatsAppMessage, formatFollowUpMessage } from '../services/followUpService';
import { MessageSquare, Bell } from 'lucide-react';
import { logActivity } from '../services/activityService';
import { toast } from 'sonner';

export default function ServiceOrders() {
  const navigate = useNavigate();
  const { userData, isAdmin } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    customerId: '',
    startDate: '',
    endDate: ''
  });
  const [closeOrderDialog, setCloseOrderDialog] = useState<{
    isOpen: boolean;
    orderId: string;
  }>({ isOpen: false, orderId: '' });

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
    if (!userData) return;

    const ordersRef = collection(db, 'serviceOrders');
    const customersRef = collection(db, 'customers');
    const suppliersRef = collection(db, 'suppliers');

    const qOrders = isAdmin
      ? query(ordersRef, orderBy('createdAt', 'desc'))
      : query(ordersRef, where('tenantId', '==', userData.tenantId), orderBy('createdAt', 'desc'));

    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrder));
      setOrders(data);
      setLoading(false);
    }, (error) => {
      console.error('Erro ao carregar ordens:', error);
      setLoading(false);
      toast.error('Erro ao carregar lista de ordens. Verifique as permissões.');
    });

    const qCustomers = isAdmin
      ? query(customersRef)
      : query(customersRef, where('tenantId', '==', userData.tenantId));

    const unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(data);
    }, (error) => {
      console.error('Erro ao carregar clientes:', error);
    });

    const qSuppliers = isAdmin
      ? query(suppliersRef)
      : query(suppliersRef, where('tenantId', '==', userData.tenantId));

    const unsubscribeSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any) as Supplier);
      setSuppliers(data);
    }, (error) => {
      console.error('Erro ao carregar fornecedores:', error);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeCustomers();
      unsubscribeSuppliers();
    };
  }, [userData, isAdmin]);

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Ordem de Serviço',
      description: 'Tem certeza que deseja excluir esta ordem de serviço? Esta ação não pode ser desfeita.',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          const order = orders.find(o => o.id === id);
          await deleteDoc(doc(db, 'serviceOrders', id));
          if (order && userData) {
            logActivity({
              type: 'delete',
              entity: 'order',
              entityId: id,
              entityName: order.orderNumber || id,
              userId: userData.id,
              userName: userData.name,
              tenantId: userData.tenantId
            });
          }
        } catch (error) {
          toast.error('Não foi possível excluir a ordem de serviço.');
          handleFirestoreError(error, OperationType.DELETE, `serviceOrders/${id}`);
        }
      }
    });
  };

  const handleCloseOrder = (id: string) => {
    setCloseOrderDialog({ isOpen: true, orderId: id });
  };

  const handleStatusUpdate = async (status: ServiceOrder['status']) => {
    if (!closeOrderDialog.orderId) return;
    
    try {
      const order = orders.find(o => o.id === closeOrderDialog.orderId);
      await updateDoc(doc(db, 'serviceOrders', closeOrderDialog.orderId), {
        status,
        updatedAt: new Date().toISOString()
      });
      
      if (order && userData) {
        logActivity({
          type: 'update',
          entity: 'order',
          entityId: closeOrderDialog.orderId,
          entityName: `${order.orderNumber || closeOrderDialog.orderId} (Status: ${status})`,
          userId: userData.id,
          userName: userData.name,
          tenantId: userData.tenantId
        });
      }

      setCloseOrderDialog({ isOpen: false, orderId: '' });
      toast.success('Status atualizado com sucesso!');
    } catch (error) {
      toast.error('Não foi possível atualizar o status.');
      handleFirestoreError(error, OperationType.UPDATE, `serviceOrders/${closeOrderDialog.orderId}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'budget': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Orçamento</Badge>;
      case 'in-progress': return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Em Andamento</Badge>;
      case 'closed': return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Fechada</Badge>;
      case 'paid': return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">Faturada Paga</Badge>;
      case 'pending-payment': return <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200">Aguardando Pagamento</Badge>;
      default: return null;
    }
  };

  const filteredOrders = orders.filter(order => {
    const customer = customers.find(c => c.id === order.customerId);
    const customerName = customer?.name.toLowerCase() || '';
    const description = (order.description || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    
    const matchesSearch = customerName.includes(search) || description.includes(search);
    const matchesStatus = !filters.status || order.status === filters.status;
    const matchesCustomer = !filters.customerId || order.customerId === filters.customerId;
    
    // Date filtering
    const orderDate = parseDateSafely(order.executionDate || order.createdAt);
    const start = filters.startDate ? new Date(filters.startDate) : null;
    const end = filters.endDate ? new Date(filters.endDate) : null;
    
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    
    const matchesDate = (!start || orderDate >= start) && (!end || orderDate <= end);

    return matchesSearch && matchesStatus && matchesCustomer && matchesDate;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ordens de Serviço</h1>
          <p className="text-muted-foreground">Gerencie seus orçamentos e serviços em andamento.</p>
        </div>
        <Link to="/orders/new">
          <Button className="gap-2 h-12 px-6 rounded-xl shadow-lg">
            <Plus className="w-5 h-5" />
            Nova Ordem
          </Button>
        </Link>
      </div>

      <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="search">Busca Geral</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="search"
                  placeholder="Cliente ou descrição..." 
                  className="pl-10 h-10 rounded-lg bg-background border-none shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                id="status"
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="h-10 rounded-lg bg-background border-none shadow-inner"
              >
                <option value="">Todos</option>
                <option value="budget">Orçamento</option>
                <option value="in-progress">Em Andamento</option>
                <option value="closed">Fechada</option>
                <option value="paid">Faturada Paga</option>
                <option value="pending-payment">Aguardando Pagamento</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer">Cliente</Label>
              <Select 
                id="customer"
                value={filters.customerId}
                onChange={(e) => setFilters(prev => ({ ...prev, customerId: e.target.value }))}
                className="h-10 rounded-lg bg-background border-none shadow-inner"
              >
                <option value="">Todos os Clientes</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                className="flex-1 h-10 rounded-lg"
                onClick={() => {
                  setSearchTerm('');
                  setFilters({
                    status: '',
                    customerId: '',
                    startDate: '',
                    endDate: ''
                  });
                }}
              >
                Limpar
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">De (Data Exec.)</Label>
              <Input 
                id="startDate"
                type="date"
                className="h-10 rounded-lg bg-background border-none shadow-inner"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Até (Data Exec.)</Label>
              <Input 
                id="endDate"
                type="date"
                className="h-10 rounded-lg bg-background border-none shadow-inner"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredOrders.map((order, i) => {
            const customer = customers.find(c => c.id === order.customerId);
            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card 
                  className="relative group border-none shadow-sm bg-orange-50/20 backdrop-blur-sm hover:bg-orange-50/40 hover:shadow-md transition-all overflow-hidden"
                >
                  <Link 
                    to={`/orders/${order.id}`} 
                    className="absolute inset-0 z-0 block cursor-pointer" 
                    aria-label={`Ver detalhes da ordem ${order.orderNumber}`}
                  />
                  <div className="relative z-10 pointer-events-none flex flex-col md:flex-row w-full h-full">
                    <div className={cn(
                      "w-2 md:w-3",
                      order.status === 'budget' ? "bg-blue-500" : 
                      order.status === 'in-progress' ? "bg-orange-500" : "bg-green-500"
                    )} />
                    <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-bold">{customer?.name || 'Cliente não encontrado (ou excluído)'}</h3>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="bg-muted text-muted-foreground font-mono">
                              N° {order.orderNumber || order.id.substring(0, 8).toUpperCase()}
                            </Badge>
                            {getStatusBadge(order.status)}
                            {order.status === 'budget' && (
                              (() => {
                                const alert = getActiveFollowUp(order);
                                if (!alert) return null;
                                return (
                                  <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 animate-pulse gap-1">
                                    <Bell className="w-3 h-3" />
                                    Follow-up: {alert.days}d
                                  </Badge>
                                );
                              })()
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{order.description}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{format(parseDateSafely(order.executionDate || order.createdAt), 'dd/MM/yyyy', { locale: ptBR })}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            <span className="font-bold text-foreground">R$ {order.totalValue.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{order.hoursWorked}h trabalhadas</span>
                          </div>
                          {order.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate max-w-[200px]">{order.location.address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-3 shrink-0 flex-wrap pt-4 lg:pt-0 border-t lg:border-none pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        {order.status === 'budget' && (
                          (() => {
                            const alert = getActiveFollowUp(order);
                            if (!alert) return null;
                            return (
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-12 w-12 lg:h-10 lg:w-10 text-blue-600 border-blue-200 hover:bg-blue-50 shrink-0"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (customer?.phone) {
                                    const supplier = suppliers.find(s => s.id === order.supplierId);
                                    const formattedMessage = formatFollowUpMessage(alert.message, order, supplier?.name || '');
                                    sendWhatsAppMessage(customer.phone, formattedMessage);
                                  }
                                }}
                                title={alert.label}
                              >
                                <MessageSquare className="w-5 h-5" />
                              </Button>
                            );
                          })()
                        )}
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className={cn(
                            "h-12 w-12 lg:h-10 lg:w-10 border-green-200 hover:bg-green-50 shrink-0",
                            (order.status === 'closed' || order.status === 'paid' || order.status === 'pending-payment') ? "text-primary border-primary/20 hover:bg-primary/5" : "text-green-600"
                          )}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCloseOrder(order.id);
                          }}
                          title="Alterar Status"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </Button>
                        <Button 
                          variant="secondary" 
                          className="gap-2 h-12 px-5 lg:h-10 lg:px-4 shrink-0 font-bold"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/orders/${order.id}`);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                          <span>Detalhes</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-12 w-12 lg:h-10 lg:w-10 bg-background/50 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all shrink-0" 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(order.id);
                          }}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
      />

      <Dialog open={closeOrderDialog.isOpen} onOpenChange={(open) => setCloseOrderDialog(prev => ({ ...prev, isOpen: open }))}>
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
            <Button variant="ghost" onClick={() => setCloseOrderDialog({ isOpen: false, orderId: '' })}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
