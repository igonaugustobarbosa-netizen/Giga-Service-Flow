import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ServiceOrder, Customer, Settings } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Label } from '../components/ui/Label';
import { 
  FileSignature, 
  Search, 
  ClipboardList, 
  User, 
  Calendar, 
  Download,
  AlertCircle,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../components/AuthGuard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateContractPDF } from '../services/contractService';
import { toast } from 'sonner';

export default function Contracts() {
  const { userData, isAdmin } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [supplier, setSupplier] = useState<any | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editableClauses, setEditableClauses] = useState<string>('');

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
        const settingsData = snapshot.data() as Settings;
        setSettings(settingsData);
        if (settingsData.contractClauses) {
          setEditableClauses(settingsData.contractClauses);
        }
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
        setSupplier(null);
        return;
      }

      const order = orders.find(o => o.id === selectedOrderId);
      if (order) {
        setSelectedOrder(order);
        
        try {
          // Fetch Customer
          const customerSnap = await getDoc(doc(db, 'customers', order.customerId));
          if (customerSnap.exists()) {
            setCustomer({ id: customerSnap.id, ...customerSnap.data() } as Customer);
          }

          // Fetch Supplier if exists
          if (order.supplierId) {
            const supplierSnap = await getDoc(doc(db, 'suppliers', order.supplierId));
            if (supplierSnap.exists()) {
              setSupplier({ id: supplierSnap.id, ...supplierSnap.data() });
            } else {
              setSupplier(null);
            }
          } else {
            setSupplier(null);
          }
        } catch (error) {
          console.error('Error fetching details:', error);
          toast.error('Erro ao carregar dados complementares da OS.');
        }
      }
    };

    fetchOrderDetails();
  }, [selectedOrderId, orders]);

  const filteredOrders = orders.filter(order => 
    (order.orderNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGenerateContract = () => {
    if (!selectedOrder) {
      toast.error('Selecione uma ordem de serviço válida.');
      return;
    }

    try {
      generateContractPDF(selectedOrder, customer, supplier, settings, editableClauses);
      toast.success('Contrato gerado com sucesso!');
    } catch (error) {
      console.error('Error generating contract:', error);
      toast.error('Erro ao gerar o PDF do contrato.');
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
          <h1 className="text-3xl font-bold tracking-tight">Gerador de Contratos</h1>
          <p className="text-muted-foreground">Selecione uma ordem de serviço para gerar o contrato de prestação de serviço.</p>
        </div>
        <div className="flex items-center gap-2">
          <FileSignature className="w-8 h-8 text-primary opacity-20" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Selection Side */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm bg-orange-50/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Selecionar OS</CardTitle>
              <CardDescription>Busque pela OS que deseja contratar</CardDescription>
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
                          ? "bg-primary border-primary text-white shadow-md"
                          : "bg-white border-primary/10 hover:border-primary/30"
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
                  <CardHeader className="bg-primary text-white rounded-t-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-2xl">Prévia do Contrato</CardTitle>
                        <CardDescription className="text-primary-foreground/80">
                          Resumo da Ordem de Serviço N° {selectedOrder.orderNumber}
                        </CardDescription>
                      </div>
                      <FileSignature className="w-10 h-10 opacity-20" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Contratante (Fornecedor/Cliente)</p>
                            <p className="font-bold text-lg">{(supplier?.name || customer?.name) || 'Carregando...'}</p>
                            {(supplier?.taxId || customer?.taxId) && <p className="text-sm text-muted-foreground">CNPJ/CPF: {supplier?.taxId || customer?.taxId}</p>}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <ClipboardList className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Objeto do Serviço</p>
                            <p className="font-medium line-clamp-2">{selectedOrder.description}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Data de Execução</p>
                            <p className="font-bold text-lg">
                              {format(new Date((selectedOrder.executionDate || selectedOrder.createdAt).replace('Z', '')), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Valor do Contrato</p>
                            <p className="font-bold text-2xl text-primary">R$ {selectedOrder.totalValue.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 rounded-xl bg-muted/50 border space-y-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <FileSignature className="w-5 h-5 text-primary" />
                          <h3 className="font-bold uppercase text-xs tracking-widest">Cláusulas Vigentes</h3>
                        </div>
                        <span className="text-[10px] text-muted-foreground bg-white px-2 py-0.5 rounded border">Editável para esta impressão</span>
                      </div>
                      
                      <div className="space-y-4">
                        <textarea
                          value={editableClauses}
                          onChange={(e) => setEditableClauses(e.target.value)}
                          placeholder="Digite as cláusulas do contrato aqui..."
                          className="w-full min-h-[300px] p-4 text-sm font-mono bg-white rounded-lg border border-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none custom-scrollbar"
                        />
                        
                        {!settings?.contractClauses && (
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <p className="text-[11px]">
                              Nenhuma cláusula padrão configurada nas <strong>Configurações</strong>.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <Button 
                        size="lg" 
                        className="flex-1 h-16 text-lg font-bold gap-3 rounded-2xl shadow-xl hover:shadow-2xl transition-all"
                        onClick={handleGenerateContract}
                      >
                        <Download className="w-6 h-6" />
                        Gerar PDF do Contrato
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed rounded-3xl p-12 text-center text-muted-foreground">
                <div className="space-y-4 max-w-sm">
                  <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto opacity-50">
                    <ClipboardList className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Nenhuma OS Selecionada</h3>
                  <p>Escola uma ordem de serviço na lista ao lado para visualizar e gerar o contrato correspondente.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
