/**
 * Performance monitoring utilities for LetsOrder Menu App
 * Tracks Core Web Vitals and reports to console (can be extended to send to analytics)
 */

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observer?: PerformanceObserver;

  constructor() {
    this.initializeObserver();
    this.trackInitialLoad();
  }

  private initializeObserver(): void {
    if (!('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver not supported');
      return;
    }

    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processEntry(entry);
        }
      });

      // Observe different types of performance entries
      this.observer.observe({ entryTypes: ['measure', 'navigation', 'paint', 'largest-contentful-paint'] });
    } catch (error) {
      console.warn('Failed to initialize PerformanceObserver:', error);
    }
  }

  private processEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'paint':
        this.handlePaintEntry(entry as PerformancePaintTiming);
        break;
      case 'largest-contentful-paint':
        this.handleLCPEntry(entry as any); // LCP type not fully supported in TypeScript
        break;
      case 'navigation':
        this.handleNavigationEntry(entry as PerformanceNavigationTiming);
        break;
    }
  }

  private handlePaintEntry(entry: PerformancePaintTiming): void {
    if (entry.name === 'first-contentful-paint') {
      const metric: PerformanceMetric = {
        name: 'FCP',
        value: entry.startTime,
        rating: this.getFCPRating(entry.startTime),
        timestamp: Date.now()
      };
      this.recordMetric(metric);
    }
  }

  private handleLCPEntry(entry: any): void {
    const metric: PerformanceMetric = {
      name: 'LCP',
      value: entry.startTime,
      rating: this.getLCPRating(entry.startTime),
      timestamp: Date.now()
    };
    this.recordMetric(metric);
  }

  private handleNavigationEntry(entry: PerformanceNavigationTiming): void {
    // Track Time to Interactive approximation
    const tti = entry.loadEventEnd - entry.navigationStart;
    const metric: PerformanceMetric = {
      name: 'TTI',
      value: tti,
      rating: this.getTTIRating(tti),
      timestamp: Date.now()
    };
    this.recordMetric(metric);
  }

  private getFCPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 1800) return 'good';
    if (value <= 3000) return 'needs-improvement';
    return 'poor';
  }

  private getLCPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 2500) return 'good';
    if (value <= 4000) return 'needs-improvement';
    return 'poor';
  }

  private getTTIRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 3800) return 'good';
    if (value <= 7300) return 'needs-improvement';
    return 'poor';
  }

  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Log metric (in production, this would be sent to analytics)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Performance] ${metric.name}: ${metric.value.toFixed(2)}ms (${metric.rating})`);
    }

    // Report performance issues in development
    if (metric.rating === 'poor') {
      console.warn(`Performance issue detected: ${metric.name} is ${metric.rating} (${metric.value.toFixed(2)}ms)`);
    }
  }

  private trackInitialLoad(): void {
    // Track page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        this.measureResourceLoadTimes();
        this.measureJavaScriptExecutionTime();
        this.reportSummary();
      }, 0);
    });
  }

  private measureResourceLoadTimes(): void {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    let totalResourceTime = 0;
    let largestResource = { name: '', duration: 0 };

    resources.forEach((resource) => {
      totalResourceTime += resource.duration;
      
      if (resource.duration > largestResource.duration) {
        largestResource = { name: resource.name, duration: resource.duration };
      }
    });

    if (largestResource.duration > 500) { // 500ms threshold
      console.warn(`Slow resource detected: ${largestResource.name} (${largestResource.duration.toFixed(2)}ms)`);
    }
  }

  private measureJavaScriptExecutionTime(): void {
    const jsEntries = performance.getEntriesByType('measure');
    const totalJSTime = jsEntries.reduce((total, entry) => total + entry.duration, 0);

    if (totalJSTime > 100) { // 100ms threshold
      console.warn(`JavaScript execution time is high: ${totalJSTime.toFixed(2)}ms`);
    }
  }

  public trackCustomMetric(name: string, startTime: number, endTime: number): void {
    const duration = endTime - startTime;
    performance.measure(name, { start: startTime, end: endTime });
    
    console.log(`[Custom Metric] ${name}: ${duration.toFixed(2)}ms`);
  }

  public getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  private reportSummary(): void {
    if (this.metrics.length === 0) return;

    const summary = this.metrics.reduce((acc, metric) => {
      acc[metric.rating] = (acc[metric.rating] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('[Performance Summary]', {
      total: this.metrics.length,
      ...summary,
      metrics: this.metrics.map(m => ({ name: m.name, value: `${m.value.toFixed(2)}ms`, rating: m.rating }))
    });
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Initialize performance monitoring
let performanceMonitor: PerformanceMonitor | null = null;

function initializePerformanceMonitoring(): void {
  if (!performanceMonitor && typeof window !== 'undefined') {
    performanceMonitor = new PerformanceMonitor();
  }
}

// Auto-initialize on menu pages
if (typeof window !== 'undefined' && document.querySelector('[data-menu-display]')) {
  initializePerformanceMonitoring();
}

export { PerformanceMonitor, initializePerformanceMonitoring };
export default PerformanceMonitor;