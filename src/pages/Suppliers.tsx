import React, { useEffect, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Supplier } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin, 
  Building2,
  X,
  CreditCard,
  QrCode
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { handleFirestoreError, OperationType } from '../lib/utils';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'default' | 'destructive';
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
    variant: 'default'
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    pixKey: '',
    paymentDetails: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'suppliers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenDialog = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        email: supplier.email || '',
        phone: supplier.phone,
        address: supplier.address || '',
        taxId: supplier.taxId || '',
        pixKey: supplier.pixKey || '',
        paymentDetails: supplier.paymentDetails || ''
      });
    } else {
      setEditingSupplier(null);
      setFormData({ name: '', email: '', phone: '', address: '', taxId: '', pixKey: '', paymentDetails: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await updateDoc(doc(db, 'suppliers', editingSupplier.id), formData);
      } else {
        await addDoc(collection(db, 'suppliers'), formData);
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Erro ao salvar fornecedor:', error);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Fornecedor',
      description: 'Tem certeza que deseja excluir este fornecedor? Esta ação não pode ser desfeita.',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'suppliers', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `suppliers/${id}`);
        }
      }
    });
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone.includes(searchTerm) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-muted-foreground">Gerencie sua base de fornecedores.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2 h-12 px-6 rounded-xl shadow-lg">
          <Plus className="w-5 h-5" />
          Novo Fornecedor
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por nome, telefone ou email..." 
          className="pl-10 h-11 rounded-xl bg-card/50 border-none shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredSuppliers.map((supplier, i) => (
            <motion.div
              key={supplier.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="group border-none shadow-sm bg-orange-50/20 backdrop-blur-sm hover:bg-orange-50/40 hover:shadow-md transition-all">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-bold text-xl">
                      {supplier.name.charAt(0)}
                    </div>
                    <CardTitle className="text-lg font-bold">{supplier.name}</CardTitle>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(supplier)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(supplier.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{supplier.phone}</span>
                    </div>
                    {supplier.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{supplier.email}</span>
                      </div>
                    )}
                    {supplier.address && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{supplier.address}</span>
                      </div>
                    )}
                    {supplier.taxId && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="w-4 h-4" />
                        <span>{supplier.taxId}</span>
                      </div>
                    )}
                    {supplier.pixKey && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <QrCode className="w-4 h-4" />
                        <span className="truncate">PIX: {supplier.pixKey}</span>
                      </div>
                    )}
                    {supplier.paymentDetails && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CreditCard className="w-4 h-4" />
                        <span className="truncate">{supplier.paymentDetails}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome / Razão Social *</Label>
              <Input 
                id="name" 
                required 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone *</Label>
                <Input 
                  id="phone" 
                  required 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">CNPJ</Label>
                <Input 
                  id="taxId" 
                  value={formData.taxId} 
                  onChange={e => setFormData({...formData, taxId: e.target.value})} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input 
                id="address" 
                value={formData.address} 
                onChange={e => setFormData({...formData, address: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pixKey">Chave PIX</Label>
                <Input 
                  id="pixKey" 
                  placeholder="E-mail, CPF, CNPJ ou Aleatória"
                  value={formData.pixKey} 
                  onChange={e => setFormData({...formData, pixKey: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentDetails">Detalhes de Cartão / Pagamento</Label>
                <Input 
                  id="paymentDetails" 
                  placeholder="Ex: Aceita crédito/débito"
                  value={formData.paymentDetails} 
                  onChange={e => setFormData({...formData, paymentDetails: e.target.value})} 
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
      />
    </div>
  );
}
