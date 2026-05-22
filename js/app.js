if (!requireAuth()) {
  throw new Error("Não autenticado");
}

let user = getCurrentUser();
let savedCategories = [];
let draftCategories = [];
let allocationChart = null;
let editingCategoryId = null;
let editSyncLock = false;
let editingDraftIndex = null;

let allocationInputMode = "percent";

const allocationHints = {
  percent: "Informe a % de cada categoria. O total é a soma — pode ultrapassar 100%.",
  value: "Informe o valor em reais; a % é calculada pela renda. O total pode passar de 100%.",
};

function persistUser(partial) {
  saveUserData(user.loginName, partial);
  user = getCurrentUser();
  migrateUserProfiles();
}

function reloadSaved() {
  AppFeatures.loadProfileData();
}

function persistSavedCategories() {
  AppFeatures.persistAll();
}

function findCategoryById(id) {
  return savedCategories.find((c) => c.id === id);
}

function applyFixedToggle(cat, enableFixed) {
  const income = AppFeatures.getIncome();
  const resolved = Alloc.resolveCategory(cat, income);
  if (enableFixed) {
    cat.fixedValue = true;
    cat.estimatedValue = resolved.estimatedValue;
    cat.percent = resolved.percent;
  } else {
    cat.fixedValue = false;
    cat.percent = resolved.percent;
    cat.estimatedValue = resolved.estimatedValue;
  }
}

function buildDraftCategory(fields) {
  const { item, structuralGroup, category, percent, income, lockValue, valueFromInput, essential } = fields;
  const entry = {
    id: generateCategoryId(),
    item,
    structuralGroup: structuralGroup || "",
    category: category || "",
    percent,
    essential: Boolean(essential),
    fixedValue: false,
  };
  const amount =
    valueFromInput != null
      ? Alloc.roundMoney(valueFromInput)
      : Alloc.roundMoney(Alloc.categoryAmount(income, percent));
  entry.estimatedValue = amount;
  if (lockValue) {
    entry.fixedValue = true;
    entry.percent = income > 0 ? Alloc.roundMoney(Alloc.percentFromValue(income, amount)) : percent;
  }
  return entry;
}

function fillEditForm(cat) {
  const income = AppFeatures.getIncome();
  const resolved = Alloc.resolveCategory(cat, income);
  document.getElementById("edit-item").value = cat.item;
  document.getElementById("edit-structural-group").value = cat.structuralGroup || "";
  document.getElementById("edit-category-label").value = cat.category || "";
  document.getElementById("edit-percent").value = resolved.percent;
  document.getElementById("edit-estimated-value").value = resolved.estimatedValue.toFixed(2).replace(".", ",");
  document.getElementById("edit-essential").checked = Boolean(cat.essential);
  document.getElementById("edit-lock-value").checked = Boolean(cat.fixedValue);
}

document.getElementById("logout-btn").addEventListener("click", () => {
  logout();
  window.location.href = "index.html";
});

function initProfile() {
  document.getElementById("user-badge").textContent = user.displayName || user.loginName;
  document.getElementById("profile-name").value = user.displayName || user.loginName;
  document.getElementById("profile-login").textContent = user.loginName;
  document.getElementById("profile-id").textContent = user.id || "—";

  document.getElementById("profile-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const displayName = document.getElementById("profile-name").value.trim();
    persistUser({ displayName: displayName || user.loginName });
    document.getElementById("user-badge").textContent = user.displayName;
    showToast("Perfil salvo.");
  });
}

function initIncome() {
  const input = document.getElementById("monthly-income");
  const ded = document.getElementById("monthly-deductions");
  input.value = user.monthlyIncome || "";
  if (ded) ded.value = user.monthlyDeductions || "";
  document.getElementById("income-display").textContent = formatCurrency(Alloc.getNetIncome(user));
  const netEl = document.getElementById("income-net-display");
  if (netEl) netEl.textContent = formatCurrency(Alloc.getNetIncome(user));
}

function renderCategoryList() {
  const list = document.getElementById("category-list");
  const income = AppFeatures.getIncome();
  list.innerHTML = "";

  draftCategories.forEach((cat, index) => {
    const li = document.createElement("li");
    li.style.setProperty("--cat-color", CHART_COLORS[index % CHART_COLORS.length]);
    const { percent, estimatedValue } = Alloc.resolveCategory(cat, income);
    const essentialBadge = cat.essential ? '<span class="badge-essential">essencial</span>' : "";
    const lockBadge = cat.fixedValue ? '<span class="badge-fixed">travado</span>' : "";
    li.innerHTML = `
      <div class="cat-info">
        <span class="cat-name">${escapeHtml(cat.item)} ${essentialBadge} ${lockBadge}</span>
        <span class="hint">${escapeHtml(cat.structuralGroup || "—")} · ${escapeHtml(cat.category || "—")}</span>
        <span class="cat-value">${percent}% — ${formatCurrency(estimatedValue)}</span>
      </div>
      <div class="cat-actions">
        <button type="button" class="btn-table btn-edit-draft" data-index="${index}">Editar</button>
        <button type="button" class="btn-icon" data-index="${index}" aria-label="Remover">×</button>
      </div>
    `;
    li.querySelector(".btn-icon").addEventListener("click", () => {
      draftCategories.splice(index, 1);
      updateAllocationUI();
    });
    li.querySelector(".btn-edit-draft").addEventListener("click", () => openDraftEditModal(index));
    list.appendChild(li);
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function updatePercentBar(total) {
  const bar = document.getElementById("percent-bar");
  bar.style.width = `${Math.min(total, 100)}%`;
  bar.classList.remove("over", "complete");
  if (total > 100) bar.classList.add("over");
  else if (Math.abs(total - 100) < 0.01) bar.classList.add("complete");

  const label = document.getElementById("percent-total");
  const income = AppFeatures.getIncome();
  const totalValue = Alloc.sumCategoryValues(income, draftCategories);
  let labelText = `Total: ${total.toFixed(2)}%`;
  if (income > 0) {
    labelText += ` · ${formatCurrency(totalValue)}`;
    if (total > 100.01) {
      labelText += ` (${formatCurrency(Alloc.roundMoney(totalValue - income))} acima da renda)`;
    } else {
      labelText += ` de ${formatCurrency(income)}`;
    }
  }
  label.textContent = labelText;
  label.classList.toggle("ok", draftCategories.length > 0);
  label.classList.toggle("warn", total > 100);
}

function toggleDraftSummary(show) {
  document.getElementById("category-list").hidden = !show;
  document.querySelector(".percent-bar-wrap").hidden = !show;
  document.getElementById("percent-total").hidden = !show;
}

function updateAllocationUI() {
  const income = AppFeatures.getIncome();
  const draftTotal = Alloc.sumEffectivePercent(draftCategories, income);
  const hasDraft = draftCategories.length > 0;

  toggleDraftSummary(hasDraft);
  updatePercentBar(draftTotal);
  renderCategoryList();
  renderAllocationTable();
  renderChart();

  document.getElementById("save-allocation-btn").disabled = !hasDraft;
  showAllocError("");

  const statusEl = document.getElementById("allocation-remaining");
  if (hasDraft) {
    const combinedTotal = Alloc.sumEffectivePercent([...savedCategories, ...draftCategories], income);
    const overClass = combinedTotal > 100.01 ? " draft-total-over" : "";
    statusEl.innerHTML = `Rascunho: ${draftTotal.toFixed(2)}% <span class="draft-total-part${overClass}">(${combinedTotal.toFixed(2)}% no total com esta adição)</span>`;
    statusEl.hidden = false;
  } else {
    statusEl.hidden = true;
  }
  AppFeatures.renderDashboard();
  requestAnimationFrame(() => syncChartCardHeight());
}

function setAllocationInputMode(mode) {
  allocationInputMode = mode;
  const isPercent = mode === "percent";
  document.getElementById("field-percent").hidden = !isPercent;
  document.getElementById("field-value").hidden = isPercent;
  document.getElementById("category-percent").required = isPercent;
  document.getElementById("category-value").required = !isPercent;
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  document.getElementById("allocation-hint").textContent = allocationHints[mode];
  updateAllocationUI();
}

function showAllocError(message) {
  const err = document.getElementById("allocation-error");
  err.textContent = message;
  err.hidden = !message;
}

function showEditError(message) {
  const err = document.getElementById("edit-category-error");
  if (!err) return;
  err.textContent = message;
  err.hidden = !message;
}

function renderAllocationTable() {
  const tbody = document.querySelector("#allocation-table tbody");
  const income = AppFeatures.getIncome();
  tbody.innerHTML = "";
  const sorted = AppFeatures.sortCategories(savedCategories);

  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Nenhuma alocação salva.</td></tr>`;
  } else {
    sorted.forEach((cat, i) => {
      const tr = document.createElement("tr");
      const { percent, estimatedValue } = Alloc.resolveCategory(cat, income);
      const lockHint = cat.fixedValue ? ' <span class="badge-fixed">travado</span>' : "";
      tr.innerHTML = `
        <td><span style="color:${CHART_COLORS[i % CHART_COLORS.length]}">●</span> ${escapeHtml(cat.item)}${lockHint}</td>
        <td>${escapeHtml(cat.structuralGroup || "—")}</td>
        <td>${escapeHtml(cat.category || "—")}</td>
        <td>${formatCurrency(estimatedValue)}</td>
        <td>${percent}%</td>
        <td class="cell-essential"><span class="essential-label ${cat.essential ? "essential-yes" : "essential-no"}">${cat.essential ? "Essencial" : "Não Essencial"}</span></td>
        <td class="cell-actions">
          <button type="button" class="btn-table btn-edit">Editar</button>
          <button type="button" class="btn-table btn-dup">Duplicar</button>
          <button type="button" class="btn-table btn-remove">Remover</button>
        </td>
      `;
      tr.querySelector(".btn-edit").addEventListener("click", () => openEditModal(cat.id));
      tr.querySelector(".btn-dup").addEventListener("click", () => AppFeatures.duplicateCategory(cat.id));
      tr.querySelector(".btn-remove").addEventListener("click", () => removeCategory(cat.id));
      tbody.appendChild(tr);
    });
  }

  document.getElementById("table-total-percent").textContent = `${Alloc.sumEffectivePercent(savedCategories, income).toFixed(2)}%`;
  document.getElementById("table-total-value").textContent = formatCurrency(Alloc.sumCategoryValues(income, savedCategories));
}

function renderChart() {
  const canvas = document.getElementById("allocation-chart");
  const empty = document.getElementById("chart-empty");
  const income = AppFeatures.getIncome();
  const hasData = savedCategories.length > 0;

  empty.hidden = hasData;
  canvas.style.display = hasData ? "block" : "none";

  if (!hasData) {
    if (allocationChart) {
      allocationChart.destroy();
      allocationChart = null;
    }
    return;
  }

  const config = getAllocationChartConfig(AppFeatures.chartType, savedCategories, income);
  if (!config) return;

  if (typeof Chart === "undefined") {
    console.error("Chart.js não carregou.");
    return;
  }

  if (allocationChart) {
    allocationChart.destroy();
    allocationChart = null;
  }

  const { type, data, options, meta } = config;
  allocationChart = new Chart(canvas, { type, data, options });
  allocationChart.$meta = meta;

  syncChartCardHeight();
  bindChartResize();
  requestAnimationFrame(() => {
    syncChartCardHeight();
    allocationChart?.resize();
  });
}

let chartResizeObserver = null;
let allocCardResizeObserver = null;

function getAllocationFormCard() {
  return document.getElementById("alloc-form-card") || document.querySelector("#section-allocation .grid-2 > .card:first-child");
}

function syncChartCardHeight() {
  const section = document.getElementById("section-allocation");
  const allocCard = getAllocationFormCard();
  const chartCard = document.getElementById("chart-dist-card") || document.querySelector(".chart-card");
  if (!allocCard || !chartCard || !section?.classList.contains("active")) return;

  if (window.matchMedia("(max-width: 900px)").matches) {
    chartCard.style.height = "";
    chartCard.style.maxHeight = "";
    requestAnimationFrame(() => allocationChart?.resize());
    return;
  }

  const h = allocCard.offsetHeight;
  if (h > 0) {
    chartCard.style.height = `${h}px`;
    chartCard.style.maxHeight = `${h}px`;
  }
  requestAnimationFrame(() => allocationChart?.resize());
}

function bindChartResize() {
  if (typeof ResizeObserver === "undefined") return;

  const wrap = document.querySelector(".chart-wrap");
  if (wrap && !chartResizeObserver) {
    chartResizeObserver = new ResizeObserver(() => allocationChart?.resize());
    chartResizeObserver.observe(wrap);
  }

  const allocCard = getAllocationFormCard();
  if (allocCard && !allocCardResizeObserver) {
    allocCardResizeObserver = new ResizeObserver(() => syncChartCardHeight());
    allocCardResizeObserver.observe(allocCard);
  }
}

window.addEventListener("resize", () => syncChartCardHeight());

function openEditModal(categoryId) {
  const cat = findCategoryById(categoryId);
  if (!cat) return;
  editingDraftIndex = null;
  editingCategoryId = categoryId;
  fillEditForm(cat);
  showEditError("");
  document.getElementById("edit-category-modal").hidden = false;
}

function openDraftEditModal(index) {
  const cat = draftCategories[index];
  if (!cat) return;
  editingDraftIndex = index;
  editingCategoryId = cat.id;
  fillEditForm(cat);
  showEditError("");
  document.getElementById("edit-category-modal").hidden = false;
}

function closeEditModal() {
  editingCategoryId = null;
  editingDraftIndex = null;
  document.getElementById("edit-category-modal").hidden = true;
  showEditError("");
}

function syncEditPercentToValue() {
  if (editSyncLock) return;
  const income = AppFeatures.getIncome();
  const percent = Alloc.parseAmountInput(document.getElementById("edit-percent").value);
  if (!Number.isFinite(percent) || percent <= 0) return;
  editSyncLock = true;
  document.getElementById("edit-estimated-value").value = Alloc.roundMoney(Alloc.categoryAmount(income, percent)).toFixed(2).replace(".", ",");
  editSyncLock = false;
}

function syncEditValueToPercent() {
  if (editSyncLock) return;
  const income = AppFeatures.getIncome();
  const value = Alloc.parseAmountInput(document.getElementById("edit-estimated-value").value);
  if (!Number.isFinite(value) || value <= 0 || !income) return;
  editSyncLock = true;
  document.getElementById("edit-percent").value = Alloc.roundMoney(Alloc.percentFromValue(income, value));
  editSyncLock = false;
}

function saveEditCategory() {
  const isDraft = editingDraftIndex != null;
  const cat = isDraft ? draftCategories[editingDraftIndex] : findCategoryById(editingCategoryId);
  if (!cat) return;

  const item = document.getElementById("edit-item").value.trim();
  const structuralGroup = document.getElementById("edit-structural-group").value.trim();
  const category = document.getElementById("edit-category-label").value.trim();
  const percent = Alloc.parseAmountInput(document.getElementById("edit-percent").value);
  const value = Alloc.parseAmountInput(document.getElementById("edit-estimated-value").value);
  const lockValue = document.getElementById("edit-lock-value").checked;
  const essential = document.getElementById("edit-essential").checked;
  const income = AppFeatures.getIncome();

  if (!item || !Number.isFinite(percent) || percent <= 0 || !Number.isFinite(value) || value <= 0) {
    showEditError("Preencha item, % e valor estimado válidos.");
    return;
  }

  cat.item = item;
  cat.structuralGroup = structuralGroup;
  cat.category = category;
  cat.essential = essential;
  cat.estimatedValue = Alloc.roundMoney(value);
  if (lockValue) {
    cat.fixedValue = true;
    cat.percent = income > 0 ? Alloc.roundMoney(Alloc.percentFromValue(income, cat.estimatedValue)) : percent;
  } else {
    cat.fixedValue = false;
    cat.percent = Alloc.roundMoney(percent);
  }

  if (!isDraft) persistSavedCategories();
  closeEditModal();
  updateAllocationUI();
  showToast(isDraft ? "Rascunho atualizado." : "Alocação atualizada.");
}

function removeCategory(categoryId) {
  const cat = findCategoryById(categoryId);
  if (!cat || !confirm(`Remover "${cat.item}"?`)) return;
  savedCategories = savedCategories.filter((c) => c.id !== categoryId);
  persistSavedCategories();
  updateAllocationUI();
  showToast("Alocação removida.");
}

function fillTaxonomyDatalists() {
  const esc = (v) => {
    const d = document.createElement("div");
    d.textContent = v;
    return d.innerHTML;
  };
  const fill = (id, items) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = items.map((v) => `<option value="${esc(v)}"></option>`).join("");
  };
  fill("datalist-structural-groups", Alloc.STRUCTURAL_GROUPS);
  fill("datalist-categories", Alloc.PRESET_CATEGORIES);
}

const CARD_VISIBILITY_KEY = "financas_card_visibility";

function initCardVisibility() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(CARD_VISIBILITY_KEY) || "{}");
  } catch {
    saved = {};
  }

  document.querySelectorAll(".card-visibility-btn").forEach((btn) => {
    const cardId = btn.dataset.card;
    const card = document.getElementById(cardId);
    if (!card) return;

    const setCollapsed = (collapsed) => {
      card.classList.toggle("collapsed", collapsed);
      btn.setAttribute("aria-pressed", collapsed ? "true" : "false");
      const name = cardId === "chart-dist-card" ? "Distribuição" : "Alocação";
      btn.setAttribute("aria-label", collapsed ? `Mostrar ${name}` : `Ocultar ${name}`);
      btn.title = collapsed ? "Mostrar" : "Ocultar";
      saved[cardId] = collapsed;
      try {
        localStorage.setItem(CARD_VISIBILITY_KEY, JSON.stringify(saved));
      } catch {
        /* ignore */
      }
      if (cardId === "chart-dist-card" || cardId === "alloc-form-card") {
        requestAnimationFrame(() => {
          syncChartCardHeight();
          allocationChart?.resize();
        });
      }
    };

    if (saved[cardId]) setCollapsed(true);

    btn.addEventListener("click", () => setCollapsed(!card.classList.contains("collapsed")));
  });
}

function initAllocation() {
  fillTaxonomyDatalists();
  initCardVisibility();
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setAllocationInputMode(btn.dataset.mode));
  });
  setAllocationInputMode("percent");

  document.getElementById("add-category-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const item = document.getElementById("field-item").value.trim();
    const structuralGroup = document.getElementById("field-structural-group").value.trim();
    const category = document.getElementById("field-category").value.trim();
    const essential = document.getElementById("field-essential").checked;
    const lockValue = document.getElementById("field-lock-value").checked;
    const income = AppFeatures.getIncome();
    let percent;
    let valueFromInput = null;

    if (!item) {
      showAllocError("Informe o item.");
      return;
    }

    if (allocationInputMode === "percent") {
      percent = Alloc.parseAmountInput(document.getElementById("category-percent").value);
      if (!percent || percent <= 0) {
        showAllocError("Informe uma porcentagem maior que zero.");
        return;
      }
      if (lockValue && !income) {
        showAllocError("Cadastre a renda para travar o valor.");
        return;
      }
    } else {
      if (!income) {
        showAllocError("Cadastre a renda na aba Renda.");
        return;
      }
      valueFromInput = Alloc.parseAmountInput(document.getElementById("category-value").value);
      if (!Number.isFinite(valueFromInput) || valueFromInput <= 0) {
        showAllocError("Informe um valor estimado válido.");
        return;
      }
      percent = Alloc.roundMoney(Alloc.percentFromValue(income, valueFromInput));
    }

    draftCategories.push(
      buildDraftCategory({ item, structuralGroup, category, percent, income, lockValue, valueFromInput, essential })
    );
    document.getElementById("add-category-form").reset();
    document.getElementById("field-essential").checked = false;
    document.getElementById("field-lock-value").checked = false;
    setAllocationInputMode(allocationInputMode);
    showAllocError("");
    updateAllocationUI();
  });

  document.getElementById("save-allocation-btn").addEventListener("click", () => {
    savedCategories = [...savedCategories.map(Alloc.cloneCategory), ...draftCategories.map(Alloc.cloneCategory)];
    AppFeatures.persistAll();
    draftCategories = [];
    updateAllocationUI();
    showToast("Alocação salva com sucesso.");
  });

  const editModal = document.getElementById("edit-category-modal");
  document.getElementById("edit-percent").addEventListener("input", syncEditPercentToValue);
  document.getElementById("edit-estimated-value").addEventListener("input", syncEditValueToPercent);
  document.getElementById("edit-category-cancel").addEventListener("click", closeEditModal);
  editModal.addEventListener("click", (e) => { if (e.target === editModal) closeEditModal(); });
  document.getElementById("edit-category-form").addEventListener("submit", (e) => {
    e.preventDefault();
    saveEditCategory();
  });

  bindChartResize();
  updateAllocationUI();
}

function boot() {
  migrateUserProfiles();
  const raw = getCurrentUser().categories || [];
  const migrated = Alloc.migrateCategories(raw);
  if (JSON.stringify(raw) !== JSON.stringify(migrated.map(Alloc.cloneCategory))) {
    persistUser({ categories: migrated });
  }
  AppFeatures.init();
  initProfile();
  initIncome();
  initAllocation();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}
