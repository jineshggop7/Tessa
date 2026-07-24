import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { 
  ApiService, 
  ExecutionHistoryItem, 
  TestScenario, 
  ExecutionResult,
  WebSocketMessage 
} from './api.service';

@Injectable({
  providedIn: 'root'
})
export class ExecutionStateService {
  private currentExecutionSubject = new BehaviorSubject<ExecutionHistoryItem | null>(null);
  private testScenariosSubject = new BehaviorSubject<TestScenario[]>([]);
  private executionResultsSubject = new BehaviorSubject<ExecutionResult[]>([]);
  private wsConnectionSubject = new BehaviorSubject<boolean>(false);
  private progressStageSubject = new BehaviorSubject<string>('');
  private logMessagesSubject = new BehaviorSubject<string[]>([]);
  private scenarioLogsSubject = new BehaviorSubject<{ [scenarioId: string]: string[] }>({});
  private scenarioStatusSubject = new BehaviorSubject<{ [scenarioId: string]: string }>({});

  currentExecution$ = this.currentExecutionSubject.asObservable();
  testScenarios$ = this.testScenariosSubject.asObservable();
  executionResults$ = this.executionResultsSubject.asObservable();
  wsConnected$ = this.wsConnectionSubject.asObservable();
  progressStage$ = this.progressStageSubject.asObservable();
  logMessages$ = this.logMessagesSubject.asObservable();
  scenarioLogs$ = this.scenarioLogsSubject.asObservable();
  scenarioStatus$ = this.scenarioStatusSubject.asObservable();

  private ws: any;

  constructor(private apiService: ApiService) {}

  getCurrentExecution(): ExecutionHistoryItem | null {
    return this.currentExecutionSubject.value;
  }

  setCurrentExecution(execution: ExecutionHistoryItem) {
    this.currentExecutionSubject.next(execution);
    this.testScenariosSubject.next(execution.test_scenarios || []);
    this.executionResultsSubject.next(execution.execution_results || []);
  }

  setTestScenarios(scenarios: TestScenario[]) {
    this.testScenariosSubject.next(scenarios);
  }

  addTestScenario(scenario: TestScenario) {
    const current = this.testScenariosSubject.value;
    this.testScenariosSubject.next([...current, scenario]);
  }

  setExecutionResults(results: ExecutionResult[]) {
    this.executionResultsSubject.next(results);
  }

  addExecutionResult(result: ExecutionResult) {
    const current = this.executionResultsSubject.value;
    this.executionResultsSubject.next([...current, result]);
  }

  connectToExecution(executionId: string) {
    this.ws = this.apiService.connectToExecution(executionId);
    
    this.ws.subscribe({
      next: (message: WebSocketMessage) => {
        console.log('WebSocket message:', message);
        this.handleWebSocketMessage(message);
      },
      error: (error: any) => {
        console.error('WebSocket error:', error);
        this.wsConnectionSubject.next(false);
      },
      complete: () => {
        console.log('WebSocket closed');
        this.wsConnectionSubject.next(false);
      }
    });

    this.wsConnectionSubject.next(true);
  }

  disconnectWebSocket() {
    if (this.ws) {
      this.ws.complete();
      this.wsConnectionSubject.next(false);
    }
  }

  private handleWebSocketMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'status':
        // Connection status, execution start/complete/fail
        const currentExec = this.currentExecutionSubject.value;
        if (currentExec && message.data.status) {
          this.currentExecutionSubject.next({
            ...currentExec,
            status: message.data.status,
            summary: message.data.summary || currentExec.summary,
            overall_result: message.data.overall_result || currentExec.overall_result
          });
        }
        this.addLogMessage(`Status: ${message.data.message}`);
        break;

      case 'scenarios_ready':
        // Test scenarios generated and ready for selection
        this.progressStageSubject.next('scenarios_ready');
        this.addLogMessage(`✓ ${message.data.message}`);
        
        if (message.data.scenarios) {
          this.setTestScenarios(message.data.scenarios);
        }
        
        const execReady = this.currentExecutionSubject.value;
        if (execReady) {
          this.currentExecutionSubject.next({
            ...execReady,
            status: 'scenarios_ready',
            test_scenarios: message.data.scenarios || []
          });
        }
        break;

      case 'progress':
        // Stage updates during execution
        this.progressStageSubject.next(message.data.stage);
        this.addLogMessage(`Progress - ${message.data.stage}: ${message.data.message}`);
        
        const exec = this.currentExecutionSubject.value;
        if (exec) {
          this.currentExecutionSubject.next({
            ...exec,
            status: message.data.stage
          });
        }
        break;

      case 'scenario_progress':
        // Progress for specific scenario
        const scenarioId = message.data.scenario_id;
        this.addScenarioLog(scenarioId, `➤ ${message.data.message}`);
        this.updateScenarioStatus(scenarioId, message.data.stage);
        this.addLogMessage(`[${scenarioId}] ${message.data.message}`);
        break;

      case 'scenario_log':
        // Log for specific scenario
        const logScenarioId = message.data.scenario_id;
        this.addScenarioLog(logScenarioId, message.data.message);
        this.addLogMessage(`[${logScenarioId}] ${message.data.message}`);
        break;

      case 'scenario_result':
        // Result for specific scenario
        const resultScenarioId = message.data.scenario_id;
        this.addScenarioLog(resultScenarioId, `${message.data.message}`);
        this.addLogMessage(`[${resultScenarioId}] ${message.data.message}`);
        
        if (message.data.result) {
          // Update existing result or add new one
          const currentResults = this.executionResultsSubject.value;
          const existingIndex = currentResults.findIndex(r => r.scenario_id === message.data.result.scenario_id);
          
          if (existingIndex >= 0) {
            // Update existing result
            currentResults[existingIndex] = message.data.result;
            this.executionResultsSubject.next([...currentResults]);
          } else {
            // Add new result only if it doesn't exist
            this.addExecutionResult(message.data.result);
          }
        }
        
        this.updateScenarioStatus(resultScenarioId, message.data.status || 'completed');
        break;

      case 'log':
        // Detailed execution logs
        this.addLogMessage(`Log - ${message.data.stage}: ${message.data.message}`);
        
        // If scenarios are included in log message, update them
        if (message.data.scenarios) {
          this.setTestScenarios(message.data.scenarios);
        }
        
        // If script path is provided, update execution
        if (message.data.script_path) {
          const execution = this.currentExecutionSubject.value;
          if (execution) {
            const updatedScriptPaths = [...execution.script_paths];
            if (!updatedScriptPaths.includes(message.data.script_path)) {
              updatedScriptPaths.push(message.data.script_path);
              this.currentExecutionSubject.next({
                ...execution,
                script_paths: updatedScriptPaths
              });
            }
          }
        }
        break;

      case 'result':
        // Individual scenario execution results - use update instead of add to avoid duplicates
        this.addLogMessage(`Result - ${message.data.scenario_id}: ${message.data.message}`);
        
        if (message.data.result) {
          // Update existing result or add new one
          const currentResults = this.executionResultsSubject.value;
          const existingIndex = currentResults.findIndex(r => r.scenario_id === message.data.result.scenario_id);
          
          if (existingIndex >= 0) {
            // Update existing result
            currentResults[existingIndex] = message.data.result;
            this.executionResultsSubject.next([...currentResults]);
          } else {
            // Add new result only if it doesn't exist
            this.addExecutionResult(message.data.result);
          }
        }
        break;

      case 'error':
        // Execution errors
        this.addLogMessage(`ERROR: ${message.data.message}`);
        
        const errorExec = this.currentExecutionSubject.value;
        if (errorExec) {
          this.currentExecutionSubject.next({
            ...errorExec,
            status: 'failed'
          });
        }
        break;
    }
  }

  private addScenarioLog(scenarioId: string, message: string) {
    const current = this.scenarioLogsSubject.value;
    const scenarioLogs = current[scenarioId] || [];
    const timestamp = new Date().toLocaleTimeString();
    
    this.scenarioLogsSubject.next({
      ...current,
      [scenarioId]: [...scenarioLogs, `[${timestamp}] ${message}`]
    });
  }

  private updateScenarioStatus(scenarioId: string, status: string) {
    const current = this.scenarioStatusSubject.value;
    this.scenarioStatusSubject.next({
      ...current,
      [scenarioId]: status
    });
  }

  getScenarioLogs(scenarioId: string): string[] {
    return this.scenarioLogsSubject.value[scenarioId] || [];
  }

  getScenarioStatus(scenarioId: string): string {
    return this.scenarioStatusSubject.value[scenarioId] || 'pending';
  }

  private addLogMessage(message: string) {
    const current = this.logMessagesSubject.value;
    const timestamp = new Date().toLocaleTimeString();
    this.logMessagesSubject.next([...current, `[${timestamp}] ${message}`]);
  }

  reset() {
    this.currentExecutionSubject.next(null);
    this.testScenariosSubject.next([]);
    this.executionResultsSubject.next([]);
    this.progressStageSubject.next('');
    this.logMessagesSubject.next([]);
    this.scenarioLogsSubject.next({});
    this.scenarioStatusSubject.next({});
    this.disconnectWebSocket();
  }
}
