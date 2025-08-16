import { Injectable, inject, signal } from '@angular/core';
import { Firestore, collection, addDoc, doc,getDoc, updateDoc, collectionData } from '@angular/fire/firestore';
import { User } from '../../models/auth/user'; // Import User model
import { ENUM_COLLECTION } from 'dashboard/enum/collections.enum';
@Injectable({
  providedIn: 'root',
})
export class UserService {
  private firestore = inject(Firestore); // Inject Firestore instance
  private usersSignal = signal<User[]>([]); // Signal to store users

  constructor() {
    const usersCollection = collection(this.firestore, ENUM_COLLECTION.USERS); // Collection reference

    collectionData(usersCollection, { idField: 'uid' }).subscribe({
      next: (users) => this.usersSignal.set(users as User[]),
      error: (error) => console.error('Error fetching users:', error),
    });
  }


  async addUser(user: User): Promise<void> {
    try {
      const usersCollection = collection(this.firestore, 'User');
      await addDoc(usersCollection, user);
    } catch (error) {
      console.error('Error adding user to Firestore:', error);
    }
  }

  async updateUser(user: User): Promise<void> {
    if (!user.uid) {
      console.error('User ID is required to update');
      return;
    }
    try {
      const userRef = doc(this.firestore, `User/${user.uid}`);
      await updateDoc(userRef, {
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      });
    } catch (error) {
      console.error('Error updating user in Firestore:', error);
    }
  }
  get users() {
    return this.usersSignal.asReadonly(); // Expose as readonly
  }

  async getUserByUid(uid: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, ENUM_COLLECTION.ROLES, uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as User;
        const user: User = {
          uid,
          email: data.email,
          roleId: data.roleId ?? undefined,
          displayName: data.displayName ?? '',
          createdAt: data.createdAt ?? '',
          companyId: data.companyId,
          hasStore: data.hasStore,
          hasAgreedTerm: data.hasAgreedTerm,
        };

        // Add/replace user in signal
        this.usersSignal.update(users => {
          const existingIndex = users.findIndex(u => u.uid === uid);
          if (existingIndex > -1) {
            users[existingIndex] = user; // replace
            return [...users];
          }
          return [...users, user]; // add
        });
      } else {
        console.log("No document found for UID:", uid);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  }

  
}


