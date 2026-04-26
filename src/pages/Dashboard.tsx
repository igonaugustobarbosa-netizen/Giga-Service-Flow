import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase';
import { ServiceOrder, Customer, Supplier } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { 
  ClipboardList, 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  AlarmClock,
  Calendar,
  Plus,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '../components/ui/Badge';
import { cn, parseDateSafely } from '../lib/utils';
import { getActiveFollowUp, sendWhatsAppMessage, formatFollowUpMessage } from '../services/followUpService';
import { MessageSquare, Bell } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LabelList
} from 'recharts';

import { useAuth } from '../components/AuthGuard';

export default function Dashboard() {
  const { userData, isAdmin } = useAuth();
  const [recentOrders, setRecentOrders] = useState<ServiceOrder[]>([]);
  const [allOrders, setAllOrders] = useState<ServiceOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const handlePrevMonth = () => setSelectedDate(subMonths(selectedDate, 1));
  const handleNextMonth = () => setSelectedDate(addMonths(selectedDate, 1));

  useEffect(() => {
    if (!userData) return;

    const ordersRef = collection(db, 'serviceOrders');
    const customersRef = collection(db, 'customers');
    const suppliersRef = collection(db, 'suppliers');

    // Query for recent orders (limit 10)
    const qRecent = isAdmin 
      ? query(ordersRef, orderBy('createdAt', 'desc'), limit(10))
      : query(ordersRef, where('tenantId', '==', userData.tenantId), orderBy('createdAt', 'desc'), limit(10));

    const unsubscribeRecent = onSnapshot(qRecent, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrder));
      setRecentOrders(data);
      setLoading(false);
    }, (error) => {
      console.error('Erro ao carregar ordens recentes:', error);
      setLoading(false);
    });

    // Query for all orders (for stats)
    const qAll = isAdmin
      ? query(ordersRef)
      : query(ordersRef, where('tenantId', '==', userData.tenantId));

    const unsubscribeAll = onSnapshot(qAll, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrder));
      setAllOrders(data);
    }, (error) => {
      console.error('Erro ao carregar todas as ordens:', error);
    });

    const qCustomers = isAdmin
      ? query(customersRef)
      : query(customersRef, where('tenantId', '==', userData.tenantId));

    const unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
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
      unsubscribeRecent();
      unsubscribeAll();
      unsubscribeCustomers();
      unsubscribeSuppliers();
    };
  }, [userData, isAdmin]);

  const calculateTotal = (status?: string, orders = allOrders) => {
    return orders
      .filter(o => !status || o.status === status)
      .reduce((acc, o) => acc + o.totalValue, 0);
  };

  const getWorkedStats = (orders = allOrders, date = new Date()) => {
    const monthOrders = orders.filter(o => {
      const orderDate = parseDateSafely(o.executionDate || o.createdAt);
      return orderDate.getMonth() === date.getMonth() && orderDate.getFullYear() === date.getFullYear();
    });

    const workedHours = monthOrders.reduce((acc, o) => acc + (o.hoursWorked || 0), 0);
    const workedDays = new Set(monthOrders.map(o => {
      const orderDate = parseDateSafely(o.executionDate || o.createdAt);
      return format(orderDate, 'yyyy-MM-dd');
    })).size;

    return { workedDays, workedHours, monthOrders };
  };

  const { workedDays, workedHours } = getWorkedStats(allOrders, new Date());

  // Chart Logic
  const filteredOrders = allOrders.filter(o => {
    const orderDate = parseDateSafely(o.executionDate || o.createdAt);
    return orderDate.getMonth() === selectedDate.getMonth() && 
           orderDate.getFullYear() === selectedDate.getFullYear();
  });

  const { workedHours: selectedMonthHours } = getWorkedStats(allOrders, selectedDate);

  const chartData = [
    { name: 'Pagas', value: calculateTotal('paid', filteredOrders), color: '#10b981' },
    { name: 'Pendente', value: calculateTotal('pending-payment', filteredOrders), color: '#a855f7' },
    { name: 'Orçamento', value: calculateTotal('budget', filteredOrders), color: '#3b82f6' },
    { name: 'Em Aberto', value: calculateTotal('in-progress', filteredOrders), color: '#f97316' },
    { name: 'Fechadas', value: calculateTotal('closed', filteredOrders), color: '#22c55e' },
    { name: 'Horas Trab.', value: selectedMonthHours, color: '#6366f1' },
    { name: 'Total Mês', value: calculateTotal(undefined, filteredOrders), color: '#f59e0b' },
  ];

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
      title: 'Trabalho (Mês)', 
      value: `${workedDays}d / ${workedHours}h`, 
      icon: Calendar, 
      color: 'bg-indigo-500/10 text-indigo-600' 
    },
    { 
      title: 'Faturamento Total', 
      value: `R$ ${calculateTotal().toFixed(2)}`, 
      icon: TrendingUp, 
      color: 'bg-primary/10 text-primary' 
    },
  ];

  const followUpOrders = allOrders
    .filter(o => o.status === 'budget')
    .map(o => ({ order: o, alert: getActiveFollowUp(o) }))
    .filter(item => item.alert !== null)
    .sort((a, b) => (b.alert?.days || 0) - (a.alert?.days || 0));

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
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
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Desempenho Mensal
              </CardTitle>
              <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-bold min-w-32 text-center uppercase">
                  {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis 
                      hide
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' 
                      }}
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Valor']}
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[6, 6, 0, 0]}
                      barSize={40}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                      <LabelList 
                        dataKey="value" 
                        position="top" 
                        formatter={(val: number) => val > 0 ? val.toFixed(0) : ''}
                        style={{ fontSize: '10px', fontWeight: 'bold' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {followUpOrders.length > 0 && (
            <Card className="border-none shadow-md bg-blue-600 text-white overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Bell className="w-5 h-5 animate-bounce" />
                  Lembretes de Orçamento Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {followUpOrders.slice(0, 3).map(({ order, alert }) => {
                    const customer = customers.find(c => c.id === order.customerId);
                    return (
                      <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-white/10 border border-white/20">
                        <div className="min-w-0">
                          <p className="font-bold truncate">{customer?.name || 'Cliente'}</p>
                          <p className="text-xs text-blue-100">{alert?.label}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link to={`/orders/${order.id}`}>
                            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 h-8 px-2">
                              Ver OS
                            </Button>
                          </Link>
                          <Button 
                            size="sm" 
                            className="bg-white text-blue-600 hover:bg-blue-50 h-8 gap-1 font-bold"
                            onClick={() => {
                              if (customer?.phone && alert) {
                                const supplier = suppliers.find(s => s.id === order.supplierId);
                                const formattedMessage = formatFollowUpMessage(alert.message, order, supplier?.name || '');
                                sendWhatsAppMessage(customer.phone, formattedMessage);
                              }
                            }}
                          >
                            <MessageSquare className="w-3 h-3" />
                            WhatsApp
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {followUpOrders.length > 3 && (
                    <p className="text-xs text-center text-blue-100 pt-2">
                      E mais {followUpOrders.length - 3} orçamentos aguardando retorno...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-sm bg-orange-50/30 backdrop-blur-sm">
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
                            <span>{format(parseDateSafely(order.executionDate || order.createdAt), 'dd MMM yyyy', { locale: ptBR })}</span>
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
      </div>

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
