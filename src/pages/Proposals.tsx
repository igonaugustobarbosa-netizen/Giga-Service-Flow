import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { ServiceOrder, Customer, Technician, Settings } from '../types';
import { useAuth } from '../components/AuthGuard';
import { 
  FileText, 
  Search, 
  Eye, 
  Download, 
  MoreHorizontal,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileBadge,
  CheckSquare,
  Square,
  DownloadCloud
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateCommercialProposalPDF } from '../services/pdfProposalService';
import { generateCommercialProposalWord } from '../services/wordService';
import { DocumentFormatDialog } from '../components/DocumentFormatDialog';
import { toast } from 'sonner';

export default function Proposals() {
  const { userData, isAdmin } = useAuth();
  const tenantId = userData?.tenantId;
  const [proposals, setProposals] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formatDialogOpen, setFormatDialogOpen] = useState(false);

  useEffect(() => {
    if (!tenantId && !isAdmin) return;

    // Filter by 'budget' status
    const collectionRef = collection(db, 'serviceOrders');
    const q = isAdmin 
      ? query(collectionRef, where('status', '==', 'budget'), orderBy('createdAt', 'desc'))
      : query(collectionRef, where('tenantId', '==', tenantId), where('status', '==', 'budget'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData: ServiceOrder[] = [];
      snapshot.forEach((doc) => {
        ordersData.push({ id: doc.id, ...doc.data() } as ServiceOrder);
      });
      setProposals(ordersData);
      setLoading(false);
    }, (error) => {
      console.error('Error loading proposals:', error);
      setLoading(false);
      toast.error('Erro ao carregar propostas. Verifique as permissões ou índices do Firestore.');
    });

    return () => unsubscribe();
  }, [tenantId, isAdmin]);

  useEffect(() => {
    if (!tenantId && !isAdmin) return;
    const custRef = collection(db, 'customers');
    const techRef = collection(db, 'technicians');
    const setRef = collection(db, 'settings');

    const qCust = isAdmin ? query(custRef) : query(custRef, where('tenantId', '==', tenantId));
    const unsubscribeCust = onSnapshot(qCust, (snapshot) => {
      const data: Customer[] = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(data);
    });

    const qTech = isAdmin ? query(techRef) : query(techRef, where('tenantId', '==', tenantId));
    const unsubscribeTech = onSnapshot(qTech, (snapshot) => {
      const data: Technician[] = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as Technician));
      setTechnicians(data);
    });

    const qSet = isAdmin ? query(setRef) : query(setRef, where('tenantId', '==', tenantId));
    const unsubscribeSet = onSnapshot(qSet, (snapshot) => {
      if (!snapshot.empty) setSettings(snapshot.docs[0].data() as Settings);
    });

    return () => {
      unsubscribeCust();
      unsubscribeTech();
      unsubscribeSet();
    };
  }, [tenantId, isAdmin]);

  const handleGenerateProposal = (proposal: ServiceOrder) => {
    const customer = customers.find(c => c.id === proposal.customerId);
    const techIds = (proposal.technicianDetails || []).map(td => td.technicianId);
    const selectedTechs = technicians.filter(t => techIds.includes(t.id));
    
    setFormatDialogOpen(true);
    // When individually calling, we might need a separate state, but for now let's reuse
    // the bulk selection if it's simpler, or handle it in processGeneration
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProposals.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProposals.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id) 
        : [...prev, id]
    );
  };

  const processGeneration = async (formatType: 'pdf' | 'word') => {
    const ordersToProcess = proposals.filter(p => selectedIds.includes(p.id));
    
    if (ordersToProcess.length === 0) {
      toast.error('Nenhuma proposta selecionada.');
      return;
    }

    toast.info(`Gerando ${ordersToProcess.length} proposta(s)...`);

    for (const proposal of ordersToProcess) {
      const customer = customers.find(c => c.id === proposal.customerId);
      const techIds = (proposal.technicianDetails || []).map(td => td.technicianId);
      const selectedTechs = technicians.filter(t => techIds.includes(t.id));

      try {
        if (formatType === 'pdf') {
          generateCommercialProposalPDF(proposal, customer, selectedTechs, undefined, settings);
        } else {
          await generateCommercialProposalWord(proposal, customer, selectedTechs, undefined, settings);
        }
      } catch (error) {
        console.error('Error generating proposal:', error);
        toast.error(`Erro ao gerar proposta #${proposal.orderNumber || proposal.id}`);
      }
    }

    toast.success('Geração concluída!');
    setFormatDialogOpen(false);
    setSelectedIds([]);
  };

  const filteredProposals = proposals.filter(p => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (p.orderNumber?.toLowerCase().includes(search) || false) ||
      (p.customerNameSnapshot?.toLowerCase().includes(search) || false) ||
      (p.description?.toLowerCase().includes(search) || false)
    );
  });

  const totalValue = proposals.reduce((acc, p) => acc + p.totalValue, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Propostas Comerciais</h1>
        <p className="text-muted-foreground">Gerenciamento de orçamentos e propostas para clientes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Propostas Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{proposals.length}</span>
              <Clock className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50/50 border-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor em Negociação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-green-600">
                R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50/50 border-orange-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ação Necessária</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-orange-600">
                {proposals.filter(p => {
                  const days = (new Date().getTime() - new Date(p.createdAt).getTime()) / (1000 * 3600 * 24);
                  return days > 7;
                }).length}
              </span>
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 underline">Mais de 7 dias sem retorno</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSelectAll}
            className="gap-2"
          >
            {selectedIds.length === filteredProposals.length && filteredProposals.length > 0 ? (
              <CheckSquare className="w-5 h-5 text-primary" />
            ) : (
              <Square className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">Selecionar Tudo</span>
          </Button>

          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por cliente, número ou descrição..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-end">
          {selectedIds.length > 0 && (
            <Button 
              variant="outline" 
              className="gap-2 border-primary text-primary hover:bg-primary/5"
              onClick={() => setFormatDialogOpen(true)}
            >
              <DownloadCloud className="w-4 h-4" />
              Gerar ({selectedIds.length})
            </Button>
          )}
          <Button asChild>
            <Link to="/orders/new?type=budget" className="gap-2">
              <FileBadge className="w-4 h-4" />
              Nova Proposta
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredProposals.length > 0 ? (
            filteredProposals.map((proposal) => (
              <motion.div
                key={proposal.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card className="overflow-hidden hover:border-primary/50 transition-all relative group">
                  <div className="p-4 md:p-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <button 
                        onClick={() => toggleSelect(proposal.id)}
                        className="shrink-0 hover:scale-110 transition-transform"
                      >
                        {selectedIds.includes(proposal.id) ? (
                          <CheckSquare className="w-6 h-6 text-primary" />
                        ) : (
                          <Square className="w-6 h-6 text-muted-foreground/30" />
                        )}
                      </button>

                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <FileBadge className="w-6 h-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">#{proposal.orderNumber || proposal.id.substring(0, 8).toUpperCase()}</span>
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                            Orçamento
                          </Badge>
                        </div>
                        <p className="font-medium text-foreground truncate">{proposal.customerNameSnapshot || 'Cliente não identificado'}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(proposal.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-1 w-full md:w-auto">
                      <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
                      <p className="text-xl font-bold text-primary">
                        R$ {proposal.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                      <Button variant="outline" size="sm" asChild className="gap-2">
                        <Link to={`/orders/${proposal.id}`}>
                          <Eye className="w-4 h-4" />
                          Ver Detalhes
                        </Link>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setSelectedIds([proposal.id]);
                          setFormatDialogOpen(true);
                        }} 
                        className="gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Gerar Proposta
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileBadge className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">Nenhum orçamento pendente</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                Comece criando um novo orçamento para seus clientes. Todos os orçamentos aparecerão aqui para acompanhamento comercial.
              </p>
              <Button asChild className="mt-6">
                <Link to="/orders/new?type=budget">Novo Orçamento</Link>
              </Button>
            </div>
          )}
        </AnimatePresence>
      </div>

      <DocumentFormatDialog 
        isOpen={formatDialogOpen}
        onOpenChange={setFormatDialogOpen}
        onSelect={processGeneration}
        title="Formato da Proposta"
        description="Escolha o formato para as propostas selecionadas"
      />
    </div>
  );
}
