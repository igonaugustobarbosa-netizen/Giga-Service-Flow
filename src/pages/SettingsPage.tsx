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
  AlertCircle,
  Building2,
  FileSignature,
  ClipboardList,
  MapPin,
  Search as SearchIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert';
import { Textarea } from '../components/ui/Textarea';
import { cn } from '../lib/utils';
import { logActivity } from '../services/activityService';
import { getCoordinatesFromAddress, getCurrentLocation } from '../services/locationService';
import { toast } from 'sonner';

import { useAuth } from '../components/AuthGuard';

export default function SettingsPage() {
  const { userData } = useAuth();
  const [settings, setSettings] = useState<Settings>({ 
    lastOrderNumber: 0,
    lastWorkOrderNumber: 0 
  } as Settings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (!userData) return;

    const unsubscribe = onSnapshot(doc(db, 'settings', userData.tenantId), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as Settings);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    setSaving(true);
    setMessage(null);
    try {
      await setDoc(doc(db, 'settings', userData.tenantId), settings);
      logActivity({
        type: 'update',
        entity: 'user', // Best fit for system settings as it's a global config
        entityId: userData.tenantId,
        entityName: 'Configurações do Sistema',
        userId: userData.id,
        userName: userData.name,
        tenantId: userData.tenantId
      });
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar configurações. Verifique suas permissões.' });
    } finally {
      setSaving(false);
    }
  };

  const handleGetLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setSettings(prev => ({ ...prev, companyLocation: location }));
      toast.success('Localização atual obtida com sucesso!');
    } catch (error: any) {
      console.error('Erro ao obter localização:', error);
      toast.error(error.message || 'Erro ao obter localização atual.');
    }
  };

  const handleGeocodeAddress = async () => {
    if (!settings.companyAddress) {
      toast.error('Preencha o endereço da empresa primeiro.');
      return;
    }
    try {
      const location = await getCoordinatesFromAddress(settings.companyAddress);
      setSettings(prev => ({ ...prev, companyLocation: location }));
      toast.success('Endereço geocodificado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao geocodificar:', error);
      toast.error(error.message || 'Erro ao buscar coordenadas para este endereço.');
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Ajuste os valores globais do sistema.</p>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-6">
          <Card className="border-none shadow-sm bg-orange-50/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Dados da Empresa
              </CardTitle>
              <CardDescription>
                Informações básicas e localização da sede.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nome da Empresa</Label>
                  <Input 
                    id="companyName" 
                    value={settings.companyName || ''} 
                    onChange={e => setSettings({...settings, companyName: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyTaxId">CNPJ/CPF</Label>
                  <Input 
                    id="companyTaxId" 
                    value={settings.companyTaxId || ''} 
                    onChange={e => setSettings({...settings, companyTaxId: e.target.value})} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyAddress">Endereço da Sede</Label>
                <div className="flex gap-2">
                  <Input 
                    id="companyAddress" 
                    value={settings.companyAddress || ''} 
                    onChange={e => setSettings({...settings, companyAddress: e.target.value})} 
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleGeocodeAddress} title="Buscar coordenadas deste endereço">
                    <SearchIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="p-3 border rounded-lg bg-white/50 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-primary font-bold">
                    <MapPin className="w-4 h-4" /> Coordenadas da Empresa
                  </Label>
                  <Button type="button" variant="ghost" size="sm" className="text-[10px] h-7" onClick={handleGetLocation}>
                    Usar Minha Localização
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Latitude</Label>
                    <Input 
                      type="number" 
                      step="any"
                      value={settings.companyLocation?.latitude || ''} 
                      onChange={e => setSettings({
                        ...settings, 
                        companyLocation: { 
                          ...(settings.companyLocation || { latitude: 0, longitude: 0 }), 
                          latitude: Number(e.target.value) 
                        }
                      })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Longitude</Label>
                    <Input 
                      type="number" 
                      step="any"
                      value={settings.companyLocation?.longitude || ''} 
                      onChange={e => setSettings({
                        ...settings, 
                        companyLocation: { 
                          ...(settings.companyLocation || { latitude: 0, longitude: 0 }), 
                          longitude: Number(e.target.value) 
                        }
                      })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                {!settings.companyLocation?.latitude && (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    As coordenadas são necessárias para o cálculo automático de KM.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-orange-50/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-primary" />
                Configurações Gerais
              </CardTitle>
              <CardDescription>
                Ajuste os parâmetros globais de funcionamento do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="lastOrderNumber" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Próximo Número de Orçamento
                  </Label>
                  <Input 
                    id="lastOrderNumber" 
                    type="number" 
                    value={settings.lastOrderNumber === 0 ? '' : settings.lastOrderNumber} 
                    onChange={e => setSettings({...settings, lastOrderNumber: e.target.value === '' ? 0 : Number(e.target.value)})} 
                  />
                  <p className="text-xs text-muted-foreground">O próximo número gerado para Orçamentos será este valor + 1.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastWorkOrderNumber" className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" /> Próximo Número de Ordem de Serviço (OS)
                  </Label>
                  <Input 
                    id="lastWorkOrderNumber" 
                    type="number" 
                    value={(settings.lastWorkOrderNumber ?? 0) === 0 ? '' : settings.lastWorkOrderNumber} 
                    onChange={e => setSettings({...settings, lastWorkOrderNumber: e.target.value === '' ? 0 : Number(e.target.value)})} 
                  />
                  <p className="text-xs text-muted-foreground">O próximo número gerado para OS será este valor + 1.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-blue-50/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                Configurações do Relatório Técnico
              </CardTitle>
              <CardDescription>
                Defina os procedimentos e mensagens automáticas para o relatório técnico.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="technicalReportDefaultProcedures">Procedimentos Técnicos Padrão</Label>
                <Textarea 
                  id="technicalReportDefaultProcedures" 
                  className="min-h-[150px] font-mono text-xs"
                  value={settings.technicalReportDefaultProcedures || ''} 
                  onChange={e => setSettings({...settings, technicalReportDefaultProcedures: e.target.value})} 
                  placeholder="Verificação de tensão elétrica&#10;Inspeção de circuitos..."
                />
                <p className="text-[10px] text-muted-foreground">Listagem de verificações técnicas que aparecem no relatório.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="technicalReportDefaultMessage">Mensagem de Descrição Padrão</Label>
                <Textarea 
                  id="technicalReportDefaultMessage" 
                  className="min-h-[100px] font-mono text-xs"
                  value={settings.technicalReportDefaultMessage || ''} 
                  onChange={e => setSettings({...settings, technicalReportDefaultMessage: e.target.value})} 
                  placeholder="Descrever detalhadamente os serviços executados..."
                />
                <p className="text-[10px] text-muted-foreground">Texto de apoio que aparece na descrição técnica se nada for editado.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-purple-50/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-primary" />
                Cláusulas do Contrato
              </CardTitle>
              <CardDescription>
                Defina as cláusulas padrão para o Contrato de Prestação de Serviço.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contractClauses">Texto das Cláusulas</Label>
                <Textarea 
                  id="contractClauses" 
                  className="min-h-[300px] font-mono text-xs"
                  value={settings.contractClauses || ''} 
                  onChange={e => setSettings({...settings, contractClauses: e.target.value})} 
                  placeholder="1. OBJETO DO CONTRATO...&#10;2. VALOR E PAGAMENTO..."
                />
                <p className="text-xs text-muted-foreground">
                  Dica: Use parágrafos claros. Estas cláusulas serão anexadas ao final do documento do contrato.
                </p>
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
