import { Injectable, inject, signal } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, collectionData } from '@angular/fire/firestore';
import { User } from '../../dashboard/models/lotto/user'; // Import User model

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private firestore = inject(Firestore); // Inject Firestore instance
  private usersSignal = signal<User[]>([]); // Signal to store users

  constructor() {
    const usersCollection = collection(this.firestore, 'User'); // Collection reference

    collectionData(usersCollection, { idField: 'uid' }).subscribe({
      next: (users) => this.usersSignal.set(users as User[]),
      error: (error) => console.error('Error fetching users:', error),
    });
  }

  get users() {
    return this.usersSignal(); // Access the signal value
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
}
