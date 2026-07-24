import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, ExecutionHistoryItem, TestScenario, ExecutionResult } from '../../services/api.service';
import { ExecutionStateService } from '../../services/execution-state.service';

@Component({
  selector: 'app-execution-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './execution-progress.component.html',
  styleUrl: './execution-progress.component.scss'
})
export class ExecutionProgressComponent implements OnInit, OnDestroy {
  executionId: string = '';
  execution: ExecutionHistoryItem | null = null;
  testScenarios: TestScenario[] = [];
  executionResults: ExecutionResult[] = [];
  logMessages: string[] = [];
  wsConnected: boolean = false;
  scenarioLogs: { [scenarioId: string]: string[] } = {};
  scenarioStatus: { [scenarioId: string]: string } = {};
  selectedScenarios: Set<string> = new Set();
  showScenariosReady: boolean = false;
  isExecuting: boolean = false;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private stateService: ExecutionStateService
  ) {}

  ngOnInit() {
    this.executionId = this.route.snapshot.params['id'];
    
    // Subscribe to state changes
    this.subscriptions.push(
      this.stateService.currentExecution$.subscribe(exec => {
        this.execution = exec;
        if (exec && exec.status === 'scenarios_ready') {
          this.showScenariosReady = true;
          // Do not auto-select scenarios - let user choose
        }
        if (exec && (exec.status === 'executing' || exec.status === 'completed')) {
          this.isExecuting = exec.status === 'executing';
          this.showScenariosReady = false;
        }
      }),
      this.stateService.testScenarios$.subscribe(scenarios => {
        this.testScenarios = scenarios;
        if (scenarios.length > 0 && this.execution?.status === 'scenarios_ready') {
          this.showScenariosReady = true;
          // Do not auto-select scenarios - let user choose
        }
      }),
      this.stateService.executionResults$.subscribe(results => {
        this.executionResults = results;
      }),
      this.stateService.logMessages$.subscribe(logs => {
        this.logMessages = logs;
      }),
      this.stateService.wsConnected$.subscribe(connected => {
        this.wsConnected = connected;
      }),
      this.stateService.scenarioLogs$.subscribe(logs => {
        this.scenarioLogs = logs;
      }),
      this.stateService.scenarioStatus$.subscribe(status => {
        this.scenarioStatus = status;
      })
    );

    // Connect to WebSocket
    this.stateService.connectToExecution(this.executionId);

    // Load initial data
    this.loadExecutionData();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.stateService.disconnectWebSocket();
  }

  loadExecutionData() {
    this.apiService.getExecutionHistory(100, 0).subscribe({
      next: (response) => {
        const execution = response.executions.find(e => e.execution_id === this.executionId);
        if (execution) {
          this.stateService.setCurrentExecution(execution);
        }
      },
      error: (err) => console.error('Error loading execution:', err)
    });
  }

  viewReport() {
    this.router.navigate(['/report', this.executionId]);
  }

  getStatusIcon(status: string): string {
    const icons: any = {
      'pending': '⏳',
      'started': '🚀',
      'running': '🚀',
      'testcase_generation': '🤖',
      'scenarios_ready': '✅',
      'code_generation': '📝',
      'executing': '⚡',
      'execution': '⚡',
      'completed': '✅',
      'failed': '❌'
    };
    return icons[status] || '❓';
  }

  getStatusText(status: string): string {
    const texts: any = {
      'pending': 'Pending',
      'started': 'Started',
      'running': 'Running',
      'testcase_generation': 'Generating Test Scenarios',
      'scenarios_ready': 'Test Scenarios Ready',
      'code_generation': 'Generating Automation Code',
      'executing': 'Executing Tests',
      'execution': 'Executing Tests',
      'completed': 'Completed',
      'failed': 'Failed'
    };
    return texts[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  getStatusDescription(status: string): string {
    const descriptions: any = {
      'pending': 'Execution is queued and will start soon',
      'started': 'Execution has started',
      'running': 'Execution is in progress',
      'testcase_generation': 'AI Agent 1 is analyzing requirements and generating test scenarios',
      'scenarios_ready': 'Test scenarios have been generated. Please select which ones to execute.',
      'code_generation': 'AI Agent 2 is creating Python automation scripts',
      'executing': 'AI Agent 3 is running automated tests',
      'execution': 'AI Agent 3 is running automated tests',
      'completed': 'All tests have been executed successfully',
      'failed': 'Execution encountered an error'
    };
    return descriptions[status] || '';
  }

  getProgressPercentage(): number {
    if (!this.execution) return 0;
    
    const statusProgress: any = {
      'pending': 0,
      'started': 10,
      'running': 10,
      'testcase_generation': 30,
      'scenarios_ready': 40,
      'code_generation': 60,
      'executing': 80,
      'execution': 80,
      'completed': 100,
      'failed': 100
    };
    
    return statusProgress[this.execution.status] || 0;
  }

  getScenarioStatusIcon(scenarioId: string): string {
    const result = this.getScenarioResult(scenarioId);
    if (!result) return '⏳';
    
    const icons: any = {
      'PASSED': '✅',
      'FAILED': '❌',
      'ERROR': '⚠️'
    };
    return icons[result.result] || '❓';
  }

  getScenarioResult(scenarioId: string): ExecutionResult | null {
    return this.executionResults.find(r => r.scenario_id === scenarioId) || null;
  }

  getPassedCount(): number {
    return this.executionResults.filter(r => r.result === 'PASSED').length;
  }

  getFailedCount(): number {
    return this.executionResults.filter(r => r.result === 'FAILED' || r.result === 'ERROR').length;
  }

  getPendingCount(): number {
    return this.testScenarios.length - this.executionResults.length;
  }

  // Scenario Selection Methods
  toggleScenarioSelection(scenarioId: string) {
    if (this.selectedScenarios.has(scenarioId)) {
      this.selectedScenarios.delete(scenarioId);
    } else {
      this.selectedScenarios.add(scenarioId);
    }
  }

  isScenarioSelected(scenarioId: string): boolean {
    return this.selectedScenarios.has(scenarioId);
  }

  selectAllScenarios() {
    this.testScenarios.forEach(s => this.selectedScenarios.add(s.scenario_id));
  }

  deselectAllScenarios() {
    this.selectedScenarios.clear();
  }

  // Execution Methods
  executeSelectedScenarios() {
    if (this.selectedScenarios.size === 0) {
      alert('Please select at least one test case to execute');
      return;
    }

    this.isExecuting = true;
    this.showScenariosReady = false;

    const scenarioIds = Array.from(this.selectedScenarios);
    this.apiService.executeScenarios({
      execution_id: this.executionId,
      scenario_ids: scenarioIds
    }).subscribe({
      next: (response) => {
        console.log('Execution started:', response);
      },
      error: (err) => {
        console.error('Error starting execution:', err);
        this.isExecuting = false;
        alert('Failed to start execution: ' + (err.error?.detail || err.message));
      }
    });
  }

  executeScenario(scenarioId: string) {
    this.isExecuting = true;
    
    this.apiService.executeScenarios({
      execution_id: this.executionId,
      scenario_ids: [scenarioId]
    }).subscribe({
      next: (response) => {
        console.log('Scenario execution started:', response);
      },
      error: (err) => {
        console.error('Error executing scenario:', err);
        this.isExecuting = false;
        alert('Failed to execute scenario: ' + (err.error?.detail || err.message));
      }
    });
  }

  // Logs Methods
  getScenarioLogs(scenarioId: string): string[] {
    return this.scenarioLogs[scenarioId] || [];
  }

  getScenarioStatusText(scenarioId: string): string {
    const status = this.scenarioStatus[scenarioId] || 'pending';
    const result = this.getScenarioResult(scenarioId);
    
    if (result) {
      return result.result;
    }
    
    const statusTexts: any = {
      'pending': 'Pending',
      'code_generation': 'Generating Code...',
      'execution': 'Executing...',
      'completed': 'Completed',
      'PASSED': 'Passed',
      'FAILED': 'Failed',
      'ERROR': 'Error'
    };
    
    return statusTexts[status] || status;
  }

  getScenarioStatusClass(scenarioId: string): string {
    const status = this.scenarioStatus[scenarioId] || 'pending';
    const result = this.getScenarioResult(scenarioId);
    
    if (result) {
      return 'status-' + result.result.toLowerCase();
    }
    
    return 'status-' + status.replace(/_/g, '-');
  }
}
