import { Component, computed, inject,effect,runInInjectionContext, OnInit,HostListener} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.less']
})
export class NavbarComponent  implements OnInit {
  isLoggedIn = computed(() => this.authService.isAuthenticated); // No '()' here
  user = computed(() => this.authService.user); // No '()' here
  menuActive: boolean = false;
  userEmail: string | null = null; // ✅ Initialize as null
  constructor(private router: Router,private authService:AuthService ) {
    console.log("isLoggedIn",this.isLoggedIn())
    if (typeof window !== "undefined") {
      // ✅ Ensure `localStorage` is available before accessing it
      this.userEmail = localStorage.getItem("email");
    }
      }
      
  
  
  isDropdownOpen = false;

toggleDropdown(event: Event) {
  event.stopPropagation();
  this.isDropdownOpen = !this.isDropdownOpen;
}

// Close dropdown if clicked outside
@HostListener('document:click', ['$event'])
closeDropdown(event: Event) {
  this.isDropdownOpen = false;
}

  toggleMenu(): void {
    this.menuActive = !this.menuActive;
  }
  ngOnInit() {
  
  }
  navigateToShop() {
    this.router.navigate(['/shop']);
  }

  navigateToSignIn() {
    this.router.navigate(['/signin']);
  }
  navigateHome() {
    this.router.navigate(['/']);
  }

  signOut() {
    this.authService.signOut().then(() => {
      localStorage.removeItem('user'); // Optionally clear storage
      this.router.navigate(['/']);
    }).catch((error: any) => {
      console.error('Sign-out error:', error);
    });
  }
  
  
}
