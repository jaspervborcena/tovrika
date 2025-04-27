import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.less'],
  imports: [CommonModule, ReactiveFormsModule]  // Add CommonModule here
})
export class SignInComponent {
  signInForm: FormGroup;
  errorMessage: string | null = null;

  constructor(private authService: AuthService, private fb: FormBuilder, private router: Router) {
    this.signInForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async onSubmit() {
    if (this.signInForm.invalid) {
      return;
    }

    const { email, password } = this.signInForm.value;

    await this.authService.signIn(email, password).then(() => {
      console.log("Sign-in successful");
      this.router.navigate(['/home']);  // Redirect to home after successful sign-in
    }).catch((error: any) => {
      this.errorMessage = error.message;  // Handle sign-in error
    });
  }

  onSignOut() {
    this.authService.signOut().then(() => {
      console.log("Signed out successfully");
      this.router.navigate(['/login']);  // Redirect to login after sign-out
    }).catch((error: any) => {
      this.errorMessage = error.message;  // Handle sign-out error
    });
  }
  goToSignUp() {
    this.router.navigate(['/sign-up']); // Change '/sign-up' to your actual sign-up route
  }
}
