import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../types';
import { Button } from './ui/Button';
import { LogIn, ShieldAlert, User as UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Lock } from 'lucide-react';

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
  const [loginMode, setLoginMode] = useState<'google' | 'email'>('email');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Erro ao fazer login:', error);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError(null);
    try {
      const loginCredential = username.includes('@') ? username : `${username}@serviceflow.local`;
      await signInWithEmailAndPassword(auth, loginCredential, password);
    } catch (err: any) {
      console.error('Erro ao fazer login:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Login ou senha incorretos.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Tente novamente mais tarde.');
      } else {
        setError('Erro ao fazer login. Verifique suas credenciais.');
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
            {loginMode === 'email' ? (
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="••••••••" 
                      className="pl-10 h-12 rounded-xl"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-12 rounded-xl text-lg shadow-lg"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? 'Entrando...' : 'Entrar'}
                </Button>
                
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Ou</span>
                  </div>
                </div>

                <Button 
                  type="button"
                  variant="outline"
                  className="w-full h-12 rounded-xl gap-3"
                  onClick={handleLogin}
                >
                  <LogIn className="w-5 h-5" />
                  Entrar com Google
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <Button 
                  size="lg" 
                  className="w-full h-14 text-lg gap-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
                  onClick={handleLogin}
                >
                  <LogIn className="w-6 h-6" />
                  Entrar com Google
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => setLoginMode('email')}
                >
                  Usar login e senha
                </Button>
              </div>
            )}
            
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
