import { createSignal, Show, onMount } from 'solid-js';
import { useTable } from '../../contexts/TableContext';
import { TableService } from '../../services/table';
import type { Table, QrCodeResponse } from '../../types/table';

interface QRCodeViewProps {
  table: Table;
  restaurantId: string;
  onClose: () => void;
}

function QRCodeView(props: QRCodeViewProps) {
  const table = useTable();
  const [qrData, setQrData] = createSignal<QrCodeResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = createSignal(false);

  onMount(async () => {
    // Check if we already have QR data cached
    const cached = table.qrCodes.get(props.table.id);
    if (cached) {
      setQrData(cached);
    } else {
      // Load QR code data
      try {
        const qrResponse = await table.getTableQRCode(props.restaurantId, props.table.id);
        setQrData(qrResponse);
      } catch (error) {
        console.error('Failed to load QR code:', error);
      }
    }
  });

  const handleRefreshCode = async () => {
    setIsRefreshing(true);
    try {
      const refreshResponse = await table.refreshTableCode(props.restaurantId, props.table.id);
      setQrData({
        qr_url: refreshResponse.qr_url,
        table_name: props.table.name,
        unique_code: refreshResponse.new_unique_code,
      });
    } catch (error) {
      console.error('Failed to refresh table code:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && qrData()) {
      const qr = qrData()!;
      const printableQRUrl = TableService.generatePrintableQRUrl(qr.qr_url, 256);
      const menuUrl = TableService.getMenuUrl(props.restaurantId, qr.unique_code);
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>QR Code - ${qr.table_name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 20px;
              margin: 0;
            }
            .qr-container {
              max-width: 400px;
              margin: 0 auto;
              padding: 20px;
              border: 2px solid #000;
              border-radius: 10px;
            }
            .qr-code {
              margin: 20px 0;
            }
            .table-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .instructions {
              font-size: 16px;
              margin: 15px 0;
              line-height: 1.4;
            }
            .url {
              font-size: 12px;
              color: #666;
              word-break: break-all;
              margin-top: 10px;
            }
            @media print {
              body { margin: 0; }
              .qr-container { border: 2px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="table-name">${qr.table_name}</div>
            <div class="instructions">Scan to view menu and place your order</div>
            <div class="qr-code">
              <img src="${printableQRUrl}" alt="QR Code for ${qr.table_name}" style="max-width: 256px; height: auto;" />
            </div>
            <div class="url">${menuUrl}</div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownload = () => {
    if (qrData()) {
      const qr = qrData()!;
      const printableQRUrl = TableService.generatePrintableQRUrl(qr.qr_url, 512);
      
      // Create a temporary link to download the QR code
      const link = document.createElement('a');
      link.href = printableQRUrl;
      link.download = `qr-code-${props.table.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div class="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-gray-900">
          QR Code - {props.table.name}
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

      <Show when={qrData()} fallback={
        <div class="text-center py-8">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p class="mt-4 text-gray-600">Loading QR code...</p>
        </div>
      }>
        <div class="text-center">
          <div class="bg-gray-50 rounded-lg p-6 mb-6">
            <div class="mb-4">
              <img
                src={TableService.generatePrintableQRUrl(qrData()?.qr_url || '', 256)}
                alt={`QR Code for ${props.table.name}`}
                class="mx-auto border border-gray-200 rounded"
                style="max-width: 256px; height: auto;"
              />
            </div>
            
            <div class="text-sm text-gray-600 space-y-2">
              <p><strong>Table:</strong> {qrData()?.table_name}</p>
              <p><strong>Unique Code:</strong> {qrData()?.unique_code}</p>
              <p><strong>Menu URL:</strong></p>
              <p class="text-xs break-all bg-gray-100 p-2 rounded">
                {TableService.getMenuUrl(props.restaurantId, qrData()?.unique_code || '')}
              </p>
            </div>
          </div>

          <div class="flex justify-center space-x-4 mb-6">
            <button
              onClick={handlePrint}
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print QR Code
            </button>
            
            <button
              onClick={handleDownload}
              class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PNG
            </button>
          </div>

          <div class="border-t pt-6">
            <div class="flex justify-between items-center">
              <div class="text-left">
                <h3 class="text-lg font-medium text-gray-900 mb-2">Refresh Unique Code</h3>
                <p class="text-sm text-gray-600">
                  Generate a new unique code if the current one has been compromised or you want to reset access.
                </p>
              </div>
              <button
                onClick={handleRefreshCode}
                disabled={isRefreshing()}
                class="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRefreshing() ? (
                  <>
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Code
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default QRCodeView;