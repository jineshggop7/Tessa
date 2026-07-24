import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService, ExecutionHistoryItem, ExecutionResult } from '../../services/api.service';

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './report.component.html',
  styleUrl: './report.component.scss'
})
export class ReportComponent implements OnInit {
  executionId: string = '';
  execution: ExecutionHistoryItem | null = null;
  loading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.executionId = this.route.snapshot.params['id'];
    this.loadReport();
  }

  copyExecutionId() {
    navigator.clipboard.writeText(this.executionId).then(() => {
      alert('Full Execution ID copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  loadReport() {
    this.loading = true;
    this.apiService.getExecutionHistory(100, 0).subscribe({
      next: (response) => {
        const execution = response.executions.find(e => e.execution_id === this.executionId);
        if (execution) {
          this.execution = execution;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading report:', err);
        this.loading = false;
      }
    });
  }

  getStatusIcon(status: string): string {
    const icons: any = {
      'PASSED': '✅',
      'FAILED': '❌',
      'ERROR': '⚠️'
    };
    return icons[status] || '❓';
  }

  getPassedCount(): number {
    if (!this.execution) return 0;
    return this.execution.execution_results?.filter(r => r.result === 'PASSED').length || 0;
  }

  getFailedCount(): number {
    if (!this.execution) return 0;
    return this.execution.execution_results?.filter(r => r.result === 'FAILED' || r.result === 'ERROR').length || 0;
  }

  getTotalCount(): number {
    return this.execution?.execution_results?.length || 0;
  }

  getSuccessRate(): number {
    const total = this.getTotalCount();
    if (total === 0) return 0;
    return Math.round((this.getPassedCount() / total) * 100);
  }

  downloadReport() {
    if (!this.execution) return;
    
    const reportData = JSON.stringify(this.execution, null, 2);
    const blob = new Blob([reportData], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `test-report-${this.executionId}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  goBack() {
    window.history.back();
  }
}
