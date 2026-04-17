import React, { useEffect, useState } from 'react';
import { Bell, User, Users, Building2, ClipboardList, ShieldCheck, Trash2, Plus, Edit2 } from 'lucide-react';
import { Button } from './ui/Button';
import { useAuth } from './AuthGuard';
import { subscribeToActivities } from '../services/activityService';
import { Activity } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function NotificationBell() {
  const { userData } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [lastViewed, setLastViewed] = useState<number>(Date.now());

  useEffect(() => {
    if (!userData?.tenantId) return;

    const unsubscribe = subscribeToActivities(userData.tenantId, (newActivities) => {
      setActivities(newActivities);
      
      // Check if there are new activities since last viewed
      const hasNew = newActivities.some(a => new Date(a.timestamp).getTime() > lastViewed);
      if (hasNew && !isOpen) {
        setHasUnread(true);
      }
    });

    return () => unsubscribe();
  }, [userData?.tenantId, lastViewed, isOpen]);

  const toggleOpen = () => {
    if (!isOpen) {
      setHasUnread(false);
      setLastViewed(Date.now());
    }
    setIsOpen(!isOpen);
  };

  const getEntityIcon = (entity: Activity['entity']) => {
    switch (entity) {
      case 'customer': return <Users className="w-4 h-4" />;
      case 'technician': return <User className="w-4 h-4" />;
      case 'supplier': return <Building2 className="w-4 h-4" />;
      case 'order': return <ClipboardList className="w-4 h-4" />;
      case 'user': return <ShieldCheck className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getTypeIcon = (type: Activity['type']) => {
    switch (type) {
      case 'create': return <Plus className="w-3 h-3 text-green-500" />;
      case 'update': return <Edit2 className="w-3 h-3 text-blue-500" />;
      case 'delete': return <Trash2 className="w-3 h-3 text-red-500" />;
    }
  };

  const getActionText = (activity: Activity) => {
    const entityNames: Record<Activity['entity'], string> = {
      customer: 'Cliente',
      technician: 'Técnico',
      supplier: 'Fornecedor',
      order: 'Ordem de Serviço',
      user: 'Usuário'
    };

    const actions: Record<Activity['type'], string> = {
      create: 'cadastrou',
      update: 'editou',
      delete: 'excluiu'
    };

    return (
      <span className="text-sm">
        <span className="font-bold">{activity.userName}</span> {actions[activity.type]} o {entityNames[activity.entity].toLowerCase()} <span className="font-medium">"{activity.entityName}"</span>
      </span>
    );
  };

  return (
    <div className="relative">
      <Button 
        variant="ghost" 
        size="icon" 
        className="relative"
        onClick={toggleOpen}
      >
        <Bell className="w-5 h-5" />
        {hasUnread && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-background" />
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 md:right-auto md:left-0 mt-2 w-80 max-h-[400px] bg-card border rounded-xl shadow-xl z-50 overflow-hidden flex flex-col origin-top-right md:origin-top-left"
            >
              <div className="p-4 border-b bg-muted/30">
                <h3 className="font-bold flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Atualizações do Sistema
                </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {activities.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground italic text-sm">
                    Nenhuma atividade recente.
                  </div>
                ) : (
                  activities.map((activity) => (
                    <div 
                      key={activity.id}
                      className="p-3 rounded-lg hover:bg-accent transition-colors flex gap-3 items-start"
                    >
                      <div className="relative shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          {getEntityIcon(activity.entity)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 border shadow-sm">
                          {getTypeIcon(activity.type)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        {getActionText(activity)}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-2 border-t bg-muted/10">
                <Button variant="ghost" className="w-full text-xs h-8" onClick={() => setIsOpen(false)}>
                  Fechar
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
