import { Table as GeneratedTable, QrCodeResponse as GeneratedQrCodeResponse } from './api';

// Use generated types
export type Table = GeneratedTable;

export interface CreateTableRequest {
  restaurant_id?: string; // Optional as it will be set by the service
  name: string;
}

export interface UpdateTableRequest {
  name?: string;
}

export type QrCodeResponse = GeneratedQrCodeResponse;

export interface BulkQrCodeRequest {
  table_ids: string[];
}

export interface BulkQrCodeResponse {
  qr_codes: QrCodeResponse[];
}

export interface RefreshCodeResponse {
  table_id: string;
  new_unique_code: string;
  qr_url: string;
}

// Frontend-specific types
export interface TableState {
  tables: Table[];
  currentTable: Table | null;
  qrCodes: Map<string, QrCodeResponse>; // table_id -> QR code data
  isLoading: boolean;
  error: string | null;
}

export interface TableFilters {
  searchTerm: string;
  sortBy: 'name' | 'created_at';
  sortOrder: 'asc' | 'desc';
}

export type TableViewMode =
  | 'list'
  | 'create'
  | 'edit'
  | 'qr'
  | 'bulk-qr'
  | 'print';

export interface TableFormData {
  name: string;
}

export interface BulkOperationData {
  selectedTableIds: string[];
  operation: 'qr' | 'delete' | 'refresh';
}
