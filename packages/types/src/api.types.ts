export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMetadata;
}

export interface ErrorResponse {
  success: false;
  statusCode: number;
  error: string;
  message: string;
  timestamp: string;
  path?: string;
  details?: any;
}
