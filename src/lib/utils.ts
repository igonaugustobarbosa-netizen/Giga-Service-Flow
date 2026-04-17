import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth } from '../firebase';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to parse dates safely from Firestore or JS strings
export const parseDateSafely = (dateValue: any): Date => {
  if (!dateValue) return new Date();
  
  // Handle Firestore Timestamps
  if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
    return dateValue.toDate();
  }
  
  // Handle JS Dates
  if (dateValue instanceof Date) return dateValue;

  try {
    const dateStr = String(dateValue);
    // Strip 'Z' to avoid day jumps if we want to stay in local time interpretation
    const cleanStr = dateStr.includes('Z') ? dateStr.replace('Z', '') : dateStr;
    const date = new Date(cleanStr);
    return isNaN(date.getTime()) ? new Date() : date;
  } catch (e) {
    return new Date();
  }
};
