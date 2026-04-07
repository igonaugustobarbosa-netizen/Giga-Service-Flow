import React, { useEffect, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { User } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  User as UserIcon,
  Mail,
  Shield,
  X,
  Lock
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { handleFirestoreError, OperationType } from '../lib/utils';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
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
    username: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    tenantId: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        username: user.username || user.email.split('@')[0],
        password: user.password || '',
        role: user.role,
        tenantId: user.tenantId
      });
    } else {
      setEditingUser(null);
      setFormData({ name: '', username: '', password: '', role: 'user', tenantId: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const internalEmail = `${formData.username}@serviceflow.local`;

      if (editingUser) {
        const data = {
          ...formData,
          email: internalEmail,
          updatedAt: new Date().toISOString()
        };
        await updateDoc(doc(db, 'users', editingUser.id), data);
      } else {
        // Create user in Firebase Auth using a secondary app to avoid logging out the admin
        const secondaryApp = getApps().length > 1 
          ? getApp('SecondaryApp') 
          : initializeApp(firebaseConfig, 'SecondaryApp');
        const secondaryAuth = getAuth(secondaryApp);
        
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          internalEmail, 
          formData.password
        );
        
        const uid = userCredential.user.uid;
        
        // Create user document in Firestore with the UID as the ID
        const userData: User = {
          id: uid,
          name: formData.name,
          username: formData.username,
          email: internalEmail,
          password: formData.password, // Storing for reference (optional, but requested)
          role: formData.role,
          tenantId: formData.role === 'admin' ? 'global' : uid,
          createdAt: new Date().toISOString()
        } as any;

        await setDoc(doc(db, 'users', uid), userData);
        
        // Sign out from the secondary app to clean up
        await secondaryAuth.signOut();
      }
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('Este login já está em uso.');
      } else if (error.code === 'auth/weak-password') {
        alert('A senha é muito fraca.');
      } else {
        handleFirestoreError(error, OperationType.WRITE, 'users');
      }
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Usuário',
      description: 'Tem certeza que deseja excluir este usuário? Ele perderá o acesso ao sistema.',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
        }
      }
    });
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="text-muted-foreground">Cadastre e gerencie os acessos ao sistema.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2 h-12 px-6 rounded-xl shadow-lg">
          <Plus className="w-5 h-5" />
          Novo Usuário
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por nome ou login..." 
          className="pl-10 h-11 rounded-xl bg-orange-50/20 border-none shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredUsers.map((user, i) => (
            <motion.div
              key={user.id}
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
                      {user.name.charAt(0) || (user.username || user.email).charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">{user.name || 'Pendente'}</CardTitle>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Shield className="w-3 h-3" />
                        <span className="capitalize">{user.role}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(user)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(user.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <UserIcon className="w-4 h-4" />
                      <span className="truncate font-medium text-foreground">{user.username || user.email.split('@')[0]}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="truncate text-xs">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Shield className="w-4 h-4" />
                      <span className="truncate text-[10px]">ID: {user.id}</span>
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
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Login *</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="username" 
                  required
                  placeholder="Ex: joao.silva"
                  className="pl-10"
                  value={formData.username} 
                  onChange={e => setFormData({...formData, username: e.target.value})} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  required={!editingUser}
                  placeholder={editingUser ? "Deixe em branco para manter" : "Defina uma senha"}
                  className="pl-10"
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Perfil de Acesso</Label>
              <Select 
                id="role" 
                value={formData.role} 
                onChange={e => setFormData({...formData, role: e.target.value as 'admin' | 'user'})}
              >
                <option value="user">Usuário (Base Isolada)</option>
                <option value="admin">Administrador (Acesso Total)</option>
              </Select>
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
