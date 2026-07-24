import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { LandingComponent } from './components/landing/landing.component';
import { StartExecutionComponent } from './components/start-execution/start-execution.component';
import { ExecutionsListComponent } from './components/executions-list/executions-list.component';
import { ExecutionProgressComponent } from './components/execution-progress/execution-progress.component';
import { LiveMonitorComponent } from './components/live-monitor/live-monitor.component';
import { ReportComponent } from './components/report/report.component';
import { TessaChatbotComponent } from './components/tessa-chatbot/tessa-chatbot.component';
import { AnalyticsDashboardComponent } from './components/analytics-dashboard/analytics-dashboard.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'home', component: LandingComponent, canActivate: [authGuard] },
  { path: 'start', component: StartExecutionComponent, canActivate: [authGuard] },
  { path: 'executions', component: ExecutionsListComponent, canActivate: [authGuard] },
  { path: 'execution/:id', component: ExecutionProgressComponent, canActivate: [authGuard] },
  { path: 'monitor/:id', component: LiveMonitorComponent, canActivate: [authGuard] },
  { path: 'report/:id', component: ReportComponent, canActivate: [authGuard] },
  { path: 'tessa', component: TessaChatbotComponent, canActivate: [authGuard] },
  { path: 'analytics', component: AnalyticsDashboardComponent, canActivate: [authGuard] }
];
