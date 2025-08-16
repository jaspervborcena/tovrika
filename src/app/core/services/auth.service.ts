import { Injectable, signal } from '@angular/core';
import { Auth, getAuth, signInWithEmailAndPassword,createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';  
import { environment } from '../../../environments/environment';
import { initializeApp } from 'firebase/app';  
import { UserService } from './user.service';
import { User } from '../../models/auth/user'; 
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private app = initializeApp(environment.firebaseConfig);
  private auth: Auth = getAuth(this.app);  
  private userSignal = signal<any>(null); // Signal to track the user
  private isAuthenticatedSignal = signal<boolean>(false); // Signal to track authentication state
  private userIdValue: string | null = null;
  private userEmailValue: string | null = null;
  constructor(private userService:UserService) {
    // Initialize user state by subscribing to auth state changes
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.userSignal.set(user); // Set user state if authenticated
        localStorage.setItem("uid", user.uid);
        localStorage.setItem("email", user.email!);
        const userInfo = this.userService.getUserByUid(user.uid);
        localStorage.setItem("userInfo", JSON.stringify(userInfo));
        this.isAuthenticatedSignal.set(true); // Set isAuthenticated to true
      } else {
        this.userSignal.set(null); // Set user state to null if not authenticated
       
        localStorage.removeItem("uid");
        localStorage.removeItem("email");
        this.isAuthenticatedSignal.set(false); // Set isAuthenticated to false
        this.signOut(); 
      }
    });
  }

  // Sign In function
  signIn(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  // Sign Out function
  signOut() {
    return signOut(this.auth).then(() => {
      this.userSignal.set(null); // Reset user state
      this.isAuthenticatedSignal.set(false); // Set authentication state to false
    });
  }
  async register(email: string, password: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;

      const users =({
        uid: user.uid,
        email: user.email!,
        roleId: 1,
        createdAt: new Date().toISOString()
      });
      this.userSignal.set(users);
      return user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }
  
  // Get the current user from the signal


  // Get the authentication status from the signal
  get isAuthenticated() {
    return this.isAuthenticatedSignal(); // Access the current value of the isAuthenticated signal
  }
  get user() {
    return this.userSignal(); // Access the current value of the user signal
  }
  get userId(): string | null {
    return localStorage.getItem("uid");// ✅ Returns tracked userId
  }

  get userEmail(): string | null {
    return localStorage.getItem("email"); // ✅ Returns tracked userEmail
  }
}