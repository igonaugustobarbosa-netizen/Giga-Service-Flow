import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { 
  ChevronLeft, 
  Save, 
  User, 
  ClipboardList, 
  Calendar as CalendarIcon,
  Search,
  CheckCircle2,
  Clock,
  Play,
  Square,
  FileText,
  Users,
  Trash2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Textarea } from '../components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { toast } from 'sonner';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthGuard';
import { Customer, Technician, ServiceOrder, WorkOrder, WorkOrderStatus, Settings } from '../types';
import { format } from 'date-fns';
import { generateWorkOrderPDF } from '../services/workOrderPDFService';
import { ConfirmDialog } from '../components/ConfirmDialog';

export default function WorkOrderForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const initialBudgetId = searchParams.get('budgetId');
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetchingBudgets, setFetchingBudgets] = useState(false);
  
  const [budgets, setBudgets] = useState<ServiceOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pdfConfirmDialog, setPdfConfirmDialog] = useState(false);
  
  const [formData, setFormData] = useState<Partial<WorkOrder>>({
    workOrderNumber: '',
    status: 'open',
    scheduledDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    description: '',
    kmDriven: 0,
    kmRate: 0,
    laborHours: 0,
    totalWorkedHours: 0,
    remainingHours: 0,
    currentStartTime: null,
    workSessions: [],
    technicianIds: [],
    technicianDetails: [],
    customerId: '',
    budgetId: '',
    supplierId: ''
  });

  const getWorkOrderNumberFromBudget = async (budgetOrderNumber: string, budgetId: string) => {
    if (!userData?.tenantId) return budgetOrderNumber;
    
    const q = query(
      collection(db, 'workOrders'),
      where('tenantId', '==', userData.tenantId),
      where('budgetId', '==', budgetId)
    );
    
    const snap = await getDocs(q);
    const count = snap.size;
    return `${budgetOrderNumber}/${count + 1}`;
  };

  useEffect(() => {
    if (!userData?.tenantId) return;

    const fetchData = async () => {
      try {
        const tenantId = userData.tenantId;
        const isAdmin = userData.role === 'admin';
        
        console.log('Fetching data for WorkOrderForm...', { tenantId, isAdmin, id });

        const customersRef = collection(db, 'customers');
        const techniciansRef = collection(db, 'technicians');
        const serviceOrdersRef = collection(db, 'serviceOrders');
        const suppliersRef = collection(db, 'suppliers');

        const [custSnap, techSnap, serviceOrdersSnap, suppliersSnap] = await Promise.all([
          getDocs(isAdmin ? query(customersRef) : query(customersRef, where('tenantId', '==', tenantId))),
          getDocs(isAdmin ? query(techniciansRef) : query(techniciansRef, where('tenantId', '==', tenantId))),
          getDocs(isAdmin ? query(serviceOrdersRef) : query(serviceOrdersRef, where('tenantId', '==', tenantId))),
          getDocs(isAdmin ? query(suppliersRef) : query(suppliersRef, where('tenantId', '==', tenantId)))
        ]);

        const customersData = custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
        const techniciansData = techSnap.docs.map(d => ({ id: d.id, ...d.data() } as Technician));
        const suppliersData = suppliersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        console.log('Data loaded:', { 
          customersCount: customersData.length, 
          techniciansCount: techniciansData.length,
          suppliersCount: suppliersData.length
        });

        setCustomers(customersData);
        setTechnicians(techniciansData);
        setSuppliers(suppliersData);
        
        // Fetch Settings
        const settingsSnap = await getDoc(doc(db, 'settings', tenantId));
        if (settingsSnap.exists()) {
          setSettings(settingsSnap.data() as Settings);
        }

        const allServiceOrders = serviceOrdersSnap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceOrder));
        const budgetListData = allServiceOrders
          .filter(so => ['budget', 'pending-payment'].includes(so.status))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
        setBudgets(budgetListData);
        console.log('Budgets loaded:', budgetListData.length);

        if (id) {
          const woSnap = await getDoc(doc(db, 'workOrders', id));
          if (woSnap.exists()) {
            const data = woSnap.data() as WorkOrder;
            console.log('Loaded existing WO:', data);
            
            const totalWorked = data.totalWorkedHours || 0;
            const remaining = data.remainingHours ?? Number(((data.laborHours || 0) - totalWorked).toFixed(2));
            
            setFormData({
              ...data,
              totalWorkedHours: totalWorked,
              remainingHours: remaining,
              currentStartTime: data.currentStartTime ?? null,
              workSessions: data.workSessions || [],
              technicianIds: data.technicianIds || [],
              technicianDetails: data.technicianDetails || []
            });
          }
        } else {
          // Generate new WO number
          const settingsSnap = await getDoc(doc(db, 'settings', tenantId));
          const settings = settingsSnap.exists() ? settingsSnap.data() as Settings : { lastWorkOrderNumber: 0 };
          const nextNumber = (settings.lastWorkOrderNumber || 0) + 1;
          
          let initialWOData: Partial<WorkOrder> = {
            workOrderNumber: String(nextNumber).padStart(5, '0')
          };

        if (initialBudgetId) {
            const budget = budgetListData.find(b => b.id === initialBudgetId);
            if (budget) {
              console.log('Linking to initial budget:', budget.id);
              const totalHours = budget.technicianDetails?.reduce((sum, t) => sum + (t.hours || 0), 0) || budget.hoursWorked || 0;
              const nextNumberFromBudget = await getWorkOrderNumberFromBudget(budget.orderNumber, budget.id);
              initialWOData = {
                ...initialWOData,
                workOrderNumber: nextNumberFromBudget,
                budgetId: budget.id,
                supplierId: budget.supplierId || '',
                customerId: budget.customerId,
                customerNameSnapshot: budget.customerNameSnapshot || '',
                technicianIds: budget.technicianIds || [],
                description: budget.description || '',
                kmDriven: budget.kmDriven || 0,
                kmRate: budget.kmValue || 0,
                laborHours: totalHours,
                totalWorkedHours: 0,
                remainingHours: totalHours,
                currentStartTime: null,
                workSessions: [],
                technicianDetails: budget.technicianDetails || []
              };
            }
          }
          
          setFormData(prev => ({
            ...prev,
            ...initialWOData
          }));
        }
      } catch (error) {
        console.error('Error fetching data in WorkOrderForm:', error);
        if (error instanceof Error) {
          console.error('Stack trace:', error.stack);
        }
        toast.error('Erro ao carregar dados.');
      }
    };

    fetchData();
  }, [userData?.id, id]); // Changed from userData to userData?.id to avoid unnecessary re-runs

  const handleBudgetChange = async (budgetId: string) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (budget) {
      const totalHours = budget.technicianDetails?.reduce((sum, t) => sum + (t.hours || 0), 0) || budget.hoursWorked || 0;
      const nextNumberFromBudget = await getWorkOrderNumberFromBudget(budget.orderNumber, budget.id);
      setFormData(prev => ({
        ...prev,
        workOrderNumber: nextNumberFromBudget,
        budgetId: budget.id,
        supplierId: budget.supplierId || '',
        customerId: budget.customerId,
        customerNameSnapshot: budget.customerNameSnapshot,
        technicianIds: budget.technicianIds || [],
        description: budget.description,
        kmDriven: budget.kmDriven || 0,
        kmRate: budget.kmValue || 0,
        laborHours: totalHours,
        totalWorkedHours: 0,
        remainingHours: totalHours,
        currentStartTime: null,
        workSessions: [],
        technicianDetails: budget.technicianDetails || []
      }));
      toast.info('Dados do orçamento carregados na OS.');
    }
  };

  const handleStartWork = () => {
    setFormData(prev => ({ ...prev, currentStartTime: new Date().toISOString() }));
    toast.success('Trabalho iniciado às ' + format(new Date(), "HH:mm") + '!');
  };

  const handleFinishWork = () => {
    if (!formData.currentStartTime) return;
    
    const startTime = formData.currentStartTime;
    const endTime = new Date().toISOString();
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // If Data Executada is set, use its date but keep the duration
    let finalStartTime = startTime;
    let finalEndTime = endTime;
    
    if (formData.scheduledDate) {
      const baseDate = new Date(formData.scheduledDate);
      const s = new Date(startTime);
      const e = new Date(endTime);
      
      s.setFullYear(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      e.setFullYear(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      
      finalStartTime = s.toISOString();
      finalEndTime = e.toISOString();
    }
    
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
    
    const newSession = {
      startTime: finalStartTime,
      endTime: finalEndTime,
      duration: diffHours,
      technicianIds: formData.technicianIds || []
    };

    const newSessions = [...(formData.workSessions || []), newSession];
    
    // Calculate Total Worked Hours as Man-Hours (duration * number of technicians in the session)
    const totalWorked = Number(newSessions.reduce((sum, s) => 
      sum + (s.duration * (s.technicianIds?.length || 0)), 0).toFixed(2));
      
    const estimated = formData.laborHours || 0;
    const remaining = Number((estimated - totalWorked).toFixed(2));
    
    setFormData(prev => ({ 
      ...prev, 
      totalWorkedHours: totalWorked,
      remainingHours: remaining,
      workSessions: newSessions,
      currentStartTime: null 
    }));
    
    toast.success(`Trabalho finalizado! Adicionadas ${diffHours} horas.`);
  };

  const handleManualTotalHoursChange = (val: number) => {
    const total = Number(val);
    const est = formData.laborHours || 0;
    const remaining = Number((est - total).toFixed(2));
    const techCount = formData.technicianIds?.length || 0;

    if (techCount === 0 && total > 0) {
      toast.warning('Selecione os técnicos primeiro para atribuir as horas.');
      return;
    }

    setFormData(prev => {
      const currentSessions = prev.workSessions || [];
      // Calculate how many man-hours are already in other sessions
      const currentManHours = currentSessions.reduce((sum, s) => sum + (s.duration * (s.technicianIds?.length || 0)), 0);
      const diff = total - currentManHours;
      
      let newSessions = [...currentSessions];
      if (diff !== 0) {
        // Create an adjustment session with the current technicians
        const adjustmentDuration = Number((diff / techCount).toFixed(2));
        const sessionDate = prev.scheduledDate ? new Date(prev.scheduledDate).toISOString() : new Date().toISOString();
        newSessions.push({
          startTime: sessionDate,
          endTime: sessionDate,
          duration: adjustmentDuration,
          technicianIds: prev.technicianIds || []
        });
      }

      return {
        ...prev,
        totalWorkedHours: total,
        remainingHours: remaining,
        workSessions: newSessions
      };
    });
  };

  const removeSession = (index: number) => {
    setFormData(prev => {
      const newSessions = [...(prev.workSessions || [])];
      newSessions.splice(index, 1);
      
      const totalWorked = Number(newSessions.reduce((sum, s) => 
        sum + (s.duration * (s.technicianIds?.length || 0)), 0).toFixed(2));
      const est = prev.laborHours || 0;
      
      return {
        ...prev,
        workSessions: newSessions,
        totalWorkedHours: totalWorked,
        remainingHours: Number((est - totalWorked).toFixed(2))
      };
    });
  };

  const handleFinishOS = async () => {
    if (!id || id === 'new') {
      toast.error('Salve a OS antes de finalizá-la.');
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'workOrders', id), {
        status: 'closed',
        updatedAt: new Date().toISOString()
      });
      setFormData(prev => ({ ...prev, status: 'closed' }));
      toast.success('Ordem de serviço encerrada com sucesso!');
      navigate('/work-orders');
    } catch (error) {
      console.error('Error closing OS:', error);
      toast.error('Erro ao encerrar ordem de serviço.');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = () => {
    if (!id || !formData.customerId) {
      toast.error('Salve a OS antes de gerar o PDF.');
      return;
    }
    setPdfConfirmDialog(true);
  };

  const confirmGeneratePDF = (includeDetails: boolean) => {
    const customer = customers.find(c => c.id === formData.customerId);
    const supplier = suppliers.find(s => s.id === formData.supplierId);
    generateWorkOrderPDF(formData as WorkOrder, customer || null, technicians, settings, supplier || null, { includeDetails });
    setPdfConfirmDialog(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !formData.customerId || !formData.workOrderNumber) {
      toast.error('Por favor, preencha os campos obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      // Create a clean data object and remove any undefined fields to prevent Firestore errors
      const woData = JSON.parse(JSON.stringify({
        ...formData,
        tenantId: userData.tenantId,
        updatedAt: new Date().toISOString(),
        // Ensure critical fields are never undefined
        currentStartTime: formData.currentStartTime ?? null,
        workSessions: formData.workSessions || [],
        technicianIds: formData.technicianIds || [],
        totalWorkedHours: formData.totalWorkedHours || 0,
        remainingHours: formData.remainingHours || 0,
        laborHours: formData.laborHours || 0
      }));

      if (id && id !== 'new') {
        await updateDoc(doc(db, 'workOrders', id), woData);
        toast.success('Ordem de serviço atualizada!');
      } else {
        const newWoRef = doc(collection(db, 'workOrders'));
        
        await runTransaction(db, async (transaction) => {
          let woNumber = formData.workOrderNumber || '';
          
          if (formData.budgetId) {
            // Re-calculate budget-based number to be safe (race conditions)
            const q = query(
              collection(db, 'workOrders'),
              where('tenantId', '==', userData.tenantId),
              where('budgetId', '==', formData.budgetId)
            );
            const snap = await getDocs(q);
            const budget = budgets.find(b => b.id === formData.budgetId);
            if (budget) {
              woNumber = `${budget.orderNumber}/${snap.size + 1}`;
            }
          } else {
            // Standard sequential number
            const settingsRef = doc(db, 'settings', userData.tenantId);
            const settingsSnap = await transaction.get(settingsRef);
            
            let lastNumber = 0;
            if (settingsSnap.exists()) {
              lastNumber = settingsSnap.data().lastWorkOrderNumber || 0;
            }
            
            const nextNumber = lastNumber + 1;
            woNumber = String(nextNumber).padStart(5, '0');
            transaction.set(settingsRef, { lastWorkOrderNumber: nextNumber }, { merge: true });
          }
          
          transaction.set(newWoRef, {
            ...woData,
            id: newWoRef.id,
            workOrderNumber: woNumber,
            createdAt: new Date().toISOString(),
          });
        });
        
        toast.success('Ordem de serviço criada!');
      }
      navigate('/work-orders');
    } catch (error) {
      console.error('Error saving Work Order:', error);
      toast.error('Erro ao salvar ordem de serviço.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/work-orders">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {id ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}
            </h1>
            <p className="text-muted-foreground">Gestão de execução de serviço em campo.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {id && formData.status !== 'closed' && (
            <Button 
              type="button" 
              variant="outline" 
              className="gap-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={handleFinishOS}
              disabled={loading}
            >
              <CheckCircle2 className="w-4 h-4" />
              Finalizar OS
            </Button>
          )}
          {id && (
            <Button 
              type="button" 
              variant="outline" 
              className="gap-2"
              onClick={handleGeneratePDF}
            >
              <FileText className="w-4 h-4" />
              Gerar PDF
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border-none shadow-sm">
            <CardHeader>
              <CardTitle>Informações Gerais</CardTitle>
              <CardDescription>Vincule um orçamento e defina os detalhes da execução.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>N° da Ordem de Serviço</Label>
                  <Input 
                    value={formData.workOrderNumber || ''} 
                    readOnly 
                    className="bg-muted font-mono font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vincular Orçamento (Opcional)</Label>
                  <Select 
                    value={formData.budgetId || ''} 
                    onChange={(e) => handleBudgetChange(e.target.value)}
                  >
                    <option value="">Selecione para importar dados</option>
                    {budgets.map(b => (
                      <option key={b.id} value={b.id}>
                        N° {b.orderNumber} - {customers.find(c => c.id === b.customerId)?.name || 'Cliente'}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select 
                    value={formData.customerId || ''} 
                    onChange={(e) => setFormData(prev => ({ ...prev, customerId: e.target.value }))}
                    required
                  >
                    <option value="">Selecione o cliente</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status *</Label>
                  <Select 
                    value={formData.status || 'open'} 
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as WorkOrderStatus }))}
                    required
                  >
                    <option value="open">Aberta</option>
                    <option value="in-progress">Em Andamento</option>
                    <option value="closed">Encerrada</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>KM Estimado</Label>
                  <Input 
                    type="number" 
                    value={formData.kmDriven}
                    onChange={(e) => setFormData(prev => ({ ...prev, kmDriven: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Horas Estimadas</Label>
                  <Input 
                    type="number" 
                    step="0.1"
                    value={formData.laborHours}
                    onChange={(e) => {
                      const est = Number(e.target.value);
                      const worked = formData.totalWorkedHours || 0;
                      setFormData(prev => ({ 
                        ...prev, 
                        laborHours: est,
                        remainingHours: Number((est - worked).toFixed(2))
                      }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Horas Trabalhadas</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="number" 
                      step="0.1"
                      value={formData.totalWorkedHours || 0}
                      onChange={(e) => handleManualTotalHoursChange(Number(e.target.value))}
                      className="flex-1 font-bold"
                    />
                    {!formData.currentStartTime ? (
                      <Button 
                        type="button" 
                        size="icon" 
                        variant="outline" 
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={handleStartWork}
                        title="Iniciar Trabalho do Dia"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </Button>
                    ) : (
                      <Button 
                        type="button" 
                        size="icon" 
                        variant="outline" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 animate-pulse"
                        onClick={handleFinishWork}
                        title="Finalizar Trabalho do Dia"
                      >
                        <Square className="w-4 h-4 fill-current" />
                      </Button>
                    )}
                  </div>
                  {formData.currentStartTime && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Sessão iniciada: {format(new Date(formData.currentStartTime), "HH:mm")}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Horas Restante</Label>
                  <Input 
                    type="number" 
                    value={formData.remainingHours || 0}
                    readOnly
                    className={`bg-muted font-bold ${Number(formData.remainingHours) < 0 ? 'text-red-600' : 'text-green-600'}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Executada</Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      type="datetime-local" 
                      className="pl-10"
                      value={formData.scheduledDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {formData.technicianDetails && formData.technicianDetails.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3 bg-muted/30 p-4 rounded-lg border border-border">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Detalhamento de Mão de Obra (Orçamento)
                    </h3>
                    <div className="space-y-2">
                      {formData.technicianDetails.map((tech, index) => (
                        <div key={index} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                          <span className="font-medium">{tech.name}</span>
                          <div className="flex gap-4 text-muted-foreground">
                            <span>{tech.hours}h</span>
                            <span>R$ {tech.laborRate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/h</span>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end pt-2 font-bold text-indigo-600">
                        Total MO: R$ {formData.technicianDetails.reduce((sum, t) => sum + (t.hours * t.laborRate), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 bg-muted/30 p-4 rounded-lg border border-border">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Detalhamento de Deslocamento (Orçamento)
                    </h3>
                    <div className="space-y-2">
                      {formData.technicianDetails.map((tech, index) => (
                        <div key={index} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                          <span className="font-medium">{tech.name}</span>
                          <div className="flex gap-4 text-muted-foreground">
                            <span>{tech.km || 0} km</span>
                            <span>R$ {(tech.kmValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/km</span>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end pt-2 font-bold text-indigo-600">
                        Total KM: R$ {formData.technicianDetails.reduce((sum, t) => sum + ((t.km || 0) * (t.kmValue || 0)), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Descrição do Serviço *</Label>
                <Textarea 
                  placeholder="Descreva o que será realizado..."
                  className="min-h-[120px]"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  required
                />
              </div>

              {formData.workSessions && formData.workSessions.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Total de Horas por Técnico
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(() => {
                        const techHoursMap: Record<string, number> = {};
                        formData.workSessions.forEach(session => {
                          session.technicianIds?.forEach(techId => {
                            techHoursMap[techId] = (techHoursMap[techId] || 0) + session.duration;
                          });
                        });

                        return Object.entries(techHoursMap).map(([id, hours]) => {
                          const tech = technicians.find(t => t.id === id);
                          const hourlyRate = tech?.defaultLaborHourValue || 0;
                          const totalValue = hours * hourlyRate;
                          return (
                            <div key={id} className="flex items-center justify-between p-2 bg-muted/30 rounded border border-border text-xs">
                              <div className="flex flex-col">
                                <span className="font-medium">{tech?.name || 'Técnico'}</span>
                                {hourlyRate > 0 && (
                                  <span className="text-[10px] text-muted-foreground">Valor/hora: R$ {hourlyRate.toFixed(2)}</span>
                                )}
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-indigo-600">{hours.toFixed(2)}h</span>
                                <span className="font-bold text-green-600">R$ {totalValue.toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Histórico de Sessões de Trabalho
                    </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {formData.workSessions.map((session, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border text-xs">
                        <div className="flex gap-4">
                          <div className="flex flex-col">
                            <span className="text-muted-foreground uppercase text-[10px] font-bold">Início</span>
                            <span>{format(new Date(session.startTime), "dd/MM/yy HH:mm")}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-muted-foreground uppercase text-[10px] font-bold">Fim</span>
                            <span>{format(new Date(session.endTime), "dd/MM/yy HH:mm")}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-end">
                            <span className="text-muted-foreground uppercase text-[10px] font-bold">Duração (h)</span>
                            <input
                              type="number"
                              step="0.1"
                              className="w-16 h-7 text-right font-bold text-indigo-600 bg-transparent border-b border-indigo-200 focus:outline-none focus:border-indigo-500"
                              value={session.duration}
                              onChange={(e) => {
                                const newDur = Number(e.target.value);
                                setFormData(prev => {
                                  const newSessions = [...(prev.workSessions || [])];
                                  newSessions[index] = { ...newSessions[index], duration: newDur };
                                  
                                  const totalWorked = Number(newSessions.reduce((sum, s) => 
                                    sum + (s.duration * (s.technicianIds?.length || 0)), 0).toFixed(2));
                                  const est = prev.laborHours || 0;
                                  
                                  return {
                                    ...prev,
                                    workSessions: newSessions,
                                    totalWorkedHours: totalWorked,
                                    remainingHours: Number((est - totalWorked).toFixed(2))
                                  };
                                });
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeSession(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Equipe Técnica</CardTitle>
              <CardDescription>Selecione os técnicos para este serviço.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {technicians.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-4 text-center border rounded-lg">
                    Nenhum técnico cadastrado.
                  </p>
                ) : (
                  technicians.map((tech) => (
                    <div key={tech.id} className="flex items-center space-x-3 p-2 rounded-lg border hover:bg-muted/50 transition-colors">
                      <input
                        type="checkbox"
                        id={`tech-${tech.id}`}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={formData.technicianIds?.includes(tech.id)}
                        onChange={(e) => {
                          const ids = formData.technicianIds || [];
                          if (e.target.checked) {
                            setFormData(prev => ({ ...prev, technicianIds: [...ids, tech.id] }));
                          } else {
                            setFormData(prev => ({ ...prev, technicianIds: ids.filter(id => id !== tech.id) }));
                          }
                        }}
                      />
                      <Label htmlFor={`tech-${tech.id}`} className="flex-1 cursor-pointer font-medium">
                        {tech.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4">
          <Link to="/work-orders">
            <Button variant="outline" type="button">Cancelar</Button>
          </Link>
          <Button type="submit" className="gap-2" disabled={loading}>
            <Save className="w-4 h-4" />
            {loading ? 'Salvando...' : 'Salvar Ordem de Serviço'}
          </Button>
        </div>
      </form>

      <ConfirmDialog 
        isOpen={pdfConfirmDialog}
        onOpenChange={setPdfConfirmDialog}
        onConfirm={() => confirmGeneratePDF(true)}
        title="Gerar PDF com Detalhes?"
        description="Deseja incluir o detalhamento de valores (horas e km) no PDF?"
        confirmText="Sim, incluir valores"
        cancelText="Não, apenas básico"
        onCancel={() => confirmGeneratePDF(false)}
      />
    </div>
  );
}
