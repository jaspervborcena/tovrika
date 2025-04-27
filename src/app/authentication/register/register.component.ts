import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common'; // ✅ Import CommonModule
import { UserService } from '../../../app/core/services/user.service'; 
@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.less'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], // ✅ Add CommonModule here
})
export class RegisterComponent {
  registerForm: FormGroup;
  successMessage: string = '';
  errorMessage: string = '';

  constructor(private fb: FormBuilder,private authService: AuthService,private userService:UserService) {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    });
  }

  onRegister() {
    if (this.registerForm.invalid) return;

    const { email, password, confirmPassword } = this.registerForm.value;

    if (password !== confirmPassword) {
      this.errorMessage = "Passwords do not match!";
      return;
    }

    this.authService.register(email, password)
      .then(() => {
      
        const user =this.authService.user;
        this.userService.addUser(user);

        this.successMessage = "Registration successful! Redirecting...";
        this.errorMessage = "";
        setTimeout(() => {
          window.location.href = "/success"; // Use Angular routing if needed
        }, 2000);
      })
      .catch(error => {
        this.errorMessage = error.message;
      });
  }
}



// // home.component.ts
// import { Component } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { ProductService } from '../../services/product.service'; 
// import { CartService } from '../../services/cart.service'; 
// import { Product } from '../../models/products';
// import { ProductItemComponent } from '../../components/product-item/product-item.component'; // Adjust the path as needed

// @Component({
//   selector: 'app-home',
//   standalone: true,
//   imports: [CommonModule, ProductItemComponent],
//   templateUrl: './home.component.html',
//   styleUrls: ['./home.component.less']
// })
// export class HomeComponent {
//   constructor(private productService: ProductService, private cartService: CartService) {}

//   get products() {
//     return this.productService.products;
//   }

//   productQuantities: { [key: string]: number } = {};

//   incrementQuantity = (product: Product) => {
//     if (product.id) {
//       this.productQuantities[product.id] = (this.productQuantities[product.id] || 1) + 1;
//     }
//   };

//   decrementQuantity = (product: Product) => {
//     if (product.id && this.productQuantities[product.id] > 1) {
//       this.productQuantities[product.id]--;
//     }
//   };

//   addToCart = (product: Product) => {
//     console.log("addToCart0")
//     if (product.id) {
//       const quantity = this.productQuantities[product.id] || 1;
//       this.cartService.addToCart({ ...product, quantity });
//       console.log("addToCart0",product)
//     }
//   };

//   get totalQuantity() {
//     return this.cartService.totalQuantity;
//   }
// }