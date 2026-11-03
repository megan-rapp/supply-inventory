const STORAGE_KEY = 'supply-room-inventory-v1';
const EQUIPMENT_KEY = 'supply-room-equipment-v1';
const EXPENSES_KEY = 'supply-room-expenses-v1';
const BUDGET_KEY = 'supply-room-monthly-budget-v1';
const CATEGORIES_KEY = 'supply-room-categories-v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CATEGORIES = {
  clinical: ['Clinical disposable', 'Non-disposable'],
  office: ['Office supplies']
};
const DEFAULT_ITEMS = [
  { id: 'demo-composite', name: 'Universal composite', category: 'Clinical disposable', quantity: 18, unitPrice: 42.5, supplier: 'Henry Schein', supplierUrl: 'https://www.henryschein.com/', supplierContact: '1-800-472-4346', orderFrequencyDays: 30, unitsPerTreatment: 1, reorderThresholdTreatments: 8, lastOrderedAt: daysAgo(18), maxStock: 30 },
  { id: 'demo-gloves', name: 'Nitrile exam gloves', category: 'Clinical disposable', quantity: 12, unitPrice: 14.25, supplier: 'Benco Dental', supplierUrl: 'https://www.benco.com/', supplierContact: '1-800-462-3626', orderFrequencyDays: 21, unitsPerTreatment: 0.08, reorderThresholdTreatments: 60, lastOrderedAt: daysAgo(16), maxStock: 24 },
  { id: 'demo-pouches', name: 'Sterilization pouches', category: 'Clinical disposable', quantity: 7, unitPrice: 19.8, supplier: 'Patterson Dental', supplierUrl: 'https://www.pattersondental.com/', supplierContact: '1-800-328-5536', orderFrequencyDays: 30, unitsPerTreatment: 0.5, reorderThresholdTreatments: 20, lastOrderedAt: daysAgo(25), maxStock: 20 },
  { id: 'demo-prophy', name: 'Prophy paste cups', category: 'Clinical disposable', quantity: 22, unitPrice: 27, supplier: 'Darby Dental', supplierUrl: 'https://www.darbydental.com/', supplierContact: '1-800-431-2972', orderFrequencyDays: 30, unitsPerTreatment: 1, reorderThresholdTreatments: 15, lastOrderedAt: daysAgo(10), maxStock: 30 },
  { id: 'demo-anesthetic', name: 'Lidocaine 2% cartridges', category: 'Clinical disposable', quantity: 9, unitPrice: 46.75, supplier: 'Henry Schein', supplierUrl: 'https://www.henryschein.com/', supplierContact: '1-800-472-4346', orderFrequencyDays: 14, unitsPerTreatment: 1.5, reorderThresholdTreatments: 12, lastOrderedAt: daysAgo(12), maxStock: 25 },
  { id: 'demo-masks', name: 'ASTM Level 3 masks', category: 'Clinical disposable', quantity: 16, unitPrice: 8.95, supplier: 'Benco Dental', supplierUrl: 'https://www.benco.com/', supplierContact: '1-800-462-3626', orderFrequencyDays: 21, unitsPerTreatment: 0.1, reorderThresholdTreatments: 50, lastOrderedAt: daysAgo(8), maxStock: 30 },
  { id: 'demo-paper', name: 'Printer paper', category: 'Office supplies', quantity: 8, minimumQuantity: 3, unit: 'reams', unitPrice: 6.25, supplier: 'Office supplier', orderFrequencyDays: 45, lastOrderedAt: daysAgo(12), maxStock: 12 },
  { id: 'demo-labels', name: 'Shipping labels', category: 'Office supplies', quantity: 2, minimumQuantity: 4, unit: 'rolls', unitPrice: 12.5, supplier: 'Office supplier', orderFrequencyDays: 30, lastOrderedAt: daysAgo(35), maxStock: 8 }
];

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function saveBudget() {
  try {
    if (monthlyBudget === null) localStorage.removeItem(BUDGET_KEY);
    else localStorage.setItem(BUDGET_KEY, String(monthlyBudget));
  } catch (error) {
    console.error('Unable to save monthly budget.', error);
    showToast('Could not save your monthly budget in this browser.');
  }
}

function loadCategories() {
  try {
    const saved = localStorage.getItem(CATEGORIES_KEY);
    if (saved === null) return { clinical: [...DEFAULT_CATEGORIES.clinical], office: [...DEFAULT_CATEGORIES.office] };
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.clinical) || !parsed.clinical.length || !Array.isArray(parsed.office) || !parsed.office.length) {
      throw new Error('Saved categories must include clinical and office lists.');
    }
    const loaded = {
      clinical: parsed.clinical.map((name) => String(name).trim()).filter(Boolean),
      office: parsed.office.map((name) => String(name).trim()).filter(Boolean)
    };
    if (!loaded.clinical.length || !loaded.office.length) throw new Error('Each category list must have at least one name.');
    return loaded;
  } catch (error) {
    console.error('Unable to load saved categories.', error);
    return { clinical: [...DEFAULT_CATEGORIES.clinical], office: [...DEFAULT_CATEGORIES.office] };
  }
}

let categories = loadCategories();

function loadItems() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return DEFAULT_ITEMS.map((item) => ({ ...item }));
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new Error('Saved inventory is not a list.');
    return parsed.map((item) => {
      let category = item.category || categories.clinical[0];
      if (['Office', 'Office supplies'].includes(category)) category = categories.office.includes('Office supplies') ? 'Office supplies' : categories.office[0];
      else if (['Restorative', 'PPE', 'Infection control', 'Preventive', 'Anesthetic'].includes(category)) {
        category = categories.clinical.includes('Clinical disposable') ? 'Clinical disposable' : categories.clinical[0];
      }
      return {
        ...item,
        category,
        inventoryType: item.inventoryType || (categories.office.includes(category) ? 'office' : 'clinical')
      };
    });
  } catch (error) {
    console.error('Unable to load saved inventory.', error);
    return DEFAULT_ITEMS.map((item) => ({ ...item }));
  }
}

let items = loadItems();
let equipment = loadStoredList(EQUIPMENT_KEY, []);
let expenses = loadStoredList(EXPENSES_KEY, []);
let monthlyBudget = loadBudget();
let activeQueueFilter = false;
let activeInventoryTab = 'clinical';
let toastTimer;
const $ = (selector) => document.querySelector(selector);
const itemDialog = $('#item-dialog');
const quantityDialog = $('#quantity-dialog');

function loadStoredList(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return fallback;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new Error(`Saved data for ${key} is not a list.`);
    return parsed;
  } catch (error) {
    console.error(`Unable to load saved data from ${key}.`, error);
    return fallback;
  }
}

function loadBudget() {
  try {
    const saved = localStorage.getItem(BUDGET_KEY);
    if (saved === null) return null;
    const parsed = Number(saved);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Saved monthly budget is invalid.');
    return parsed;
  } catch (error) {
    console.error('Unable to load saved monthly budget.', error);
    return null;
  }
}

function saveItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    $('#toast').dataset.storageError = '';
  } catch (error) {
    console.error('Unable to save inventory.', error);
    showToast('Could not save your changes in this browser.');
  }
}

function saveEquipment() {
  try {
    localStorage.setItem(EQUIPMENT_KEY, JSON.stringify(equipment));
  } catch (error) {
    console.error('Unable to save equipment records.', error);
    showToast('Could not save your equipment in this browser.');
  }
}

function saveExpenses() {
  try {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  } catch (error) {
    console.error('Unable to save purchase records.', error);
    showToast('Could not save your purchase record in this browser.');
  }
}

function dateInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function thisMonthExpenses() {
  const month = dateInputValue().slice(0, 7);
  return expenses.filter((expense) => typeof expense.date === 'string' && expense.date.slice(0, 7) === month);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntilNextOrder(item) {
  const lastOrder = formatDate(item.lastOrderedAt);
  const frequency = Number(item.orderFrequencyDays);
  if (!lastOrder || !Number.isFinite(frequency) || frequency <= 0) return null;
  return Math.ceil((lastOrder.getTime() + frequency * DAY_MS - Date.now()) / DAY_MS);
}

function treatmentEstimate(item) {
  if (isOfficeItem(item)) return null;
  const usage = Number(item.unitsPerTreatment);
  if (!Number.isFinite(usage) || usage <= 0) return null;
  return Math.floor(Number(item.quantity) / usage);
}

function isOfficeItem(item) {
  return item.inventoryType ? item.inventoryType === 'office' : categories.office.includes(item.category);
}

function isBackordered(item) {
  return Boolean(item.backorder);
}

function needsAttention(item) {
  if (isBackordered(item)) return true;
  if (isOfficeItem(item)) {
    const minimum = Number(item.minimumQuantity);
    const hasMinimum = item.minimumQuantity !== null && item.minimumQuantity !== undefined && item.minimumQuantity !== '';
    const belowMinimum = hasMinimum && Number.isFinite(minimum) && minimum >= 0 && Number(item.quantity) <= minimum;
    const orderDays = daysUntilNextOrder(item);
    return belowMinimum || (orderDays !== null && orderDays <= 0);
  }
  const estimate = treatmentEstimate(item);
  const threshold = Number(item.reorderThresholdTreatments);
  const treatmentLow = estimate !== null && Number.isFinite(threshold) && estimate <= threshold;
  const orderDays = daysUntilNextOrder(item);
  return treatmentLow || (orderDays !== null && orderDays <= 0);
}

function itemStatus(item) {
  if (isOfficeItem(item)) {
    const minimum = Number(item.minimumQuantity);
    const hasMinimum = item.minimumQuantity !== null && item.minimumQuantity !== undefined && item.minimumQuantity !== '';
    if (hasMinimum && Number.isFinite(minimum) && Number(item.quantity) <= minimum * 0.4) return 'critical';
    return needsAttention(item) ? 'low' : 'healthy';
  }
  const estimate = treatmentEstimate(item);
  const threshold = Number(item.reorderThresholdTreatments);
  if (estimate !== null && Number.isFinite(threshold) && estimate <= Math.max(1, threshold * 0.4)) return 'critical';
  return needsAttention(item) ? 'low' : 'healthy';
}

function statusLabel(item) {
  if (isBackordered(item)) return 'Backordered';
  const days = daysUntilNextOrder(item);
  if (days !== null && days <= 0 && (isOfficeItem(item) ? Number(item.quantity) > Number(item.minimumQuantity) : !treatmentIsLow(item))) return 'Order due';
  const status = itemStatus(item);
  return status === 'critical' ? 'Running low' : status === 'low' ? 'Reorder soon' : 'In good shape';
}

function treatmentIsLow(item) {
  const estimate = treatmentEstimate(item);
  const threshold = Number(item.reorderThresholdTreatments);
  return estimate !== null && Number.isFinite(threshold) && estimate <= threshold;
}

function itemInitials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
}

function render() {
  const search = $('#search-input').value.trim().toLowerCase();
  const stockFilter = $('#status-filter').value;
  const queueItems = items.filter(needsAttention);
  const monthExpenses = thisMonthExpenses();
  const monthSpend = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  $('#stat-items').textContent = items.length;
  $('#stat-attention').textContent = queueItems.length;
  $('#stat-budget').textContent = monthlyBudget === null ? 'Not set' : formatCurrency(monthlyBudget);
  $('#stat-procedure-links').textContent = items.filter((item) => !isOfficeItem(item) && item.procedureLinks).length;
  const budgetPercent = monthlyBudget > 0 ? Math.min(100, Math.round(monthSpend / monthlyBudget * 100)) : 0;
  $('#budget-fill').style.width = `${budgetPercent}%`;
  $('#budget-fill').classList.toggle('over-budget', monthlyBudget !== null && monthSpend > monthlyBudget);
  $('#budget-caption').textContent = monthlyBudget === null
    ? `${formatCurrency(monthSpend)} spent this month · Set a budget`
    : `${formatCurrency(monthSpend)} spent · ${formatCurrency(Math.max(0, monthlyBudget - monthSpend))} remaining`;
  $('#attention-caption').textContent = queueItems.length ? `${queueItems.length} ${queueItems.length === 1 ? 'item needs' : 'items need'} a closer look` : 'All supplies looking good';
  $('#queue-count').textContent = queueItems.length;
  $('#nav-count').textContent = items.length;
  $('#clinical-tab-count').textContent = items.filter((item) => !isOfficeItem(item)).length;
  $('#office-tab-count').textContent = items.filter(isOfficeItem).length;
  $('#equipment-tab-count').textContent = equipment.length;
  $('#nav-dot').hidden = queueItems.length === 0;
  renderQueue(queueItems);

  const tabItems = items.filter((item) => activeInventoryTab === 'office' ? isOfficeItem(item) : !isOfficeItem(item));
  const categoryChoices = categories[activeInventoryTab === 'office' ? 'office' : 'clinical'];
  const oldCategory = $('#category-filter').value;
  $('#category-filter').innerHTML = '<option value="all">All categories</option>' + categoryChoices.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  $('#category-filter').value = categoryChoices.includes(oldCategory) ? oldCategory : 'all';

  const visibleItems = tabItems.filter((item) => {
    const matchesText = [item.name, item.category, item.supplier].some((value) => String(value || '').toLowerCase().includes(search));
    const matchesCategory = $('#category-filter').value === 'all' || item.category === $('#category-filter').value;
    const matchesStatus = stockFilter === 'all' || (stockFilter === 'attention' ? needsAttention(item) : !needsAttention(item));
    const matchesQueue = !activeQueueFilter || needsAttention(item);
    return matchesText && matchesCategory && matchesStatus && matchesQueue;
  });
  visibleItems.sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)) || String(a.name).localeCompare(String(b.name)));

  $('#inventory-body').innerHTML = visibleItems.map((item, index) => renderRow(item, index)).join('');
  $('#empty-state').hidden = visibleItems.length > 0;
  $('#inventory-body').closest('table').hidden = visibleItems.length === 0;
  $('#result-count').textContent = `Showing ${visibleItems.length} of ${tabItems.length} ${tabItems.length === 1 ? 'item' : 'items'}`;
  $('#view-queue-button').textContent = activeQueueFilter ? 'View all supplies →' : 'View all →';
  $('#usage-header').textContent = activeInventoryTab === 'office' ? 'MINIMUM STOCK' : 'USES LEFT';
  $('#manage-categories-button').hidden = activeInventoryTab === 'equipment';
  renderEquipment();
  setInventoryTab(activeInventoryTab, false);
}

function formatShortDate(value) {
  const date = formatDate(value);
  return date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date) : 'Not recorded';
}

function renderEquipment() {
  const today = dateInputValue();
  $('#equipment-body').innerHTML = equipment.map((item) => {
    const warrantyExpired = item.warrantyExpiration && item.warrantyExpiration < today;
    const warrantyStatus = !item.warrantyExpiration ? 'No warranty date' : warrantyExpired ? 'Expired' : `Until ${formatShortDate(item.warrantyExpiration)}`;
    const repairs = Array.isArray(item.repairs) ? item.repairs : [];
    const issues = Array.isArray(item.issues) ? item.issues : [];
    const openIssues = issues.filter((issue) => !issue.resolved);
    const lastRepair = [...repairs].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const dealerUrl = safeUrl(item.supplierUrl);
    const dealerLoginUrl = safeUrl(item.supplierLoginUrl);
    const repairUrl = safeUrl(item.repairProviderUrl);
    const dealer = item.supplier ? escapeHtml(item.supplier) : 'Not set';
    const dealerInfo = item.supplier && dealerUrl
      ? `<a href="${escapeHtml(dealerUrl)}" target="_blank" rel="noopener noreferrer">${dealer} ↗</a>`
      : `<small>${dealer}</small>`;
    return `<tr>
      <td><div class="supply-cell"><span class="supply-avatar equipment-avatar">${escapeHtml(itemInitials(item.name))}</span><span class="supply-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category || 'Clinical equipment')}${item.serialNumber ? ` · ${escapeHtml(item.serialNumber)}` : ''}</small></span></div></td>
      <td class="cycle-cell"><strong>${item.purchasePrice === null || item.purchasePrice === undefined ? 'Price not set' : formatCurrency(item.purchasePrice)}</strong><small>${formatShortDate(item.purchaseDate)}</small></td>
      <td class="cycle-cell"><span class="warranty-status ${warrantyExpired ? 'warranty-expired' : ''}">${escapeHtml(warrantyStatus)}</span></td>
      <td class="cycle-cell service-cell"><strong>${item.repairProviderName ? (repairUrl ? `<a href="${escapeHtml(repairUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.repairProviderName)} ↗</a>` : escapeHtml(item.repairProviderName)) : 'No repair provider'}</strong>${item.repairProviderContact ? `<small>${escapeHtml(item.repairProviderContact)}</small>` : '<small>Edit equipment to add service contact</small>'}<small class="repair-count">${repairs.length} ${repairs.length === 1 ? 'repair' : 'repairs'} logged</small>${lastRepair ? `<details class="repair-details"><summary>View service history</summary><ul>${[...repairs].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((repair) => `<li><strong>${escapeHtml(repair.description)}</strong><small>${formatShortDate(repair.date)}${Number(repair.cost) > 0 ? ` · ${formatCurrency(repair.cost)}` : ''}</small></li>`).join('')}</ul></details>` : ''}</td>
      <td class="cycle-cell issue-cell"><span class="issue-count ${openIssues.length ? 'issue-open' : 'issue-clear'}">${openIssues.length} open</span>${issues.length ? `<details class="repair-details issue-history"><summary>${issues.length} ${issues.length === 1 ? 'issue' : 'issues'} logged</summary><ul>${[...issues].sort((a, b) => String(b.reportedAt).localeCompare(String(a.reportedAt))).map((issue) => `<li class="issue-entry"><strong>${escapeHtml(issue.description)}</strong><small>${formatShortDate(issue.reportedAt)} · ${issue.resolved ? `Resolved ${formatShortDate(issue.resolvedAt)}` : 'Open'}</small>${issue.details ? `<small>${escapeHtml(issue.details)}</small>` : ''}<button class="issue-resolve-button ${issue.resolved ? 'resolved' : ''}" data-action="toggle-issue" data-id="${escapeHtml(item.id)}" data-issue-id="${escapeHtml(issue.id)}">${issue.resolved ? 'Reopen issue' : 'Mark resolved'}</button></li>`).join('')}</ul></details>` : '<small>No issues logged</small>'}</td>
      <td class="supplier-cell"><strong>${dealerInfo}</strong>${dealerLoginUrl ? `<a class="supplier-login" href="${escapeHtml(dealerLoginUrl)}" target="_blank" rel="noopener noreferrer">Online ordering ↗</a>` : ''}${item.supplierContact ? `<small>${escapeHtml(item.supplierContact)}</small>` : ''}</td>
      <td><div class="row-actions"><button class="row-action" data-action="issue" data-id="${escapeHtml(item.id)}" title="Log equipment issue" aria-label="Log an issue for ${escapeHtml(item.name)}">!</button><button class="row-action" data-action="repair" data-id="${escapeHtml(item.id)}" title="Log repair" aria-label="Log repair for ${escapeHtml(item.name)}">⚒</button><button class="row-action" data-action="equipment-edit" data-id="${escapeHtml(item.id)}" title="Edit equipment" aria-label="Edit ${escapeHtml(item.name)}">···</button></div></td>
    </tr>`;
  }).join('');
  $('#equipment-empty-state').hidden = equipment.length > 0;
  $('#equipment-body').closest('table').hidden = equipment.length === 0;
}

function setInventoryTab(tab, scroll = false) {
  activeInventoryTab = tab;
  const isEquipment = tab === 'equipment';
  const isOffice = tab === 'office';
  $('#clinical-tab').classList.toggle('active', tab === 'clinical');
  $('#office-tab').classList.toggle('active', isOffice);
  $('#equipment-tab').classList.toggle('active', isEquipment);
  $('#clinical-tab').setAttribute('aria-selected', String(tab === 'clinical'));
  $('#office-tab').setAttribute('aria-selected', String(isOffice));
  $('#equipment-tab').setAttribute('aria-selected', String(isEquipment));
  $('#supplies-panel').hidden = isEquipment;
  $('#equipment-panel').hidden = !isEquipment;
  $('#log-purchase-button').hidden = isEquipment;
  $('#add-item-button').hidden = isEquipment;
  $('#add-equipment-button').hidden = !isEquipment;
  $('#inventory .inventory-heading h2').textContent = isEquipment ? 'Your equipment' : isOffice ? 'Office supplies' : 'Clinical supplies';
  $('#inventory .inventory-heading p').textContent = isEquipment
    ? 'Purchase, warranty, and service history for durable assets.'
    : isOffice ? 'Track office stock and set a quantity-based reorder reminder.' : 'Manage clinical stock, suppliers, and procedure usage.';
  $('#equipment-nav-link').classList.toggle('active', isEquipment);
  $('.nav-link[href="#inventory"]').classList.toggle('active', !isEquipment);
  $('#empty-state').querySelector('strong').textContent = isOffice ? 'No office supplies found' : 'No clinical supplies found';
  $('#empty-state').querySelector('p').textContent = isOffice ? 'Add office stock and set a quantity-based reorder reminder.' : 'Try a different search or add your first clinical item.';
  if (scroll) $('#inventory').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderQueue(queueItems) {
  const queue = [...queueItems].sort((a, b) => {
    if (isBackordered(a) !== isBackordered(b)) return isBackordered(a) ? -1 : 1;
    if (isOfficeItem(a) !== isOfficeItem(b)) return isOfficeItem(a) ? -1 : 1;
    if (isOfficeItem(a)) return Number(a.quantity) - Number(b.quantity);
    return (treatmentEstimate(a) ?? Infinity) - (treatmentEstimate(b) ?? Infinity);
  }).slice(0, 3);
  $('#reorder-list').innerHTML = queue.length ? queue.map((item) => {
    const count = treatmentEstimate(item);
    const days = daysUntilNextOrder(item);
    const detail = isBackordered(item)
      ? `Backordered${item.backorder.expectedDate ? ` · expected ${formatShortDate(item.backorder.expectedDate)}` : ''}`
      : isOfficeItem(item)
      ? Number.isFinite(Number(item.minimumQuantity)) && Number(item.minimumQuantity) >= 0
        ? `${item.quantity} ${item.unit || 'units'} · reorder at ${item.minimumQuantity}`
        : 'Order cycle is due'
      : count !== null && treatmentIsLow(item) ? `${count} uses left` : days !== null && days <= 0 ? 'Order cycle is due' : 'Review your stock';
    const link = safeUrl(item.supplierLoginUrl) || safeUrl(item.supplierUrl);
    const alternatives = isBackordered(item) ? findAlternateVendors(item).slice(0, 2) : [];
    const alternativeLinks = alternatives.map((vendor) => {
      const query = `site:${vendor.domain} "${item.name}"`;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      return `<a href="${searchUrl}" target="_blank" rel="noopener noreferrer">Search ${escapeHtml(vendor.name)} ↗</a>`;
    }).join('');
    const searchLinks = isBackordered(item)
      ? `<div class="alternative-searches">${alternativeLinks || '<small>No other supplier websites are saved yet.</small>'}<small>Search suggestions only; vendor stock is not verified.</small></div>`
      : '';
    return `<article class="reorder-item ${isBackordered(item) ? 'backordered-item' : ''}"><span class="reorder-avatar">${escapeHtml(itemInitials(item.name))}</span><div class="reorder-item-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(detail)}</small>${searchLinks}</div>${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" aria-label="Visit ${escapeHtml(item.supplier || 'supplier')}">↗</a>` : '<span aria-hidden="true"></span>'}</article>`;
  }).join('') : '<div class="reorder-empty"><span>✓</span> You’re in good shape. No supplies need reordering right now.</div>';
}

function findAlternateVendors(item) {
  const currentSupplier = String(item.supplier || '').trim().toLowerCase();
  const vendors = new Map();
  for (const candidate of items) {
    const name = String(candidate.supplier || '').trim();
    const url = safeUrl(candidate.supplierUrl);
    if (!name || !url || name.toLowerCase() === currentSupplier) continue;
    const domain = new URL(url).hostname.replace(/^www\./, '');
    if (!vendors.has(name.toLowerCase())) vendors.set(name.toLowerCase(), { name, domain });
  }
  return [...vendors.values()];
}

function renderRow(item, index) {
  const estimate = treatmentEstimate(item);
  const status = itemStatus(item);
  const minimum = Number(item.minimumQuantity);
  const hasMinimum = item.minimumQuantity !== null && item.minimumQuantity !== undefined && item.minimumQuantity !== '';
  const max = Math.max(Number(item.maxStock) || 0, Number(item.quantity) || 0, isOfficeItem(item) && Number.isFinite(minimum) ? minimum : 0, 1);
  const stockPercent = Math.min(100, Math.round(Number(item.quantity) / max * 100));
  const days = daysUntilNextOrder(item);
  const cycleLabel = item.orderFrequencyDays ? `Every ${escapeHtml(item.orderFrequencyDays)} days` : 'Not set';
  const nextOrder = isBackordered(item)
    ? `Expected ${item.backorder.expectedDate ? formatShortDate(item.backorder.expectedDate) : 'date not set'}`
    : days === null ? 'No recent order' : days < 0 ? `Overdue by ${Math.abs(days)} days` : days === 0 ? 'Due today' : `Due in ${days} days`;
  const safeSupplierUrl = safeUrl(item.supplierUrl);
  const supplier = item.supplier ? escapeHtml(item.supplier) : 'Not set';
  const supplierLoginUrl = safeUrl(item.supplierLoginUrl);
  const procedures = !isOfficeItem(item) && (Array.isArray(item.procedureLinks) ? item.procedureLinks.join(', ') : item.procedureLinks);
  return `<tr>
    <td><div class="supply-cell"><span class="supply-avatar tone-${index % 4}">${escapeHtml(itemInitials(item.name))}</span><span class="supply-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category || 'Other')} <span class="status-pill ${isBackordered(item) ? 'backorder-pill' : needsAttention(item) ? '' : 'healthy'}">${escapeHtml(statusLabel(item))}</span>${procedures ? `<small class="procedure-link-summary">TDO: ${escapeHtml(procedures)}</small>` : ''}</small></span></div></td>
    <td><div class="stock-cell"><div class="stock-numbers"><span>${escapeHtml(item.quantity)} ${escapeHtml(item.unit || 'units')}</span><small>${isOfficeItem(item) ? hasMinimum ? `min ${escapeHtml(Number.isFinite(minimum) ? minimum : '—')}` : 'min not set' : `${escapeHtml(max)} max`}</small></div><div class="stock-track"><div class="stock-fill ${status === 'critical' ? 'critical' : status === 'low' ? 'low' : ''}" style="width:${stockPercent}%"></div></div></div></td>
    <td><span class="treatment-cell">${isOfficeItem(item) ? '<strong>—</strong><small>Reorder by minimum stock</small>' : estimate === null ? '<strong>Not set</strong><small>Add units per procedure</small>' : `<strong>${estimate.toLocaleString()} uses</strong><small>${escapeHtml(item.unitsPerTreatment)} ${escapeHtml(item.unit || 'units')} / procedure</small>`}</span></td>
    <td class="price-cell">${formatCurrency(item.unitPrice)}</td>
    <td><span class="supplier-cell"><strong>${supplier}</strong>${item.supplier ? (safeSupplierUrl ? `<a href="${escapeHtml(safeSupplierUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.supplierContact || 'Dealer website')} ↗</a>` : `<small>${escapeHtml(item.supplierContact || '')}</small>`) : '<small>Add dealer details</small>'}${supplierLoginUrl ? `<a class="supplier-login" href="${escapeHtml(supplierLoginUrl)}" target="_blank" rel="noopener noreferrer">Online ordering ↗</a>` : ''}</span></td>
    <td><span class="cycle-cell"><strong>${cycleLabel}</strong><small class="${isBackordered(item) || days !== null && days <= 0 ? 'due' : ''}">${escapeHtml(nextOrder)}</small></span></td>
    <td><div class="row-actions">${supplierLoginUrl ? `<a class="row-action order-action" href="${escapeHtml(supplierLoginUrl)}" target="_blank" rel="noopener noreferrer" title="Online ordering login" aria-label="Open online ordering login for ${escapeHtml(item.name)}">↗</a>` : ''}<button class="row-action ${isBackordered(item) ? 'backorder-action active' : 'backorder-action'}" data-action="backorder" data-id="${escapeHtml(item.id)}" title="${isBackordered(item) ? 'Update backorder' : 'Flag as backordered'}" aria-label="${isBackordered(item) ? 'Update backorder for' : 'Flag as backordered'} ${escapeHtml(item.name)}">↻</button><button class="row-action" data-action="receive" data-id="${escapeHtml(item.id)}" title="Receive stock" aria-label="Receive stock for ${escapeHtml(item.name)}">＋</button><button class="row-action" data-action="edit" data-id="${escapeHtml(item.id)}" title="Edit item" aria-label="Edit ${escapeHtml(item.name)}">···</button></div></td>
  </tr>`;
}

function safeUrl(value) {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function resetItemForm() {
  $('#item-form').reset();
  $('#item-id').value = '';
  $('#item-dialog-title').textContent = 'Add an item';
  $('#item-unit').value = '';
  $('#item-minimum').value = '';
  updateItemCategoryFields();
}

function populateItemCategories(type, selectedCategory) {
  const options = categories[type];
  $('#item-category').innerHTML = options.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  if (selectedCategory && !options.includes(selectedCategory)) {
    $('#item-category').add(new Option(selectedCategory, selectedCategory));
  }
  $('#item-category').value = selectedCategory && [...$('#item-category').options].some((option) => option.value === selectedCategory)
    ? selectedCategory
    : options[0];
}

function updateItemCategoryFields() {
  const office = categories.office.includes($('#item-category').value);
  $('#minimum-quantity-field').hidden = !office;
  $('#procedure-fields').hidden = office;
}

function openItemDialog(item) {
  resetItemForm();
  const itemType = item ? (isOfficeItem(item) ? 'office' : 'clinical') : activeInventoryTab === 'office' ? 'office' : 'clinical';
  populateItemCategories(itemType, item?.category);
  if (!item) $('#item-category').value = categories[itemType][0];
  if (item) {
    $('#item-dialog-title').textContent = 'Edit item';
    $('#item-id').value = item.id;
    $('#item-name').value = item.name || '';
    $('#item-quantity').value = item.quantity ?? 0;
    $('#item-minimum').value = item.minimumQuantity ?? '';
    $('#item-unit').value = item.unit || '';
    $('#item-price').value = item.unitPrice ?? 0;
    $('#item-supplier').value = item.supplier || '';
    $('#item-url').value = item.supplierUrl || '';
    $('#item-login-url').value = item.supplierLoginUrl || '';
    $('#item-contact').value = item.supplierContact || '';
    $('#item-frequency').value = item.orderFrequencyDays ?? '';
    $('#item-procedures').value = Array.isArray(item.procedureLinks) ? item.procedureLinks.join(', ') : item.procedureLinks || '';
    $('#item-usage').value = item.unitsPerTreatment ?? '';
    $('#item-threshold').value = item.reorderThresholdTreatments ?? '';
  }
  updateItemCategoryFields();
  itemDialog.showModal();
}

function openQuantityDialog(item) {
  $('#quantity-item-id').value = item.id;
  $('#quantity-item-name').textContent = item.name;
  $('#quantity-amount').value = '';
  $('#quantity-amount').focus();
  quantityDialog.showModal();
}

function startOrder(item) {
  const dealerUrl = safeUrl(item.supplierLoginUrl) || safeUrl(item.supplierUrl);
  if (!dealerUrl) {
    showToast('Add a valid supplier link to this item before ordering.');
    openItemDialog(item);
    return;
  }
  window.open(dealerUrl, '_blank', 'noopener,noreferrer');
  showToast(`Supplier page opened. Log the purchase when the order is placed.`);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field.trim()); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (rows.length < 2) throw new Error('CSV must include a header row and at least one item.');
  const headers = rows[0].map((header) => header.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

let categoryDraftType = 'clinical';
let categoryDraft = [];
let categoryOriginals = [];
const CSV_FIELDS = ['name', 'category', 'quantity', 'unit', 'minimum_quantity', 'unit_price', 'supplier', 'supplier_url', 'supplier_login_url', 'supplier_contact', 'order_frequency_days', 'procedure_links', 'units_per_procedure', 'reorder_threshold_uses', 'backordered', 'backordered_order_date', 'expected_delivery_date', 'backorder_note'];

function openCategoriesDialog() {
  categoryDraftType = activeInventoryTab === 'office' ? 'office' : 'clinical';
  categoryDraft = [...categories[categoryDraftType]];
  categoryOriginals = [...categories[categoryDraftType]];
  $('#categories-dialog-title').textContent = `Manage ${categoryDraftType} categories`;
  $('#new-category-name').value = '';
  renderCategoryEditor();
  $('#categories-dialog').showModal();
}

function renderCategoryEditor() {
  $('#category-editor-list').innerHTML = categoryDraft.map((name, index) => `
    <div class="category-editor-row">
      <label class="sr-only" for="category-name-${index}">Category name</label>
      <input id="category-name-${index}" data-category-original="${escapeHtml(categoryOriginals[index] || '')}" maxlength="40" required value="${escapeHtml(name)}">
      <button class="row-action category-remove" type="button" data-category-remove="${index}" aria-label="Remove ${escapeHtml(name)}" title="Remove category">×</button>
    </div>`).join('');
}

function saveCategories() {
  const inputs = [...$('#category-editor-list').querySelectorAll('[data-category-original]')];
  const values = inputs.map((input) => input.value.trim());
  if (!values.length || values.some((name) => !name)) {
    showToast('Keep at least one non-empty category for each tab.');
    return false;
  }
  const uniqueNames = new Set(values.map((name) => name.toLocaleLowerCase()));
  if (uniqueNames.size !== values.length) {
    showToast('Category names must be unique within this tab.');
    return false;
  }
  const otherType = categoryDraftType === 'office' ? 'clinical' : 'office';
  const otherNames = new Set(categories[otherType].map((name) => name.toLocaleLowerCase()));
  if (values.some((name) => otherNames.has(name.toLocaleLowerCase()))) {
    showToast('Use different category names for Clinical and Office.');
    return false;
  }
  const originalNames = categories[categoryDraftType];
  const removed = originalNames.filter((oldName) => !inputs.some((input) => input.dataset.categoryOriginal === oldName));
  const assignedRemoved = items.filter((item) => {
    const sameType = categoryDraftType === 'office' ? isOfficeItem(item) : !isOfficeItem(item);
    return sameType && removed.includes(item.category);
  });
  if (assignedRemoved.length) {
    showToast('Reassign items before removing a category.');
    return false;
  }
  for (const input of inputs) {
    const previousName = input.dataset.categoryOriginal;
    const updatedName = input.value.trim();
    if (previousName && updatedName !== previousName) {
      for (const item of items) {
        const sameType = categoryDraftType === 'office' ? isOfficeItem(item) : !isOfficeItem(item);
        if (sameType && item.category === previousName) item.category = updatedName;
      }
    }
  }
  categories[categoryDraftType] = values;
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } catch (error) {
    console.error('Unable to save inventory categories.', error);
    showToast('Could not save your categories in this browser.');
    return false;
  }
  saveItems();
  $('#categories-dialog').close();
  render();
  showToast('Categories updated.');
  return true;
}

function openBackorderDialog(item) {
  $('#backorder-item-id').value = item.id;
  $('#backorder-item-name').textContent = item.name;
  $('#backorder-ordered-date').value = item.backorder?.orderedDate || dateInputValue();
  $('#backorder-eta').value = item.backorder?.expectedDate || '';
  $('#backorder-note').value = item.backorder?.note || '';
  $('#clear-backorder-button').hidden = !isBackordered(item);
  $('#backorder-dialog').showModal();
}

function openEquipmentDialog(item) {
  $('#equipment-form').reset();
  $('#equipment-id').value = item?.id || '';
  $('#equipment-dialog-title').textContent = item ? 'Edit equipment' : 'Add equipment';
  $('#equipment-name').value = item?.name || '';
  $('#equipment-category').value = item?.category || 'Clinical equipment';
  $('#equipment-serial').value = item?.serialNumber || '';
  $('#equipment-purchase-date').value = item?.purchaseDate || '';
  $('#equipment-purchase-price').value = item?.purchasePrice ?? '';
  $('#equipment-warranty').value = item?.warrantyExpiration || '';
  $('#equipment-supplier').value = item?.supplier || '';
  $('#equipment-contact').value = item?.supplierContact || '';
  $('#equipment-url').value = item?.supplierUrl || '';
  $('#equipment-login-url').value = item?.supplierLoginUrl || '';
  $('#repair-provider-name').value = item?.repairProviderName || '';
  $('#repair-provider-contact').value = item?.repairProviderContact || '';
  $('#repair-provider-url').value = item?.repairProviderUrl || '';
  $('#equipment-notes').value = item?.notes || '';
  $('#equipment-budget-hint').textContent = item
    ? 'Existing purchase expenses are not counted again when equipment details are edited.'
    : 'A new equipment purchase is included in this month’s budget when a price is entered.';
  $('#equipment-dialog').showModal();
}

function recordExpense(expense) {
  const record = { id: `expense-${crypto.randomUUID()}`, ...expense };
  expenses.push(record);
  saveExpenses();
  return record;
}

$('#today-label').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
$('#add-item-button').addEventListener('click', () => openItemDialog());
$('#empty-add-button').addEventListener('click', () => openItemDialog());
$('#item-category').addEventListener('change', updateItemCategoryFields);
$('#search-input').addEventListener('input', render);
$('#category-filter').addEventListener('change', render);
$('#status-filter').addEventListener('change', render);
$('#view-queue-button').addEventListener('click', () => {
  activeQueueFilter = !activeQueueFilter;
  render();
  $('#inventory').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#clinical-tab').addEventListener('click', () => { setInventoryTab('clinical'); render(); });
$('#office-tab').addEventListener('click', () => { setInventoryTab('office'); render(); });
$('#equipment-tab').addEventListener('click', () => { setInventoryTab('equipment'); render(); });
$('#manage-categories-button').addEventListener('click', openCategoriesDialog);
$('#add-category-button').addEventListener('click', () => {
  const name = $('#new-category-name').value.trim();
  if (!name) { showToast('Enter a category name first.'); return; }
  const editedNames = [...$('#category-editor-list').querySelectorAll('[data-category-original]')].map((input) => input.value.trim());
  if ([...editedNames, ...categoryDraft.slice(editedNames.length)].some((category) => category.toLocaleLowerCase() === name.toLocaleLowerCase())
      || categories[categoryDraftType === 'office' ? 'clinical' : 'office'].some((category) => category.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    showToast('That category already exists.');
    return;
  }
  categoryDraft = [...editedNames, ...categoryDraft.slice(editedNames.length), name];
  categoryOriginals.push('');
  $('#new-category-name').value = '';
  renderCategoryEditor();
});
$('#category-editor-list').addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-category-remove]');
  if (!removeButton) return;
  const index = Number(removeButton.dataset.categoryRemove);
  const input = [...$('#category-editor-list').querySelectorAll('[data-category-original]')][index];
  const editorValues = [...$('#category-editor-list').querySelectorAll('[data-category-original]')].map((entry) => entry.value.trim());
  categoryDraft = [...editorValues, ...categoryDraft.slice(editorValues.length)];
  const original = input?.dataset.categoryOriginal;
  if (categoryDraft.length <= 1) {
    showToast('Each tab needs at least one category.');
    return;
  }
  if (original && items.some((item) => item.category === original && (categoryDraftType === 'office' ? isOfficeItem(item) : !isOfficeItem(item)))) {
    showToast('Reassign items before removing a category.');
    return;
  }
  categoryDraft.splice(index, 1);
  categoryOriginals.splice(index, 1);
  renderCategoryEditor();
});
$('#categories-form').addEventListener('submit', (event) => {
  event.preventDefault();
  saveCategories();
});
$('#new-category-name').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    $('#add-category-button').click();
  }
});
$('#add-equipment-button').addEventListener('click', () => openEquipmentDialog());
$('#equipment-empty-add-button').addEventListener('click', () => openEquipmentDialog());
$('#budget-edit-button').addEventListener('click', () => {
  $('#budget-amount').value = monthlyBudget ?? '';
  $('#budget-dialog').showModal();
});
$('#budget-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const amount = Number($('#budget-amount').value);
  if (!Number.isFinite(amount) || amount < 0) { showToast('Enter a valid monthly budget.'); return; }
  monthlyBudget = amount;
  saveBudget();
  $('#budget-dialog').close();
  render();
  showToast('Monthly budget updated.');
});
$('#equipment-nav-link').addEventListener('click', (event) => {
  event.preventDefault();
  setInventoryTab('equipment', true);
  render();
});
document.querySelector('.nav-link[href="#inventory"]').addEventListener('click', (event) => {
  event.preventDefault();
  setInventoryTab('clinical', true);
  render();
});

$('#log-purchase-button').addEventListener('click', () => {
  if (!items.length) { showToast('Add a supply before logging a purchase.'); return; }
  $('#purchase-item').innerHTML = items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
  $('#purchase-form').reset();
  $('#purchase-date').value = dateInputValue();
  $('#purchase-dialog').showModal();
});

$('#purchase-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const item = items.find((entry) => entry.id === $('#purchase-item').value);
  const amount = Number($('#purchase-total').value);
  const received = $('#purchase-quantity').value === '' ? null : Number($('#purchase-quantity').value);
  const date = $('#purchase-date').value;
  if (!item || !Number.isFinite(amount) || amount <= 0 || !date || (received !== null && (!Number.isFinite(received) || received < 0))) {
    showToast('Enter a valid purchase total, date, and quantity.');
    return;
  }
  recordExpense({ date, amount, type: 'supply', itemId: item.id, itemName: item.name });
  if (received !== null && received > 0) {
    item.quantity = Number((Number(item.quantity) + received).toFixed(4));
    item.maxStock = Math.max(Number(item.maxStock) || 0, item.quantity);
  }
  item.lastOrderedAt = new Date(`${date}T12:00:00`).toISOString();
  saveItems();
  $('#purchase-dialog').close();
  render();
  showToast(`Purchase for ${item.name} recorded.`);
});

$('#item-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const id = $('#item-id').value;
  const existing = items.find((item) => item.id === id);
  const quantity = Number(form.get('quantity'));
  const unitPrice = Number(form.get('unitPrice'));
  const minimumQuantity = form.get('minimumQuantity') === '' ? null : Number(form.get('minimumQuantity'));
  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(unitPrice) || unitPrice < 0
      || (minimumQuantity !== null && (!Number.isFinite(minimumQuantity) || minimumQuantity < 0))) {
    showToast('Enter valid non-negative quantity and price values.');
    return;
  }
  const supplierUrl = String(form.get('supplierUrl') || '').trim();
  const supplierLoginUrl = String(form.get('supplierLoginUrl') || '').trim();
  for (const [selector, value, label] of [
    ['#item-url', supplierUrl, 'dealer website'],
    ['#item-login-url', supplierLoginUrl, 'online ordering login']
  ]) {
    if (value && !safeUrl(value)) {
      $(selector).setCustomValidity(`Enter a valid ${label} starting with https:// or http://.`);
      $(selector).reportValidity();
      $(selector).setCustomValidity('');
      return;
    }
  }
  const updatedItem = {
    ...existing,
    id: id || `item-${crypto.randomUUID()}`,
    name: String(form.get('name')).trim(),
    category: String(form.get('category')),
    quantity,
    minimumQuantity: categories.office.includes(String(form.get('category'))) ? minimumQuantity : null,
    unit: String(form.get('unit') || '').trim() || 'units',
    inventoryType: categories.office.includes(String(form.get('category'))) ? 'office' : 'clinical',
    unitPrice,
    supplier: String(form.get('supplier') || '').trim(),
    supplierUrl,
    supplierLoginUrl,
    supplierContact: String(form.get('supplierContact') || '').trim(),
    orderFrequencyDays: form.get('orderFrequencyDays') === '' ? null : Number(form.get('orderFrequencyDays')),
    procedureLinks: categories.office.includes(String(form.get('category'))) ? '' : String(form.get('procedureLinks') || '').split(',').map((procedure) => procedure.trim()).filter(Boolean).join(', '),
    unitsPerTreatment: categories.office.includes(String(form.get('category'))) || form.get('unitsPerTreatment') === '' ? null : Number(form.get('unitsPerTreatment')),
    reorderThresholdTreatments: categories.office.includes(String(form.get('category'))) || form.get('reorderThresholdTreatments') === '' ? null : Number(form.get('reorderThresholdTreatments')),
    maxStock: existing?.maxStock && quantity <= existing.maxStock ? existing.maxStock : Math.max(quantity, existing?.maxStock || 0)
  };
  if (existing) items = items.map((item) => item.id === id ? updatedItem : item);
  else items.push({ ...updatedItem, lastOrderedAt: null });
  saveItems();
  itemDialog.close();
  render();
  showToast(existing ? 'Supply details updated.' : 'Supply added to your inventory.');
});

$('#quantity-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const item = items.find((entry) => entry.id === $('#quantity-item-id').value);
  const amount = Number($('#quantity-amount').value);
  if (!item || !Number.isFinite(amount) || amount <= 0) {
    showToast('Enter a quantity greater than zero.');
    return;
  }
  item.quantity = Number((Number(item.quantity) + amount).toFixed(4));
  item.maxStock = Math.max(Number(item.maxStock) || 0, item.quantity);
  const clearedBackorder = isBackordered(item);
  if (clearedBackorder) item.backorder = null;
  saveItems();
  quantityDialog.close();
  render();
  showToast(clearedBackorder ? `Stock received; backorder cleared for ${item.name}.` : `${amount} ${item.unit || 'units'} received for ${item.name}.`);
});

$('#backorder-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const item = items.find((entry) => entry.id === $('#backorder-item-id').value);
  const orderedDate = $('#backorder-ordered-date').value;
  const expectedDate = $('#backorder-eta').value;
  if (!item || !orderedDate || (expectedDate && expectedDate < orderedDate)) {
    showToast('Enter a valid order date and expected delivery date.');
    return;
  }
  item.backorder = { orderedDate, expectedDate, note: $('#backorder-note').value.trim() };
  item.lastOrderedAt = new Date(`${orderedDate}T12:00:00`).toISOString();
  saveItems();
  $('#backorder-dialog').close();
  render();
  showToast(`${item.name} flagged as backordered.`);
});

$('#clear-backorder-button').addEventListener('click', () => {
  const item = items.find((entry) => entry.id === $('#backorder-item-id').value);
  if (!item) return;
  item.backorder = null;
  saveItems();
  $('#backorder-dialog').close();
  render();
  showToast(`Backorder flag cleared for ${item.name}.`);
});

$('#equipment-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const id = $('#equipment-id').value;
  const existing = equipment.find((item) => item.id === id);
  const priceValue = $('#equipment-purchase-price').value;
  const purchasePrice = priceValue === '' ? null : Number(priceValue);
  const purchaseDate = $('#equipment-purchase-date').value;
  if (purchasePrice !== null && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) {
    showToast('Enter a valid equipment purchase price.');
    return;
  }
  if (purchasePrice !== null && purchasePrice > 0 && !purchaseDate) {
    $('#equipment-purchase-date').setCustomValidity('Add the purchase date to record this expense.');
    $('#equipment-purchase-date').reportValidity();
    $('#equipment-purchase-date').setCustomValidity('');
    return;
  }
  const supplierUrl = $('#equipment-url').value.trim();
  const supplierLoginUrl = $('#equipment-login-url').value.trim();
  const repairProviderUrl = $('#repair-provider-url').value.trim();
  for (const [selector, value, label] of [
    ['#equipment-url', supplierUrl, 'dealer website'],
    ['#equipment-login-url', supplierLoginUrl, 'online ordering login'],
    ['#repair-provider-url', repairProviderUrl, 'repair company website']
  ]) {
    if (value && !safeUrl(value)) {
      $(selector).setCustomValidity(`Enter a valid ${label} starting with https:// or http://.`);
      $(selector).reportValidity();
      $(selector).setCustomValidity('');
      return;
    }
  }
  const updated = {
    ...existing,
    id: id || `equipment-${crypto.randomUUID()}`,
    name: $('#equipment-name').value.trim(),
    category: $('#equipment-category').value,
    serialNumber: $('#equipment-serial').value.trim(),
    purchaseDate,
    purchasePrice,
    warrantyExpiration: $('#equipment-warranty').value,
    supplier: $('#equipment-supplier').value.trim(),
    supplierContact: $('#equipment-contact').value.trim(),
    supplierUrl,
    supplierLoginUrl,
    repairProviderName: $('#repair-provider-name').value.trim(),
    repairProviderContact: $('#repair-provider-contact').value.trim(),
    repairProviderUrl,
    notes: $('#equipment-notes').value.trim(),
    repairs: existing?.repairs || [],
    issues: existing?.issues || []
  };
  if (!updated.purchaseExpenseId && purchasePrice > 0 && purchaseDate) {
    const expense = recordExpense({ date: purchaseDate, amount: purchasePrice, type: 'equipment', itemId: updated.id, itemName: updated.name });
    updated.purchaseExpenseId = expense.id;
  } else if (updated.purchaseExpenseId) {
    const purchaseExpense = expenses.find((expense) => expense.id === updated.purchaseExpenseId);
    if (purchaseExpense && purchasePrice > 0 && purchaseDate) {
      purchaseExpense.amount = purchasePrice;
      purchaseExpense.date = purchaseDate;
      purchaseExpense.itemName = updated.name;
      saveExpenses();
    } else if (purchaseExpense && (purchasePrice === null || purchasePrice === 0)) {
      expenses = expenses.filter((expense) => expense.id !== updated.purchaseExpenseId);
      updated.purchaseExpenseId = null;
      saveExpenses();
    }
  }
  if (existing) equipment = equipment.map((item) => item.id === id ? updated : item);
  else equipment.push(updated);
  saveEquipment();
  $('#equipment-dialog').close();
  render();
  showToast(existing ? 'Equipment details updated.' : 'Equipment added to your records.');
});

$('#repair-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const item = equipment.find((entry) => entry.id === $('#repair-equipment-id').value);
  const date = $('#repair-date').value;
  const description = $('#repair-description').value.trim();
  const cost = $('#repair-cost').value === '' ? 0 : Number($('#repair-cost').value);
  if (!item || !date || !description || !Number.isFinite(cost) || cost < 0) {
    showToast('Enter a repair description, date, and valid cost.');
    return;
  }
  if (!Array.isArray(item.repairs)) item.repairs = [];
  item.repairs.push({ id: `repair-${crypto.randomUUID()}`, date, description, cost });
  if (cost > 0) recordExpense({ date, amount: cost, type: 'repair', itemId: item.id, itemName: item.name, description });
  saveEquipment();
  $('#repair-dialog').close();
  render();
  showToast(`Repair recorded for ${item.name}.`);
});

$('#issue-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const item = equipment.find((entry) => entry.id === $('#issue-equipment-id').value);
  const description = $('#issue-description').value.trim();
  const reportedAt = $('#issue-date').value;
  if (!item || !description || !reportedAt) {
    showToast('Add an issue summary and reported date.');
    return;
  }
  if (!Array.isArray(item.issues)) item.issues = [];
  item.issues.push({
    id: `issue-${crypto.randomUUID()}`,
    description,
    details: $('#issue-details').value.trim(),
    reportedAt,
    resolved: false,
    resolvedAt: null
  });
  saveEquipment();
  $('#issue-dialog').close();
  render();
  showToast(`Issue logged for ${item.name}.`);
});

document.addEventListener('click', (event) => {
  const closeButton = event.target.closest('[data-close-dialog]');
  if (closeButton) closeButton.closest('dialog').close();
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  if (actionButton.dataset.action === 'equipment-edit' || actionButton.dataset.action === 'repair'
      || actionButton.dataset.action === 'issue' || actionButton.dataset.action === 'toggle-issue') {
    const equipmentItem = equipment.find((entry) => entry.id === actionButton.dataset.id);
    if (!equipmentItem) return;
    if (actionButton.dataset.action === 'equipment-edit') openEquipmentDialog(equipmentItem);
    else if (actionButton.dataset.action === 'repair') {
      $('#repair-form').reset();
      $('#repair-equipment-id').value = equipmentItem.id;
      $('#repair-equipment-name').textContent = equipmentItem.name;
      $('#repair-date').value = dateInputValue();
      $('#repair-dialog').showModal();
    } else if (actionButton.dataset.action === 'issue') {
      $('#issue-form').reset();
      $('#issue-equipment-id').value = equipmentItem.id;
      $('#issue-equipment-name').textContent = equipmentItem.name;
      $('#issue-date').value = dateInputValue();
      $('#issue-dialog').showModal();
    } else {
      const issue = (equipmentItem.issues || []).find((entry) => entry.id === actionButton.dataset.issueId);
      if (!issue) return;
      issue.resolved = !issue.resolved;
      issue.resolvedAt = issue.resolved ? dateInputValue() : null;
      saveEquipment();
      render();
      showToast(issue.resolved ? 'Issue marked resolved.' : 'Issue reopened.');
    }
    return;
  }
  const item = items.find((entry) => entry.id === actionButton.dataset.id);
  if (!item) return;
  if (actionButton.dataset.action === 'edit') openItemDialog(item);
  else if (actionButton.dataset.action === 'receive') openQuantityDialog(item);
  else if (actionButton.dataset.action === 'order') startOrder(item);
  else if (actionButton.dataset.action === 'backorder') openBackorderDialog(item);
});

$('#import-button').addEventListener('click', () => $('#csv-file').click());
$('#csv-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = parseCsv(await file.text());
      const invalid = imported.filter((row) => {
        const requiredQuantity = Number(row.quantity);
        const optionalNumbers = ['minimum_quantity', 'unit_price', 'order_frequency_days', 'units_per_procedure', 'units_per_treatment', 'reorder_threshold_uses', 'reorder_threshold_treatments']
          .filter((key) => row[key] !== '')
          .map((key) => Number(row[key]));
        return !row.name || row.quantity === '' || !Number.isFinite(requiredQuantity) || requiredQuantity < 0
          || optionalNumbers.some((number) => !Number.isFinite(number) || number < 0)
          || (row.order_frequency_days !== '' && Number(row.order_frequency_days) === 0)
          || (row.supplier_url && !safeUrl(row.supplier_url))
          || (row.supplier_login_url && !safeUrl(row.supplier_login_url));
      });
    if (invalid.length) throw new Error(`${invalid.length} row(s) need a name and a valid non-negative quantity.`);
    const importedCategories = { clinical: [...categories.clinical], office: [...categories.office] };
    const created = imported.map((row) => {
      const readNumber = (key) => row[key] === '' ? null : Number(row[key]);
      const category = row.category || 'Other';
      const inventoryType = importedCategories.office.includes(category) ? 'office'
        : importedCategories.clinical.includes(category) ? 'clinical'
          : activeInventoryTab === 'office' ? 'office' : 'clinical';
      if (!importedCategories[inventoryType].includes(category)) importedCategories[inventoryType].push(category);
      return {
        id: `item-${crypto.randomUUID()}`,
        name: row.name,
        category,
        inventoryType,
        quantity: Number(row.quantity),
        unit: row.unit || 'units',
        minimumQuantity: readNumber('minimum_quantity'),
        unitPrice: readNumber('unit_price') ?? 0,
        supplier: row.supplier || '',
        supplierUrl: row.supplier_url || '',
        supplierLoginUrl: row.supplier_login_url || '',
        supplierContact: row.supplier_contact || '',
        orderFrequencyDays: readNumber('order_frequency_days'),
        procedureLinks: row.procedure_links || '',
        unitsPerTreatment: readNumber('units_per_procedure') ?? readNumber('units_per_treatment'),
        reorderThresholdTreatments: readNumber('reorder_threshold_uses') ?? readNumber('reorder_threshold_treatments'),
        maxStock: Number(row.quantity),
        lastOrderedAt: row.backordered_order_date && /^\d{4}-\d{2}-\d{2}$/.test(row.backordered_order_date) ? new Date(`${row.backordered_order_date}T12:00:00`).toISOString() : null,
        backorder: ['true', 'yes', '1'].includes(String(row.backordered || '').toLowerCase())
          ? {
            orderedDate: row.backordered_order_date && /^\d{4}-\d{2}-\d{2}$/.test(row.backordered_order_date) ? row.backordered_order_date : '',
            expectedDate: row.expected_delivery_date && /^\d{4}-\d{2}-\d{2}$/.test(row.expected_delivery_date) ? row.expected_delivery_date : '',
            note: row.backorder_note || ''
          }
          : null
      };
    });
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(importedCategories));
    categories = importedCategories;
    items = [...items, ...created];
    saveItems();
    render();
    showToast(`${created.length} ${created.length === 1 ? 'item' : 'items'} imported.`);
  } catch (error) {
    console.error('Unable to import inventory CSV.', error);
    showToast(error.message || 'Could not read this CSV. Check the file format and try again.');
  } finally {
    event.target.value = '';
  }
});

$('#export-button').addEventListener('click', () => {
  const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [CSV_FIELDS, ...items.map((item) => [
    item.name, item.category, item.quantity, item.unit || 'units', item.minimumQuantity, item.unitPrice, item.supplier, item.supplierUrl,
    item.supplierLoginUrl, item.supplierContact, item.orderFrequencyDays,
    Array.isArray(item.procedureLinks) ? item.procedureLinks.join(', ') : item.procedureLinks,
    item.unitsPerTreatment, item.reorderThresholdTreatments, isBackordered(item),
    item.backorder?.orderedDate || '', item.backorder?.expectedDate || '', item.backorder?.note || ''
  ])];
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
  const blobUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `supply-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(blobUrl);
  showToast('Your inventory CSV is ready.');
});

render();
