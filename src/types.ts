export type ServiceStatus = 'budget' | 'in-progress' | 'closed';
export type PaymentMethod = 'pix' | 'cash' | 'credit' | 'debit';

export interface ServiceLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  taxId?: string;
  location?: ServiceLocation;
}

export interface Technician {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  specialty?: string;
  defaultKmValue?: number;
  defaultLaborHourValue?: number;
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
  supplierId?: string;
  status: ServiceStatus;
  description: string;
  hoursWorked: number;
  laborCost: number;
  kmDriven: number;
  kmValue: number;
  parts: Part[];
  servicePhotos: string[];
  location?: ServiceLocation;
  paymentMethod?: PaymentMethod;
  totalValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  kmValue?: number;
  laborHourValue?: number;
  lastOrderNumber: number;
}
