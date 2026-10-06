import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, AskTessaRequest } from '../../services/api.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
  displayedContent?: string;
}

@Component({
  selector: 'app-tessa-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tessa-chatbot.component.html',
  styleUrl: './tessa-chatbot.component.scss'
})
export class TessaChatbotComponent implements OnInit {
  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [];
  currentMessage: string = '';
  isLoading: boolean = false;
  executionId: string = '';
  aiModel: string = 'gemini';
  isLoadingExecutionId: boolean = false;
  
  aiModels = ['gemini', 'gpt', 'openai', 'gpt-4'];

  constructor(
    private apiService: ApiService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    // Load chat history from localStorage only in browser
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('tessa_messages');
      if (saved) {
        this.messages = JSON.parse(saved).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        this.scrollToBottom();
      }

      const savedAiModel = localStorage.getItem('tessa_ai_model');
      if (savedAiModel) {
        this.aiModel = savedAiModel;
      }

      // Always load the latest execution ID on initialization
      this.loadLatestExecutionId();
    }
  }

  loadLatestExecutionId() {
    this.isLoadingExecutionId = true;
    // Fetch the most recent execution and set it as default
    this.apiService.getExecutionHistory(1, 0).subscribe({
      next: (response) => {
        if (response.executions && response.executions.length > 0) {
          const latestExecution = response.executions[0];
          this.executionId = latestExecution.execution_id;
          this.setExecutionId(); // Save to localStorage
          console.log('Auto-loaded latest execution ID:', this.executionId);
        } else {
          console.warn('No executions found to auto-load');
        }
        this.isLoadingExecutionId = false;
      },
      error: (err) => {
        console.error('Failed to load latest execution ID:', err);
        // Try to load from localStorage as fallback
        const savedExecutionId = localStorage.getItem('tessa_execution_id');
        if (savedExecutionId) {
          this.executionId = savedExecutionId;
          console.log('Using saved execution ID as fallback:', this.executionId);
        }
        this.isLoadingExecutionId = false;
      }
    });
  }

  setExecutionId() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('tessa_execution_id', this.executionId);
    }
  }

  setAiModel() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('tessa_ai_model', this.aiModel);
    }
  }

  sendMessage() {
    if (!this.currentMessage.trim() || this.isLoading) return;

    if (!this.executionId.trim()) {
      alert('Please enter an Execution ID first');
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: this.currentMessage.trim(),
      timestamp: new Date()
    };

    this.messages.push(userMessage);
    this.saveMessages();

    const question = this.currentMessage;
    this.currentMessage = '';
    this.isLoading = true;

    const request: AskTessaRequest = {
      execution_id: this.executionId,
      message: question,
      ai_model: this.aiModel
    };

    this.apiService.askTessa(request).subscribe({
      next: (response) => {
        // Create typing message
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.response,
          timestamp: new Date(response.timestamp),
          isTyping: true,
          displayedContent: ''
        };
        this.messages.push(assistantMessage);
        this.saveMessages();
        this.isLoading = false;
        
        // Start typing animation
        this.animateTyping(assistantMessage);
      },
      error: (err) => {
        console.error('Error asking Tessa:', err);
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: err.error?.detail || 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
          isTyping: true,
          displayedContent: ''
        };
        this.messages.push(errorMessage);
        this.saveMessages();
        this.isLoading = false;
        
        // Start typing animation for error message too
        this.animateTyping(errorMessage);
      }
    });

    this.scrollToBottom();
  }

  clearConversation() {
    if (confirm('Are you sure you want to clear the conversation?')) {
      this.messages = [];
      if (isPlatformBrowser(this.platformId)) {
        localStorage.removeItem('tessa_messages');
      }
    }
  }

  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private saveMessages() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('tessa_messages', JSON.stringify(this.messages));
    }
  }

  animateTyping(message: ChatMessage) {
    const fullText = message.content;
    let currentIndex = 0;
    
    // Calculate dynamic typing speed based on content length
    const contentLength = fullText.length;
    let baseSpeed: number;
    
    if (contentLength < 100) {
      baseSpeed = 50; // Slower for short responses (more natural)
    } else if (contentLength < 500) {
      baseSpeed = 30; // Medium speed for normal responses
    } else {
      baseSpeed = 20; // Faster for long responses (efficiency)
    }
    
    const typeNextChar = () => {
      if (currentIndex < fullText.length) {
        message.displayedContent = fullText.substring(0, currentIndex + 1);
        currentIndex++;
        
        // Save messages on each character for persistence
        this.saveMessages();
        
        // Auto-scroll during typing to keep latest content visible
        this.scrollToBottom();
        
        // Schedule next character with slight randomization for more natural feel
        const delay = baseSpeed + (Math.random() * 10 - 5); // ±5ms variation
        setTimeout(typeNextChar, delay);
      } else {
        // Typing complete
        message.isTyping = false;
        message.displayedContent = fullText;
        this.saveMessages();
        this.scrollToBottom();
      }
    };
    
    // Start typing animation
    typeNextChar();
  }

  private scrollToBottom() {
    if (!isPlatformBrowser(this.platformId)) return;

    requestAnimationFrame(() => {
      const container = this.messagesContainer?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }
}
