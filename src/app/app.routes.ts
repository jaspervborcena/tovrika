import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './dashboard/pages/home/home.component';
import { AboutComponent } from './dashboard/pages/about/about.component';
import { ContactComponent } from './dashboard/pages/contact/contact.component';
import { RegisterComponent } from './authentication/register/register.component';
import { SignInComponent } from './authentication/sign-in/sign-in.component';
import { LottoDrawComponent } from './dashboard/pages/lotto-draw/lotto-draw.component';
import { authGuard } from './core/guards/auth.guard';
import { EndingComponent } from './dashboard/pages/ending/ending.component';
import { CardsListComponent } from './dashboard/ending-components/cards-list/cards-list.component';
export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent ,},
  { path: 'about', component: AboutComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'signin', component: SignInComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'ending', component: EndingComponent,
    children: [
      {
        path: 'cards',
        loadComponent: () =>
          import('./dashboard/ending-components/cards-list/cards-list.component').then(
            (m) => m.CardsListComponent
          ),
      },
    ]
  },
  {path: 'draw',
  component: LottoDrawComponent,
  children: [
    {
      path: 'play',
      loadComponent: () =>
        import('./dashboard/lotto-components/play/play.component').then(
          (m) => m.PlayComponent
        ),
    },
    {
      path: 'transaction',
      loadComponent: () =>
        import('./dashboard/lotto-components/transaction/transaction.component').then(
          (m) => m.TransactionComponent
        ),
    },
    {
      path: 'dashboard',
      loadComponent: () =>
        import('./dashboard/lotto-components/dashboard/dashboard.component').then(
          (m) => m.DashboardComponent
        ),
    },
    {
      path: 'winners',
      loadComponent: () =>
        import('./dashboard/lotto-components/winners/winners.component').then(
          (m) => m.WinnersComponent
        ),
    },
    {
      path: 'cancelled',
      loadComponent: () =>
        import('./dashboard/lotto-components/cancelled/cancelled.component').then(
          (m) => m.CancelledComponent
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