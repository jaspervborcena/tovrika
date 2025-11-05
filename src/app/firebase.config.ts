import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { environment } from '../environments/environment';

// Reuse existing app if already initialized elsewhere (e.g., AngularFire providers)
const app = getApps().length > 0 ? getApp() : initializeApp(environment.firebase);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
