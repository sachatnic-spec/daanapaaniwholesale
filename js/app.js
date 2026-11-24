/* ============================================================
   WHOLESALE SHOP MANAGEMENT SYSTEM - app.js
   Description: Handles UI interactions, mock data, CRUD logic
   Note: In a real project, these functions would call a PHP/Node
         backend which talks to MySQL. Here we simulate with JS.
   ============================================================ */

'use strict';

if (!sessionStorage.getItem('authToken') && !window.location.pathname.endsWith('login.html')) {
  window.location.href = 'login.html';
}

// ============================================================
//  MOCK DATA STORE (simulates MySQL database rows in browser)
//  In production: replace fetch() calls to your backend API
// ============================================================

let DB = {
  categories: [
    { id: 1, name: 'Groceries' },
    { id: 2, name: 'Electronics' },
    { id: 3, name: 'Beverages' },
    { id: 4, name: 'Stationery' },
    { id: 5, name: 'Cleaning' }
  ],

  products: [
    { id: 1, name: 'Basmati Rice 25kg', categoryId: 1, unitPrice: 1800, costPrice: 1500, unit: 'bag', stock: 50, reorder: 10 },
    { id: 2, name: 'Wheat Flour 10kg', categoryId: 1, unitPrice: 450, costPrice: 380, unit: 'bag', stock: 80, reorder: 15 },
    { id: 3, name: 'Sugar 50kg', categoryId: 1, unitPrice: 2200, costPrice: 1950, unit: 'bag', stock: 40, reorder: 10 },
    { id: 4, name: 'Refined Oil 15L', categoryId: 1, unitPrice: 1650, costPrice: 1430, unit: 'tin', stock: 60, reorder: 10 },
    { id: 5, name: 'Toor Dal 5kg', categoryId: 1, unitPrice: 700, costPrice: 600, unit: 'packet', stock: 100, reorder: 20 },
    { id: 6, name: 'LED Bulb 9W', categoryId: 2, unitPrice: 85, costPrice: 60, unit: 'piece', stock: 200, reorder: 30 },
    { id: 7, name: 'USB Charger 2A', categoryId: 2, unitPrice: 250, costPrice: 180, unit: 'piece', stock: 8, reorder: 25 },
    { id: 8, name: 'Extension Board 4-plug', categoryId: 2, unitPrice: 380, costPrice: 290, unit: 'piece', stock: 75, reorder: 15 },
    { id: 9, name: 'AA Battery Pack of 4', categoryId: 2, unitPrice: 90, costPrice: 65, unit: 'pack', stock: 3, reorder: 50 },
    { id: 10, name: 'Coca-Cola 2L (Case 6)', categoryId: 3, unitPrice: 480, costPrice: 390, unit: 'case', stock: 90, reorder: 20 },
    { id: 11, name: 'Mineral Water 1L x12', categoryId: 3, unitPrice: 180, costPrice: 140, unit: 'case', stock: 0, reorder: 25 },
    { id: 12, name: 'Tea Bags 100pcs', categoryId: 3, unitPrice: 220, costPrice: 170, unit: 'box', stock: 160, reorder: 30 },
    { id: 13, name: 'A4 Paper 500 sheets', categoryId: 4, unitPrice: 320, costPrice: 260, unit: 'ream', stock: 80, reorder: 15 },
    { id: 14, name: 'Ball Pen Box (10pc)', categoryId: 4, unitPrice: 90, costPrice: 65, unit: 'box', stock: 250, reorder: 40 },
    { id: 15, name: 'Detergent Powder 5kg', categoryId: 5, unitPrice: 450, costPrice: 370, unit: 'bag', stock: 130, reorder: 25 },
    { id: 16, name: 'Floor Cleaner 5L', categoryId: 5, unitPrice: 380, costPrice: 300, unit: 'can', stock: 70, reorder: 15 },
  ],

  customers: [
    { id: 1, name: 'Ramesh General Store', phone: '9876543210', email: 'ramesh@gmail.com', address: '12, MG Road, Delhi', gst: '07AABCU9603R1ZP', credit: 75000 },
    { id: 2, name: 'Sharma Brothers Mart', phone: '9812345678', email: 'sharma@gmail.com', address: '45, Civil Lines, Agra', gst: '09AAHCS8586R1ZT', credit: 100000 },
    { id: 3, name: 'Patel Supermarket', phone: '9701234567', email: 'patel@gmail.com', address: '78, Station Road, Surat', gst: '24AACCP9801R1ZA', credit: 60000 },
    { id: 4, name: 'City Retail Hub', phone: '9988776655', email: 'cityretail@gmail.com', address: '33, Park Street, Kolkata', gst: '19AABCC1234R1ZB', credit: 150000 },
    { id: 5, name: 'Gupta Wholesale Depot', phone: '9654321098', email: 'gupta@gmail.com', address: '55, Nehru Nagar, Kanpur', gst: '09AAECG2345R1ZC', credit: 200000 },
  ],

  bills: [
    { id: 1, customerId: 1, date: '2024-05-10', total: 10500, discount: 5, tax: 18, final: 11799, status: 'Paid', mode: 'Cash' },
    { id: 2, customerId: 2, date: '2024-05-12', total: 25000, discount: 8, tax: 18, final: 27260, status: 'Paid', mode: 'Online' },
    { id: 3, customerId: 3, date: '2024-05-15', total: 8000, discount: 0, tax: 18, final: 9440, status: 'Unpaid', mode: 'Credit' },
    { id: 4, customerId: 4, date: '2024-05-18', total: 45000, discount: 10, tax: 18, final: 47628, status: 'Partial', mode: 'Credit' },
    { id: 5, customerId: 5, date: '2024-05-20', total: 18000, discount: 5, tax: 18, final: 20214, status: 'Paid', mode: 'Online' },
    { id: 6, customerId: 1, date: '2024-05-22', total: 12000, discount: 0, tax: 18, final: 14160, status: 'Unpaid', mode: 'Credit' },
  ],

  nextId: { products: 17, customers: 6, bills: 7 }
};


async function saveDB() {
  // Database writes are performed by the API calls in each page action.
  return DB;
}

async function apiRequest(url, options = {}) {
  const token = sessionStorage.getItem('authToken');
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '', ...(options.headers || {}) }
  });
  if (response.status === 401) {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('authUser');
    if (!window.location.pathname.endsWith('login.html')) window.location.href = 'login.html';
    throw new Error('Please sign in again.');
  }
  if (!response.ok) throw new Error((await response.json()).error || 'API request failed');
  return response.json();
}

// Load the initial application state from PostgreSQL through the Node API.
const appReady = apiRequest('/api/db')
  .then(data => { DB = data; return DB; })
  .catch(error => {
    console.error('Could not load PostgreSQL data:', error);
  });

// ============================================================
//  UTILITY FUNCTIONS
// ============================================================

/**
 * Format a number as Indian currency (₹ XX,XX,XXX)
 * @param {number} amount
 * @returns {string}
 */
function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(amount) {
  return '₹' + safeNumber(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

/**
 * Format a date string to DD-MM-YYYY
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Get today's date in YYYY-MM-DD format (for date inputs)
 */
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Show a temporary alert notification
 * @param {string} message
 * @param {'success'|'error'} type
 */
function showAlert(message, type = 'success') {
  const alertBox = document.getElementById('alertBox');
  if (!alertBox) return;
  alertBox.textContent = (type === 'success' ? '✅ ' : '❌ ') + message;
  alertBox.className = `alert alert-${type} show`;
  setTimeout(() => { alertBox.className = 'alert'; }, 3000);
}

/**
 * Get stock status badge HTML
 * @param {number} stock  Current stock qty
 * @param {number} reorder Reorder level
 * @returns {string} HTML badge
 */
function stockBadge(stock, reorder) {
  if (stock === 0) return '<span class="badge badge-red">Out of Stock</span>';
  if (stock <= reorder) return '<span class="badge badge-yellow">Low Stock</span>';
  return '<span class="badge badge-green">In Stock</span>';
}

/**
 * Get payment status badge HTML
 * @param {string} status
 * @returns {string} HTML badge
 */
function paymentBadge(status) {
  const map = {
    'Paid': 'badge-green',
    'Unpaid': 'badge-red',
    'Partial': 'badge-yellow'
  };
  return `<span class="badge ${map[status] || 'badge-blue'}">${status}</span>`;
}

/**
 * Get category name by ID
 */
function getCategoryName(id) {
  const cat = DB.categories.find(c => c.id === id);
  return cat ? cat.name : '—';
}

/**
 * Get customer name by ID
 */
function getCustomerName(id) {
  const cust = DB.customers.find(c => c.id === id);
  return cust ? cust.name : '—';
}

/**
 * Get current logged-in user details from session
 */
function getCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem('authUser') || 'null'); }
  catch (_) { return null; }
}

/**
 * Logout the current user
 */
async function logout() {
  try { await apiRequest('/api/auth/logout', { method: 'POST' }); } catch (_) { }
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('authUser');
  window.location.href = 'login.html';
}

// ============================================================
//  SIDEBAR / MOBILE NAV
// ============================================================
function initSidebar() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => sidebar.classList.remove('open'));
  }

  // Mark active nav link based on current page
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    if (link.getAttribute('href') === currentPage) {
      link.classList.add('active');
    }
  });
}

// ============================================================
//  MODAL HELPER FUNCTIONS
// ============================================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    // Reset any form inside the modal
    const form = modal.querySelector('form');
    if (form) form.reset();
  }
}

// Close modal when clicking outside content
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ============================================================
//  TOPBAR DATE
// ============================================================
function setTopbarDate() {
  const el = document.getElementById('currentDate');
  if (el) {
    el.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });
  }
}

// ============================================================
//  USER BAR (TOPBAR RIGHT SECTION)
// ============================================================
function initUserBar() {
  const right = document.querySelector('.topbar-right');
  if (!right) return;
  const user = getCurrentUser();
  if (!user) return;
  const existing = document.getElementById('userBar');
  if (existing) existing.remove();
  const bar = document.createElement('div');
  bar.id = 'userBar';
  bar.className = 'user-bar';
  bar.innerHTML = `<span>👤 ${user.displayName || user.username}</span><button type="button" class="btn btn-outline btn-sm" onclick="logout()">Logout</button>`;
  right.appendChild(bar);
}

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  setTopbarDate();
  initUserBar();
});

// ============================================================
//  TABLE SEARCH FILTER (generic)
//  Filters <tbody> rows based on text search input
// ============================================================
function initTableSearch(inputId, tableBodyId) {
  const input = document.getElementById(inputId);
  const tbody = document.getElementById(tableBodyId);
  if (!input || !tbody) return;

  input.addEventListener('input', () => {
    const query = input.value.toLowerCase();
    Array.from(tbody.querySelectorAll('tr')).forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
  });
}

// ============================================================
//  BILLING CALCULATOR
//  Computes subtotals, discount, tax, and final bill amount
// ============================================================
function calculateBillTotals(items, discountPct) {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmt = subtotal * (discountPct / 100);
  const afterDisc = subtotal - discountAmt;

  return { subtotal, discountAmt, afterDisc, taxAmt: 0, finalAmt: afterDisc };
}

// ============================================================
//  TABLE PDF EXPORT (print-to-PDF)
//  Adds an Export PDF button to every table wrapper automatically.
// ============================================================
function exportTableToPdf(tableWrapper, title) {
  const table = tableWrapper.querySelector('table');
  if (!table) return;

  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) {
    showAlert('Please allow pop-ups to export PDF.', 'error');
    return;
  }

  const safeTitle = title || document.title || 'Table Report';
  const clonedTable = table.cloneNode(true);
  clonedTable.querySelectorAll('button').forEach(button => button.remove());

  printWindow.document.write(`<!DOCTYPE html><html><head><title>${safeTitle}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #172033; padding: 24px; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      .meta { color: #64748b; font-size: 12px; margin-bottom: 18px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background: #172554; color: #fff; }
      th, td { border: 1px solid #cbd5e1; padding: 7px 8px; text-align: left; }
      tr:nth-child(even) td { background: #f8fafc; }
      @media print { @page { size: landscape; margin: 10mm; } button { display:none; } }
    </style></head><body>
      <h1>${safeTitle}</h1>
      <div class="meta">Generated: ${new Date().toLocaleString('en-IN')} | DaanaPaani Traders</div>
      ${clonedTable.outerHTML}
      <script>window.onload = () => { window.print(); };<\/script>
    </body></html>`);
  printWindow.document.close();
}

function initTablePdfExports() {
  const containers = new Set();
  document.querySelectorAll('table').forEach(table => {
    containers.add(table.closest('.table-wrapper') || table.closest('.card') || table.parentElement);
  });

  containers.forEach((wrapper, index) => {
    if (wrapper.querySelector('[data-pdf-export]')) return;

    let controls = wrapper.querySelector('.table-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'table-controls';
      wrapper.prepend(controls);
    }

    const heading = controls.querySelector('h2') || controls.querySelector('h1');
    if (!heading) {
      const title = document.createElement('h2');
      title.textContent = document.querySelector('.topbar h1')?.textContent || `Table Report ${index + 1}`;
      controls.prepend(title);
    }

    const titleText = (heading?.textContent || document.title).trim();
    const rightGroup = controls.querySelector(':scope > div:last-child');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline btn-sm export-pdf-btn';
    button.setAttribute('data-pdf-export', 'true');
    button.textContent = '🖨️ Export PDF';
    button.onclick = () => exportTableToPdf(wrapper, titleText);

    if (rightGroup && rightGroup !== controls.querySelector(':scope > h2')) {
      rightGroup.appendChild(button);
    } else {
      controls.appendChild(button);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initTablePdfExports, 100);
  if ('MutationObserver' in window) {
    let exportTimer;
    const exportObserver = new MutationObserver(() => {
      clearTimeout(exportTimer);
      exportTimer = setTimeout(initTablePdfExports, 150);
    });
    exportObserver.observe(document.body, { childList: true, subtree: true });
  }
});

// ============================================================
//  UNIVERSAL TABLE COLUMN SORTING
// ============================================================
function parseSortableValue(value) {
  const text = String(value ?? '').replace(/₹|,/g, '').trim();
  if (!text) return '';
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  const date = new Date(text);
  if (/\d{4}-\d{2}-\d{2}|\d{1,2}\s[A-Za-z]{3}/.test(text) && !Number.isNaN(date.getTime())) return date.getTime();
  return text.toLowerCase();
}

function initTableSorting() {
  document.querySelectorAll('table').forEach(table => {
    const headers = table.querySelectorAll('thead th');
    headers.forEach((header, columnIndex) => {
      if (header.hasAttribute('data-sort-ready')) return;
      header.setAttribute('data-sort-ready', 'true');
      header.style.cursor = 'pointer';
      header.title = 'Click to sort';
      header.innerHTML = `<span>${header.innerHTML}</span> <span class="sort-arrow" style="opacity:.55">↕</span>`;

      header.addEventListener('click', () => {
        const tbody = table.tBodies[0];
        if (!tbody) return;
        const previous = header.dataset.sortDirection;
        const direction = previous === 'asc' ? 'desc' : 'asc';

        headers.forEach(h => {
          h.dataset.sortDirection = '';
          const arrow = h.querySelector('.sort-arrow');
          if (arrow) arrow.textContent = '↕';
        });
        header.dataset.sortDirection = direction;
        const arrow = header.querySelector('.sort-arrow');
        if (arrow) arrow.textContent = direction === 'asc' ? '▲' : '▼';

        const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => row.cells.length);
        rows.sort((a, b) => {
          const aValue = parseSortableValue(a.cells[columnIndex]?.textContent || '');
          const bValue = parseSortableValue(b.cells[columnIndex]?.textContent || '');
          let comparison;
          if (typeof aValue === 'number' && typeof bValue === 'number') comparison = aValue - bValue;
          else comparison = String(aValue).localeCompare(String(bValue));
          return direction === 'asc' ? comparison : -comparison;
        });
        rows.forEach(row => tbody.appendChild(row));
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initTableSorting, 100);
  if ('MutationObserver' in window) {
    let sortTimer;
    const sortObserver = new MutationObserver(() => {
      clearTimeout(sortTimer);
      sortTimer = setTimeout(initTableSorting, 150);
    });
    sortObserver.observe(document.body, { childList: true, subtree: true });
  }
});

// ============================================================
//  INIT ON PAGE LOAD
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  setTopbarDate();
  initUserBar();
});
