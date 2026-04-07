import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Settings } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { 
  Settings as SettingsIcon, 
  Save, 
  Truck, 
  Clock, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert';
import { cn } from '../lib/utils';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({ kmValue: 0, laborHourValue: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as Settings);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(doc(db, 'settings', 'global'), settings);
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar configurações. Verifique suas permissões.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Ajuste os valores padrão do sistema.</p>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-6">
          <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-primary" />
                Valores Padrão
              </CardTitle>
              <CardDescription>
                Estes valores serão usados automaticamente ao criar novas ordens de serviço.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="kmValue" className="flex items-center gap-2">
                    <Truck className="w-4 h-4" /> Valor por KM Rodado (R$)
                  </Label>
                  <Input 
                    id="kmValue" 
                    type="number" 
                    step="0.01"
                    value={settings.kmValue} 
                    onChange={e => setSettings({...settings, kmValue: Number(e.target.value)})} 
                  />
                  <p className="text-xs text-muted-foreground">Usado para calcular o custo de deslocamento.</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="laborHourValue" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Valor da Hora Técnica (R$)
                  </Label>
                  <Input 
                    id="laborHourValue" 
                    type="number" 
                    step="0.01"
                    value={settings.laborHourValue} 
                    onChange={e => setSettings({...settings, laborHourValue: Number(e.target.value)})} 
                  />
                  <p className="text-xs text-muted-foreground">Usado para calcular o custo base da mão de obra.</p>
                </div>
              </div>

              {message && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Alert variant={message.type === 'error' ? 'destructive' : 'default'} className={cn(
                    message.type === 'success' && "bg-green-50 border-green-200 text-green-800"
                  )}>
                    {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4" />}
                    <AlertTitle>{message.type === 'success' ? 'Sucesso' : 'Erro'}</AlertTitle>
                    <AlertDescription>{message.text}</AlertDescription>
                  </Alert>
                </motion.div>
              )}

              <Button type="submit" className="w-full h-12 gap-2 rounded-xl shadow-lg" disabled={saving}>
                <Save className="w-5 h-5" />
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
