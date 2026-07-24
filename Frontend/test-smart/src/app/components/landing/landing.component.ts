import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements OnInit {
  heroDescription = '';
  private fullDescription = 'TESSA is a unified end-to-end automation platform for testing everything from first trigger to final validation. Our 4-agent system generates test cases, writes code, executes tests, and provides intelligent insights.';

  features = [
    {
      icon: '🤖',
      title: 'AI Test Case Generator',
      description: 'Automatically generates comprehensive test scenarios and steps based on your application screenshots and descriptions.',
      color: '#2196f3'
    },
    {
      icon: '⚡',
      title: 'Smart Code Generation',
      description: 'Transforms test scenarios into executable Selenium Python code automatically with best practices built-in.',
      color: '#4caf50'
    },
    {
      icon: '🎯',
      title: 'Intelligent Executor',
      description: 'Executes test scenarios and provides AI-powered summaries, results, and detailed observations for each run.',
      color: '#ff9800'
    },
    {
      icon: '💬',
      title: 'Tessa - AI Assistant',
      description: 'Your personal AI chatbot with complete awareness of test steps, code, execution details, and results.',
      color: '#9c27b0'
    },
    {
      icon: '🔄',
      title: 'Real-time Updates',
      description: 'Live WebSocket connection provides instant status updates and detailed logs during test execution.',
      color: '#00bcd4'
    },
    {
      icon: '📊',
      title: 'Execution History',
      description: 'Complete history tracking with MongoDB storage. Review, analyze, and rerun previous executions effortlessly.',
      color: '#f44336'
    },
    {
      icon: '🎨',
      title: 'Multi-Model Support',
      description: 'Choose between Gemini, GPT, and other AI models for each agent based on your requirements.',
      color: '#673ab7'
    },
    {
      icon: '🔁',
      title: 'Smart Rerun',
      description: 'Rerun executions with original or modified parameters. Update images, prompts, or configurations easily.',
      color: '#607d8b'
    }
  ];

  constructor(private router: Router) {}

  ngOnInit() {
    this.typeDescription();
  }

  async typeDescription() {
    for (let i = 0; i <= this.fullDescription.length; i++) {
      this.heroDescription = this.fullDescription.substring(0, i);
      await this.delay(30);
    }
  }

  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  navigateToStart() {
    this.router.navigate(['/start']);
  }
}
