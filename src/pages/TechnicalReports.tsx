import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ServiceOrder, Customer, Settings, Technician } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Label } from '../components/ui/Label';
import { Textarea } from '../components/ui/Textarea';
import { 
  ClipboardList, 
  Search, 
  User, 
  Calendar, 
  Download,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../components/AuthGuard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateTechnicalReport } from '../services/technicalReportService';
import { toast } from 'sonner';

export default function TechnicalReports() {
  const { userData, isAdmin } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [technicalDescription, setTechnicalDescription] = useState('');
  const [procedures, setProcedures] = useState('');
  const [nonConformities, setNonConformities] = useState('');

  useEffect(() => {
    if (!userData) return;

    // Load available service orders
    const ordersRef = collection(db, 'serviceOrders');
    const q = isAdmin
      ? query(ordersRef, orderBy('createdAt', 'desc'))
      : query(ordersRef, where('tenantId', '==', userData.tenantId), orderBy('createdAt', 'desc'));

    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrder));
      setOrders(data);
      setLoading(false);
    });

    // Load settings
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', userData.tenantId), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as Settings);
      }
    });

    return () => {
      unsubscribeOrders();
      unsubscribeSettings();
    };
  }, [userData, isAdmin]);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!selectedOrderId) {
        setSelectedOrder(null);
        setCustomer(null);
        setTechnicians([]);
        return;
      }

      const order = orders.find(o => o.id === selectedOrderId);
      if (order) {
        setSelectedOrder(order);
        
        setTechnicalDescription(order.description || "");
        setProcedures(settings?.technicalReportDefaultProcedures || '');
        setNonConformities('');
        
        try {
          // Fetch Customer
          const customerSnap = await getDoc(doc(db, 'customers', order.customerId));
          if (customerSnap.exists()) {
            setCustomer({ id: customerSnap.id, ...customerSnap.data() } as Customer);
          }

          // Fetch Technicians
          if (order.technicianIds && order.technicianIds.length > 0) {
            const techPromises = order.technicianIds.map(id => getDoc(doc(db, 'technicians', id)));
            const techSnaps = await Promise.all(techPromises);
            const techData = techSnaps
              .filter(s => s.exists())
              .map(s => ({ id: s.id, ...s.data() } as Technician));
            setTechnicians(techData);
          } else {
            setTechnicians([]);
          }
        } catch (error) {
          console.error('Error fetching details:', error);
          toast.error('Erro ao carregar dados complementares da OS.');
        }
      }
    };

    fetchOrderDetails();
  }, [selectedOrderId, orders, settings]);

  const filteredOrders = orders.filter(order => 
    (order.orderNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGenerateReport = () => {
    if (!selectedOrder) {
      toast.error('Selecione uma ordem de serviço válida.');
      return;
    }

    try {
      generateTechnicalReport(selectedOrder, customer, technicians, settings, {
        description: technicalDescription,
        procedures: procedures,
        nonConformities: nonConformities
      });
      toast.success('Relatório técnico gerado com sucesso!');
    } catch (error) {
      console.error('Error generating technical report:', error);
      toast.error('Erro ao gerar o PDF do relatório técnico.');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <span className="ml-3">Carregando ordens de serviço...</span>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerador de Relatórios Técnicos</h1>
          <p className="text-muted-foreground">Selecione uma OS para gerar o relatório técnico profissional sem valores financeiros.</p>
        </div>
        <div className="flex items-center gap-2">
          <ClipboardList className="w-8 h-8 text-primary opacity-20" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Selection Side */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm bg-blue-50/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Selecionar OS</CardTitle>
              <CardDescription>Busque pela OS para emitir o relatório</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Pesquisar OS..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredOrders.length === 0 ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">Nenhuma OS encontrada.</p>
                ) : (
                  filteredOrders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`w-full text-left p-3 rounded-xl transition-all border ${
                        selectedOrderId === order.id
                          ? "bg-blue-600 border-blue-600 text-white shadow-md"
                          : "bg-white border-blue-600/10 hover:border-blue-600/30"
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs font-mono font-bold ${selectedOrderId === order.id ? "text-white/80" : "text-muted-foreground"}`}>
                          OS N° {order.orderNumber}
                        </span>
                        <span className="font-semibold line-clamp-1">{order.description}</span>
                        <div className={`flex items-center gap-2 text-[10px] mt-1 ${selectedOrderId === order.id ? "text-white/70" : "text-muted-foreground"}`}>
                          <Calendar className="w-3 h-3" />
                          {format(new Date(order.createdAt.replace('Z', '')), 'dd/MM/yyyy')}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Side */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedOrder ? (
              <motion.div
                key={selectedOrder.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <Card className="border-none shadow-lg">
                  <CardHeader className="bg-blue-600 text-white rounded-t-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-2xl">Prévia do Relatório</CardTitle>
                        <CardDescription className="text-blue-100">
                          Resumo Técnico da Ordem de Serviço N° {selectedOrder.orderNumber}
                        </CardDescription>
                      </div>
                      <ClipboardList className="w-10 h-10 opacity-20" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Cliente</p>
                            <p className="font-bold text-lg">{customer?.name || 'Carregando...'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                            <ClipboardList className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Descrição do Serviço</p>
                            <p className="font-medium line-clamp-2">{selectedOrder.description}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                            <Calendar className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Data de Execução</p>
                            <p className="font-bold text-lg">
                              {format(new Date((selectedOrder.executionDate || selectedOrder.createdAt).replace('Z', '')), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                            <Clock className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Status da OS</p>
                            <div className="flex items-center gap-2 mt-1">
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                              <p className="font-bold uppercase text-xs">{selectedOrder.status === 'completed' ? 'Concluída' : 'Orçamento/Em Aberto'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6 pt-6 border-t font-sans">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-blue-600">Descrição Técnica Editável</Label>
                        <Textarea 
                          value={technicalDescription}
                          onChange={(e) => setTechnicalDescription(e.target.value)}
                          placeholder="Descreva o serviço realizado..."
                          className="min-h-[120px] text-sm bg-blue-50/10 border-blue-100"
                        />
                        <p className="text-[10px] text-muted-foreground italic">Este texto aparecerá no campo "Descrição do Serviço Realizado".</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-blue-600">Procedimentos Técnicos</Label>
                        <Textarea 
                          value={procedures}
                          onChange={(e) => setProcedures(e.target.value)}
                          placeholder="Liste os procedimentos realizados..."
                          className="min-h-[100px] text-sm bg-blue-50/10 border-blue-100"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-red-600">Não Conformidades Encontradas</Label>
                        <Textarea 
                          value={nonConformities}
                          onChange={(e) => setNonConformities(e.target.value)}
                          placeholder="Liste eventuais problemas ou não conformidades..."
                          className="min-h-[80px] text-sm bg-red-50/10 border-red-100"
                        />
                      </div>
                    </div>

                    <div className="p-6 rounded-xl bg-blue-50/50 border border-blue-100 space-y-4">
                      <h3 className="font-bold uppercase text-xs tracking-widest text-blue-600">Conteúdo do Relatório</h3>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Itens de Material:</p>
                          <p className="font-bold">{(selectedOrder.parts || []).length} items</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Registros Fotográficos:</p>
                          <p className="font-bold">{(selectedOrder.beforePhotos || []).length + (selectedOrder.afterPhotos || []).length} fotos</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Técnicos:</p>
                          <p className="font-bold">{technicians.length} profissionais</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Tempo Executado:</p>
                          <p className="font-bold">{selectedOrder.hoursWorked || 0} horas</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic mt-2 border-t pt-2">
                        * O relatório técnico não inclui valores financeiros (preços, mão de obra ou descontos).
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <Button 
                        size="lg" 
                        className="flex-1 h-16 text-lg font-bold gap-3 rounded-2xl shadow-xl hover:shadow-2xl transition-all bg-blue-600 hover:bg-blue-700"
                        onClick={handleGenerateReport}
                      >
                        <Download className="w-6 h-6" />
                        Gerar Relatório Técnico PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed rounded-3xl p-12 text-center text-muted-foreground bg-slate-50/50">
                <div className="space-y-4 max-w-sm">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto opacity-50 border border-blue-100">
                    <ClipboardList className="w-10 h-10 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Aguardando Seleção</h3>
                  <p>Selecione uma ordem de serviço na lista para visualizar o resumo técnico e gerar o PDF.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
