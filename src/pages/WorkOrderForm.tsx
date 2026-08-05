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
  FileText,
  Users
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
  const [settings, setSettings] = useState<Settings | null>(null);
  
  const [formData, setFormData] = useState<Partial<WorkOrder>>({
    workOrderNumber: '',
    status: 'open',
    scheduledDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    description: '',
    kmDriven: 0,
    kmRate: 0,
    laborHours: 0,
    technicianIds: []
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

        const [custSnap, techSnap, serviceOrdersSnap] = await Promise.all([
          getDocs(isAdmin ? query(customersRef) : query(customersRef, where('tenantId', '==', tenantId))),
          getDocs(isAdmin ? query(techniciansRef) : query(techniciansRef, where('tenantId', '==', tenantId))),
          getDocs(isAdmin ? query(serviceOrdersRef) : query(serviceOrdersRef, where('tenantId', '==', tenantId)))
        ]);

        const customersData = custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
        const techniciansData = techSnap.docs.map(d => ({ id: d.id, ...d.data() } as Technician));
        
        console.log('Data loaded:', { 
          customersCount: customersData.length, 
          techniciansCount: techniciansData.length 
        });

        setCustomers(customersData);
        setTechnicians(techniciansData);
        
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
            setFormData(data);
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
                customerId: budget.customerId,
                customerNameSnapshot: budget.customerNameSnapshot,
                technicianIds: budget.technicianIds || [],
                description: budget.description,
                kmDriven: budget.kmDriven || 0,
                kmRate: budget.kmValue || 0,
                laborHours: totalHours,
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
        customerId: budget.customerId,
        customerNameSnapshot: budget.customerNameSnapshot,
        technicianIds: budget.technicianIds || [],
        description: budget.description,
        kmDriven: budget.kmDriven || 0,
        kmRate: budget.kmValue || 0,
        laborHours: totalHours,
        technicianDetails: budget.technicianDetails || []
      }));
      toast.info('Dados do orçamento carregados na OS.');
    }
  };

  const handleGeneratePDF = () => {
    if (!id || !formData.customerId) {
      toast.error('Salve a OS antes de gerar o PDF.');
      return;
    }
    const customer = customers.find(c => c.id === formData.customerId);
    generateWorkOrderPDF(formData as WorkOrder, customer || null, technicians, settings);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !formData.customerId || !formData.workOrderNumber) {
      toast.error('Por favor, preencha os campos obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      const woData = {
        ...formData,
        tenantId: userData.tenantId,
        updatedAt: new Date().toISOString(),
      };

      if (id) {
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
                    onChange={(e) => setFormData(prev => ({ ...prev, laborHours: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Agendada</Label>
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
    </div>
  );
}
