import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

// TODO: Replace with your Firebase config
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addUserRole({
  companyId,
  userId,
  email,
  roleId,
  storeId
}: {
  companyId: string;
  userId: string;
  email: string;
  roleId: string;
  storeId: string;
}) {
  const userRolesRef = collection(db, 'userRoles');
  await addDoc(userRolesRef, {
    companyId,
    userId,
    email,
    roleId,
    storeId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('UserRole added:', { companyId, userId, email, roleId, storeId });
}

// Example usage:
addUserRole({
  companyId: 'D36HL1Nk7ycQXrgdtY0l',
  userId: 'Rpj4HkXTcAeraJNdYpgolEVaeLd2',
  email: 'jasper@pos.com',
  roleId: 'cashier',
  storeId: 'pXlhGouNQAXxRQg8Eknk', // or 'c82Fh5QtNJ9cqXwklbih'
});
