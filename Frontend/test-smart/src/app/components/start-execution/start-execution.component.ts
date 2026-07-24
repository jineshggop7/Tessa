import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, StartExecutionRequest } from '../../services/api.service';
import { ExecutionStateService } from '../../services/execution-state.service';
import { Router } from '@angular/router';

interface FileWithPath extends File {
  path?: string;
}

interface ExecutionFormData {
  appName: string;
  appDescription: string;
  appPlatform: string;
  aiModel: string;
  customPrompt: string;
  fileNames: string[];
  fileSizes: number[];
}

@Component({
  selector: 'app-start-execution',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './start-execution.component.html',
  styleUrl: './start-execution.component.scss'
})
export class StartExecutionComponent implements OnInit {
  appName: string = '';
  appDescription: string = '';
  appPlatform: string = 'web';
  aiModel: string = 'gemini';
  customPrompt: string = '';
  selectedFiles: FileWithPath[] = [];
  selectedFilesList: File[] = [];
  isLoading: boolean = false;
  error: string = '';

  platforms = ['web', 'mobile', 'desktop'];
  aiModels = ['gemini', 'gpt', 'openai', 'gpt-4'];
  
  private readonly STORAGE_KEY = 'tessa_execution_form';
  private readonly LOADING_STATE_KEY = 'tessa_execution_loading';
  private readonly DB_NAME = 'TessaDB';
  private readonly STORE_NAME = 'executionFiles';
  private db: IDBDatabase | null = null;

  constructor(
    private apiService: ApiService,
    private stateService: ExecutionStateService,
    private router: Router
  ) {}

  ngOnInit() {
    // Initialize IndexedDB and load persisted form data and loading state
    this.initIndexedDB().then(() => {
      this.loadFormData();
      this.loadLoadingState();
      this.loadFilesFromIndexedDB();
    });
  }

  private initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);
      
      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
    });
  }

  private loadFormData() {
    try {
      const savedData = localStorage.getItem(this.STORAGE_KEY);
      if (savedData) {
        const formData: ExecutionFormData = JSON.parse(savedData);
        this.appName = formData.appName || '';
        this.appDescription = formData.appDescription || '';
        this.appPlatform = formData.appPlatform || 'web';
        this.aiModel = formData.aiModel || 'gemini';
        this.customPrompt = formData.customPrompt || '';
      }
    } catch (error) {
      console.error('Error loading form data from localStorage:', error);
    }
  }

  private loadLoadingState() {
    try {
      const savedLoadingState = localStorage.getItem(this.LOADING_STATE_KEY);
      if (savedLoadingState) {
        this.isLoading = JSON.parse(savedLoadingState);
      }
    } catch (error) {
      console.error('Error loading loading state from localStorage:', error);
    }
  }

  private saveFilesToIndexedDB() {
    if (!this.db) return;

    // Convert files to blob array for storage
    const filePromises = this.selectedFilesList.map((file: File) => {
      return new Promise<{ name: string; data: ArrayBuffer; size: number }>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            name: file.name,
            data: reader.result as ArrayBuffer,
            size: file.size
          });
        };
        reader.readAsArrayBuffer(file);
      });
    });

    Promise.all(filePromises).then((fileDataArray) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      store.clear();
      store.put(fileDataArray, 'files');
    });
  }

  private loadFilesFromIndexedDB() {
    if (!this.db) return;

    const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
    const store = transaction.objectStore(this.STORE_NAME);
    const request = store.get('files');

    request.onsuccess = () => {
      const fileDataArray = request.result as { name: string; data: ArrayBuffer; size: number }[] | undefined;
      if (fileDataArray && Array.isArray(fileDataArray)) {
        // Reconstruct File objects from stored data
        this.selectedFilesList = fileDataArray.map((fileData) => {
          const file = new File([new Blob([fileData.data])], fileData.name);
          // Store the original size in case we need it
          Object.defineProperty(file, 'originalSize', {
            value: fileData.size,
            enumerable: false
          });
          return file;
        });
        this.selectedFiles = this.selectedFilesList.map((file: any) => ({
          ...file,
          path: file.name,
          size: file.originalSize || file.size
        }));
      }
    };
  }

  saveFormData() {
    try {
      const formData: ExecutionFormData = {
        appName: this.appName,
        appDescription: this.appDescription,
        appPlatform: this.appPlatform,
        aiModel: this.aiModel,
        customPrompt: this.customPrompt,
        fileNames: this.selectedFiles.map(f => f.name),
        fileSizes: this.selectedFiles.map(f => f.size)
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(formData));
    } catch (error) {
      console.error('Error saving form data to localStorage:', error);
    }
  }

  private saveLoadingState() {
    try {
      localStorage.setItem(this.LOADING_STATE_KEY, JSON.stringify(this.isLoading));
    } catch (error) {
      console.error('Error saving loading state to localStorage:', error);
    }
  }

  onFileSelect(event: any) {
    const files = Array.from(event.target.files) as FileWithPath[];
    // Append new files to existing selection instead of replacing
    this.selectedFiles = [...this.selectedFiles, ...files];
    this.selectedFilesList = [...this.selectedFilesList, ...files];
    console.log('Selected files:', this.selectedFiles);
    // Reset the input so the same file can be selected again if needed
    event.target.value = '';
    this.saveFormData();
    this.saveFilesToIndexedDB();
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
    this.selectedFilesList.splice(index, 1);
    this.saveFormData();
    this.saveFilesToIndexedDB();
  }

  clearAllInputs() {
    // Clear all form inputs
    this.appName = '';
    this.appDescription = '';
    this.appPlatform = 'web';
    this.aiModel = 'gemini';
    this.customPrompt = '';
    this.selectedFiles = [];
    this.selectedFilesList = [];
    this.error = '';
    
    // Clear localStorage
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
    
    // Clear IndexedDB
    if (this.db) {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      store.clear();
    }
    
    // Reset file input
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  startExecution() {
    // Validate required fields
    if (!this.appName) {
      this.error = 'Application name is required';
      return;
    }

    if (this.selectedFiles.length === 0) {
      this.error = 'At least one image file is required';
      return;
    }

    this.isLoading = true;
    this.saveLoadingState();
    this.error = '';

    // Convert files to base64
    this.convertFilesToBase64(this.selectedFilesList).then((base64Images) => {
      const requestData: StartExecutionRequest = {
        image_paths: base64Images, // Now contains base64 encoded image data
        app_name: this.appName,
        app_platform: this.appPlatform,
        ai_model: this.aiModel
      };

      // Add optional fields
      if (this.appDescription) {
        requestData.app_description = this.appDescription;
      }

      if (this.customPrompt) {
        requestData.custom_prompt = this.customPrompt;
      }

      console.log('Sending request with base64 encoded images');
      this.apiService.startExecution(requestData).subscribe({
        next: (response) => {
          console.log('Execution started:', response);
          this.isLoading = false;
          this.saveLoadingState();
          // Navigate to live monitor page
          this.router.navigate(['/monitor', response.execution_id]);
        },
        error: (err) => {
          console.error('Error starting execution:', err);
          this.error = err.error?.detail || 'Failed to start execution';
          this.isLoading = false;
          this.saveLoadingState();
        }
      });
    }).catch((error) => {
      console.error('Error converting files to base64:', error);
      this.error = 'Failed to process images';
      this.isLoading = false;
      this.saveLoadingState();
    });
  }

  /**
   * Convert File objects to base64 encoded strings
   * @param files Array of File objects to convert
   * @returns Promise resolving to array of base64 strings
   */
  private convertFilesToBase64(files: File[]): Promise<string[]> {
    const promises = files.map((file) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = () => {
          const base64String = reader.result as string;
          resolve(base64String);
        };
        
        reader.onerror = (error) => {
          console.error(`Error reading file ${file.name}:`, error);
          reject(error);
        };
        
        // Read file as data URL (includes base64 encoding)
        reader.readAsDataURL(file);
      });
    });

    return Promise.all(promises);
  }

  canStartExecution(): boolean {
    // Start button is enabled when stop button is disabled (i.e., not loading)
    return !this.isLoading;
  }

  stopExecution() {
    // TODO: Implement stop execution logic
    console.log('Stop execution clicked');
  }
}
