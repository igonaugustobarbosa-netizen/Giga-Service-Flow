import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, limit, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { ServiceOrder, Customer, Supplier, Technician, WorkOrder, Settings } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { 
  ClipboardList, 
  ClipboardCheck,
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
  ChevronRight,
  User,
  ShieldAlert,
  Banknote
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '../components/ui/Badge';
import { cn, parseDateSafely, handleFirestoreError, OperationType } from '../lib/utils';
import { getActiveFollowUp, sendWhatsAppMessage, formatFollowUpMessage } from '../services/followUpService';
import { generateWorkOrderReportPDF } from '../services/workOrderReportService';
import { MessageSquare, Bell, Download } from 'lucide-react';
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
  const [allWorkOrders, setAllWorkOrders] = useState<WorkOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('all');
  
  // New Report Filters
  const [reportFilters, setReportFilters] = useState({
    customerId: 'all',
    status: 'all',
    billingStatus: 'all', // all, billed, pending
    technicianId: 'all'
  });

  const handlePrevMonth = () => setSelectedDate(subMonths(selectedDate, 1));
  const handleNextMonth = () => setSelectedDate(addMonths(selectedDate, 1));

  useEffect(() => {
    if (!userData) return;

    const ordersRef = collection(db, 'serviceOrders');
    const workOrdersRef = collection(db, 'workOrders');
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

    // Query for all work orders (for report)
    const qWorkAll = isAdmin
      ? query(workOrdersRef)
      : query(workOrdersRef, where('tenantId', '==', userData.tenantId));

    const unsubscribeWorkAll = onSnapshot(qWorkAll, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder));
      setAllWorkOrders(data);
    }, (error) => {
      console.error('Erro ao carregar ordens de serviço:', error);
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

    const techniciansRef = collection(db, 'technicians');
    const qTechnicians = isAdmin
      ? query(techniciansRef)
      : query(techniciansRef, where('tenantId', '==', userData.tenantId));

    const unsubscribeTechnicians = onSnapshot(qTechnicians, (snapshot) => {
      setTechnicians(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Technician)));
    }, (error) => {
      console.error('Erro ao carregar técnicos:', error);
    });

    // Fetch Settings
    const settingsRef = doc(db, 'settings', userData.tenantId);
    const unsubscribeSettings = onSnapshot(settingsRef, (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as Settings);
      }
    });

    return () => {
      unsubscribeRecent();
      unsubscribeAll();
      unsubscribeWorkAll();
      unsubscribeCustomers();
      unsubscribeSuppliers();
      unsubscribeTechnicians();
      unsubscribeSettings();
    };
  }, [userData, isAdmin]);

  const calculateTotal = (status?: string, orders = allOrders) => {
    return orders
      .filter(o => !status || o.status === status)
      .reduce((acc, o) => {
        if (selectedTechnicianId !== 'all') {
          const techDetail = o.technicianDetails?.find(td => td.technicianId === selectedTechnicianId);
          if (techDetail) {
            return acc + (techDetail.hours * techDetail.laborRate) + (techDetail.km * techDetail.kmValue);
          }
          return acc;
        }
        return acc + o.totalValue;
      }, 0);
  };

  const getWorkedStats = (orders = allOrders, date = new Date()) => {
    const monthOrders = orders.filter(o => {
      const orderDate = parseDateSafely(o.executionDate || o.createdAt);
      return orderDate.getMonth() === date.getMonth() && orderDate.getFullYear() === date.getFullYear();
    });

    const workedHours = monthOrders.reduce((acc, o) => {
      if (selectedTechnicianId !== 'all') {
        const techDetail = o.technicianDetails?.find(td => td.technicianId === selectedTechnicianId);
        return acc + (techDetail?.hours || 0);
      }
      return acc + (o.hoursWorked || 0);
    }, 0);
    const workedDays = new Set(monthOrders.map(o => {
      const orderDate = parseDateSafely(o.executionDate || o.createdAt);
      return format(orderDate, 'yyyy-MM-dd');
    })).size;

    return { workedDays, workedHours, monthOrders };
  };

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  const filteredOrders = allOrders.filter(o => {
    const orderDate = parseDateSafely(o.executionDate || o.createdAt);
    const dateMatch = isWithinInterval(orderDate, { start: monthStart, end: monthEnd });
    
    if (!dateMatch) return false;
    
    if (selectedTechnicianId !== 'all') {
      return o.technicianIds?.includes(selectedTechnicianId);
    }
    
    return true;
  });

  const { workedDays: selectedMonthDays, workedHours: selectedMonthHours } = getWorkedStats(filteredOrders, selectedDate);

  const handleMigrate00091 = async () => {
    try {
      // 1. Find user "giga eletrica"
      const usersRef = collection(db, 'users');
      // Case insensitive search is hard in Firestore, so we try a few variations
      const userSnaps = await Promise.all([
        getDocs(query(usersRef, where('name', '==', 'Giga Elétrica'))),
        getDocs(query(usersRef, where('name', '==', 'Giga Eletrica'))),
        getDocs(query(usersRef, where('username', '==', 'giga.eletrica'))),
        getDocs(query(usersRef, where('username', '==', 'gigaeletrica')))
      ]);
      
      let targetUser = null;
      for (const snap of userSnaps) {
        if (!snap.empty) {
          targetUser = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
          break;
        }
      }
      
      if (!targetUser) {
        // Last resort: search for all users and filter in memory if it's small enough, 
        // or just ask user for exact login
        const allUsersSnap = await getDocs(query(usersRef));
        targetUser = allUsersSnap.docs.find(d => 
          d.data().name?.toLowerCase().includes('giga') || 
          d.data().username?.toLowerCase().includes('giga')
        )?.data();
      }

      if (!targetUser) {
        toast.error('Usuário "giga eletrica" não encontrado.');
        return;
      }

      // 2. Find serviceOrder "00091"
      const ordersRef = collection(db, 'serviceOrders');
      const qOrder = query(ordersRef, where('orderNumber', '==', '00091'));
      const orderSnap = await getDocs(qOrder);
      
      if (orderSnap.empty) {
        toast.error('Orçamento "00091" não encontrado.');
        return;
      }

      const orderDoc = orderSnap.docs[0];
      const orderData = orderDoc.data();
      
      // 3. Update tenantId
      await updateDoc(doc(db, 'serviceOrders', orderDoc.id), {
        tenantId: targetUser.tenantId,
        updatedAt: new Date().toISOString()
      });

      toast.success(`Orçamento 00091 (ID: ${orderDoc.id}) migrado com sucesso para ${targetUser.name} (Tenant: ${targetUser.tenantId})!`);
      console.log('Migração concluída:', { orderId: orderDoc.id, oldTenant: orderData.tenantId, newTenant: targetUser.tenantId });
    } catch (error) {
      console.error('Erro na migração:', error);
      toast.error('Erro ao processar migração.');
    }
  };

  const filteredWorkOrders = allWorkOrders.filter(wo => {
    if (reportFilters.customerId !== 'all' && wo.customerId !== reportFilters.customerId) return false;
    if (reportFilters.status !== 'all' && wo.status !== reportFilters.status) return false;
    if (reportFilters.technicianId !== 'all' && !wo.technicianIds?.includes(reportFilters.technicianId)) return false;
    
    if (reportFilters.billingStatus !== 'all') {
      const hasBilled = wo.workSessions && wo.workSessions.some(s => s.billed);
      const hasPending = !wo.workSessions || wo.workSessions.length === 0 || wo.workSessions.some(s => !s.billed);
      
      if (reportFilters.billingStatus === 'billed' && !hasBilled) return false;
      if (reportFilters.billingStatus === 'pending' && !hasPending) return false;
    }
    
    return true;
  });

  const getWorkStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 uppercase text-[10px]">Aberta</Badge>;
      case 'in-progress': return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 uppercase text-[10px]">Em Andamento</Badge>;
      case 'closed': return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 uppercase text-[10px]">Encerrada</Badge>;
      default: return null;
    }
  };

  const calculateWorkOrderMetrics = (wo: WorkOrder, billingFilter: 'all' | 'billed' | 'pending' = 'all') => {
    let sessions = wo.workSessions || [];
    
    const isTechFilter = reportFilters.technicianId !== 'all';
    const selectedTech = technicians.find(t => t.id === reportFilters.technicianId);
    const isIgonSelected = selectedTech?.name?.toLowerCase().includes('igon');
    
    if (isTechFilter) {
      sessions = sessions.filter(s => s.technicianIds?.includes(reportFilters.technicianId));
    }
    
    if (billingFilter === 'billed') {
      sessions = sessions.filter(s => s.billed);
    } else if (billingFilter === 'pending') {
      sessions = sessions.filter(s => !s.billed);
    }
    
    const hours = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);

    const laborValue = sessions.reduce((acc, s) => {
      const uniqueTechIds = Array.from(new Set(s.technicianIds || []));
      
      if (isTechFilter) {
        // Double check the tech is actually in this session
        if (!uniqueTechIds.includes(reportFilters.technicianId)) return acc;
        
        const rate = wo.technicianDetails?.find(td => td.technicianId === reportFilters.technicianId)?.laborRate || 
                     technicians.find(t => t.id === reportFilters.technicianId)?.defaultLaborHourValue || 
                     settings?.laborHourValue || 0;
        return acc + ((s.duration || 0) * rate);
      }
      
      const sessionLabor = uniqueTechIds.reduce((sAcc, tId) => {
        const rate = wo.technicianDetails?.find(td => td.technicianId === tId)?.laborRate || 
                     technicians.find(t => t.id === tId)?.defaultLaborHourValue || 
                     settings?.laborHourValue || 0;
        return sAcc + ((s.duration || 0) * rate);
      }, 0);
      
      return acc + sessionLabor;
    }, 0);

    // KM attribution logic:
    // If filtering by tech, show KM if they are part of the OS.
    // We attribute general KM to the primary technician if no split details exist.
    const isPartOfOs = wo.technicianIds?.includes(reportFilters.technicianId);
    
    // For KM, if there's only one technician, they are the owner.
    // If there are multiple and no split, the first one is the owner for reporting purposes.
    const isOwnerOfKm = !isTechFilter || 
                        (wo.technicianDetails?.some(td => td.technicianId === reportFilters.technicianId && td.km > 0)) ||
                        (wo.technicianIds?.[0] === reportFilters.technicianId && (!wo.technicianDetails || wo.technicianDetails.length === 0));

    const techHasWorked = !isTechFilter || wo.workSessions?.some(s => s.technicianIds?.includes(reportFilters.technicianId));
    const anySessionsBilled = wo.workSessions && wo.workSessions.some(s => s.billed);
    const hasSessions = wo.workSessions && wo.workSessions.length > 0;

    let kmValue = 0;
    let igonKmValue = 0;
    let kmDistance = 0;
    let igonKmDistance = 0;

    if (hasSessions && techHasWorked) {
      let baseKmValue = 0;
      let baseIgonKmValue = 0;
      let baseKmDistance = 0;
      let baseIgonKmDistance = 0;
      
      if (isTechFilter) {
        // Only KM for the filtered technician
        const techDetail = wo.technicianDetails?.find(td => td.technicianId === reportFilters.technicianId);
        
        if (isIgonSelected) {
          // Rule: Don't add KM for technician Igon to the main total, put in igonKmValue
          baseIgonKmValue = techDetail && techDetail.km > 0 ? techDetail.km * techDetail.kmValue : 0;
          baseIgonKmDistance = techDetail && techDetail.km > 0 ? techDetail.km : 0;
          baseKmValue = 0;
          baseKmDistance = 0;
        } else if (techDetail && techDetail.km > 0) {
          baseKmValue = techDetail.km * techDetail.kmValue;
          baseKmDistance = techDetail.km;
        } else if (isOwnerOfKm) {
          // Proportional attribution of KM based on participation if no specific detail exists
          // This avoids "elevated values" where a tech gets KM for sessions they didn't participate in
          const allSessions = wo.workSessions || [];
          const techSessionsCount = allSessions.filter(s => s.technicianIds?.includes(reportFilters.technicianId)).length;
          const proportion = allSessions.length > 0 ? techSessionsCount / allSessions.length : 0;
          
          const calculatedTotalKmVal = (wo.kmDriven || 0) * (wo.kmRate || settings?.kmValue || 0);
          const totalKmVal = calculatedTotalKmVal > 0 ? calculatedTotalKmVal : (wo.kmTotalValue || 0);
          const totalDistance = wo.kmDriven || 0;
          
          baseKmValue = totalKmVal * proportion;
          baseKmDistance = totalDistance * proportion;
        }
      } else {
        // Sum of all KM if no tech filter (Total report)
        if (wo.technicianDetails && wo.technicianDetails.length > 0 && wo.technicianDetails.some(td => td.km > 0)) {
          wo.technicianDetails.forEach(td => {
            const tech = technicians.find(t => t.id === td.technicianId);
            const isIgon = tech?.name?.toLowerCase().includes('igon');
            const val = td.km * td.kmValue;
            const dist = td.km;
            if (isIgon) {
              baseIgonKmValue += val;
              baseIgonKmDistance += dist;
            } else {
              baseKmValue += val;
              baseKmDistance += dist;
            }
          });
        } else {
          // If no split details, check if the primary owner is Igon
          const primaryTechId = wo.technicianIds?.[0];
          const primaryTech = technicians.find(t => t.id === primaryTechId);
          const isIgonPrimary = primaryTech?.name?.toLowerCase().includes('igon');

          const calculatedVal = (wo.kmDriven || 0) * (wo.kmRate || settings?.kmValue || 0);
          const totalKmVal = calculatedVal > 0 ? calculatedVal : (wo.kmTotalValue || 0);
          const totalDistance = wo.kmDriven || 0;

          if (isIgonPrimary) {
            baseIgonKmValue = totalKmVal;
            baseIgonKmDistance = totalDistance;
          } else {
            baseKmValue = totalKmVal;
            baseKmDistance = totalDistance;
          }
        }
      }
      
      if (billingFilter === 'all') {
        kmValue = baseKmValue;
        igonKmValue = baseIgonKmValue;
        kmDistance = baseKmDistance;
        igonKmDistance = baseIgonKmDistance;
      } else if (billingFilter === 'billed' && anySessionsBilled) {
        kmValue = baseKmValue;
        igonKmValue = baseIgonKmValue;
        kmDistance = baseKmDistance;
        igonKmDistance = baseIgonKmDistance;
      } else if (billingFilter === 'pending' && !anySessionsBilled) {
        kmValue = baseKmValue;
        igonKmValue = baseIgonKmValue;
        kmDistance = baseKmDistance;
        igonKmDistance = baseIgonKmDistance;
      }
    }

    return { hours, laborValue, kmValue, igonKmValue, kmDistance, igonKmDistance, totalValue: laborValue + kmValue };
  };

  const getWorkOrderTotalValue = (wo: WorkOrder) => calculateWorkOrderMetrics(wo, reportFilters.billingStatus as any).totalValue;
  const getWorkOrderLaborValue = (wo: WorkOrder) => calculateWorkOrderMetrics(wo, reportFilters.billingStatus as any).laborValue;
  const getWorkOrderKmValue = (wo: WorkOrder) => calculateWorkOrderMetrics(wo, reportFilters.billingStatus as any).kmValue;
  const getWorkOrderIgonKmValue = (wo: WorkOrder) => calculateWorkOrderMetrics(wo, reportFilters.billingStatus as any).igonKmValue;
  const getWorkOrderIgonKmDistance = (wo: WorkOrder) => calculateWorkOrderMetrics(wo, reportFilters.billingStatus as any).igonKmDistance;
  const getWorkOrderHours = (wo: WorkOrder) => calculateWorkOrderMetrics(wo, reportFilters.billingStatus as any).hours;

  const handleExportWorkOrderReport = () => {
    // Enrich orders with calculated total value for the report if missing
    const enrichedOrders = filteredWorkOrders.map(wo => ({
      ...wo,
      totalValue: getWorkOrderTotalValue(wo)
    }));
    generateWorkOrderReportPDF(enrichedOrders, customers, technicians, reportFilters);
  };

  const chartData = [
    { name: 'Pagas', value: calculateTotal('paid', filteredOrders), color: '#10b981', isMoney: true },
    { name: 'Pendente', value: calculateTotal('pending-payment', filteredOrders), color: '#a855f7', isMoney: true },
    { name: 'Orçamento', value: calculateTotal('budget', filteredOrders), color: '#3b82f6', isMoney: true },
    { name: 'Em Aberto', value: calculateTotal('in-progress', filteredOrders), color: '#f97316', isMoney: true },
    { name: 'Fechadas', value: calculateTotal('closed', filteredOrders), color: '#22c55e', isMoney: true },
    { name: 'Horas Trab.', value: selectedMonthHours, color: '#6366f1', isMoney: false },
    { name: 'Faturado', value: calculateTotal(undefined, filteredOrders.filter(o => o.status !== 'budget')), color: '#f59e0b', isMoney: true },
  ];

  const stats = [
    { 
      title: 'Faturadas Pagas', 
      value: `R$ ${calculateTotal('paid', filteredOrders).toFixed(2)}`, 
      icon: CheckCircle2, 
      color: 'bg-emerald-500/10 text-emerald-600' 
    },
    { 
      title: 'Aguardando Pagamento', 
      value: `R$ ${calculateTotal('pending-payment', filteredOrders).toFixed(2)}`, 
      icon: Clock, 
      color: 'bg-purple-500/10 text-purple-600' 
    },
    { 
      title: 'Orçamentos', 
      value: `R$ ${calculateTotal('budget', filteredOrders).toFixed(2)}`, 
      icon: ClipboardList, 
      color: 'bg-blue-500/10 text-blue-600',
      link: '/proposals'
    },
    { 
      title: 'Em Andamento', 
      value: `R$ ${calculateTotal('in-progress', filteredOrders).toFixed(2)}`, 
      icon: AlertCircle, 
      color: 'bg-orange-500/10 text-orange-600' 
    },
    { 
      title: 'Fechadas', 
      value: `R$ ${calculateTotal('closed', filteredOrders).toFixed(2)}`, 
      icon: CheckCircle2, 
      color: 'bg-green-500/10 text-green-600' 
    },
    { 
      title: 'Trabalho (Mês)', 
      value: `${selectedMonthDays}d / ${selectedMonthHours}h`, 
      icon: Calendar, 
      color: 'bg-indigo-500/10 text-indigo-600' 
    },
    { 
      title: 'Faturamento Mês', 
      value: `R$ ${calculateTotal(undefined, filteredOrders.filter(o => o.status !== 'budget')).toFixed(2)}`, 
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
        <div className="flex flex-wrap gap-2">
          <Link to="/work-orders/new">
            <Button className="gap-2 h-12 px-6 rounded-xl shadow-lg bg-indigo-600 hover:bg-indigo-700">
              <ClipboardCheck className="w-5 h-5" />
              Nova OS
            </Button>
          </Link>
          <Link to="/orders/new">
            <Button className="gap-2 h-12 px-6 rounded-xl shadow-lg">
              <Plus className="w-5 h-5" />
              Novo Orçamento
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          const content = (
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
          );

          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              {stat.link ? (
                <Link to={stat.link}>
                  {content}
                </Link>
              ) : content}
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Desempenho Mensal
              </CardTitle>
              <div className="flex flex-wrap items-center gap-3">
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

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Select
                      value={selectedTechnicianId}
                      onChange={(e) => setSelectedTechnicianId(e.target.value)}
                      className="pl-8 h-10 w-[180px]"
                    >
                      <option value="all">Todos os Técnicos</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
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
                        formatter={(val: number) => val > 0 ? val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : ''}
                        style={{ fontSize: '9px', fontWeight: 'bold' }}
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
                              Ver Detalhes
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
                  <p className="text-muted-foreground">Nenhum orçamento encontrado.</p>
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

        <div className="space-y-8">
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

      {/* Relatório de Ordens de Serviço (OS) */}
      <Card className="border-none shadow-sm bg-indigo-50/30 backdrop-blur-sm mt-8">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Relatório de Ordens de Serviço (OS)
            </CardTitle>
            <p className="text-xs text-muted-foreground">Filtre e exporte relatórios detalhados das suas OS.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setReportFilters({
                customerId: 'all',
                status: 'all',
                billingStatus: 'all',
                technicianId: 'all'
              })}
              className="h-9 text-xs"
            >
              Limpar Filtros
            </Button>
            <Select 
              value={reportFilters.customerId} 
              onChange={e => setReportFilters(prev => ({...prev, customerId: e.target.value}))}
              className="h-9 text-xs min-w-[150px]"
            >
              <option value="all">Todos os Clientes</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select 
              value={reportFilters.status} 
              onChange={e => setReportFilters(prev => ({...prev, status: e.target.value}))}
              className="h-9 text-xs min-w-[120px]"
            >
              <option value="all">Todos os Status</option>
              <option value="open">Aberta</option>
              <option value="in-progress">Em Andamento</option>
              <option value="closed">Encerrada</option>
            </Select>
            <Select 
              value={reportFilters.technicianId} 
              onChange={e => setReportFilters(prev => ({...prev, technicianId: e.target.value}))}
              className="h-9 text-xs min-w-[140px]"
            >
              <option value="all">Todos os Técnicos</option>
              {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Select 
              value={reportFilters.billingStatus} 
              onChange={e => setReportFilters(prev => ({...prev, billingStatus: e.target.value}))}
              className="h-9 text-xs min-w-[140px]"
            >
              <option value="all">Todos (Cobrança)</option>
              <option value="billed">Totalmente Cobrado</option>
              <option value="pending">Pendência de Cobrança</option>
            </Select>
            <Button 
              size="sm" 
              onClick={handleExportWorkOrderReport}
              disabled={filteredWorkOrders.length === 0}
              className="h-9 gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              <Download className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Mini Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
            <Card className="border-none shadow-sm bg-indigo-600 text-white p-3">
              <p className="text-[10px] uppercase font-bold opacity-80">Total OS</p>
              <p className="text-xl font-bold">{filteredWorkOrders.length}</p>
            </Card>
            <Card className="border-none shadow-sm bg-slate-800 text-white p-3">
              <p className="text-[10px] uppercase font-bold opacity-80">Valor Geral</p>
              <p className="text-xl font-bold">R$ {filteredWorkOrders.reduce((acc, wo) => acc + calculateWorkOrderMetrics(wo, 'all').totalValue, 0).toFixed(2)}</p>
            </Card>
            <Card className="border-none shadow-sm bg-emerald-600 text-white p-3">
              <p className="text-[10px] uppercase font-bold opacity-80">Vlr. Cobrado</p>
              <p className="text-xl font-bold">
                R$ {filteredWorkOrders
                  .reduce((acc, wo) => acc + calculateWorkOrderMetrics(wo, 'billed').totalValue, 0)
                  .toFixed(2)}
              </p>
            </Card>
            <Card className="border-none shadow-sm bg-rose-600 text-white p-3">
              <p className="text-[10px] uppercase font-bold opacity-80">Valor Pendente</p>
              <p className="text-xl font-bold">
                R$ {filteredWorkOrders
                  .reduce((acc, wo) => acc + calculateWorkOrderMetrics(wo, 'pending').totalValue, 0)
                  .toFixed(2)}
              </p>
            </Card>
            <Card className="border-none shadow-sm bg-white border border-indigo-100 p-3">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Mão de Obra</p>
              <p className="text-sm font-bold text-indigo-600">R$ {filteredWorkOrders.reduce((acc, wo) => acc + getWorkOrderLaborValue(wo), 0).toFixed(2)}</p>
            </Card>
            <Card className="border-none shadow-sm bg-white border border-indigo-100 p-3">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">KM Acumulado Diário</p>
              <p className="text-sm font-bold text-amber-600">R$ {filteredWorkOrders.reduce((acc, wo) => acc + getWorkOrderKmValue(wo), 0).toFixed(2)}</p>
            </Card>
            <Card className="border-none shadow-sm bg-white border border-indigo-100 p-3">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">KM Igon (Valor)</p>
              <p className="text-sm font-bold text-rose-600">
                R$ {filteredWorkOrders.reduce((acc, wo) => acc + getWorkOrderIgonKmValue(wo), 0).toFixed(2)}
                <span className="text-[10px] ml-1 opacity-70 font-normal">
                  ({filteredWorkOrders.reduce((acc, wo) => acc + getWorkOrderIgonKmDistance(wo), 0)} km)
                </span>
              </p>
            </Card>
            <Card className="border-none shadow-sm bg-white border border-indigo-100 p-3">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Hrs. Totais</p>
              <p className="text-sm font-bold text-slate-700">{filteredWorkOrders.reduce((acc, wo) => acc + (wo.totalWorkedHours || 0), 0).toFixed(1)}h</p>
            </Card>
            <Card className="border-none shadow-sm bg-indigo-50 border border-indigo-100 p-3">
              <p className="text-[10px] uppercase font-bold text-indigo-600">Hrs. Trab.</p>
              <p className="text-sm font-bold text-indigo-700">{filteredWorkOrders.reduce((acc, wo) => acc + getWorkOrderHours(wo), 0).toFixed(1)}h</p>
            </Card>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b text-muted-foreground uppercase text-[10px] font-bold">
                  <th className="py-3 px-2">Nº OS</th>
                  <th className="py-3 px-2">Cliente</th>
                  <th className="py-3 px-2">Data</th>
                  <th className="py-3 px-2 text-center">Status</th>
                  <th className="py-3 px-2 text-center">Cobrança</th>
                  <th className="py-3 px-2 text-center whitespace-nowrap">Hrs. Trab.</th>
                  <th className="py-3 px-2 text-center whitespace-nowrap">Hrs. Totais</th>
                  <th className="py-3 px-2 text-right">KM Igon</th>
                  <th className="py-3 px-2 text-right">Valor</th>
                  <th className="py-3 px-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredWorkOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground italic">Nenhuma OS encontrada com esses filtros.</td>
                  </tr>
                ) : (
                  filteredWorkOrders.map(wo => {
                    const billedCount = wo.workSessions?.filter(s => s.billed).length || 0;
                    const totalSessions = wo.workSessions?.length || 0;
                    const isFullyBilled = totalSessions > 0 && billedCount === totalSessions;

                    return (
                      <tr key={wo.id} className="hover:bg-accent/5 transition-colors">
                        <td className="py-3 px-2 font-mono font-bold text-indigo-600">{wo.workOrderNumber}</td>
                        <td className="py-3 px-2 font-medium truncate max-w-[150px]">{wo.customerNameSnapshot || customers.find(c => c.id === wo.customerId)?.name || '-'}</td>
                        <td className="py-3 px-2 text-xs text-muted-foreground">{format(parseDateSafely(wo.scheduledDate), 'dd/MM/yy', { locale: ptBR })}</td>
                        <td className="py-3 px-2 text-center">{getWorkStatusBadge(wo.status)}</td>
                        <td className="py-3 px-2 text-center">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            isFullyBilled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          )}>
                            <Banknote className="w-3 h-3" />
                            {billedCount}/{totalSessions}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center text-xs font-bold text-indigo-600">
                          {getWorkOrderHours(wo).toFixed(1)}h
                        </td>
                        <td className="py-3 px-2 text-center text-xs font-medium text-slate-500">
                          {(wo.totalWorkedHours || 0).toFixed(1)}h
                        </td>
                        <td className="py-3 px-2 text-right font-medium text-rose-600 text-xs">
                          {getWorkOrderIgonKmValue(wo) > 0 ? `R$ ${getWorkOrderIgonKmValue(wo).toFixed(2)}` : '-'}
                          {getWorkOrderIgonKmDistance(wo) > 0 && (
                            <span className="block text-[10px] opacity-50 font-normal">
                              {getWorkOrderIgonKmDistance(wo)} km
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-slate-700">
                          R$ {getWorkOrderTotalValue(wo).toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Link to={`/work-orders/${wo.id}/edit`}>
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2 bg-slate-100 hover:bg-slate-200">VER</Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {userData?.email === 'igonaugustobarbosa@gmail.com' && (
        <div className="mt-12 p-6 border-2 border-dashed border-primary/20 rounded-2xl bg-primary/5">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2 text-primary">
            <ShieldAlert className="w-6 h-6" />
            Ferramentas de Super Admin
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Ações especiais para manutenção de dados. Utilize com cautela.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button 
              variant="default" 
              className="bg-primary hover:bg-primary/90 h-12 px-6 rounded-xl shadow-md"
              onClick={handleMigrate00091}
            >
              Vincular Orçamento 00091 à Giga Elétrica
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
