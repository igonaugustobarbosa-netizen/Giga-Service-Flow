import React, { useEffect, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Customer } from '../types';
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
  User,
  X
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { getCurrentLocation } from '../services/locationService';
import { ServiceLocation } from '../types';
import { useAuth } from '../components/AuthGuard';
import { where } from 'firebase/firestore';
import { logActivity } from '../services/activityService';

export default function Customers() {
  const { userData, isAdmin } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
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
    location: null as ServiceLocation | null
  });

  useEffect(() => {
    if (!userData) return;

    const customersRef = collection(db, 'customers');
    const q = isAdmin
      ? query(customersRef, orderBy('name', 'asc'))
      : query(customersRef, where('tenantId', '==', userData.tenantId), orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userData, isAdmin]);

  const handleOpenDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone,
        address: customer.address || '',
        taxId: customer.taxId || '',
        location: customer.location || null
      });
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', email: '', phone: '', address: '', taxId: '', location: null });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), formData);
        logActivity({
          type: 'update',
          entity: 'customer',
          entityId: editingCustomer.id,
          entityName: formData.name,
          userId: userData.id,
          userName: userData.name,
          tenantId: userData.tenantId
        });
      } else {
        const docRef = await addDoc(collection(db, 'customers'), {
          ...formData,
          tenantId: userData.tenantId
        });
        logActivity({
          type: 'create',
          entity: 'customer',
          entityId: docRef.id,
          entityName: formData.name,
          userId: userData.id,
          userName: userData.name,
          tenantId: userData.tenantId
        });
      }
      setIsDialogOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'customers');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Cliente',
      description: 'Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          const customer = customers.find(c => c.id === id);
          await deleteDoc(doc(db, 'customers', id));
          if (customer && userData) {
            logActivity({
              type: 'delete',
              entity: 'customer',
              entityId: id,
              entityName: customer.name,
              userId: userData.id,
              userName: userData.name,
              tenantId: userData.tenantId
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `customers/${id}`);
        }
      }
    });
  };

  const handleGetLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setFormData(prev => ({
        ...prev,
        location,
        address: location.address || prev.address
      }));
    } catch (error) {
      console.error('Erro ao obter localização:', error);
      alert('Não foi possível obter a localização atual.');
    }
  };

  const filteredCustomers = customers.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').includes(searchTerm) ||
    (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Gerencie sua base de clientes.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2 h-12 px-6 rounded-xl shadow-lg">
          <Plus className="w-5 h-5" />
          Novo Cliente
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
          {filteredCustomers.map((customer, i) => (
            <motion.div
              key={customer.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="group border-none shadow-sm bg-orange-50/20 backdrop-blur-sm hover:bg-orange-50/40 hover:shadow-md transition-all">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-bold text-xl shrink-0">
                      {customer.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-lg font-bold truncate">{customer.name}</CardTitle>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="icon" className="h-8 w-8 bg-background/50 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground transition-all" onClick={() => handleOpenDialog(customer)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 bg-background/50 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all" onClick={() => handleDelete(customer.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{customer.phone}</span>
                    </div>
                    {customer.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{customer.address}</span>
                      </div>
                    )}
                    {customer.taxId && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>{customer.taxId}</span>
                      </div>
                    )}
                    {customer.location && (
                      <div className="flex items-center gap-2 text-primary hover:underline">
                        <MapPin className="w-4 h-4" />
                        <a 
                          href={`https://www.google.com/maps?q=${customer.location.latitude},${customer.location.longitude}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="truncate"
                        >
                          Ver no Google Maps
                        </a>
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
            <DialogTitle>{editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo *</Label>
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
                <Label htmlFor="taxId">CPF/CNPJ</Label>
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
              <div className="flex gap-2">
                <Input 
                  id="address" 
                  className="flex-1"
                  value={formData.address} 
                  onChange={e => setFormData({...formData, address: e.target.value})} 
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  onClick={handleGetLocation}
                  title="Obter localização atual"
                >
                  <MapPin className="w-4 h-4" />
                </Button>
              </div>
              {formData.location && (
                <p className="text-[10px] text-muted-foreground">
                  Coordenadas: {formData.location.latitude.toFixed(6)}, {formData.location.longitude.toFixed(6)}
                </p>
              )}
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
