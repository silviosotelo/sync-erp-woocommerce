let socket;
let currentPage = 1;
let currentFilters = { status: 'all', search: '' };
let charts = {};

document.addEventListener('DOMContentLoaded', () => {
  initializeSocket();
  initializeCharts();
  initializeEventListeners();
  loadInitialData();
  startAutoRefresh();
});

function initializeSocket() {
  socket = io();

  socket.on('connect', () => {
    updateConnectionStatus(true);
  });

  socket.on('disconnect', () => {
    updateConnectionStatus(false);
  });

  socket.on('stats_update', (stats) => {
    updateStatsCards(stats);
  });

  socket.on('sync_progress', (progress) => {
    updateProgress(progress);
  });

  socket.on('product_completed', (data) => {
    showNotification('Producto completado: ' + data.art_cod_int, 'success');
    refreshQueueTable();
  });

  socket.on('product_failed', (data) => {
    showNotification('Error en producto: ' + data.art_cod_int, 'error');
    addErrorToList(data);
    refreshQueueTable();
  });

  socket.on('sync_started', (data) => {
    showNotification('Sincronización iniciada: Batch ' + data.batch_id, 'info');
  });

  socket.on('sync_completed', (data) => {
    showNotification(`Sincronización completada: ${data.successful}/${data.total} exitosos`, 'success');
    refreshAllData();
  });

  socket.on('critical_error', (error) => {
    showNotification('Error crítico: ' + error.message, 'error');
  });
}

function updateConnectionStatus(connected) {
  const statusEl = document.getElementById('connection-status');
  if (connected) {
    statusEl.innerHTML = '<span class="w-2 h-2 bg-green-400 rounded-full mr-2"></span>Conectado';
  } else {
    statusEl.innerHTML = '<span class="w-2 h-2 bg-red-400 rounded-full mr-2 pulse"></span>Desconectado';
  }
}

function initializeCharts() {
  const ctx7days = document.getElementById('chart-7days');
  charts.sevenDays = new Chart(ctx7days, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Exitosos',
          data: [],
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.3
        },
        {
          label: 'Fallidos',
          data: [],
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.3
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
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });

  const ctxStatus = document.getElementById('chart-status');
  charts.status = new Chart(ctxStatus, {
    type: 'doughnut',
    data: {
      labels: ['Pendientes', 'Procesando', 'Completados', 'Fallidos'],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: [
          'rgb(234, 179, 8)',
          'rgb(59, 130, 246)',
          'rgb(34, 197, 94)',
          'rgb(239, 68, 68)'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'right'
        }
      }
    }
  });
}

function initializeEventListeners() {
  document.getElementById('filter-status').addEventListener('change', (e) => {
    currentFilters.status = e.target.value;
    currentPage = 1;
    loadQueueData();
  });

  document.getElementById('search-sku').addEventListener('input', debounce((e) => {
    currentFilters.search = e.target.value;
    currentPage = 1;
    loadQueueData();
  }, 500));
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function loadInitialData() {
  await Promise.all([
    loadStats(),
    loadQueueData(),
    load7DaysChart(),
    loadRecentErrors()
  ]);
}

async function loadStats() {
  try {
    const response = await fetch('/api/queue/stats');
    const data = await response.json();
    updateStatsCards(data);
    updateStatusChart(data);
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

function updateStatsCards(stats) {
  document.getElementById('stat-pending').textContent = stats.pending || 0;
  document.getElementById('stat-processing').textContent = stats.processing || 0;
  document.getElementById('stat-completed').textContent = stats.completed || 0;
  document.getElementById('stat-failed').textContent = stats.failed || 0;

  const total = (stats.completed || 0) + (stats.failed || 0);
  const successRate = total > 0 ? ((stats.completed / total) * 100).toFixed(1) : 0;
  document.getElementById('success-rate').textContent = `Tasa: ${successRate}%`;

  if (stats.processing > 0) {
    document.getElementById('processing-icon').classList.add('animate-spin');
  } else {
    document.getElementById('processing-icon').classList.remove('animate-spin');
  }

  if (stats.eta) {
    document.getElementById('eta').textContent = `ETA: ${stats.eta}`;
  }
}

function updateStatusChart(stats) {
  if (charts.status) {
    charts.status.data.datasets[0].data = [
      stats.pending || 0,
      stats.processing || 0,
      stats.completed || 0,
      stats.failed || 0
    ];
    charts.status.update();
  }
}

async function loadQueueData() {
  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: 20,
      status: currentFilters.status,
      search: currentFilters.search
    });

    const response = await fetch(`/api/queue?${params}`);
    const result = await response.json();

    renderQueueTable(result.data);
    updatePagination(result.pagination);
  } catch (error) {
    console.error('Error loading queue:', error);
  }
}

function renderQueueTable(items) {
  const tbody = document.getElementById('queue-tbody');

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-8 text-center text-gray-500">
          No hay productos en la cola
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(item => `
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        ${escapeHtml(item.art_cod_int)}
      </td>
      <td class="px-6 py-4 text-sm text-gray-900">
        <div class="max-w-xs truncate">${escapeHtml(item.product_name || 'Sin nombre')}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="status-badge status-${item.status}">
          ${getStatusLabel(item.status)}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        ${item.attempts}/${item.max_attempts}
      </td>
      <td class="px-6 py-4 text-sm text-red-600">
        <div class="max-w-xs truncate" title="${escapeHtml(item.error_message || '')}">
          ${escapeHtml(item.error_message || '-')}
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${formatDate(item.updated_at)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">
        ${item.status === 'failed' ? `
          <button onclick="retrySingle('${escapeHtml(item.art_cod_int)}')"
                  class="text-orange-600 hover:text-orange-900 font-medium">
            Reintentar
          </button>
        ` : '-'}
      </td>
    </tr>
  `).join('');
}

function updatePagination(pagination) {
  const start = pagination.total === 0 ? 0 : ((pagination.page - 1) * pagination.limit) + 1;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);

  document.getElementById('showing-start').textContent = start;
  document.getElementById('showing-end').textContent = end;
  document.getElementById('showing-total').textContent = pagination.total;
}

async function load7DaysChart() {
  try {
    const response = await fetch('/api/stats/last-7-days');
    const data = await response.json();

    if (charts.sevenDays && data.length > 0) {
      charts.sevenDays.data.labels = data.map(d => formatDateShort(d.date));
      charts.sevenDays.data.datasets[0].data = data.map(d => d.successful);
      charts.sevenDays.data.datasets[1].data = data.map(d => d.failed);
      charts.sevenDays.update();
    }
  } catch (error) {
    console.error('Error loading 7 days chart:', error);
  }
}

async function loadRecentErrors() {
  try {
    const response = await fetch('/api/errors/recent');
    const errors = await response.json();

    document.getElementById('error-count').textContent = errors.length;

    const container = document.getElementById('recent-errors');

    if (errors.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-sm">No hay errores recientes</p>';
      return;
    }

    container.innerHTML = errors.map(error => `
      <div class="border border-red-200 rounded-lg p-4 bg-red-50">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="flex items-center space-x-2 mb-2">
              <span class="font-semibold text-red-900">${escapeHtml(error.error_type)}</span>
              <span class="text-xs text-gray-500">${formatDate(error.created_at)}</span>
            </div>
            <p class="text-sm text-gray-700 mb-2">${escapeHtml(error.error_message)}</p>
            ${error.art_cod_int ? `<p class="text-xs text-gray-600">SKU: ${escapeHtml(error.art_cod_int)}</p>` : ''}
          </div>
          <button onclick="markErrorResolved(${error.id})"
                  class="text-green-600 hover:text-green-900 text-sm font-medium ml-4">
            Resolver
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading recent errors:', error);
  }
}

function addErrorToList(errorData) {
  loadRecentErrors();
}

async function triggerSync() {
  if (!confirm('¿Iniciar nueva sincronización?')) return;

  try {
    const response = await fetch('/api/sync/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (result.success) {
      showNotification('Sincronización iniciada correctamente', 'success');
    } else {
      showNotification('Error al iniciar sincronización: ' + result.error, 'error');
    }
  } catch (error) {
    showNotification('Error al iniciar sincronización', 'error');
    console.error(error);
  }
}

async function retryAllFailed() {
  if (!confirm('¿Reintentar todos los productos fallidos?')) return;

  try {
    const response = await fetch('/api/queue/retry-failed', {
      method: 'POST'
    });

    const result = await response.json();
    showNotification(`${result.count} productos marcados para reintento`, 'success');
    refreshQueueTable();
  } catch (error) {
    showNotification('Error al reintentar productos', 'error');
    console.error(error);
  }
}

async function retrySingle(artCodInt) {
  try {
    const response = await fetch(`/api/queue/${artCodInt}/retry`, {
      method: 'POST'
    });

    const result = await response.json();
    showNotification(`Producto ${artCodInt} marcado para reintento`, 'success');
    refreshQueueTable();
  } catch (error) {
    showNotification('Error al reintentar producto', 'error');
    console.error(error);
  }
}

async function markErrorResolved(errorId) {
  try {
    const response = await fetch(`/api/errors/${errorId}/resolve`, {
      method: 'POST'
    });

    if (response.ok) {
      showNotification('Error marcado como resuelto', 'success');
      loadRecentErrors();
    }
  } catch (error) {
    showNotification('Error al marcar como resuelto', 'error');
    console.error(error);
  }
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    loadQueueData();
  }
}

function nextPage() {
  currentPage++;
  loadQueueData();
}

function refreshQueueTable() {
  loadQueueData();
  loadStats();
}

function refreshAllData() {
  loadInitialData();
}

function startAutoRefresh() {
  setInterval(() => {
    loadStats();
    if (document.getElementById('filter-status').value !== 'completed') {
      refreshQueueTable();
    }
  }, 5000);

  setInterval(() => {
    load7DaysChart();
  }, 60000);
}

function updateProgress(progress) {
  if (progress.current) {
    document.getElementById('current-product').textContent = progress.current;
  }

  if (progress.eta) {
    document.getElementById('eta').textContent = `ETA: ${progress.eta}`;
  }
}

function showNotification(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
}

function getStatusLabel(status) {
  const labels = {
    pending: 'Pendiente',
    processing: 'Procesando',
    completed: 'Completado',
    failed: 'Fallido'
  };
  return labels[status] || status;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('es-PY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-PY', {
    month: 'short',
    day: 'numeric'
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
