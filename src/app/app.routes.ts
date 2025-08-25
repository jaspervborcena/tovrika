
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from '../dashboard/components/home/home.component';
import { RegisterComponent } from './authentication/register/register.component';
import { SignInComponent } from './authentication/sign-in/sign-in.component';
import { CreateStoreComponent } from '../dashboard/components/create-store/create-store.component';
import { GetStartedComponent } from  '../dashboard/components/get-started/get-started.component';
import { LaunchTemplateComponent } from  '../dashboard/components/launch-template/launch-template.component';
import { CompanyProfileComponent } from '../dashboard/components/company-profile/company-profile.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  { path: 'dashboard', component: HomeComponent },
  { path: 'company-profile', component: CompanyProfileComponent },
  { path: 'create-store', component: CreateStoreComponent },
  { path: 'get-started', component: GetStartedComponent },
  { path: 'launch-template', component: LaunchTemplateComponent },
  { path: 'signin', component: SignInComponent },
  { path: 'register', component: RegisterComponent },
];
@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }