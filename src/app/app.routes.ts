import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './dashboard/pages/home/home.component';
import { AboutComponent } from './dashboard/pages/about/about.component';
import { ContactComponent } from './dashboard/pages/contact/contact.component';
import { RegisterComponent } from './authentication/register/register.component';
import { SignInComponent } from './authentication/sign-in/sign-in.component';
import { LottoDrawComponent } from './dashboard/pages/lotto-draw/lotto-draw.component';
import { PlayComponent } from './dashboard/components/play/play.component'
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent ,},
  { path: 'about', component: AboutComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'signin', component: SignInComponent },
  { path: 'register', component: RegisterComponent },
  {path: 'draw',
  component: LottoDrawComponent,
  children: [
    {
      path: 'play',
      loadComponent: () =>
        import('./dashboard/components/play/play.component').then(
          (m) => m.PlayComponent
        ),
    },
    {
      path: 'transaction',
      loadComponent: () =>
        import('./dashboard/pages/transaction/transaction.component').then(
          (m) => m.TransactionComponent
        ),
    },
    {
      path: '',
      redirectTo: 'play',
      pathMatch: 'full',
    },
  ],

}
];
@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }