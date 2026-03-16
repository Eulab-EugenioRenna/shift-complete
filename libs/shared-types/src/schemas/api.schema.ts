export interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  details?: string[];
  timestamp: string;
  path: string;
  requestId: string;
}

export interface ActionFeedbackItem {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  createdAt: string;
}
