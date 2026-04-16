import React, { useEffect, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc, where } from 'firebase/firestore';
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
  Shield,
  ShieldAlert,
  X,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { useAuth } from '../components/AuthGuard';

export default function UserManagement() {
  const { userData: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
    if (!currentUser) return;

    const q = isAdmin 
      ? query(collection(db, 'users'), orderBy('name', 'asc'))
      : query(collection(db, 'users'), where('tenantId', '==', currentUser.tenantId), orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser, isAdmin]);

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
    setFormError(null);
    setShowPassword(false);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    
    try {
      // Auto-format username: lowercase and trim
      const sanitizedUsername = formData.username.trim().toLowerCase().replace(/\s+/g, '.');
      
      // Validate username: letters, numbers, dots, underscores, and hyphens
      const usernameRegex = /^[a-z0-9._-]+$/;
      if (!usernameRegex.test(sanitizedUsername)) {
        throw new Error('O login deve conter apenas letras, números, pontos, hífens ou sublinhados.');
      }

      const internalEmail = `${sanitizedUsername}@serviceflow.local`;

      if (editingUser) {
        const data: any = {
          ...formData,
          username: sanitizedUsername,
          email: internalEmail,
          updatedAt: new Date().toISOString()
        };
        
        // Don't update password if it's empty (meaning we want to keep the old one)
        if (!formData.password) {
          delete data.password;
        }
        
        await updateDoc(doc(db, 'users', editingUser.id), data);
      } else {
        if (!formData.password || formData.password.length < 6) {
          throw new Error('A senha deve ter pelo menos 6 caracteres.');
        }

        // Create user in Firebase Auth using a secondary app to avoid logging out the admin
        const secondaryAppName = 'SecondaryApp';
        const secondaryApp = getApps().find(app => app.name === secondaryAppName) 
          || initializeApp(firebaseConfig, secondaryAppName);
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
          username: sanitizedUsername,
          email: internalEmail,
          password: formData.password,
          role: formData.role,
          tenantId: formData.role === 'admin' ? 'global' : (isAdmin ? uid : currentUser!.tenantId),
          createdAt: new Date().toISOString()
        } as any;

        await setDoc(doc(db, 'users', uid), userData);
        
        // Sign out and delete the secondary app to clean up completely
        await secondaryAuth.signOut();
        try {
          // Some Firebase versions might not support deleteApp easily in all environments
          // but it's good practice to try
          if ('deleteApp' in secondaryApp) {
            await (secondaryApp as any).deleteApp();
          }
        } catch (e) {
          console.warn('Could not delete secondary app:', e);
        }
      }
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      let message = 'Erro ao salvar usuário. Tente novamente.';
      
      if (error.code === 'auth/email-already-in-use') {
        message = 'Este login já está em uso.';
      } else if (error.code === 'auth/weak-password') {
        message = 'A senha é muito fraca (mínimo 6 caracteres).';
      } else if (error.code === 'auth/operation-not-allowed') {
        message = 'ERRO CRÍTICO: O provedor de "E-mail/Senha" não está ativado no seu Firebase Console. \n\n' + 
                  'Para corrigir:\n' +
                  '1. Acesse: https://console.firebase.google.com/project/gen-lang-client-0335885739/authentication/providers\n' +
                  '2. Clique em "Adicionar novo provedor"\n' +
                  '3. Escolha "E-mail/Senha" e clique em "Ativar"\n' +
                  '4. Salve as alterações.';
      } else if (error.message) {
        message = error.message;
      }
      
      setFormError(message);
    } finally {
      setIsSaving(false);
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
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-bold text-xl shrink-0">
                      {user.name.charAt(0) || (user.username || user.email).charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-lg font-bold truncate">{user.name || 'Pendente'}</CardTitle>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Shield className="w-3 h-3" />
                        <span className="capitalize">{user.role}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="icon" className="h-8 w-8 bg-background/50 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground transition-all" onClick={() => handleOpenDialog(user)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 bg-background/50 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all" onClick={() => handleDelete(user.id)}>
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
                      <Shield className="w-4 h-4" />
                      <span className="truncate text-[10px]">ID: {user.id}</span>
                    </div>
                    {user.password && (
                      <div className="flex items-center gap-2 text-muted-foreground pt-1 border-t border-orange-100/50 mt-2">
                        <Lock className="w-3 h-3" />
                        <span className="text-xs font-mono">Senha: {user.password}</span>
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
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>
          
          {formError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs flex items-center gap-2 mt-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <p>{formError}</p>
            </div>
          )}

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
              <p className="text-[10px] text-muted-foreground">
                O login será convertido para minúsculas e espaços serão substituídos por pontos.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  required={!editingUser}
                  placeholder={editingUser ? "Deixe em branco para manter" : "Defina uma senha"}
                  className="pl-10 pr-10"
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Perfil de Acesso</Label>
              <Select 
                id="role" 
                value={formData.role} 
                onChange={e => setFormData({...formData, role: e.target.value as 'admin' | 'user'})}
                disabled={!isAdmin}
              >
                <option value="user">Usuário (Base Isolada)</option>
                {isAdmin && <option value="admin">Administrador (Acesso Total)</option>}
              </Select>
              {!isAdmin && (
                <p className="text-[10px] text-muted-foreground">
                  Apenas administradores podem criar outros administradores.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
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
