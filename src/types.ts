export type ServiceStatus = 'budget' | 'in-progress' | 'closed';

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  taxId?: string;
}

export interface Technician {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  specialty?: string;
}

export interface Part {
  name: string;
  quantity: number;
  price: number;
  photoUrl?: string;
}

export interface ServiceLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface ServiceOrder {
  id: string;
  customerId: string;
  technicianIds: string[];
  status: ServiceStatus;
  description: string;
  hoursWorked: number;
  laborCost: number;
  kmDriven: number;
  kmValue: number;
  parts: Part[];
  servicePhotos: string[];
  location?: ServiceLocation;
  totalValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  kmValue: number;
  laborHourValue: number;
}
