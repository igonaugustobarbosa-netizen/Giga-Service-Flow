export type ServiceStatus = 'budget' | 'in-progress' | 'closed' | 'paid' | 'pending-payment';
export type PaymentMethod = 'pix' | 'cash' | 'credit' | 'debit';

export interface ServiceLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  password?: string;
  role: 'admin' | 'user';
  tenantId: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  taxId?: string;
  contactName?: string;
  contactPhone?: string;
  location?: ServiceLocation;
  tenantId: string;
}

export interface Technician {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  specialty?: string;
  defaultKmValue?: number;
  defaultLaborHourValue?: number;
  location?: ServiceLocation;
  signature?: string;
  tenantId: string;
}

export interface TechnicianWork {
  technicianId: string;
  name: string;
  hours: number;
  laborRate: number;
  km: number;
  kmValue: number;
}

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  taxId?: string;
  pixKey?: string;
  paymentDetails?: string;
  signature?: string;
  tenantId: string;
}

export interface Part {
  name: string;
  quantity: number;
  price: number;
  photoUrl?: string;
}

export interface ServiceOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  technicianIds: string[];
  technicianDetails?: TechnicianWork[];
  supplierId?: string;
  status: ServiceStatus;
  description: string;
  hoursWorked: number;
  laborCost: number;
  laborRate?: number;
  kmDriven: number;
  kmValue: number;
  parts: Part[];
  servicePhotos: string[];
  beforePhotos: string[];
  afterPhotos: string[];
  location?: ServiceLocation;
  paymentMethod?: PaymentMethod;
  totalValue: number;
  discountPercent?: number;
  discountValue?: number;
  executionDate?: string;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  // Snapshots for contract generation
  companyNameSnapshot?: string;
  companyTaxIdSnapshot?: string;
  companyAddressSnapshot?: string;
  customerNameSnapshot?: string;
  customerTaxIdSnapshot?: string;
  customerAddressSnapshot?: string;
}

export interface Settings {
  kmValue?: number;
  laborHourValue?: number;
  lastOrderNumber: number;
  lastWorkOrderNumber?: number;
  companyName?: string;
  companyTaxId?: string;
  companyAddress?: string;
  contractClauses?: string;
  technicalReportDefaultMessage?: string;
  technicalReportDefaultProcedures?: string;
}

export type WorkOrderStatus = 'open' | 'in-progress' | 'closed';

export interface WorkSession {
  startTime: string;
  endTime: string;
  duration: number; // hours
  technicianIds: string[];
}

export interface WorkOrder {
  id: string;
  workOrderNumber: string;
  budgetId?: string;
  supplierId?: string;
  customerId: string;
  customerNameSnapshot?: string;
  technicianIds: string[];
  technicianDetails?: TechnicianWork[];
  description: string;
  kmDriven: number;
  kmRate?: number;
  laborHours: number; // This will be treated as Estimated Hours
  totalWorkedHours?: number;
  remainingHours?: number;
  currentStartTime?: string | null;
  workSessions?: WorkSession[];
  status: WorkOrderStatus;
  scheduledDate: string;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

export interface Activity {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'customer' | 'technician' | 'supplier' | 'order' | 'user' | 'workOrder';
  entityId: string;
  entityName: string;
  userId: string;
  userName: string;
  timestamp: string;
  tenantId: string;
}
