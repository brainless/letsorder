import {
  createContext,
  createSignal,
  useContext,
  ParentComponent,
} from 'solid-js';
import { TableService } from '../services/table';
import type {
  Table,
  CreateTableRequest,
  UpdateTableRequest,
  QrCodeResponse,
  BulkQrCodeRequest,
  RefreshCodeResponse,
  TableState,
  TableFilters,
} from '../types/table';

interface TableContextType extends TableState {
  // Table CRUD
  loadRestaurantTables: (restaurantId: string) => Promise<void>;
  createTable: (
    restaurantId: string,
    data: Omit<CreateTableRequest, 'restaurant_id'>
  ) => Promise<Table>;
  updateTable: (
    restaurantId: string,
    tableId: string,
    data: UpdateTableRequest
  ) => Promise<Table>;
  deleteTable: (restaurantId: string, tableId: string) => Promise<void>;

  // QR Code operations
  getTableQRCode: (
    restaurantId: string,
    tableId: string
  ) => Promise<QrCodeResponse>;
  generateBulkQRCodes: (
    restaurantId: string,
    tableIds: string[]
  ) => Promise<QrCodeResponse[]>;
  refreshTableCode: (
    restaurantId: string,
    tableId: string
  ) => Promise<RefreshCodeResponse>;

  // UI state management
  setCurrentTable: (table: Table | null) => void;
  clearError: () => void;

  // Filtering and search
  filteredTables: () => Table[];
  setFilters: (filters: Partial<TableFilters>) => void;
  getFilters: () => TableFilters;
}

const TableContext = createContext<TableContextType | undefined>(undefined);

export const TableProvider: ParentComponent = (props) => {
  const [tables, setTables] = createSignal<Table[]>([]);
  const [currentTable, setCurrentTable] = createSignal<Table | null>(null);
  const [qrCodes, setQrCodes] = createSignal<Map<string, QrCodeResponse>>(
    new Map()
  );
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [filters, setFiltersSignal] = createSignal<TableFilters>({
    searchTerm: '',
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const clearError = () => {
    setError(null);
  };

  const handleError = (err: unknown) => {
    const errorMessage =
      err instanceof Error ? err.message : 'An unexpected error occurred';
    setError(errorMessage);
    console.error('Table operation error:', err);
  };

  // Filtering and search
  const filteredTables = () => {
    const currentFilters = filters();
    const currentTables = tables();

    let filtered = [...currentTables];

    // Apply search filter
    if (currentFilters.searchTerm) {
      const searchTerm = currentFilters.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (table) =>
          table.name.toLowerCase().includes(searchTerm) ||
          table.unique_code.toLowerCase().includes(searchTerm)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string | Date;
      let bValue: string | Date;

      if (currentFilters.sortBy === 'name') {
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
      } else {
        aValue = new Date(a.created_at);
        bValue = new Date(b.created_at);
      }

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;

      return currentFilters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  };

  const setFilters = (newFilters: Partial<TableFilters>) => {
    setFiltersSignal((prev) => ({ ...prev, ...newFilters }));
  };

  const getFilters = () => filters();

  // Table CRUD operations
  const loadRestaurantTables = async (restaurantId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const restaurantTables =
        await TableService.getRestaurantTables(restaurantId);
      setTables(Array.isArray(restaurantTables) ? restaurantTables : []);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const createTable = async (
    restaurantId: string,
    data: Omit<CreateTableRequest, 'restaurant_id'>
  ): Promise<Table> => {
    setIsLoading(true);
    setError(null);

    try {
      const newTable = await TableService.createTable(restaurantId, data);
      setTables((prev) => [...(Array.isArray(prev) ? prev : []), newTable]);
      return newTable;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateTable = async (
    restaurantId: string,
    tableId: string,
    data: UpdateTableRequest
  ): Promise<Table> => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedTable = await TableService.updateTable(
        restaurantId,
        tableId,
        data
      );
      setTables((prev) =>
        prev.map((t) => (t.id === tableId ? updatedTable : t))
      );

      // Update current table if it's the one being updated
      if (currentTable()?.id === tableId) {
        setCurrentTable(updatedTable);
      }

      return updatedTable;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTable = async (
    restaurantId: string,
    tableId: string
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await TableService.deleteTable(restaurantId, tableId);
      setTables((prev) => prev.filter((t) => t.id !== tableId));

      // Clear current table if it's the one being deleted
      if (currentTable()?.id === tableId) {
        setCurrentTable(null);
      }

      // Remove QR code from cache
      setQrCodes((prev) => {
        const newMap = new Map(prev);
        newMap.delete(tableId);
        return newMap;
      });
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // QR Code operations
  const getTableQRCode = async (
    restaurantId: string,
    tableId: string
  ): Promise<QrCodeResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const qrResponse = await TableService.getTableQRCode(
        restaurantId,
        tableId
      );

      // Cache the QR code data
      setQrCodes((prev) => {
        const newMap = new Map(prev);
        newMap.set(tableId, qrResponse);
        return newMap;
      });

      return qrResponse;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const generateBulkQRCodes = async (
    restaurantId: string,
    tableIds: string[]
  ): Promise<QrCodeResponse[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const bulkRequest: BulkQrCodeRequest = { table_ids: tableIds };
      const bulkResponse = await TableService.generateBulkQRCodes(
        restaurantId,
        bulkRequest
      );

      // Cache all QR codes
      setQrCodes((prev) => {
        const newMap = new Map(prev);
        bulkResponse.qr_codes.forEach((qrCode, index) => {
          newMap.set(tableIds[index], qrCode);
        });
        return newMap;
      });

      return bulkResponse.qr_codes;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTableCode = async (
    restaurantId: string,
    tableId: string
  ): Promise<RefreshCodeResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const refreshResponse = await TableService.refreshTableCode(
        restaurantId,
        tableId
      );

      // Update table with new unique code
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? { ...t, unique_code: refreshResponse.new_unique_code }
            : t
        )
      );

      // Update current table if it's the one being refreshed
      const current = currentTable();
      if (current?.id === tableId) {
        setCurrentTable({
          ...current,
          unique_code: refreshResponse.new_unique_code,
        });
      }

      // Update cached QR code
      setQrCodes((prev) => {
        const newMap = new Map(prev);
        newMap.set(tableId, {
          qr_url: refreshResponse.qr_url,
          table_name: tables().find((t) => t.id === tableId)?.name || '',
          unique_code: refreshResponse.new_unique_code,
        });
        return newMap;
      });

      return refreshResponse;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const contextValue: TableContextType = {
    get tables() {
      return tables();
    },
    get currentTable() {
      return currentTable();
    },
    get qrCodes() {
      return qrCodes();
    },
    get isLoading() {
      return isLoading();
    },
    get error() {
      return error();
    },

    // Table CRUD
    loadRestaurantTables,
    createTable,
    updateTable,
    deleteTable,

    // QR Code operations
    getTableQRCode,
    generateBulkQRCodes,
    refreshTableCode,

    // UI state
    setCurrentTable,
    clearError,

    // Filtering and search
    filteredTables,
    setFilters,
    getFilters,
  };

  return (
    <TableContext.Provider value={contextValue}>
      {props.children}
    </TableContext.Provider>
  );
};

export const useTable = () => {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error('useTable must be used within a TableProvider');
  }
  return context;
};
