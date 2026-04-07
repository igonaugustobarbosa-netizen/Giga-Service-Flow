import React, { useEffect, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Technician } from '../types';
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
  Wrench,
  X
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { useAuth } from '../components/AuthGuard';
import { where } from 'firebase/firestore';

export default function Technicians() {
  const { userData, isAdmin } = useAuth();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);
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
    specialty: '',
    defaultKmValue: 0,
    defaultLaborHourValue: 0
  });

  useEffect(() => {
    if (!userData) return;

    const techniciansRef = collection(db, 'technicians');
    const q = isAdmin
      ? query(techniciansRef, orderBy('name', 'asc'))
      : query(techniciansRef, where('tenantId', '==', userData.tenantId), orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Technician));
      setTechnicians(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userData, isAdmin]);

  const handleOpenDialog = (technician?: Technician) => {
    if (technician) {
      setEditingTechnician(technician);
      setFormData({
        name: technician.name,
        email: technician.email || '',
        phone: technician.phone || '',
        specialty: technician.specialty || '',
        defaultKmValue: technician.defaultKmValue || 0,
        defaultLaborHourValue: technician.defaultLaborHourValue || 0
      });
    } else {
      setEditingTechnician(null);
      setFormData({ 
        name: '', 
        email: '', 
        phone: '', 
        specialty: '',
        defaultKmValue: 0,
        defaultLaborHourValue: 0
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    try {
      if (editingTechnician) {
        await updateDoc(doc(db, 'technicians', editingTechnician.id), formData);
      } else {
        await addDoc(collection(db, 'technicians'), {
          ...formData,
          tenantId: userData.tenantId
        });
      }
      setIsDialogOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'technicians');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Técnico',
      description: 'Tem certeza que deseja excluir este técnico? Esta ação não pode ser desfeita.',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'technicians', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `technicians/${id}`);
        }
      }
    });
  };

  const filteredTechnicians = technicians.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Técnicos</h1>
          <p className="text-muted-foreground">Gerencie sua equipe técnica.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2 h-12 px-6 rounded-xl shadow-lg">
          <Plus className="w-5 h-5" />
          Novo Técnico
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por nome ou especialidade..." 
          className="pl-10 h-11 rounded-xl bg-card/50 border-none shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredTechnicians.map((technician, i) => (
            <motion.div
              key={technician.id}
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
                      {technician.name.charAt(0)}
                    </div>
                    <CardTitle className="text-lg font-bold">{technician.name}</CardTitle>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(technician)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(technician.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2 text-sm">
                    {technician.specialty && (
                      <div className="flex items-center gap-2 text-primary font-medium mb-2">
                        <Wrench className="w-4 h-4" />
                        <span>{technician.specialty}</span>
                      </div>
                    )}
                    {technician.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span>{technician.phone}</span>
                      </div>
                    )}
                    {technician.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{technician.email}</span>
                      </div>
                    )}
                    <div className="flex gap-4 pt-2 border-t mt-2">
                      <div className="text-[10px] text-muted-foreground">
                        <p>KM: <span className="font-bold text-primary">R$ {technician.defaultKmValue?.toFixed(2) || '0.00'}</span></p>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        <p>Hora: <span className="font-bold text-primary">R$ {technician.defaultLaborHourValue?.toFixed(2) || '0.00'}</span></p>
                      </div>
                    </div>
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
            <DialogTitle>{editingTechnician ? 'Editar Técnico' : 'Novo Técnico'}</DialogTitle>
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
            <div className="space-y-2">
              <Label htmlFor="specialty">Especialidade</Label>
              <Input 
                id="specialty" 
                placeholder="Ex: Eletricista, Mecânico..."
                value={formData.specialty} 
                onChange={e => setFormData({...formData, specialty: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input 
                  id="phone" 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value})} 
                />
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
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="defaultKmValue">Valor KM Padrão (R$)</Label>
                <Input 
                  id="defaultKmValue" 
                  type="number"
                  step="0.01"
                  value={formData.defaultKmValue} 
                  onChange={e => setFormData({...formData, defaultKmValue: Number(e.target.value)})} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultLaborHourValue">Valor Hora Padrão (R$)</Label>
                <Input 
                  id="defaultLaborHourValue" 
                  type="number"
                  step="0.01"
                  value={formData.defaultLaborHourValue} 
                  onChange={e => setFormData({...formData, defaultLaborHourValue: Number(e.target.value)})} 
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
