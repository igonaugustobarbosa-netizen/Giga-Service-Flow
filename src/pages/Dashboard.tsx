import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase';
import { ServiceOrder, Customer } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { 
  ClipboardList, 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Plus
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';

import { useAuth } from '../components/AuthGuard';

export default function Dashboard() {
  const { userData, isAdmin } = useAuth();
  const [recentOrders, setRecentOrders] = useState<ServiceOrder[]>([]);
  const [allOrders, setAllOrders] = useState<ServiceOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData) return;

    const ordersRef = collection(db, 'serviceOrders');
    const customersRef = collection(db, 'customers');

    // Query for recent orders (limit 10)
    const qRecent = isAdmin 
      ? query(ordersRef, orderBy('createdAt', 'desc'), limit(10))
      : query(ordersRef, where('tenantId', '==', userData.tenantId), orderBy('createdAt', 'desc'), limit(10));

    const unsubscribeRecent = onSnapshot(qRecent, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrder));
      setRecentOrders(data);
      setLoading(false);
    });

    // Query for all orders (for stats)
    const qAll = isAdmin
      ? query(ordersRef)
      : query(ordersRef, where('tenantId', '==', userData.tenantId));

    const unsubscribeAll = onSnapshot(qAll, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrder));
      setAllOrders(data);
    });

    const qCustomers = isAdmin
      ? query(customersRef)
      : query(customersRef, where('tenantId', '==', userData.tenantId));

    const unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(data);
    });

    return () => {
      unsubscribeRecent();
      unsubscribeAll();
      unsubscribeCustomers();
    };
  }, [userData, isAdmin]);

  const calculateTotal = (status?: string) => {
    return allOrders
      .filter(o => !status || o.status === status)
      .reduce((acc, o) => acc + o.totalValue, 0);
  };

  const stats = [
    { 
      title: 'Faturadas Pagas', 
      value: `R$ ${calculateTotal('paid').toFixed(2)}`, 
      icon: CheckCircle2, 
      color: 'bg-emerald-500/10 text-emerald-600' 
    },
    { 
      title: 'Aguardando Pagamento', 
      value: `R$ ${calculateTotal('pending-payment').toFixed(2)}`, 
      icon: Clock, 
      color: 'bg-purple-500/10 text-purple-600' 
    },
    { 
      title: 'Orçamentos', 
      value: `R$ ${calculateTotal('budget').toFixed(2)}`, 
      icon: ClipboardList, 
      color: 'bg-blue-500/10 text-blue-600' 
    },
    { 
      title: 'Em Andamento', 
      value: `R$ ${calculateTotal('in-progress').toFixed(2)}`, 
      icon: AlertCircle, 
      color: 'bg-orange-500/10 text-orange-600' 
    },
    { 
      title: 'Fechadas', 
      value: `R$ ${calculateTotal('closed').toFixed(2)}`, 
      icon: CheckCircle2, 
      color: 'bg-green-500/10 text-green-600' 
    },
    { 
      title: 'Faturamento Total', 
      value: `R$ ${calculateTotal().toFixed(2)}`, 
      icon: TrendingUp, 
      color: 'bg-primary/10 text-primary' 
    },
  ];

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu negócio e serviços recentes.</p>
        </div>
        <Link to="/orders/new">
          <Button className="gap-2 h-12 px-6 rounded-xl shadow-lg">
            <Plus className="w-5 h-5" />
            Nova Ordem de Serviço
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={cn("p-1.5 rounded-md", stat.color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold truncate">{stat.value}</div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm bg-orange-50/30 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Serviços Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <ClipboardList className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Nenhuma ordem de serviço encontrada.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => {
                  const customer = customers.find(c => c.id === order.customerId);
                  return (
                    <Link key={order.id} to={`/orders/${order.id}`}>
                      <div className="flex items-center justify-between p-4 rounded-xl border bg-background hover:bg-accent transition-colors group">
                        <div className="space-y-1">
                          <div className="font-semibold group-hover:text-primary transition-colors">
                            {customer?.name || 'Cliente não encontrado'}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{format(new Date((order.executionDate || order.createdAt).replace('Z', '')), 'dd MMM yyyy', { locale: ptBR })}</span>
                            <span>•</span>
                            <span>R$ {order.totalValue.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {getStatusBadge(order.status)}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-orange-50/30 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Clientes Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {customers.slice(0, 5).map((customer) => (
                <div key={customer.id} className="flex items-center gap-3 p-2">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    {customer.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{customer.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{customer.phone}</div>
                  </div>
                </div>
              ))}
              <Link to="/customers">
                <Button variant="ghost" className="w-full mt-4">Ver todos os clientes</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
