export interface Table {
  id: string;
  restaurant_id: string;
  name: string;
  unique_code: string;
  created_at: string;
}

export interface CreateTableRequest {
  restaurant_id?: string; // Optional as it will be set by the service
  name: string;
}

export interface UpdateTableRequest {
  name?: string;
}

export interface QrCodeResponse {
  qr_url: string;
  table_name: string;
  unique_code: string;
}

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

export type TableViewMode = 'list' | 'create' | 'edit' | 'qr' | 'bulk-qr' | 'print';

export interface TableFormData {
  name: string;
}

export interface BulkOperationData {
  selectedTableIds: string[];
  operation: 'qr' | 'delete' | 'refresh';
}