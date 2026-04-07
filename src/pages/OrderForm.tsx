import React, { useEffect, useState } from 'react';
import { collection, addDoc, updateDoc, doc, getDoc, onSnapshot, query, orderBy, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { ServiceOrder, Customer, Technician, Supplier, Part, ServiceStatus, PaymentMethod, Settings } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { 
  Plus, 
  Trash2, 
  MapPin, 
  Camera, 
  Save, 
  ArrowLeft,
  DollarSign,
  Clock,
  Truck,
  Wrench
} from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getCurrentLocation } from '../services/locationService';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';

export default function OrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!!id);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [settings, setSettings] = useState<Settings>({ kmValue: 0, laborHourValue: 0, lastOrderNumber: 0 });

  // Form state
  const [formData, setFormData] = useState<Partial<ServiceOrder>>({
    orderNumber: '',
    customerId: '',
    technicianIds: [],
    status: 'budget',
    description: '',
    hoursWorked: 0,
    laborCost: 0,
    kmDriven: 0,
    kmValue: 0,
    parts: [],
    servicePhotos: [],
    paymentMethod: 'pix',
    totalValue: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  useEffect(() => {
    // Load customers
    const unsubscribeCustomers = onSnapshot(query(collection(db, 'customers'), orderBy('name')), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });

    // Load technicians
    const unsubscribeTechnicians = onSnapshot(query(collection(db, 'technicians'), orderBy('name')), (snapshot) => {
      setTechnicians(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Technician)));
    });

    // Load suppliers
    const unsubscribeSuppliers = onSnapshot(query(collection(db, 'suppliers'), orderBy('name')), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });

    // Load settings
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as Settings;
        setSettings(data);
        if (!id) {
          setFormData(prev => ({ 
            ...prev, 
            kmValue: data.kmValue,
            laborCost: (prev.hoursWorked || 0) * data.laborHourValue
          }));
        }
      }
    });

    // Load order if editing
    if (id) {
      const loadOrder = async () => {
        const docRef = doc(db, 'serviceOrders', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setFormData(docSnap.data() as ServiceOrder);
        }
        setLoading(false);
      };
      loadOrder();
    }

    return () => {
      unsubscribeCustomers();
      unsubscribeTechnicians();
      unsubscribeSuppliers();
      unsubscribeSettings();
    };
  }, [id]);

  // Calculate total value whenever relevant fields change
  useEffect(() => {
    const partsTotal = (formData.parts || []).reduce((acc, p) => acc + (p.quantity * p.price), 0);
    const laborTotal = formData.laborCost || 0;
    const kmTotal = (formData.kmDriven || 0) * (formData.kmValue || 0);
    const total = partsTotal + laborTotal + kmTotal;
    
    setFormData(prev => ({ ...prev, totalValue: total }));
  }, [formData.parts, formData.laborCost, formData.kmDriven, formData.kmValue]);

  const handleAddPart = () => {
    setFormData(prev => ({
      ...prev,
      parts: [...(prev.parts || []), { name: '', quantity: 1, price: 0 }]
    }));
  };

  const handleRemovePart = (index: number) => {
    setFormData(prev => ({
      ...prev,
      parts: (prev.parts || []).filter((_, i) => i !== index)
    }));
  };

  const handlePartChange = (index: number, field: keyof Part, value: any) => {
    const newParts = [...(formData.parts || [])];
    newParts[index] = { ...newParts[index], [field]: value };
    setFormData(prev => ({ ...prev, parts: newParts }));
  };

  const handleGetLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setFormData(prev => ({ ...prev, location }));
    } catch (error) {
      console.error('Erro ao obter localização:', error);
      alert('Não foi possível obter a localização. Verifique as permissões do navegador.');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'parts' | 'service', index?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (type === 'parts' && index !== undefined) {
        handlePartChange(index, 'photoUrl', base64String);
      } else {
        setFormData(prev => ({
          ...prev,
          servicePhotos: [...(prev.servicePhotos || []), base64String]
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (id) {
        const data = {
          ...formData,
          updatedAt: new Date().toISOString()
        };
        await updateDoc(doc(db, 'serviceOrders', id), data);
      } else {
        // Use a transaction to increment the order number
        await runTransaction(db, async (transaction) => {
          const settingsRef = doc(db, 'settings', 'global');
          const settingsSnap = await transaction.get(settingsRef);
          
          let nextNumber = 1;
          if (settingsSnap.exists()) {
            const currentSettings = settingsSnap.data() as Settings;
            nextNumber = (currentSettings.lastOrderNumber || 0) + 1;
          }
          
          const formattedNumber = nextNumber.toString().padStart(5, '0');
          
          const newOrderRef = doc(collection(db, 'serviceOrders'));
          const newOrderData = {
            ...formData,
            orderNumber: formattedNumber,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          transaction.set(newOrderRef, newOrderData);
          transaction.set(settingsRef, { lastOrderNumber: nextNumber }, { merge: true });
        });
      }
      navigate('/orders');
    } catch (error) {
      console.error('Erro ao salvar ordem de serviço:', error);
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Link to="/orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {id ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}
          </h1>
          {id && formData.orderNumber && (
            <p className="text-muted-foreground font-mono">OS N° {formData.orderNumber}</p>
          )}
          {!id && (
            <p className="text-muted-foreground">Preencha os detalhes do orçamento ou serviço.</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Basic Info */}
          <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">Cliente *</Label>
                  <Select 
                    id="customer" 
                    required 
                    value={formData.customerId} 
                    onChange={e => setFormData({...formData, customerId: e.target.value})}
                  >
                    <option value="">Selecione um cliente</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier">Fornecedor (Opcional)</Label>
                  <Select 
                    id="supplier" 
                    value={formData.supplierId || ''} 
                    onChange={e => setFormData({...formData, supplierId: e.target.value})}
                  >
                    <option value="">Nenhum fornecedor</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select 
                    id="status" 
                    required 
                    value={formData.status} 
                    onChange={e => setFormData({...formData, status: e.target.value as ServiceStatus})}
                  >
                    <option value="budget">Orçamento</option>
                    <option value="in-progress">Em Andamento</option>
                    <option value="closed">Fechada</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
                  <Select 
                    id="paymentMethod" 
                    value={formData.paymentMethod || 'pix'} 
                    onChange={e => setFormData({...formData, paymentMethod: e.target.value as PaymentMethod})}
                  >
                    <option value="pix">PIX</option>
                    <option value="cash">Dinheiro</option>
                    <option value="credit">Cartão de Crédito</option>
                    <option value="debit">Cartão de Débito</option>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição do Serviço *</Label>
                <Textarea 
                  id="description" 
                  required 
                  className="min-h-[120px]"
                  placeholder="Descreva o que precisa ser feito..."
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Técnicos Responsáveis</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {technicians.map(t => (
                    <div key={t.id} className="flex items-center gap-2 p-2 border rounded-lg bg-background">
                      <input 
                        type="checkbox" 
                        id={`tech-${t.id}`}
                        checked={formData.technicianIds?.includes(t.id)}
                        onChange={(e) => {
                          const ids = formData.technicianIds || [];
                          if (e.target.checked) {
                            setFormData({...formData, technicianIds: [...ids, t.id]});
                          } else {
                            setFormData({...formData, technicianIds: ids.filter(id => id !== t.id)});
                          }
                        }}
                      />
                      <label htmlFor={`tech-${t.id}`} className="text-sm truncate">{t.name}</label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parts */}
          <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                Peças e Materiais
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={handleAddPart}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar Peça
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.parts?.map((part, index) => (
                <div key={index} className="p-4 border rounded-xl bg-background space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Nome da Peça</Label>
                        <Input 
                          value={part.name} 
                          onChange={e => handlePartChange(index, 'name', e.target.value)} 
                          placeholder="Ex: Filtro de Óleo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Quantidade</Label>
                        <Input 
                          type="number" 
                          value={part.quantity} 
                          onChange={e => handlePartChange(index, 'quantity', Number(e.target.value))} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Preço Unitário (R$)</Label>
                        <Input 
                          type="number" 
                          step="0.01"
                          value={part.price} 
                          onChange={e => handlePartChange(index, 'price', Number(e.target.value))} 
                        />
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemovePart(index)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 bg-muted rounded-lg overflow-hidden border">
                      {part.photoUrl ? (
                        <img src={part.photoUrl} alt="Peça" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Camera className="w-6 h-6" />
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={(e) => handlePhotoUpload(e, 'parts', index)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Clique para adicionar foto da peça</p>
                  </div>
                </div>
              ))}
              {(formData.parts?.length || 0) === 0 && (
                <p className="text-center py-8 text-muted-foreground italic">Nenhuma peça adicionada.</p>
              )}
            </CardContent>
          </Card>

          {/* Photos */}
          <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                Fotos do Serviço
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {formData.servicePhotos?.map((photo, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden border group">
                    <img src={photo} alt={`Serviço ${index}`} className="w-full h-full object-cover" />
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="icon" 
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        servicePhotos: (prev.servicePhotos || []).filter((_, i) => i !== index)
                      }))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <div className="relative aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-accent transition-colors cursor-pointer">
                  <Plus className="w-8 h-8 mb-2" />
                  <span className="text-xs font-medium">Adicionar Foto</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={(e) => handlePhotoUpload(e, 'service')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Costs & Location */}
          <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm sticky top-8">
            <CardHeader>
              <CardTitle>Resumo e Localização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Horas Trabalhadas
                  </Label>
                  <Input 
                    type="number" 
                    value={formData.hoursWorked} 
                    onChange={e => {
                      const hours = Number(e.target.value);
                      setFormData({
                        ...formData, 
                        hoursWorked: hours,
                        laborCost: hours * settings.laborHourValue
                      });
                    }} 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Mão de Obra (R$)
                  </Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={formData.laborCost} 
                    onChange={e => setFormData({...formData, laborCost: Number(e.target.value)})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Truck className="w-4 h-4" /> Deslocamento (KM)
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      type="number" 
                      placeholder="KM"
                      value={formData.kmDriven} 
                      onChange={e => setFormData({...formData, kmDriven: Number(e.target.value)})} 
                    />
                    <Input 
                      type="number" 
                      step="0.01"
                      placeholder="R$/KM"
                      value={formData.kmValue} 
                      onChange={e => setFormData({...formData, kmValue: Number(e.target.value)})} 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Localização
                </Label>
                {formData.location ? (
                  <div className="p-3 rounded-lg bg-accent text-xs space-y-1">
                    <p className="font-bold">{formData.location.address}</p>
                    <p className="text-muted-foreground opacity-70">
                      {formData.location.latitude.toFixed(6)}, {formData.location.longitude.toFixed(6)}
                    </p>
                    <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={handleGetLocation}>
                      Atualizar Localização
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGetLocation}>
                    <MapPin className="w-4 h-4" /> Obter Localização Atual
                  </Button>
                )}
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal Peças:</span>
                  <span>R$ {(formData.parts || []).reduce((acc, p) => acc + (p.quantity * p.price), 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Mão de Obra:</span>
                  <span>R$ {(formData.laborCost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Deslocamento:</span>
                  <span>R$ {((formData.kmDriven || 0) * (formData.kmValue || 0)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold pt-2">
                  <span>TOTAL:</span>
                  <span className="text-primary">R$ {(formData.totalValue || 0).toFixed(2)}</span>
                </div>
              </div>

              <Button type="submit" className="w-full h-14 text-lg gap-2 rounded-xl shadow-lg">
                <Save className="w-5 h-5" />
                Salvar Ordem
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
