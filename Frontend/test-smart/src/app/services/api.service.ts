import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { environment } from '../../environments/environment';

// Request Models
export interface StartExecutionRequest {
  image_paths: string[];
  custom_prompt?: string;
  app_description?: string;
  app_name: string;
  app_platform: string;
  ai_model: string;
}

export interface AskTessaRequest {
  execution_id: string;
  message: string;
  ai_model: string;
}

export interface RerunExecutionRequest {
  execution_id: string;
  image_paths?: string[];
  custom_prompt?: string;
  app_description?: string;
  ai_model?: string;
}

export interface ExecuteScenariosRequest {
  execution_id: string;
  scenario_ids: string[];
}

// Response Models
export interface StartExecutionResponse {
  execution_id: string;
  status: string;
  message: string;
}

export interface AskTessaResponse {
  response: string;
  timestamp: string;
}

export interface RerunExecutionResponse {
  execution_id: string;
  status: string;
  message: string;
}

export interface ExecuteScenariosResponse {
  execution_id: string;
  status: string;
  message: string;
  scenarios_count: number;
}

export interface ExecutionHistoryResponse {
  executions: ExecutionHistoryItem[];
  total: number;
}

export interface ExecutionHistoryItem {
  id: string;
  execution_id: string;
  app_name: string;
  app_description?: string;
  app_platform: string;
  ai_model: string;
  custom_prompt?: string;
  image_paths: string[];
  script_paths: string[];
  summary?: string;
  overall_result?: string;
  observation?: string;
  created_at: string;
  status: string;
  test_scenarios: TestScenario[];
  execution_results: ExecutionResult[];
}

export interface TestScenario {
  scenario_id: string;
  scenario_name: string;
  description: string;
  priority: string;
  test_steps: TestStep[];
}

export interface TestStep {
  step_number: number;
  action: string;
  expected_result: string;
}

export interface ExecutionResult {
  scenario_id: string;
  scenario_name: string;
  summary: string;
  result: string;
  observation: string;
  execution_details: {
    success: boolean;
    stdout: string;
    stderr: string;
    returncode: number;
  };
}

export interface ExecutionScript {
  scenario_id: string;
  scenario_name: string;
  code: string;
}

export interface ExecutionScriptsResponse {
  execution_id: string;
  app_name: string;
  ai_model: string;
  scripts: ExecutionScript[];
}

export interface ScriptExecutionResponse {
  result: ExecutionResult;
  overall_result: string;
}

export interface StepScreenshot {
  filename: string;
  label: string;
}

export interface ScriptAssistantResponse {
  intent: 'answer' | 'edit';
  message: string;
  code?: string;
}

export interface WebSocketMessage {
  type: string;
  execution_id: string;
  data: any;
  timestamp: string;
}

function formatDisplayText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map(formatDisplayText).filter(Boolean).join('\n');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const label = key.replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
        const text = formatDisplayText(item);
        return text ? `${label}: ${text}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

export function normalizeExecutionResult(result: ExecutionResult): ExecutionResult {
  const summary = formatDisplayText(result.summary).replace(/^\s*(?:\*\*\s*)?Summary\s*:\s*(?:\*\*\s*)?/i, '');
  return {
    ...result,
    summary,
    observation: formatDisplayText(result.observation)
  };
}

function normalizeExecution(execution: ExecutionHistoryItem): ExecutionHistoryItem {
  return {
    ...execution,
    execution_results: (execution.execution_results || []).map(normalizeExecutionResult)
  };
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;
  private wsUrl = environment.wsUrl;

  constructor(private http: HttpClient) {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;

      if (environment.apiUrl.includes('localhost') || environment.apiUrl.includes('127.0.0.1')) {
        this.baseUrl = `http://${hostname}:8000`;
      }
      if (environment.wsUrl.includes('localhost') || environment.wsUrl.includes('127.0.0.1')) {
        this.wsUrl = `ws://${hostname}:8000`;
      }
    }
  }

  // API 1: Start Execution
  startExecution(data: StartExecutionRequest): Observable<StartExecutionResponse> {
    return this.http.post<StartExecutionResponse>(
      `${this.baseUrl}/api/start-execution`,
      data
    );
  }

  // API 2: Ask Tessa (Chatbot)
  askTessa(data: AskTessaRequest): Observable<AskTessaResponse> {
    return this.http.post<AskTessaResponse>(
      `${this.baseUrl}/api/ask-tessa`,
      data
    );
  }

  // API 3: Get Execution History
  getExecutionHistory(limit: number = 50, skip: number = 0): Observable<ExecutionHistoryResponse> {
    return this.http.get<ExecutionHistoryResponse>(
      `${this.baseUrl}/api/execution-history`,
      { params: { limit: limit.toString(), skip: skip.toString() } }
    ).pipe(map(response => ({
      ...response,
      executions: (response.executions || []).map(normalizeExecution)
    })));
  }

  // API 4: Rerun Execution
  rerunExecution(data: RerunExecutionRequest): Observable<RerunExecutionResponse> {
    return this.http.post<RerunExecutionResponse>(
      `${this.baseUrl}/api/rerun-execution`,
      data
    );
  }

  // API 5: Execute Selected Scenarios
  executeScenarios(data: ExecuteScenariosRequest): Observable<ExecuteScenariosResponse> {
    return this.http.post<ExecuteScenariosResponse>(
      `${this.baseUrl}/api/execute-scenarios`,
      data
    );
  }

  getExecutionScripts(executionId: string): Observable<ExecutionScriptsResponse> {
    return this.http.get<ExecutionScriptsResponse>(
      `${this.baseUrl}/api/executions/${encodeURIComponent(executionId)}/scripts`
    );
  }

  saveExecutionScript(executionId: string, scenarioId: string, code: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.baseUrl}/api/executions/${encodeURIComponent(executionId)}/scripts/${encodeURIComponent(scenarioId)}`,
      { code }
    );
  }

  aiEditExecutionScript(executionId: string, scenarioId: string, code: string, instruction: string): Observable<{ code: string }> {
    return this.http.post<{ code: string }>(
      `${this.baseUrl}/api/executions/${encodeURIComponent(executionId)}/scripts/${encodeURIComponent(scenarioId)}/ai-edit`,
      { code, instruction }
    );
  }

  askScriptAssistant(executionId: string, scenarioId: string, code: string, message: string): Observable<ScriptAssistantResponse> {
    return this.http.post<ScriptAssistantResponse>(
      `${this.baseUrl}/api/executions/${encodeURIComponent(executionId)}/scripts/${encodeURIComponent(scenarioId)}/assistant`,
      { code, message }
    );
  }

  executeSavedScript(executionId: string, scenarioId: string): Observable<ScriptExecutionResponse> {
    return this.http.post<ScriptExecutionResponse>(
      `${this.baseUrl}/api/executions/${encodeURIComponent(executionId)}/scripts/${encodeURIComponent(scenarioId)}/execute`,
      {}
    );
  }

  getScenarioScreenshots(executionId: string, scenarioId: string): Observable<{ screenshots: StepScreenshot[] }> {
    return this.http.get<{ screenshots: StepScreenshot[] }>(
      `${this.baseUrl}/api/executions/${encodeURIComponent(executionId)}/scenarios/${encodeURIComponent(scenarioId)}/screenshots`
    );
  }

  getScenarioScreenshotUrl(executionId: string, scenarioId: string, filename: string): string {
    return `${this.baseUrl}/api/executions/${encodeURIComponent(executionId)}/scenarios/${encodeURIComponent(scenarioId)}/screenshots/${encodeURIComponent(filename)}`;
  }

  // WebSocket Connection
  connectToExecution(executionId: string): WebSocketSubject<WebSocketMessage> {
    return webSocket<WebSocketMessage>(
      `${this.wsUrl}/ws/${executionId}`
    );
  }

  // Health Check
  healthCheck(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(`${this.baseUrl}/health`);
  }
}
