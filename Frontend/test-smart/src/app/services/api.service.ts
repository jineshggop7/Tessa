import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
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

export interface WebSocketMessage {
  type: string;
  execution_id: string;
  data: any;
  timestamp: string;
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
    );
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
