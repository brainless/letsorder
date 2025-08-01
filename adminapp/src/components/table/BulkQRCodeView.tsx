import { createSignal, Show, For, onMount } from 'solid-js';
import { useTable } from '../../contexts/TableContext';
import { TableService } from '../../services/table';
import type { Table, QrCodeResponse } from '../../types/table';

interface BulkQRCodeViewProps {
  restaurantId: string;
  onClose: () => void;
}

function BulkQRCodeView(props: BulkQRCodeViewProps) {
  const table = useTable();
  const [selectedTables, setSelectedTables] = createSignal<Set<string>>(new Set());
  const [bulkQrCodes, setBulkQrCodes] = createSignal<QrCodeResponse[]>([]);
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [showResults, setShowResults] = createSignal(false);

  const availableTables = () => table.filteredTables();

  const handleSelectTable = (tableId: string, selected: boolean) => {
    setSelectedTables(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(tableId);
      } else {
        newSet.delete(tableId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedTables(new Set(availableTables().map(t => t.id)));
    } else {
      setSelectedTables(new Set<string>());
    }
  };

  const handleGenerateBulkQR = async () => {
    const selected = Array.from(selectedTables());
    if (selected.length === 0) return;

    setIsGenerating(true);
    try {
      const qrCodes = await table.generateBulkQRCodes(props.restaurantId, selected);
      setBulkQrCodes(qrCodes);
      setShowResults(true);
    } catch (error) {
      console.error('Failed to generate bulk QR codes:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintAll = () => {
    const qrCodes = bulkQrCodes();
    if (qrCodes.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bulk QR Codes</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .qr-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              page-break-inside: avoid;
            }
            .qr-item {
              text-align: center;
              padding: 15px;
              border: 2px solid #000;
              border-radius: 10px;
              page-break-inside: avoid;
              margin-bottom: 20px;
            }
            .table-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 8px;
            }
            .instructions {
              font-size: 14px;
              margin: 10px 0;
              line-height: 1.3;
            }
            .qr-code {
              margin: 10px 0;
            }
            .url {
              font-size: 10px;
              color: #666;
              word-break: break-all;
              margin-top: 8px;
            }
            @media print {
              body { margin: 0; }
              .qr-item { 
                border: 2px solid #000;
                break-inside: avoid;
              }
            }
            @page {
              margin: 0.5in;
            }
          </style>
        </head>
        <body>
          <div class="qr-grid">
      `;

      qrCodes.forEach(qr => {
        const printableQRUrl = TableService.generatePrintableQRUrl(qr.qr_url, 200);
        const menuUrl = TableService.getMenuUrl(props.restaurantId, qr.unique_code);
        
        htmlContent += `
          <div class="qr-item">
            <div class="table-name">${qr.table_name}</div>
            <div class="instructions">Scan to view menu and place your order</div>
            <div class="qr-code">
              <img src="${printableQRUrl}" alt="QR Code for ${qr.table_name}" style="max-width: 200px; height: auto;" />
            </div>
            <div class="url">${menuUrl}</div>
          </div>
        `;
      });

      htmlContent += `
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownloadAll = () => {
    // For simplicity, we'll download individual QR codes
    // In a real app, you might want to create a ZIP file
    bulkQrCodes().forEach((qr, index) => {
      setTimeout(() => {
        const printableQRUrl = TableService.generatePrintableQRUrl(qr.qr_url, 512);
        const link = document.createElement('a');
        link.href = printableQRUrl;
        link.download = `qr-code-${qr.table_name.replace(/\s+/g, '-').toLowerCase()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 500); // Stagger downloads to avoid browser blocking
    });
  };

  const handleBack = () => {
    setShowResults(false);
    setBulkQrCodes([]);
    setSelectedTables(new Set<string>());
  };

  const selectedCount = () => selectedTables().size;
  const allSelected = () => selectedCount() === availableTables().length && availableTables().length > 0;

  return (
    <div class="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-gray-900">
          {showResults() ? 'Bulk QR Codes Generated' : 'Generate Bulk QR Codes'}
        </h2>
        <button
          onClick={props.onClose}
          class="text-gray-400 hover:text-gray-600 focus:outline-none"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <Show when={table.error}>
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {table.error}
        </div>
      </Show>

      <Show when={!showResults()} fallback={
        <div>
          <div class="mb-6 flex justify-between items-center">
            <p class="text-gray-600">
              Generated {bulkQrCodes().length} QR codes successfully.
            </p>
            <div class="space-x-3">
              <button
                onClick={handleBack}
                class="px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Back to Selection
              </button>
              <button
                onClick={handlePrintAll}
                class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print All
              </button>
              <button
                onClick={handleDownloadAll}
                class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download All
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <For each={bulkQrCodes()}>
              {(qr) => (
                <div class="bg-gray-50 rounded-lg p-4 text-center">
                  <h3 class="font-medium text-gray-900 mb-2">{qr.table_name}</h3>
                  <div class="mb-3">
                    <img
                      src={TableService.generatePrintableQRUrl(qr.qr_url, 150)}
                      alt={`QR Code for ${qr.table_name}`}
                      class="mx-auto border border-gray-200 rounded"
                      style="max-width: 150px; height: auto;"
                    />
                  </div>
                  <p class="text-xs text-gray-600 break-all">
                    {qr.unique_code}
                  </p>
                </div>
              )}
            </For>
          </div>
        </div>
      }>
        <div>
          <div class="mb-6">
            <p class="text-gray-600 mb-4">
              Select the tables you want to generate QR codes for. You can then print or download them all at once.
            </p>
            
            <div class="flex justify-between items-center mb-4">
              <div class="flex items-center space-x-4">
                <label class="flex items-center">
                  <input
                    type="checkbox"
                    checked={allSelected()}
                    onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                    class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span class="ml-2 text-sm text-gray-700">Select All</span>
                </label>
                <span class="text-sm text-gray-500">
                  {selectedCount()} of {availableTables().length} tables selected
                </span>
              </div>
              
              <button
                onClick={handleGenerateBulkQR}
                disabled={selectedCount() === 0 || isGenerating()}
                class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating() ? (
                  <>
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  `Generate QR Codes (${selectedCount()})`
                )}
              </button>
            </div>
          </div>

          <Show when={availableTables().length === 0} fallback={
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <For each={availableTables()}>
                {(tableItem) => (
                  <div class="bg-gray-50 rounded-lg p-4">
                    <label class="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTables().has(tableItem.id)}
                        onChange={(e) => handleSelectTable(tableItem.id, e.currentTarget.checked)}
                        class="mt-1 rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <div class="flex-1">
                        <div class="font-medium text-gray-900">{tableItem.name}</div>
                        <div class="text-sm text-gray-600">Code: {tableItem.unique_code}</div>
                        <div class="text-xs text-gray-500">
                          Created: {new Date(tableItem.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </label>
                  </div>
                )}
              </For>
            </div>
          }>
            <div class="text-center py-8">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">No tables available</h3>
              <p class="mt-1 text-sm text-gray-500">
                Create some tables first to generate QR codes.
              </p>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export default BulkQRCodeView;