import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Activity } from '../types';

export const logActivity = async (activity: Omit<Activity, 'id' | 'timestamp'>) => {
  try {
    await addDoc(collection(db, 'activities'), {
      ...activity,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

export const subscribeToActivities = (tenantId: string, callback: (activities: Activity[]) => void) => {
  const q = query(
    collection(db, 'activities'),
    where('tenantId', '==', tenantId),
    orderBy('timestamp', 'desc'),
    limit(20)
  );

  return onSnapshot(q, (snapshot) => {
    const activities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate()?.toISOString() || new Date().toISOString()
    } as Activity));
    callback(activities);
  }, (error) => {
    console.error('Error subscribing to activities:', error);
    callback([]);
  });
};
