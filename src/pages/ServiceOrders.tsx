import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ServiceOrder, Customer } from '../types';
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
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '../components/ui/Badge';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../components/AuthGuard';
import { where } from 'firebase/firestore';

export default function ServiceOrders() {
  const { userData, isAdmin } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
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
    if (!userData) return;

    const ordersRef = collection(db, 'serviceOrders');
    const customersRef = collection(db, 'customers');

    const qOrders = isAdmin
      ? query(ordersRef, orderBy('createdAt', 'desc'))
      : query(ordersRef, where('tenantId', '==', userData.tenantId), orderBy('createdAt', 'desc'));

    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrder));
      setOrders(data);
      setLoading(false);
    });

    const qCustomers = isAdmin
      ? query(customersRef)
      : query(customersRef, where('tenantId', '==', userData.tenantId));

    const unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(data);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeCustomers();
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
          await deleteDoc(doc(db, 'serviceOrders', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `serviceOrders/${id}`);
        }
      }
    });
  };

  const handleCloseOrder = async (id: string) => {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'budget': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Orçamento</Badge>;
      case 'in-progress': return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Em Andamento</Badge>;
      case 'closed': return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Fechada</Badge>;
      default: return null;
    }
  };

  const filteredOrders = orders.filter(order => {
    const customer = customers.find(c => c.id === order.customerId);
    const customerName = customer?.name.toLowerCase() || '';
    const description = order.description.toLowerCase();
    const search = searchTerm.toLowerCase();
    return customerName.includes(search) || description.includes(search);
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

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por cliente ou descrição..." 
          className="pl-10 h-11 rounded-xl bg-card/50 border-none shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

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
                <Card className="group border-none shadow-sm bg-orange-50/20 backdrop-blur-sm hover:bg-orange-50/40 hover:shadow-md transition-all overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    <div className={cn(
                      "w-2 md:w-3",
                      order.status === 'budget' ? "bg-blue-500" : 
                      order.status === 'in-progress' ? "bg-orange-500" : "bg-green-500"
                    )} />
                    <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold">{customer?.name || 'Cliente não encontrado'}</h3>
                          <Badge variant="secondary" className="bg-muted text-muted-foreground font-mono">
                            N° {order.orderNumber || order.id.substring(0, 8).toUpperCase()}
                          </Badge>
                          {getStatusBadge(order.status)}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{order.description}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{format(new Date(order.createdAt), 'dd/MM/yyyy', { locale: ptBR })}</span>
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
                      <div className="flex items-center gap-2">
                        {order.status !== 'closed' && (
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => handleCloseOrder(order.id)}
                            title="Encerrar Ordem"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Link to={`/orders/${order.id}`}>
                          <Button variant="secondary" className="gap-2">
                            <Eye className="w-4 h-4" />
                            Detalhes
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(order.id)}>
                          <Trash2 className="w-4 h-4" />
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
    </div>
  );
}
