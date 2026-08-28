
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

async function run() {
  try {
    const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
    
    initializeApp({
      projectId: config.projectId
    });

    // Explicitly set the databaseId from config
    const db = getFirestore(config.firestoreDatabaseId);
    
    console.log('--- SEARCHING WORK ORDERS ---');
    const collections = ['workOrders', 'serviceOrders', 'proposals'];
    
    for (const col of collections) {
      console.log(`Checking collection: ${col}`);
      const snap = await db.collection(col).get();
      snap.docs.forEach(doc => {
        const data = doc.data();
        const num = data.workOrderNumber || data.orderNumber || data.proposalNumber || '';
        if (String(num).includes('091') || String(num).includes('91')) {
          console.log(`FOUND in ${col}:`, JSON.stringify({ id: doc.id, ...data }, null, 2));
        }
      });
    }

    console.log('--- SEARCHING USERS ---');
    const usersSnap = await db.collection('users').get();
    usersSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.email?.includes('giga') || data.name?.includes('giga')) {
        console.log('FOUND USER:', JSON.stringify({ id: doc.id, ...data }, null, 2));
      }
    });

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
