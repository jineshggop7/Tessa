import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ExecutionHistoryItem } from '../../services/api.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics-dashboard.component.html',
  styleUrl: './analytics-dashboard.component.scss'
})
export class AnalyticsDashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('lineChart') lineChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieChart') pieChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('barChart') barChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('barChart2') barChart2Ref!: ElementRef<HTMLCanvasElement>;

  isLoading: boolean = false;
  error: string = '';
  executionHistory: ExecutionHistoryItem[] = [];

  // Date filtering
  startDate: string = '';
  endDate: string = '';
  filteredHistory: ExecutionHistoryItem[] = [];

  // Summary stats
  totalExecutions: number = 0;
  successRate: number = 0;
  avgTestScenarios: number = 0;
  totalTestCases: number = 0;

  private charts: Chart[] = [];

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.setDefaultDateRange();
    this.loadAnalyticsData();
  }

  ngAfterViewInit() {
    // Charts will be initialized after data is loaded
  }

  setDefaultDateRange() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30); // Last 30 days by default

    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];
  }

  loadAnalyticsData() {
    this.isLoading = true;
    this.error = '';

    this.apiService.getExecutionHistory(1000, 0).subscribe({ // Load more data for better analytics
      next: (response) => {
        this.executionHistory = response.executions;
        this.applyDateFilter();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading analytics data:', err);
        this.error = err.error?.detail || 'Failed to load analytics data';
        this.isLoading = false;
      }
    });
  }

  applyDateFilter() {
    if (!this.startDate || !this.endDate) {
      this.filteredHistory = [...this.executionHistory];
    } else {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end date

      this.filteredHistory = this.executionHistory.filter(exec => {
        const execDate = new Date(exec.created_at);
        return execDate >= start && execDate <= end;
      });
    }

    this.calculateStats();
    this.destroyCharts(); // Destroy existing charts before creating new ones
    this.initializeCharts();
  }

  clearDateFilter() {
    this.setDefaultDateRange();
    this.applyDateFilter();
  }

  refreshData() {
    this.destroyCharts();
    this.loadAnalyticsData();
  }

  calculateStats() {
    const data = this.filteredHistory;
    this.totalExecutions = data.length;

    if (this.totalExecutions === 0) {
      this.successRate = 0;
      this.avgTestScenarios = 0;
      this.totalTestCases = 0;
      return;
    }

    // Calculate success rate
    const successfulExecutions = data.filter(
      exec => exec.overall_result?.toLowerCase() === 'passed' || exec.status === 'completed'
    ).length;
    this.successRate = Math.round((successfulExecutions / this.totalExecutions) * 100);

    // Calculate average test scenarios
    const totalScenarios = data.reduce(
      (sum, exec) => sum + (exec.test_scenarios?.length || 0), 0
    );
    this.avgTestScenarios = Math.round(totalScenarios / this.totalExecutions);

    // Calculate total test cases
    this.totalTestCases = data.reduce(
      (sum, exec) => sum + (exec.execution_results?.length || 0), 0
    );
  }

  initializeCharts() {
    setTimeout(() => {
      if (this.lineChartRef && this.pieChartRef && this.barChartRef && this.barChart2Ref) {
        this.createLineChart();
        this.createPieChart();
        this.createBarChart();
        this.createBarChart2();
      }
    }, 200); // Increased delay to ensure DOM is ready
  }

  createLineChart() {
    const ctx = this.lineChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, this.lineChartRef.nativeElement.width, this.lineChartRef.nativeElement.height);

    const data = this.filteredHistory;

    // Group executions by date
    const dateMap = new Map<string, { total: number, passed: number, failed: number }>();

    data.forEach(exec => {
      const date = new Date(exec.created_at).toISOString().split('T')[0]; // Use YYYY-MM-DD format
      if (!dateMap.has(date)) {
        dateMap.set(date, { total: 0, passed: 0, failed: 0 });
      }
      const stats = dateMap.get(date)!;
      stats.total++;
      if (exec.overall_result?.toLowerCase() === 'passed' || exec.status === 'completed') {
        stats.passed++;
      } else {
        stats.failed++;
      }
    });

    // Sort dates and limit based on dataset size
    const sortedDates = Array.from(dateMap.keys()).sort();
    const maxPoints = Math.min(sortedDates.length, 30); // Show up to 30 data points
    const step = Math.max(1, Math.floor(sortedDates.length / maxPoints));
    const displayDates = sortedDates.filter((_, index) => index % step === 0);

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: displayDates.map(date => {
          const d = new Date(date);
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }),
        datasets: [
          {
            label: 'Passed',
            data: displayDates.map(date => dateMap.get(date)!.passed),
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 5
          },
          {
            label: 'Failed',
            data: displayDates.map(date => dateMap.get(date)!.failed),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          title: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              title: (context) => {
                const dateIndex = context[0].dataIndex;
                const fullDate = displayDates[dateIndex];
                return new Date(fullDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Date'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 0
            }
          },
          y: {
            beginAtZero: true,
            display: true,
            title: {
              display: true,
              text: 'Number of Executions'
            },
            ticks: {
              stepSize: 1,
              precision: 0
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    };

    this.charts.push(new Chart(ctx, config));
  }

  createPieChart() {
    const ctx = this.pieChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, this.pieChartRef.nativeElement.width, this.pieChartRef.nativeElement.height);

    const data = this.filteredHistory;

    // Count executions by platform
    const platformCounts = new Map<string, number>();
    data.forEach(exec => {
      const platform = exec.app_platform || 'unknown';
      platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1);
    });

    const config: ChartConfiguration = {
      type: 'pie',
      data: {
        labels: Array.from(platformCounts.keys()),
        datasets: [{
          data: Array.from(platformCounts.values()),
          backgroundColor: [
            '#3b82f6',
            '#8b5cf6',
            '#ec4899',
            '#f59e0b',
            '#10b981'
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: 'right'
          }
        }
      }
    };

    this.charts.push(new Chart(ctx, config));
  }

  createBarChart() {
    const ctx = this.barChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, this.barChartRef.nativeElement.width, this.barChartRef.nativeElement.height);

    // Count results by platform
    const platformStats = new Map<string, { passed: number, failed: number }>();
    this.filteredHistory.forEach(exec => {
      const platform = exec.app_platform || 'unknown';
      if (!platformStats.has(platform)) {
        platformStats.set(platform, { passed: 0, failed: 0 });
      }
      const stats = platformStats.get(platform)!;
      if (exec.overall_result?.toLowerCase() === 'passed' || exec.status === 'completed') {
        stats.passed++;
      } else {
        stats.failed++;
      }
    });

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: Array.from(platformStats.keys()),
        datasets: [
          {
            label: 'Passed',
            data: Array.from(platformStats.values()).map(s => s.passed),
            backgroundColor: '#22c55e',
            borderRadius: 6
          },
          {
            label: 'Failed',
            data: Array.from(platformStats.values()).map(s => s.failed),
            backgroundColor: '#ef4444',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    };

    this.charts.push(new Chart(ctx, config));
  }

  createBarChart2() {
    const ctx = this.barChart2Ref.nativeElement.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, this.barChart2Ref.nativeElement.width, this.barChart2Ref.nativeElement.height);

    // Count success rate by AI model
    const modelStats = new Map<string, { passed: number, total: number }>();
    this.filteredHistory.forEach(exec => {
      const model = exec.ai_model || 'unknown';
      if (!modelStats.has(model)) {
        modelStats.set(model, { passed: 0, total: 0 });
      }
      const stats = modelStats.get(model)!;
      stats.total++;
      if (exec.overall_result?.toLowerCase() === 'passed' || exec.status === 'completed') {
        stats.passed++;
      }
    });

    const successRates = new Map<string, number>();
    modelStats.forEach((stats, model) => {
      successRates.set(model, Math.round((stats.passed / stats.total) * 100));
    });

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: Array.from(successRates.keys()),
        datasets: [{
          label: 'Success Rate (%)',
          data: Array.from(successRates.values()),
          backgroundColor: [
            '#6366f1',
            '#8b5cf6',
            '#ec4899',
            '#f59e0b'
          ],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        }
      }
    };

    this.charts.push(new Chart(ctx, config));
  }

  destroyCharts() {
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
  }

  ngOnDestroy() {
    this.destroyCharts();
  }
}
