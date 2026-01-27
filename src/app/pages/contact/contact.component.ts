import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RecaptchaModule, RecaptchaFormsModule } from 'ng-recaptcha';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { ContentLayoutComponent } from '../../shared/components/content-layout/content-layout.component';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, RecaptchaModule, RecaptchaFormsModule, HeaderComponent, ContentLayoutComponent],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css']
})
export class ContactComponent {
  form = {
    email: '',
    subject: '',
    body: ''
  };

  // Google reCAPTCHA site key
  siteKey: string = '6LfALVgsAAAAANJsAediJhvzsAJTx4rHvZBFTtXo';
  
  captchaToken: string = '';
  isSubmitting: boolean = false;
  submitMessage: string = '';
  submitSuccess: boolean = false;

  constructor(private router: Router) {}

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  onCaptchaResolved(token: string | null): void {
    this.captchaToken = token || '';
    console.log('reCAPTCHA resolved:', token ? 'Success' : 'Expired');
  }

  onCaptchaError(error: any): void {
    console.error('reCAPTCHA error:', error);
    this.captchaToken = '';
  }

  isFormValid(): boolean {
    return (
      this.form.email.trim() !== '' &&
      this.isValidEmail(this.form.email) &&
      this.form.subject.trim() !== '' &&
      this.form.body.trim() !== '' &&
      this.captchaToken !== ''
    );
  }

  async submitForm(): Promise<void> {
    if (!this.isFormValid()) {
      return;
    }

    this.isSubmitting = true;
    this.submitMessage = '';
    this.submitSuccess = false;

    try {
      // Simulate API call - In production, this would send to your backend
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create mailto link as fallback
      const subject = encodeURIComponent(this.form.subject);
      const body = encodeURIComponent(
        `From: ${this.form.email}\n\n${this.form.body}`
      );
      const mailtoLink = `mailto:tovrikapos@gmail.com?subject=${subject}&body=${body}`;

      // Open default email client
      window.location.href = mailtoLink;

      this.submitSuccess = true;
      this.submitMessage = '✓ Your email client has been opened. Please send the email to complete your request.';

      // Reset form after 3 seconds
      setTimeout(() => {
        this.form = { email: '', subject: '', body: '' };
        this.captchaToken = '';
        this.submitMessage = '';
      }, 3000);

    } catch (error) {
      console.error('Form submission error:', error);
      this.submitSuccess = false;
      this.submitMessage = '✗ Failed to send message. Please try again or contact us directly at support@tovrika.com';
    } finally {
      this.isSubmitting = false;
    }
  }

  goBack(): void {
    this.router.navigate(['/help']);
  }
}
