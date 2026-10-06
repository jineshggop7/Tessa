import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, ExecutionHistoryItem, ExecutionResult, ExecutionScript } from '../../services/api.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-script-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './script-editor.component.html',
  styleUrl: './script-editor.component.scss'
})
export class ScriptEditorComponent implements OnInit {
  executions: ExecutionHistoryItem[] = [];
  scripts: ExecutionScript[] = [];
  executionId = '';
  appName = '';
  selectedScenarioId = '';
  code = '';
  savedCode = '';
  instruction = '';
  proposedCode = '';
  messages: ChatMessage[] = [];
  result: ExecutionResult | null = null;
  loading = false;
  saving = false;
  editing = false;
  running = false;
  error = '';
  notice = '';

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.executionId = this.route.snapshot.paramMap.get('id') || '';
    this.api.getExecutionHistory(100, 0).subscribe({
      next: response => {
        this.executions = response.executions;
        if (!this.executions.length) {
          this.error = 'No executions found. Run a scenario to generate an editable script.';
          return;
        }
        if (!this.executions.some(item => item.execution_id === this.executionId)) {
          this.executionId = this.executions[0].execution_id;
        }
        this.loadScripts();
      },
      error: err => this.error = err.error?.detail || 'Could not load executions.'
    });
  }

  get hasUnsavedChanges(): boolean {
    return this.code !== this.savedCode;
  }

  get selectedScript(): ExecutionScript | undefined {
    return this.scripts.find(item => item.scenario_id === this.selectedScenarioId);
  }

  selectExecution(id: string): void {
    this.executionId = id;
    this.router.navigate(['/scripts', id], { replaceUrl: true });
    this.selectedScenarioId = '';
    this.loadScripts();
  }

  loadScripts(): void {
    if (!this.executionId) return;
    this.loading = true;
    this.error = '';
    this.api.getExecutionScripts(this.executionId).subscribe({
      next: response => {
        this.appName = response.app_name;
        this.scripts = response.scripts;
        this.loading = false;
        if (this.scripts.length) this.selectScript(this.scripts[0].scenario_id);
        else this.error = 'No generated scripts were found for this execution.';
      },
      error: err => {
        this.loading = false;
        this.error = err.error?.detail || 'Could not load scripts.';
      }
    });
  }

  selectScript(id: string): void {
    const script = this.scripts.find(item => item.scenario_id === id);
    if (!script) return;
    this.selectedScenarioId = id;
    this.code = script.code;
    this.savedCode = script.code;
    this.proposedCode = '';
    this.messages = [];
    this.result = null;
    this.error = '';
    this.notice = '';
  }

  saveScript(): void {
    if (!this.hasUnsavedChanges || this.saving) return;
    this.saving = true;
    this.error = '';
    this.api.saveExecutionScript(this.executionId, this.selectedScenarioId, this.code).subscribe({
      next: () => {
        this.savedCode = this.code;
        this.scripts = this.scripts.map(script => script.scenario_id === this.selectedScenarioId
          ? { ...script, code: this.code }
          : script);
        this.saving = false;
        this.notice = 'Script saved.';
      },
      error: err => {
        this.saving = false;
        this.error = err.error?.detail || 'Could not save script.';
      }
    });
  }

  askTessa(): void {
    const instruction = this.instruction.trim();
    if (!instruction || this.editing) return;
    this.messages.push({ role: 'user', content: instruction });
    this.instruction = '';
    this.editing = true;
    this.error = '';
    this.api.askScriptAssistant(this.executionId, this.selectedScenarioId, this.code, instruction).subscribe({
      next: response => {
        if (response.intent === 'edit' && response.code) {
          this.proposedCode = response.code;
          this.notice = 'Code edit ready for review.';
        }
        this.messages.push({ role: 'assistant', content: response.message });
        this.editing = false;
      },
      error: err => {
        this.error = err.error?.detail || 'Tessa could not edit this script.';
        this.messages.push({ role: 'assistant', content: this.error });
        this.editing = false;
      }
    });
  }

  applyProposal(): void {
    if (!this.proposedCode) return;
    this.code = this.proposedCode;
    this.proposedCode = '';
    this.notice = 'AI proposal applied. Save the script before running it.';
  }

  runScript(): void {
    if (this.hasUnsavedChanges || this.running) return;
    this.running = true;
    this.error = '';
    this.notice = 'Running saved script...';
    this.result = null;
    this.api.executeSavedScript(this.executionId, this.selectedScenarioId).subscribe({
      next: response => {
        this.result = response.result;
        this.running = false;
        this.notice = `Execution finished: ${response.result.result}.`;
      },
      error: err => {
        this.running = false;
        this.notice = '';
        this.error = err.error?.detail || 'Could not execute saved script.';
      }
    });
  }
}