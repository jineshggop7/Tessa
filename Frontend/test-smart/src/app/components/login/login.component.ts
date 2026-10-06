import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit, OnDestroy {
  username: string = '';
  password: string = '';
  errorMessage: string = '';
  lockoutMessage: string = '';
  isLoading: boolean = false;
  rememberCredentials = true;
  private lockoutTimerId?: number;
  private readonly USERNAME_KEY = 'tessa_login_username';
  private readonly PASSWORD_KEY = 'tessa_login_password';

  leftMessages = [
    'TESSA - TESSA - Testing End-to-End Smart Software Automation',
    'Testing Every System Always',
    'Unified automation platform for complete testing',
    'From first trigger to final validation'
  ];

  rightMessages = [
    'AI-powered test generation and execution',
    '4 intelligent agents working in harmony',
    'Real-time monitoring and insights',
    'Complete test automation lifecycle'
  ];

  currentLeftMessage = '';
  currentRightMessage = '';
  leftMessageIndex = 0;
  rightMessageIndex = 0;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadCredentials();
    this.startTypingAnimation();
  }

  saveCredentials() {
    if (typeof window === 'undefined') return;
    if (this.rememberCredentials) {
      localStorage.setItem(this.USERNAME_KEY, this.username);
      sessionStorage.setItem(this.PASSWORD_KEY, this.password);
    } else {
      localStorage.removeItem(this.USERNAME_KEY);
      sessionStorage.removeItem(this.PASSWORD_KEY);
    }
  }

  private loadCredentials() {
    if (typeof window === 'undefined') return;
    this.username = localStorage.getItem(this.USERNAME_KEY) || '';
    this.password = sessionStorage.getItem(this.PASSWORD_KEY) || '';
  }

  async startTypingAnimation() {
    while (true) {
      // Type left message
      await this.typeMessage(this.leftMessages[this.leftMessageIndex], 'left');
      await this.delay(3000);
      await this.eraseMessage('left');
      this.leftMessageIndex = (this.leftMessageIndex + 1) % this.leftMessages.length;
      
      await this.delay(500);
      
      // Type right message
      await this.typeMessage(this.rightMessages[this.rightMessageIndex], 'right');
      await this.delay(3000);
      await this.eraseMessage('right');
      this.rightMessageIndex = (this.rightMessageIndex + 1) % this.rightMessages.length;
      
      await this.delay(500);
    }
  }

  async typeMessage(message: string, side: 'left' | 'right') {
    for (let i = 0; i <= message.length; i++) {
      if (side === 'left') {
        this.currentLeftMessage = message.substring(0, i);
      } else {
        this.currentRightMessage = message.substring(0, i);
      }
      await this.delay(50);
    }
  }

  async eraseMessage(side: 'left' | 'right') {
    const message = side === 'left' ? this.currentLeftMessage : this.currentRightMessage;
    for (let i = message.length; i >= 0; i--) {
      if (side === 'left') {
        this.currentLeftMessage = message.substring(0, i);
      } else {
        this.currentRightMessage = message.substring(0, i);
      }
      await this.delay(30);
    }
  }

  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async onLogin() {
    this.errorMessage = '';
    this.lockoutMessage = '';
    this.isLoading = true;

    await this.delay(500);
    const result = await this.authService.login(this.username, this.password);

    if (result.success) {
      this.saveCredentials();
      this.clearLockoutTimer();
      this.router.navigate(['/home']);
      return;
    }

    this.isLoading = false;

    if (result.blocked) {
      this.startLockoutTimer(result.remainingMs);
      this.errorMessage = 'Too many incorrect attempts. Login is temporarily blocked.';
    } else {
      const remainingAttempts = Math.max(0, 3 - result.attempts);
      this.errorMessage = `Invalid username or password. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining before temporary lock.`;
    }
  }

  ngOnDestroy() {
    this.clearLockoutTimer();
  }

  private startLockoutTimer(remainingMs: number) {
    this.clearLockoutTimer();
    this.updateLockoutMessage(remainingMs);

    this.lockoutTimerId = window.setInterval(() => {
      remainingMs -= 1000;
      if (remainingMs <= 0) {
        this.clearLockoutTimer();
        this.lockoutMessage = 'Login is now available. Please try again.';
        return;
      }
      this.updateLockoutMessage(remainingMs);
    }, 1000);
  }

  private clearLockoutTimer() {
    if (this.lockoutTimerId !== undefined) {
      window.clearInterval(this.lockoutTimerId);
      this.lockoutTimerId = undefined;
    }
  }

  private updateLockoutMessage(remainingMs: number) {
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    this.lockoutMessage = `Please wait ${minutes}m ${seconds}s before trying again.`;
  }
}
