import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './services/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  title = 'TESSA - TESSA - Testing End-to-End Smart Software Automation';
  showSidebar = true;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {
    // Listen to route changes to show/hide sidebar
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const hideSidebarRoutes = ['/login', '/home'];
        this.showSidebar = !hideSidebarRoutes.includes(event.urlAfterRedirects);
      });
  }

  ngOnInit() {
    const spinner = document.getElementById('nb-global-spinner');
    if (spinner) {
      spinner.classList.add('loaded');
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
