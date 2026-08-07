import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  ClipboardList, 
  Calendar, 
  User, 
  CheckCircle2, 
  Clock, 
  Play,
  Edit,
  Trash2,
  ChevronRight,
  FileText
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthGuard';
import { WorkOrder, WorkOrderStatus, Customer, Technician, Settings } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { generateWorkOrderPDF } from '../services/workOrderPDFService';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { logActivity } from '../services/activityService';

export default function WorkOrders() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    id: string;
  }>({
    isOpen: false,
    id: ''
  });

  const [pdfConfirmDialog, setPdfConfirmDialog] = useState<{
    isOpen: boolean;
    workOrder: WorkOrder | null;
  }>({
    isOpen: false,
    workOrder: null
  });

  useEffect(() => {
    if (!userData?.tenantId) return;

    const tenantId = userData.tenantId;
    
    // Fetch Settings
    getDoc(doc(db, 'settings', tenantId)).then(snap => {
      if (snap.exists()) setSettings(snap.data() as Settings);
    });

    const q = query(
      collection(db, 'workOrders'),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWorkOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder)));
      setLoading(false);
    }, (error) => {
      console.error('Error loading work orders:', error);
      setLoading(false);
    });

    const qCust = query(
      collection(db, 'customers'),
      where('tenantId', '==', tenantId)
    );

    const unsubscribeCust = onSnapshot(qCust, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => {
      console.error('Error loading customers:', error);
    });

    const qTech = query(
      collection(db, 'technicians'),
      where('tenantId', '==', tenantId)
    );

    const unsubscribeTech = onSnapshot(qTech, (snapshot) => {
      setTechnicians(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Technician)));
    }, (error) => {
      console.error('Error loading technicians:', error);
    });

    return () => {
      unsubscribe();
      unsubscribeCust();
      unsubscribeTech();
    };
  }, [userData]);

  const handleDelete = async (id: string) => {
    try {
      const wo = workOrders.find(w => w.id === id);
      await deleteDoc(doc(db, 'workOrders', id));
      
      if (wo && userData) {
        logActivity({
          type: 'delete',
          entity: 'workOrder',
          entityId: id,
          entityName: `OS #${wo.workOrderNumber}`,
          userId: userData.id,
          userName: userData.name,
          tenantId: userData.tenantId
        });
      }
      
      toast.success('Ordem de serviço excluída.');
    } catch (error) {
      console.error('Error deleting WO:', error);
      toast.error('Erro ao excluir ordem de serviço.');
    }
  };

  const getStatusBadge = (status: WorkOrderStatus) => {
    switch (status) {
      case 'open':
        return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 gap-1.5"><Clock className="w-3 h-3" /> Aberta</Badge>;
      case 'in-progress':
        return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 gap-1.5"><Play className="w-3 h-3" /> Em Andamento</Badge>;
      case 'closed':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 gap-1.5"><CheckCircle2 className="w-3 h-3" /> Encerrada</Badge>;
      default:
        return null;
    }
  };

  const filteredOrders = workOrders.filter(wo => {
    const customer = customers.find(c => c.id === wo.customerId);
    const searchLower = searchTerm.toLowerCase();
    const woNumber = wo.workOrderNumber || '';
    const customerName = (customer?.name || wo.customerNameSnapshot || '').toLowerCase();
    const description = (wo.description || '').toLowerCase();
    
    const matchesSearch = (
      woNumber.toLowerCase().includes(searchLower) ||
      customerName.includes(searchLower) ||
      description.includes(searchLower)
    );

    const isArchived = wo.status === 'closed';
    const matchesTab = activeTab === 'active' ? !isArchived : isArchived;

    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de OS</h1>
          <p className="text-muted-foreground">Controle diário de ordens de serviço das equipes.</p>
        </div>
        <Link to="/work-orders/new">
          <Button className="gap-2">
            <Plus className="w-5 h-5" />
            Nova OS
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="flex items-center gap-4 bg-card/50 p-1 rounded-xl border shadow-sm backdrop-blur-sm flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar por N°, cliente ou serviço..." 
              className="pl-10 border-none bg-background/50 focus-visible:ring-1"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex bg-muted p-1 rounded-lg">
          <Button
            variant={activeTab === 'active' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => setActiveTab('active')}
          >
            Ativas
          </Button>
          <Button
            variant={activeTab === 'archived' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => setActiveTab('archived')}
          >
            Arquivadas
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[200px] rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className="border-dashed border-2 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <ClipboardList className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Nenhuma OS encontrada</h3>
            <p className="text-muted-foreground max-w-sm mt-1">
              Você ainda não criou nenhuma ordem de serviço ou sua busca não retornou resultados.
            </p>
            <Link to="/work-orders/new" className="mt-4">
              <Button variant="outline">Criar primeira OS</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map((wo) => {
            const customer = customers.find(c => c.id === wo.customerId);
            return (
              <Card key={wo.id} className="group border-none shadow-sm hover:shadow-md transition-all">
                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg">#{wo.workOrderNumber}</span>
                      {getStatusBadge(wo.status)}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      {wo.scheduledDate ? format(new Date(wo.scheduledDate), "dd 'de' MMMM, HH:mm", { locale: ptBR }) : 'Não informada'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => setPdfConfirmDialog({ isOpen: true, workOrder: wo })}
                      title="Gerar PDF"
                    >
                      <FileText className="w-4 h-4" />
                    </Button>
                    <Link to={`/work-orders/${wo.id}/edit`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDialog({ isOpen: true, id: wo.id })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-10 h-10 bg-background rounded-full flex items-center justify-center shadow-sm">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Cliente</p>
                      <p className="font-semibold truncate">{customer?.name || 'Cliente não encontrado'}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Descrição do Serviço</p>
                    <p className="text-sm line-clamp-2 text-foreground/80 leading-relaxed">
                      {wo.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t flex items-center justify-between">
                    <div className="flex gap-4">
                      <div className="text-xs font-medium text-muted-foreground">
                        KM: <span className="text-foreground">{wo.kmDriven}</span>
                      </div>
                      <div className="text-xs font-medium text-muted-foreground">
                        Horas: <span className="text-indigo-600 font-bold">{wo.totalWorkedHours?.toFixed(2) || '0.00'}h</span>
                      </div>
                    </div>
                    <Link to={`/work-orders/${wo.id}/edit`}>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-primary h-8 px-2 hover:bg-primary/5">
                        Ver Detalhes <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}
        onConfirm={() => handleDelete(confirmDialog.id)}
        title="Excluir Ordem de Serviço"
        description="Tem certeza que deseja excluir esta OS? Esta ação não pode ser desfeita."
        variant="destructive"
      />
      <ConfirmDialog 
        isOpen={pdfConfirmDialog.isOpen}
        onOpenChange={(open) => setPdfConfirmDialog(prev => ({ ...prev, isOpen: open }))}
        onConfirm={() => {
          if (pdfConfirmDialog.workOrder) {
            const customer = customers.find(c => c.id === pdfConfirmDialog.workOrder?.customerId);
            generateWorkOrderPDF(pdfConfirmDialog.workOrder, customer || null, technicians, settings, { includeDetails: true });
          }
        }}
        title="Gerar PDF com Detalhes?"
        description="Deseja incluir o detalhamento de valores (horas e km) no PDF?"
        confirmText="Sim, incluir valores"
        cancelText="Não, apenas básico"
        onCancel={() => {
          if (pdfConfirmDialog.workOrder) {
            const customer = customers.find(c => c.id === pdfConfirmDialog.workOrder?.customerId);
            generateWorkOrderPDF(pdfConfirmDialog.workOrder, customer || null, technicians, settings, { includeDetails: false });
          }
          setPdfConfirmDialog({ isOpen: false, workOrder: null });
        }}
      />
    </div>
  );
}
