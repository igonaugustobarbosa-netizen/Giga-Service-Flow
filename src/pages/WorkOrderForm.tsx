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
  Trash2,
  MapPin
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Textarea } from '../components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { toast } from 'sonner';
import { cn, parseDateSafely } from '../lib/utils';
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
import { Customer, Technician, ServiceOrder, WorkOrder, WorkOrderStatus, Settings, Supplier } from '../types';
import { format } from 'date-fns';
import { generateWorkOrderPDF } from '../services/workOrderPDFService';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { calculateDistance } from '../services/locationService';

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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pdfConfirmDialog, setPdfConfirmDialog] = useState(false);
  
  const [formData, setFormData] = useState<Partial<WorkOrder>>({
    workOrderNumber: '',
    status: 'open',
    scheduledDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    description: '',
    estimatedKm: 0,
    kmDriven: 0,
    remainingKm: 0,
    dailyKmOverride: 0,
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
    supplierId: '',
    supplierNameSnapshot: ''
  });

  const calculateDisplacement = (customerId: string, supplierId?: string): number => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer?.location) return 0;

    let originLocation = settings?.companyLocation;

    if (supplierId) {
      const supplier = suppliers.find(s => s.id === supplierId);
      if (supplier?.location && supplier.location.latitude !== 0) {
        originLocation = supplier.location;
      }
    }

    if (originLocation && originLocation.latitude !== 0) {
      const dist = calculateDistance(originLocation, customer.location);
      return Number((dist * 2).toFixed(2));
    }

    return 0;
  };

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
      setLoading(true);
      try {
        const tenantId = userData.tenantId;
        const isAdmin = userData.role === 'admin';
        
        const [custSnap, techSnap, supSnap, serviceOrdersSnap, settingsSnap] = await Promise.all([
          getDocs(isAdmin ? query(collection(db, 'customers')) : query(collection(db, 'customers'), where('tenantId', '==', tenantId))),
          getDocs(isAdmin ? query(collection(db, 'technicians')) : query(collection(db, 'technicians'), where('tenantId', '==', tenantId))),
          getDocs(isAdmin ? query(collection(db, 'suppliers')) : query(collection(db, 'suppliers'), where('tenantId', '==', tenantId))),
          getDocs(isAdmin ? query(collection(db, 'serviceOrders')) : query(collection(db, 'serviceOrders'), where('tenantId', '==', tenantId))),
          getDoc(doc(db, 'settings', tenantId))
        ]);

        const customersData = custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
        const techniciansData = techSnap.docs.map(d => ({ id: d.id, ...d.data() } as Technician));
        const suppliersData = supSnap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier));
        
        setCustomers(customersData);
        setTechnicians(techniciansData);
        setSuppliers(suppliersData);
        
        let settingsData: Settings | null = null;
        if (settingsSnap.exists()) {
          settingsData = settingsSnap.data() as Settings;
          setSettings(settingsData);
        }

        const budgetListData = serviceOrdersSnap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceOrder))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
        setBudgets(budgetListData);

        if (id && id !== 'new') {
          const woSnap = await getDoc(doc(db, 'workOrders', id));
          if (woSnap.exists()) {
            const data = woSnap.data() as WorkOrder;
            
            const totalWorked = data.totalWorkedHours || 0;
            const remaining = data.remainingHours ?? Number(((data.laborHours || 0) - totalWorked).toFixed(2));
            
            const supplierFromList = suppliersData.find(s => s.id === data.supplierId);
            let supplierName = data.supplierNameSnapshot || supplierFromList?.name || '';

            if (!supplierName && data.budgetId) {
              const budget = budgetListData.find(b => b.id === data.budgetId);
              if (budget?.supplierId) {
                const s = suppliersData.find(sup => sup.id === budget.supplierId);
                supplierName = s?.name || '';
              }
            }

            setFormData({
              ...data,
              supplierNameSnapshot: supplierName,
              totalWorkedHours: totalWorked,
              remainingHours: remaining,
              estimatedKm: data.estimatedKm || 0,
              kmDriven: data.kmDriven || 0,
              remainingKm: data.remainingKm || Number(((data.estimatedKm || 0) - (data.kmDriven || 0)).toFixed(2)),
              currentStartTime: data.currentStartTime ?? null,
              workSessions: data.workSessions || [],
              technicianIds: data.technicianIds || [],
              technicianDetails: data.technicianDetails || []
            });
          }
        } else {
          const nextNumber = (settingsData?.lastWorkOrderNumber || 0) + 1;
          
          let initialWOData: Partial<WorkOrder> = {
            workOrderNumber: String(nextNumber).padStart(5, '0'),
            estimatedKm: 0,
            kmDriven: 0,
            remainingKm: 0,
            status: 'open',
            scheduledDate: format(new Date(), "yyyy-MM-dd'T'HH:mm")
          };

          if (initialBudgetId) {
            const budget = budgetListData.find(b => b.id === initialBudgetId);
            if (budget) {
              const totalHours = budget.technicianDetails?.reduce((sum, t) => sum + (t.hours || 0), 0) || budget.hoursWorked || 0;
              const nextNumberFromBudget = await getWorkOrderNumberFromBudget(budget.orderNumber, budget.id);
              
              const supplier = suppliersData.find(s => s.id === budget.supplierId);
              const estKm = budget.kmDriven || calculateDisplacement(budget.customerId, budget.supplierId) || 0;
              
              initialWOData = {
                ...initialWOData,
                workOrderNumber: nextNumberFromBudget,
                budgetId: budget.id,
                customerId: budget.customerId,
                customerNameSnapshot: budget.customerNameSnapshot || '',
                supplierId: budget.supplierId || '',
                supplierNameSnapshot: supplier?.name || '',
                technicianIds: budget.technicianIds || [],
                description: budget.description || '',
                estimatedKm: estKm,
                kmDriven: 0,
                remainingKm: estKm,
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
        toast.error('Erro ao carregar dados.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userData?.id, id]);

  // Reactive sync for supplier name if it's missing but budget exists
  useEffect(() => {
    if (formData.budgetId && !formData.supplierNameSnapshot && budgets.length > 0 && suppliers.length > 0) {
      const budget = budgets.find(b => b.id === formData.budgetId);
      if (budget?.supplierId) {
        const supplier = suppliers.find(s => s.id === budget.supplierId);
        if (supplier) {
          setFormData(prev => ({ 
            ...prev, 
            supplierId: budget.supplierId,
            supplierNameSnapshot: supplier.name 
          }));
        }
      }
    }
  }, [formData.budgetId, budgets.length, suppliers.length]); // Changed from userData to userData?.id to avoid unnecessary re-runs

  useEffect(() => {
    // Sincronizar KM se houver sessões (correção para OS antigas ou mudança no valor manual/deslocamento)
    if (formData.workSessions?.length) {
      const sessionKm = formData.dailyKmOverride && formData.dailyKmOverride > 0 
        ? formData.dailyKmOverride 
        : calculateDisplacement(formData.customerId || '', formData.supplierId);
      
      const totalKm = Number((formData.workSessions.length * sessionKm).toFixed(2));
      
      // Only update if the value is different to avoid infinite loops
      if (formData.kmDriven !== totalKm) {
        setFormData(prev => ({
          ...prev,
          kmDriven: totalKm,
          remainingKm: Number(((prev.estimatedKm || 0) - totalKm).toFixed(2))
        }));
      }
    } else if (formData.kmDriven !== 0) {
      setFormData(prev => ({
        ...prev,
        kmDriven: 0,
        remainingKm: prev.estimatedKm || 0
      }));
    }
  }, [formData.workSessions?.length, formData.customerId, formData.supplierId, formData.dailyKmOverride, formData.estimatedKm]);

  const handleBudgetChange = async (budgetId: string) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (budget) {
      const totalHours = budget.technicianDetails?.reduce((sum, t) => sum + (t.hours || 0), 0) || budget.hoursWorked || 0;
      const nextNumberFromBudget = await getWorkOrderNumberFromBudget(budget.orderNumber, budget.id);
      
      const supplier = suppliers.find(s => s.id === budget.supplierId);
      const supplierName = supplier?.name || (budget as any).supplierNameSnapshot || '';

      const estKm = budget.kmDriven || calculateDisplacement(budget.customerId, budget.supplierId) || 0;

      setFormData(prev => ({
        ...prev,
        workOrderNumber: nextNumberFromBudget,
        budgetId: budget.id,
        customerId: budget.customerId,
        customerNameSnapshot: budget.customerNameSnapshot,
        supplierId: budget.supplierId || '',
        supplierNameSnapshot: supplierName,
        technicianIds: budget.technicianIds || [],
        description: budget.description,
        estimatedKm: estKm,
        kmDriven: 0,
        remainingKm: estKm,
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

  const handleCustomerChange = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    const estKm = calculateDisplacement(customerId, formData.supplierId);

    setFormData(prev => ({
      ...prev,
      customerId,
      customerNameSnapshot: customer?.name || '',
      estimatedKm: estKm,
      remainingKm: Number((estKm - (prev.kmDriven || 0)).toFixed(2))
    }));
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
      technicianIds: formData.technicianIds || [],
      description: 'Sessão em tempo real finalizada'
    };

    const newSessions = [...(formData.workSessions || []), newSession];
    
    // Calculate Total Worked Hours as Man-Hours (duration * number of technicians in the session)
    const totalWorked = Number(newSessions.reduce((sum, s) => 
      sum + (s.duration * (s.technicianIds?.length || 0)), 0).toFixed(2));
      
    const estimated = formData.laborHours || 0;
    const remaining = Number((estimated - totalWorked).toFixed(2));
    
    // Auto KM calculation - prioritizing override
    const sessionKm = formData.dailyKmOverride && formData.dailyKmOverride > 0 
      ? formData.dailyKmOverride 
      : calculateDisplacement(formData.customerId || '', formData.supplierId);
    
    const newKmTotal = Number((newSessions.length * sessionKm).toFixed(2));
    const newKmRemaining = Number(((formData.estimatedKm || 0) - newKmTotal).toFixed(2));

    setFormData(prev => ({ 
      ...prev, 
      totalWorkedHours: totalWorked,
      remainingHours: remaining,
      kmDriven: newKmTotal,
      remainingKm: newKmRemaining,
      workSessions: newSessions,
      currentStartTime: null 
    }));
    
    if (sessionKm > 0) {
      toast.success(`Trabalho finalizado! +${diffHours}h e percurso de ${sessionKm}km registrado.`);
    } else {
      toast.success(`Trabalho finalizado! Adicionadas ${diffHours} horas.`);
    }
  };

  const [laborHoursInput, setLaborHoursInput] = useState<string>('');
  const [manualSessionDuration, setManualSessionDuration] = useState<string>('');
  const [manualSessionDescription, setManualSessionDescription] = useState<string>('');
  const [manualStartTime, setManualStartTime] = useState<string>('');
  const [manualEndTime, setManualEndTime] = useState<string>('');

  useEffect(() => {
    if (manualStartTime && manualEndTime) {
      const [startH, startM] = manualStartTime.split(':').map(Number);
      const [endH, endM] = manualEndTime.split(':').map(Number);
      
      let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      if (diffMinutes < 0) diffMinutes += 24 * 60;
      
      const hours = Number((diffMinutes / 60).toFixed(2));
      setManualSessionDuration(hours.toString().replace('.', ','));
    }
  }, [manualStartTime, manualEndTime]);

  useEffect(() => {
    // Sincronizar apenas se o valor no formData for diferente do valor numérico atual no input
    // Isso evita que o input seja resetado enquanto o usuário digita (ex: perdendo a vírgula)
    if (formData.laborHours !== undefined) {
      const currentNumericVal = Number(laborHoursInput.replace(',', '.'));
      if (isNaN(currentNumericVal) || currentNumericVal !== formData.laborHours) {
        setLaborHoursInput(formData.laborHours.toString());
      }
    }
  }, [formData.laborHours]);

  const handleLaborHoursChange = (val: string) => {
    setLaborHoursInput(val);
    const numericVal = val.replace(',', '.');
    const num = Number(numericVal);
    
    // Só atualiza o formData se for um número válido e não estiver terminando em separador decimal
    // Isso evita que o useEffect de sincronização resete o input enquanto o usuário digita "8,"
    if (!isNaN(num) && !val.endsWith('.') && !val.endsWith(',')) {
      const worked = formData.totalWorkedHours || 0;
      setFormData(prev => ({ 
        ...prev, 
        laborHours: val.trim() === '' ? 0 : num,
        remainingHours: Number(((val.trim() === '' ? 0 : num) - worked).toFixed(2))
      }));
    }
  };

  const handleAddManualSession = () => {
    const duration = Number(manualSessionDuration.replace(',', '.'));
    if (isNaN(duration) || duration <= 0) {
      toast.error('Insira uma duração válida.');
      return;
    }
    
    const techCount = formData.technicianIds?.length || 0;
    if (techCount === 0) {
      toast.warning('Selecione os técnicos primeiro para atribuir as horas.');
      return;
    }

    setFormData(prev => {
      const currentSessions = prev.workSessions || [];
      const sessionDate = prev.scheduledDate ? new Date(prev.scheduledDate).toISOString() : new Date().toISOString();
      
      let startISO = sessionDate;
      let endISO = sessionDate;

      if (manualStartTime && manualEndTime) {
        const base = new Date(sessionDate);
        const [sh, sm] = manualStartTime.split(':').map(Number);
        const [eh, em] = manualEndTime.split(':').map(Number);
        
        const startDate = new Date(base);
        startDate.setHours(sh, sm, 0, 0);
        
        const endDate = new Date(base);
        endDate.setHours(eh, em, 0, 0);
        if (endDate < startDate) endDate.setDate(endDate.getDate() + 1);
        
        startISO = startDate.toISOString();
        endISO = endDate.toISOString();
      }

      const newSession = {
        startTime: startISO,
        endTime: endISO,
        duration: duration,
        technicianIds: prev.technicianIds || [],
        description: manualSessionDescription
      };

      const newSessions = [...currentSessions, newSession];
      const totalWorked = Number(newSessions.reduce((sum, s) => 
        sum + (s.duration * (s.technicianIds?.length || 0)), 0).toFixed(2));
      const est = prev.laborHours || 0;

      // Auto KM calculation for manual session - Based on total sessions count
      const sessionKm = prev.dailyKmOverride && prev.dailyKmOverride > 0 
        ? prev.dailyKmOverride 
        : calculateDisplacement(prev.customerId || '', prev.supplierId);

      const newKmTotal = Number((newSessions.length * sessionKm).toFixed(2));
      const newKmRemaining = Number(((prev.estimatedKm || 0) - newKmTotal).toFixed(2));

      return {
        ...prev,
        workSessions: newSessions,
        totalWorkedHours: totalWorked,
        remainingHours: Number((est - totalWorked).toFixed(2)),
        kmDriven: newKmTotal,
        remainingKm: newKmRemaining
      };
    });
    
    setManualSessionDuration('');
    setManualSessionDescription('');
    setManualStartTime('');
    setManualEndTime('');
    toast.success(`Trabalho diário lançado: ${duration}h adicionadas.`);
  };

  const removeSession = (index: number) => {
    setFormData(prev => {
      const newSessions = [...(prev.workSessions || [])];
      newSessions.splice(index, 1);
      
      const totalWorked = Number(newSessions.reduce((sum, s) => 
        sum + (s.duration * (s.technicianIds?.length || 0)), 0).toFixed(2));
      const est = prev.laborHours || 0;

      // Re-calculate KM based on remaining sessions
      const sessionKm = calculateDisplacement(prev.customerId || '', prev.supplierId);
      const totalKm = Number((newSessions.length * sessionKm).toFixed(2));
      
      return {
        ...prev,
        workSessions: newSessions,
        totalWorkedHours: totalWorked,
        remainingHours: Number((est - totalWorked).toFixed(2)),
        kmDriven: totalKm,
        remainingKm: Number(((prev.estimatedKm || 0) - totalKm).toFixed(2))
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
    generateWorkOrderPDF(formData as WorkOrder, customer || null, technicians, settings, { includeDetails });
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
          let woNumber = formData.workOrderNumber;
          
          if (!woNumber) {
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
                    onChange={(e) => setFormData(prev => ({ ...prev, workOrderNumber: e.target.value }))}
                    className="font-mono font-bold"
                    placeholder="Ex: 00001/1"
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

              {formData.supplierNameSnapshot && (
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <div className="flex items-center gap-2 text-indigo-700">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Fornecedor do Orçamento:</span>
                    <span className="text-sm font-bold uppercase">{formData.supplierNameSnapshot}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select 
                    value={formData.customerId || ''} 
                    onChange={(e) => handleCustomerChange(e.target.value)}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Horas Estimadas</Label>
                  <Input 
                    type="text" 
                    inputMode="decimal"
                    placeholder="0.0"
                    value={laborHoursInput}
                    onChange={(e) => handleLaborHoursChange(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>KM Estimado</Label>
                  <Input 
                    type="number" 
                    value={formData.estimatedKm || 0}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormData(prev => ({ 
                        ...prev, 
                        estimatedKm: val,
                        remainingKm: Number((val - (prev.kmDriven || 0)).toFixed(2))
                      }));
                    }}
                    className="font-mono"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-indigo-500" /> KM por Sessão (Manual)
                  </Label>
                  <div className="flex gap-2">
                    <Input 
                      type="number" 
                      step="0.1"
                      placeholder="Ex: 30"
                      value={formData.dailyKmOverride || ''} 
                      onChange={(e) => setFormData(prev => ({ ...prev, dailyKmOverride: Number(e.target.value) }))}
                      className="font-mono"
                    />
                    <div className="flex items-center px-3 bg-slate-100 rounded-md text-xs font-medium text-slate-500 border border-slate-200">
                      km/dia
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    Se preenchido, ignora o cálculo automático ({calculateDisplacement(formData.customerId || '', formData.supplierId)} km).
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Adicionar Horas Trabalhadas (p/ técnico)</Label>
                  <div className="flex flex-col gap-3 p-3 border rounded-lg bg-slate-50/50">
                    <div className="grid grid-cols-1 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-500">O que foi feito?</Label>
                        <Input 
                          placeholder="Breve descrição do trabalho realizado..."
                          value={manualSessionDescription}
                          onChange={(e) => setManualSessionDescription(e.target.value)}
                          className="h-9 bg-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Início</Label>
                      <Input 
                        type="time" 
                        value={manualStartTime}
                        onChange={(e) => setManualStartTime(e.target.value)}
                        className="h-9 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Fim</Label>
                      <Input 
                        type="time" 
                        value={manualEndTime}
                        onChange={(e) => setManualEndTime(e.target.value)}
                        className="h-9 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Duração (h)</Label>
                      <Input 
                        type="text" 
                        inputMode="decimal"
                        placeholder="0.0"
                        value={manualSessionDuration}
                        onChange={(e) => setManualSessionDuration(e.target.value)}
                        className="h-9 font-bold bg-white"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddManualSession();
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddManualSession}
                      className="bg-indigo-600 hover:bg-indigo-700 h-9"
                    >
                      Add
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    {!formData.currentStartTime ? (
                      <Button 
                        type="button" 
                        size="sm"
                        variant="outline" 
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 gap-2 flex-1 h-9"
                        onClick={handleStartWork}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Iniciar Agora
                      </Button>
                    ) : (
                      <Button 
                        type="button" 
                        size="sm"
                        variant="outline" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 animate-pulse gap-2 flex-1 h-9"
                        onClick={handleFinishWork}
                      >
                        <Square className="w-3 h-3 fill-current" />
                        Finalizar Agora
                      </Button>
                    )}
                  </div>
                </div>
                {formData.currentStartTime && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    Sessão iniciada em tempo real: {format(parseDateSafely(formData.currentStartTime), "HH:mm")}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 p-4 bg-slate-100/50 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">KM Real (Orc.)</Label>
                  <div className="text-xl font-mono font-bold text-indigo-600">
                    {formData.estimatedKm || 0} <span className="text-xs text-slate-400">km</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">KM Diário (Acum.)</Label>
                  <div className="text-xl font-mono font-bold text-amber-600">
                    {formData.kmDriven || 0} <span className="text-xs text-slate-400">km</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">KM Restante</Label>
                  <div className={`text-xl font-mono font-bold ${Number(formData.remainingKm) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formData.remainingKm || 0} <span className="text-xs opacity-50">km</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Total Horas</Label>
                  <div className="text-xl font-mono font-bold text-indigo-600">
                    {formData.totalWorkedHours || 0} <span className="text-xs text-slate-400">h</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Horas Restante</Label>
                  <div className={`text-xl font-mono font-bold ${Number(formData.remainingHours) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formData.remainingHours || 0} <span className="text-xs opacity-50">h</span>
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
                      <div key={index} className="flex flex-col p-3 bg-muted/20 rounded-lg border border-border text-xs gap-2">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex gap-4">
                            <div className="flex flex-col">
                              <span className="text-muted-foreground uppercase text-[10px] font-bold">Início</span>
                              <span>{format(parseDateSafely(session.startTime), "dd/MM/yy HH:mm")}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-muted-foreground uppercase text-[10px] font-bold">Fim</span>
                              <span>{format(parseDateSafely(session.endTime), "dd/MM/yy HH:mm")}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col items-end">
                              <span className="text-muted-foreground uppercase text-[10px] font-bold">Duração (h)</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="w-16 h-7 text-right font-bold text-indigo-600 bg-transparent border-b border-indigo-200 focus:outline-none focus:border-indigo-500"
                                value={session.duration}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const numericVal = val.replace(',', '.');
                                  const newDur = Number(numericVal);
                                  
                                  if (!isNaN(newDur)) {
                                    // Só sincroniza com o estado global se não estiver no meio de uma digitação decimal
                                    if (!val.endsWith('.') && !val.endsWith(',')) {
                                      setFormData(prev => {
                                        const newSessions = [...(prev.workSessions || [])];
                                        if (newSessions[index].duration === newDur) return prev;
                                        
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
                                    }
                                  }
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
                        {session.description && (
                          <div className="pt-2 border-t border-border/50">
                            <span className="text-muted-foreground font-medium">Procedimento:</span>
                            <p className="mt-0.5 text-slate-700 italic">{session.description}</p>
                          </div>
                        )}
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
