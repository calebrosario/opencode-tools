// Task lifecycle types for Phase 2

export interface TaskConfig {
  id?: string;
  name: string;
  description?: string;
  owner?: string;
  metadata?: Record<string, any>;
}

export interface TaskResult {
  success: boolean;
  status?: 'success' | 'error';
  data?: any;
  error?: string;
  message?: string;
}
