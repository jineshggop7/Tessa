import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService, ExecutionHistoryItem } from '../../services/api.service';

@Component({
  selector: 'app-executions-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './executions-list.component.html',
  styleUrl: './executions-list.component.scss'
})
export class ExecutionsListComponent implements OnInit {
  executions: ExecutionHistoryItem[] = [];
  loading = true;
  error: string | null = null;
  expandedSummaries = new Set<string>();

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadExecutions();
  }

  loadExecutions() {
    this.loading = true;
    this.error = null;

    this.apiService.getExecutionHistory(50, 0).subscribe({
      next: (response) => {
        this.executions = response.executions;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load executions';
        this.loading = false;
        console.error('Error loading executions:', err);
      }
    });
  }

  viewProgress(executionId: string) {
    this.router.navigate(['/execution', executionId]);
  }

  viewMonitor(executionId: string) {
    this.router.navigate(['/monitor', executionId]);
  }

  copyToClipboard(text: string, event: Event) {
    event.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      alert('Full Execution ID copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy ID');
    });
  }

  viewReport(executionId: string) {
    this.router.navigate(['/report', executionId]);
  }

  rerunExecution(execution: ExecutionHistoryItem) {
    if (confirm(`Rerun execution for ${execution.app_name}?`)) {
      this.apiService.rerunExecution({
        execution_id: execution.execution_id
      }).subscribe({
        next: (response) => {
          console.log('Rerun started:', response);
          this.router.navigate(['/execution', response.execution_id]);
        },
        error: (err) => {
          console.error('Error rerunning execution:', err);
          alert('Failed to rerun execution');
        }
      });
    }
  }

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'status-pending',
      'running': 'status-running',
      'started': 'status-running',
      'testcase_generation': 'status-running',
      'code_generation': 'status-running',
      'execution': 'status-running',
      'completed': 'status-completed',
      'failed': 'status-failed',
      'error': 'status-failed'
    };
    return statusMap[status.toLowerCase()] || 'status-pending';
  }

  getStatusText(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getSuccessRate(execution: ExecutionHistoryItem): number {
    if (!execution.execution_results || execution.execution_results.length === 0) {
      return 0;
    }
    const passed = execution.execution_results.filter(r => r.result === 'PASSED').length;
    return Math.round((passed / execution.execution_results.length) * 100);
  }

  getTotalScenarios(execution: ExecutionHistoryItem): number {
    return execution.test_scenarios?.length || 0;
  }

  getPassedCount(execution: ExecutionHistoryItem): number {
    return execution.execution_results?.filter(r => r.result === 'PASSED').length || 0;
  }

  getFailedCount(execution: ExecutionHistoryItem): number {
    return execution.execution_results?.filter(r => r.result === 'FAILED' || r.result === 'ERROR').length || 0;
  }

  toggleSummary(execution: ExecutionHistoryItem) {
    if (this.expandedSummaries.has(execution.execution_id)) {
      this.expandedSummaries.delete(execution.execution_id);
    } else {
      this.expandedSummaries.add(execution.execution_id);
    }
  }

  isSummaryExpanded(execution: ExecutionHistoryItem): boolean {
    return this.expandedSummaries.has(execution.execution_id);
  }

  isExecutionInProgress(status: string): boolean {
    const inProgressStatuses = ['pending', 'running', 'started', 'testcase_generation', 'code_generation', 'execution'];
    return inProgressStatuses.includes(status.toLowerCase());
  }
}
