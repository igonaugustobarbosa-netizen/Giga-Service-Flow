import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ServiceOrder, Customer, Supplier, ServiceStatus } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { 
  FileText, 
  Download, 
  Filter, 
  Calendar,
  Users,
  Building2,
  TrendingUp,
  ClipboardList
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { generateReportPDF } from '../services/reportService';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../components/AuthGuard';

export default function Reports() {
  const { userData, isAdmin } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filters, setFilters] = useState({
    status: '' as ServiceStatus | '',
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    customerId: '',
    supplierId: ''
  });

  useEffect(() => {
    if (!userData) return;

    const customersRef = collection(db, 'customers');
    const suppliersRef = collection(db, 'suppliers');
    const ordersRef = collection(db, 'serviceOrders');

    // Load customers
    const qCustomers = isAdmin ? query(customersRef, orderBy('name')) : query(customersRef, where('tenantId', '==', userData.tenantId), orderBy('name'));
    const unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });

    // Load suppliers
    const qSuppliers = isAdmin ? query(suppliersRef, orderBy('name')) : query(suppliersRef, where('tenantId', '==', userData.tenantId), orderBy('name'));
    const unsubscribeSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });

    // Initial load of orders
    const loadOrders = async () => {
      setLoading(true);
      try {
        const q = isAdmin ? query(ordersRef, orderBy('createdAt', 'desc')) : query(ordersRef, where('tenantId', '==', userData.tenantId), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrder));
        setOrders(data);
      } catch (error) {
        console.error('Erro ao carregar ordens:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();

    return () => {
      unsubscribeCustomers();
      unsubscribeSuppliers();
    };
  }, [userData, isAdmin]);

  const filteredOrders = orders.filter(order => {
    const orderDate = new Date(order.executionDate || order.createdAt);
    const start = filters.startDate ? new Date(filters.startDate) : null;
    const end = filters.endDate ? new Date(filters.endDate) : null;
    
    // Set hours to 0 for date-only comparison
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);

    const matchesStatus = !filters.status || order.status === filters.status;
    const matchesCustomer = !filters.customerId || order.customerId === filters.customerId;
    const matchesSupplier = !filters.supplierId || order.supplierId === filters.supplierId;
    const matchesDate = (!start || orderDate >= start) && (!end || orderDate <= end);

    return matchesStatus && matchesCustomer && matchesSupplier && matchesDate;
  });

  const totalBilling = filteredOrders.reduce((acc, order) => acc + order.totalValue, 0);

  const handleGeneratePDF = () => {
    generateReportPDF(filteredOrders, customers, suppliers, filters);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground">Analise o faturamento e desempenho do seu negócio.</p>
        </div>
        <Button 
          onClick={handleGeneratePDF} 
          className="gap-2 h-12 px-6 rounded-xl shadow-lg"
          disabled={filteredOrders.length === 0}
        >
          <Download className="w-5 h-5" />
          Exportar PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm bg-orange-50/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" />
                Filtros
              </CardTitle>
              <CardDescription>Refine os dados do relatório.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  id="status" 
                  value={filters.status} 
                  onChange={e => setFilters({...filters, status: e.target.value as ServiceStatus | ''})}
                >
                  <option value="">Todos os Status</option>
                  <option value="budget">Orçamento</option>
                  <option value="in-progress">Em Andamento</option>
                  <option value="closed">Fechada</option>
                  <option value="paid">Faturada Paga</option>
                  <option value="pending-payment">Aguardando Pagamento</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inicial</Label>
                <Input 
                  id="startDate" 
                  type="date" 
                  value={filters.startDate} 
                  onChange={e => setFilters({...filters, startDate: e.target.value})} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">Data Final</Label>
                <Input 
                  id="endDate" 
                  type="date" 
                  value={filters.endDate} 
                  onChange={e => setFilters({...filters, endDate: e.target.value})} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer">Cliente</Label>
                <Select 
                  id="customer" 
                  value={filters.customerId} 
                  onChange={e => setFilters({...filters, customerId: e.target.value})}
                >
                  <option value="">Todos os Clientes</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier">Fornecedor</Label>
                <Select 
                  id="supplier" 
                  value={filters.supplierId} 
                  onChange={e => setFilters({...filters, supplierId: e.target.value})}
                >
                  <option value="">Todos os Fornecedores</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>

              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setFilters({
                  status: '',
                  startDate: '',
                  endDate: '',
                  customerId: '',
                  supplierId: ''
                })}
              >
                Limpar Filtros
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Report Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm bg-primary text-primary-foreground">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-primary-foreground/70 text-sm font-medium">Faturamento Total</p>
                    <h3 className="text-3xl font-bold mt-1">R$ {totalBilling.toFixed(2)}</h3>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Total de Ordens</p>
                    <h3 className="text-3xl font-bold mt-1">{filteredOrders.length}</h3>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <ClipboardList className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Orders Table Preview */}
          <Card className="border-none shadow-sm bg-orange-50/20 backdrop-blur-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">Detalhamento</CardTitle>
              <CardDescription>Prévia das ordens incluídas no relatório.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left p-4 font-medium">Nº OS</th>
                      <th className="text-left p-4 font-medium">Data Exec.</th>
                      <th className="text-left p-4 font-medium">Cliente</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-right p-4 font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order, i) => {
                      const customer = customers.find(c => c.id === order.customerId);
                      const dateToDisplay = order.executionDate || order.createdAt;
                      return (
                        <motion.tr 
                          key={order.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-4 font-mono text-xs">{order.orderNumber || order.id.substring(0, 8)}</td>
                          <td className="p-4">{format(new Date(dateToDisplay), 'dd/MM/yy')}</td>
                          <td className="p-4 font-medium">{customer?.name || 'N/A'}</td>
                          <td className="p-4">
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                              order.status === 'budget' ? "bg-blue-100 text-blue-700" :
                              order.status === 'in-progress' ? "bg-orange-100 text-orange-700" :
                              order.status === 'closed' ? "bg-green-100 text-green-700" :
                              order.status === 'paid' ? "bg-emerald-100 text-emerald-700" :
                              "bg-purple-100 text-purple-700"
                            )}>
                              {order.status === 'budget' ? 'Orçamento' : 
                               order.status === 'in-progress' ? 'Em Aberto' : 
                               order.status === 'closed' ? 'Fechada' :
                               order.status === 'paid' ? 'Faturada Paga' :
                               'Aguardando Pagamento'}
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold">R$ {order.totalValue.toFixed(2)}</td>
                        </motion.tr>
                      );
                    })}
                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-muted-foreground italic">
                          Nenhuma ordem encontrada para os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
