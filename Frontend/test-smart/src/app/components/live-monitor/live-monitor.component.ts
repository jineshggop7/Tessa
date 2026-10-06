import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, ExecutionHistoryItem, TestScenario, ExecutionResult, StepScreenshot } from '../../services/api.service';
import { ExecutionStateService } from '../../services/execution-state.service';

@Component({
  selector: 'app-live-monitor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './live-monitor.component.html',
  styleUrl: './live-monitor.component.scss'
})
export class LiveMonitorComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('logsContainer') private logsContainer?: ElementRef;
  
  executionId: string = '';
  execution: ExecutionHistoryItem | null = null;
  testScenarios: TestScenario[] = [];
  executionResults: ExecutionResult[] = [];
  logMessages: string[] = [];
  scenarioLogs: { [scenarioId: string]: string[] } = {};
  scenarioStatus: { [scenarioId: string]: string } = {};
  wsConnected: boolean = false;
  
  selectedScenarios: Set<string> = new Set();
  showScenariosReady: boolean = false;
  isExecuting: boolean = false;
  autoScroll: boolean = true;
  activeTab: 'testcases' | 'logs' | 'results' = 'testcases';
  selectedScenarioForLogs: string | null = null;
  editingScenarioId: string | null = null;
  editedSteps: { [scenarioId: string]: any[] } = {};
  expandedResult: ExecutionResult | null = null;
  screenshotScenarioId: string | null = null;
  stepScreenshots: StepScreenshot[] = [];
  screenshotsLoading = false;
  screenshotsError = '';
  
  private subscriptions: Subscription[] = [];
  private shouldScrollToBottom = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private stateService: ExecutionStateService
  ) {}

  ngOnInit() {
    // Subscribe to route parameter changes
    this.subscriptions.push(
      this.route.params.subscribe(params => {
        const newExecutionId = params['id'];
        
        // Only reset and reload if execution ID actually changed
        if (newExecutionId !== this.executionId) {
          this.executionId = newExecutionId;
          
          // Clear any previous execution state
          this.stateService.reset();
          
          // Unsubscribe from old subscriptions to WebSocket
          this.stateService.disconnectWebSocket();
          
          // If 'current' is passed, try to find the most recent execution
          if (this.executionId === 'current') {
            const currentExecution = this.stateService.getCurrentExecution();
            if (currentExecution) {
              this.executionId = currentExecution.execution_id;
              // Update URL without navigation
              this.router.navigate(['/monitor', this.executionId], { replaceUrl: true });
            } else {
              // Load most recent execution
              this.loadMostRecentExecution();
              return;
            }
          }
          
          // Connect to new execution WebSocket
          this.stateService.connectToExecution(this.executionId);
          
          // Load initial data for new execution
          this.loadExecutionData();
        }
      })
    );
    
    // Subscribe to state changes
    this.subscriptions.push(
      this.stateService.currentExecution$.subscribe(exec => {
        this.execution = exec;
        if (exec && exec.status === 'scenarios_ready') {
          this.showScenariosReady = true;
          this.activeTab = 'testcases';
          // Do not auto-select scenarios - let user choose
        }
        if (exec && (exec.status === 'executing' || exec.status === 'completed')) {
          this.isExecuting = exec.status === 'executing';
          this.showScenariosReady = false;
          if (exec.status === 'executing') {
            this.activeTab = 'logs';
          }
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
        this.shouldScrollToBottom = this.autoScroll;
      }),
      
      this.stateService.wsConnected$.subscribe(connected => {
        this.wsConnected = connected;
      }),
      
      this.stateService.scenarioLogs$.subscribe(logs => {
        this.scenarioLogs = logs;
        this.shouldScrollToBottom = this.autoScroll;
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

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
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

  loadMostRecentExecution() {
    this.apiService.getExecutionHistory(1, 0).subscribe({
      next: (response) => {
        if (response.executions.length > 0) {
          this.executionId = response.executions[0].execution_id;
          this.router.navigate(['/monitor', this.executionId], { replaceUrl: true });
          this.stateService.setCurrentExecution(response.executions[0]);
          this.stateService.connectToExecution(this.executionId);
        } else {
          // No executions found
          this.router.navigate(['/start']);
        }
      },
      error: (err) => {
        console.error('Error loading recent execution:', err);
        this.router.navigate(['/start']);
      }
    });
  }

  scrollToBottom() {
    if (this.logsContainer && this.autoScroll) {
      try {
        this.logsContainer.nativeElement.scrollTop = this.logsContainer.nativeElement.scrollHeight;
      } catch (err) { }
    }
  }

  // Test Case Selection
  toggleScenarioSelection(scenarioId: string) {
    if (this.selectedScenarios.has(scenarioId)) {
      this.selectedScenarios.delete(scenarioId);
    } else {
      this.selectedScenarios.add(scenarioId);
    }
  }

  selectAllScenarios() {
    this.testScenarios.forEach(s => this.selectedScenarios.add(s.scenario_id));
  }

  deselectAllScenarios() {
    this.selectedScenarios.clear();
  }

  isScenarioSelected(scenarioId: string): boolean {
    return this.selectedScenarios.has(scenarioId);
  }

  // Execution
  executeSelectedScenarios() {
    if (this.selectedScenarios.size === 0) {
      alert('Please select at least one test case to execute');
      return;
    }

    this.isExecuting = true;
    this.showScenariosReady = false;
    this.activeTab = 'logs';

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
    this.activeTab = 'logs';
    this.selectedScenarioForLogs = scenarioId;
    
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

  executeNextPending() {
    const pendingScenario = this.testScenarios.find(s => 
      !this.executionResults.some(r => r.scenario_id === s.scenario_id)
    );
    
    if (pendingScenario) {
      this.executeScenario(pendingScenario.scenario_id);
    }
  }

  // Status helpers
  getScenarioResult(scenarioId: string): ExecutionResult | null {
    return this.executionResults.find(r => r.scenario_id === scenarioId) || null;
  }

  getScenarioStatusText(scenarioId: string): string {
    const status = this.scenarioStatus[scenarioId] || 'pending';
    const result = this.getScenarioResult(scenarioId);
    
    if (result) return result.result;
    
    const statusTexts: any = {
      'pending': 'Pending',
      'code_generation': 'Generating...',
      'execution': 'Running...',
    };
    
    return statusTexts[status] || status;
  }

  getScenarioStatusIcon(scenarioId: string): string {
    const result = this.getScenarioResult(scenarioId);
    if (result) {
      return result.result === 'PASSED' ? '✅' : result.result === 'FAILED' ? '❌' : '⚠️';
    }
    
    const status = this.scenarioStatus[scenarioId];
    if (status === 'execution') return '⚡';
    if (status === 'code_generation') return '📝';
    
    return '⏳';
  }

  getScenarioLogs(scenarioId: string): string[] {
    return this.scenarioLogs[scenarioId] || [];
  }

  hasAnyScenarioLogs(): boolean {
    return this.testScenarios.some(s => this.getScenarioLogs(s.scenario_id).length > 0);
  }

  // Stats
  getTotalScenarios(): number {
    return this.testScenarios.length;
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

  getRunningCount(): number {
    return Object.values(this.scenarioStatus).filter(s => s === 'execution' || s === 'code_generation').length;
  }

  // View helpers
  switchTab(tab: 'testcases' | 'logs' | 'results') {
    this.activeTab = tab;
    if (tab === 'logs') {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  viewScenarioLogs(scenarioId: string) {
    this.selectedScenarioForLogs = scenarioId;
    this.activeTab = 'logs';
  }

  openExpandedResult(result: ExecutionResult) {
    this.expandedResult = result;
  }

  closeExpandedResult() {
    this.expandedResult = null;
  }

  openStepScreenshots(scenarioId: string) {
    this.screenshotScenarioId = scenarioId;
    this.stepScreenshots = [];
    this.screenshotsError = '';
    this.screenshotsLoading = true;
    this.apiService.getScenarioScreenshots(this.executionId, scenarioId).subscribe({
      next: response => {
        this.stepScreenshots = response.screenshots || [];
        this.screenshotsLoading = false;
      },
      error: error => {
        this.screenshotsError = error.error?.detail || 'Could not load step screenshots.';
        this.screenshotsLoading = false;
      }
    });
  }

  closeStepScreenshots() {
    this.screenshotScenarioId = null;
    this.stepScreenshots = [];
    this.screenshotsError = '';
  }

  getStepScreenshotUrl(filename: string): string {
    return this.apiService.getScenarioScreenshotUrl(
      this.executionId,
      this.screenshotScenarioId || '',
      filename
    );
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    this.closeExpandedResult();
  }

  // Step editing methods
  startEditingSteps(scenarioId: string, steps: any[]) {
    this.editingScenarioId = scenarioId;
    this.editedSteps[scenarioId] = JSON.parse(JSON.stringify(steps)); // Deep copy
  }

  cancelEditingSteps() {
    if (this.editingScenarioId) {
      delete this.editedSteps[this.editingScenarioId];
    }
    this.editingScenarioId = null;
  }

  saveEditedSteps(scenarioId: string) {
    // Find the scenario and update its steps
    const scenario = this.testScenarios.find(s => s.scenario_id === scenarioId);
    if (scenario) {
      scenario.test_steps = this.editedSteps[scenarioId] || scenario.test_steps;
    }
    delete this.editedSteps[scenarioId];
    this.editingScenarioId = null;
  }

  updateStepAction(scenarioId: string, stepIndex: number, newAction: string) {
    if (!this.editedSteps[scenarioId]) {
      this.editedSteps[scenarioId] = this.testScenarios.find(s => s.scenario_id === scenarioId)?.test_steps || [];
    }
    if (this.editedSteps[scenarioId][stepIndex]) {
      this.editedSteps[scenarioId][stepIndex].action = newAction;
    }
  }

  updateStepExpectedResult(scenarioId: string, stepIndex: number, newResult: string) {
    if (!this.editedSteps[scenarioId]) {
      this.editedSteps[scenarioId] = this.testScenarios.find(s => s.scenario_id === scenarioId)?.test_steps || [];
    }
    if (this.editedSteps[scenarioId][stepIndex]) {
      this.editedSteps[scenarioId][stepIndex].expected_result = newResult;
    }
  }

  getDisplaySteps(scenarioId: string): any[] {
    return this.editedSteps[scenarioId] || this.testScenarios.find(s => s.scenario_id === scenarioId)?.test_steps || [];
  }

  toggleAutoScroll() {
    this.autoScroll = !this.autoScroll;
    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }

  viewFullReport() {
    this.router.navigate(['/report', this.executionId]);
  }

  backToList() {
    this.router.navigate(['/executions']);
  }

  copyExecutionId() {
    navigator.clipboard.writeText(this.executionId).then(() => {
      alert('Execution ID copied to clipboard! You can use this in Tessa chatbot.');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }
}
