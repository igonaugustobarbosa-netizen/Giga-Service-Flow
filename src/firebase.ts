import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  enableIndexedDbPersistence,
  doc,
  getDocFromServer
} from 'firebase/firestore';

// Load configuration from firebase-applet-config.json.
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use experimentalForceLongPolling to bypass some proxy restrictions in sandboxed environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

// Enable offline persistence for better UX in unstable networks
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a a time.
      console.warn('Firestore persistence failed: multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('Firestore persistence is not supported by this browser');
    }
  });
}

// Connectivity test as per Firebase skill guidelines
async function testConnection() {
  try {
    // Only try to test connection if we are in the browser
    if (typeof window !== 'undefined') {
      // We don't need the result, just testing if it can reach the server
      await getDocFromServer(doc(db, '_connection_test_', 'ping'));
      console.log("Firestore connection verified.");
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes('the client is offline') || (error as any).code === 'unavailable')) {
      console.error("Firestore is currently unavailable. The app will work in offline mode.");
    } else {
      console.error("Firestore Connection Error:", error);
    }
  }
}

testConnection();
