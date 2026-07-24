import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface LoginResult {
  success: boolean;
  blocked: boolean;
  remainingMs: number;
  attempts: number;
}

interface AuthState {
  authenticated: boolean;
  failedAttempts: number;
  lockUntil: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticatedUser = false;
  private failedAttempts = 0;
  private lockUntil: number | null = null;
  private readonly DEMO_USERNAME = environment.demoUsername;
  private readonly DEMO_PASSWORD = environment.demoPassword;
  private readonly STORAGE_KEY = 'tessa_auth_token';
  private readonly ENCRYPTION_PASSPHRASE = environment.encryptionPassphrase;
  private readonly ENCRYPTION_SALT = environment.encryptionSalt;
  private readonly MAX_INCORRECT_ATTEMPTS = 3;
  private readonly BLOCK_DURATION_MS = 60_000;

  constructor() {
    this.loadAuthState().catch(error => {
      console.error('Unable to restore auth state:', error);
      this.resetAuthState();
    });
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const now = Date.now();

    if (this.isLocked(now)) {
      return {
        success: false,
        blocked: true,
        remainingMs: this.lockUntil! - now,
        attempts: this.failedAttempts,
      };
    }

    if (username === this.DEMO_USERNAME && password === this.DEMO_PASSWORD) {
      this.isAuthenticatedUser = true;
      this.failedAttempts = 0;
      this.lockUntil = null;
      await this.saveAuthState();
      return {
        success: true,
        blocked: false,
        remainingMs: 0,
        attempts: 0,
      };
    }

    this.failedAttempts += 1;
    if (this.failedAttempts > this.MAX_INCORRECT_ATTEMPTS) {
      const blockCount = this.failedAttempts - this.MAX_INCORRECT_ATTEMPTS;
      this.lockUntil = now + blockCount * this.BLOCK_DURATION_MS;
    }

    await this.saveAuthState();

    return {
      success: false,
      blocked: this.isLocked(now),
      remainingMs: this.lockUntil ? Math.max(this.lockUntil - now, 0) : 0,
      attempts: this.failedAttempts,
    };
  }

  logout(): void {
    this.resetAuthState();
    localStorage.removeItem(this.STORAGE_KEY);
  }

  isAuthenticated(): boolean {
    return this.isAuthenticatedUser;
  }

  getLockoutInfo(): { locked: boolean; remainingMs: number; attempts: number } {
    const now = Date.now();
    return {
      locked: this.isLocked(now),
      remainingMs: this.lockUntil && this.lockUntil > now ? this.lockUntil - now : 0,
      attempts: this.failedAttempts,
    };
  }

  private isLocked(now: number = Date.now()): boolean {
    return this.lockUntil !== null && this.lockUntil > now;
  }

  private async saveAuthState(): Promise<void> {
    const state: AuthState = {
      authenticated: this.isAuthenticatedUser,
      failedAttempts: this.failedAttempts,
      lockUntil: this.lockUntil,
    };

    const encrypted = await this.encryptString(JSON.stringify(state));
    localStorage.setItem(this.STORAGE_KEY, encrypted);
  }

  private async loadAuthState(): Promise<void> {
    const encrypted = localStorage.getItem(this.STORAGE_KEY);
    if (!encrypted) {
      this.resetAuthState();
      return;
    }

    try {
      const decrypted = await this.decryptString(encrypted);
      const state = JSON.parse(decrypted) as AuthState;
      this.isAuthenticatedUser = state.authenticated === true;
      this.failedAttempts = state.failedAttempts || 0;
      this.lockUntil = state.lockUntil && state.lockUntil > Date.now() ? state.lockUntil : null;
    } catch (error) {
      console.error('Auth state load/decryption failed:', error);
      this.resetAuthState();
    }
  }

  private resetAuthState(): void {
    this.isAuthenticatedUser = false;
    this.failedAttempts = 0;
    this.lockUntil = null;
  }

  private async getCryptoKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passphraseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.ENCRYPTION_PASSPHRASE),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(this.ENCRYPTION_SALT),
        iterations: 250000,
        hash: 'SHA-256'
      },
      passphraseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async encryptString(value: string): Promise<string> {
    const key = await this.getCryptoKey();
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const encoded = new TextEncoder().encode(value);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      encoded
    );

    return `${this.toBase64(iv)}:${this.toBase64(encrypted)}`;
  }

  private async decryptString(value: string): Promise<string> {
    const [ivBase64, dataBase64] = value.split(':');
    if (!ivBase64 || !dataBase64) {
      throw new Error('Invalid encrypted payload');
    }

    const key = await this.getCryptoKey();
    const iv = this.fromBase64(ivBase64);
    const data = this.fromBase64(dataBase64);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      data as BufferSource
    );

    return new TextDecoder().decode(decrypted);
  }

  private toBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => (binary += String.fromCharCode(byte)));
    return window.btoa(binary);
  }

  private fromBase64(base64: string): Uint8Array {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
