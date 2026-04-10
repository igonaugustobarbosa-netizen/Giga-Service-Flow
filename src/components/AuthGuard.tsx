import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../types';
import { Button } from './ui/Button';
import { ShieldAlert, User as UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Lock, LogIn, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface AuthContextType {
  user: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          // 1. Try to get user document by UID
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            setUserData(userDoc.data() as User);
          } else {
            // 2. If not found by UID, try to find by email (admin pre-registered)
            const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              const preRegisteredDoc = querySnapshot.docs[0];
              const preRegisteredData = preRegisteredDoc.data() as User;
              
              // Associate UID with this record
              const newUserData: User = {
                ...preRegisteredData,
                id: firebaseUser.uid,
                tenantId: preRegisteredData.role === 'admin' ? 'global' : firebaseUser.uid,
                name: firebaseUser.displayName || preRegisteredData.name || '',
                updatedAt: new Date().toISOString()
              } as any;

              await setDoc(doc(db, 'users', firebaseUser.uid), newUserData);
              // Delete the pre-registered doc if it had a different ID (like a random one from addDoc)
              if (preRegisteredDoc.id !== firebaseUser.uid) {
                // deleteDoc(doc(db, 'users', preRegisteredDoc.id)); // Optional
              }
              setUserData(newUserData);
            } else if (firebaseUser.email === 'igonaugustobarbosa@gmail.com') {
              // 3. Default Admin Bootstrap
              const adminData: User = {
                id: firebaseUser.uid,
                email: firebaseUser.email!,
                username: firebaseUser.email!.split('@')[0],
                name: firebaseUser.displayName || 'Admin',
                role: 'admin',
                tenantId: 'global',
                createdAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), adminData);
              setUserData(adminData);
            } else {
              // 4. Not authorized
              setError('Acesso negado. Entre em contato com o administrador para obter acesso.');
            }
          }
        } catch (err) {
          console.error('Auth error:', err);
          setError('Erro ao verificar permissões.');
        }
      } else {
        setUserData(null);
        setError(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError(null);
    try {
      const sanitizedUsername = username.trim().toLowerCase().replace(/\s+/g, '.');
      const loginCredential = sanitizedUsername.includes('@') ? sanitizedUsername : `${sanitizedUsername}@serviceflow.local`;
      
      console.log('Tentando login com:', loginCredential);
      await signInWithEmailAndPassword(auth, loginCredential, password);
    } catch (err: any) {
      console.error('Erro ao fazer login:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Login ou senha incorretos.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Tente novamente mais tarde.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Erro de conexão. Verifique sua internet.');
      } else {
        setError('Erro ao fazer login. Verifique suas credenciais.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Login realizado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao fazer login com Google:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, no need for error message
      } else {
        setError('Erro ao fazer login com Google. Tente novamente.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-4">
            <div className="w-20 h-20 bg-primary rounded-2xl mx-auto flex items-center justify-center text-primary-foreground text-4xl font-bold shadow-xl">
              SF
            </div>
            <h1 className="text-4xl font-bold tracking-tight">ServiceFlow</h1>
            <p className="text-muted-foreground text-lg">
              Gerencie seus serviços e orçamentos de forma profissional e eficiente.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3 text-destructive text-sm text-left">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <form onSubmit={handleEmailLogin} className="space-y-4 text-left">
              <div className="space-y-2">
                <Label htmlFor="username">Login</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="username" 
                    type="text" 
                    placeholder="Seu login" 
                    className="pl-10 h-12 rounded-xl"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                {username && (
                  <p className="text-[10px] text-primary font-medium px-1">
                    Entrando como: <span className="font-bold">{username.trim().toLowerCase().replace(/\s+/g, '.')}</span>
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground px-1">
                  O login será convertido para minúsculas e espaços serão substituídos por pontos.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    className="pl-10 pr-10 h-12 rounded-xl"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
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
              <Button 
                type="submit" 
                className="w-full h-12 rounded-xl text-lg shadow-lg"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Ou continue com</span>
              </div>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full h-12 rounded-xl gap-2 shadow-sm border-primary/20 hover:bg-primary/5 transition-all"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Entrar com Google
            </Button>
            
            {error && !isLoggingIn && (
              <Button variant="ghost" onClick={() => { setError(null); auth.signOut(); }}>
                Tentar novamente
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Ao entrar, você concorda com nossos termos de serviço e política de privacidade.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userData, loading, isAdmin: userData?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}
