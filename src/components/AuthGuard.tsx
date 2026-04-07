import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { auth } from '../firebase';
import { Button } from './ui/Button';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
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

  if (!user) {
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

          <Button 
            size="lg" 
            className="w-full h-14 text-lg gap-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
            onClick={handleLogin}
          >
            <LogIn className="w-6 h-6" />
            Entrar com Google
          </Button>

          <p className="text-xs text-muted-foreground">
            Ao entrar, você concorda com nossos termos de serviço e política de privacidade.
          </p>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}
