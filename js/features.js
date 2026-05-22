const APP_SECTIONS = ["dashboard", "profile", "income", "allocation", "simulator", "data"];
const SECTION_STORAGE_KEY = "financas_active_section";

const CHART_TYPE_STORAGE_KEY = "financas_chart_type";

const AppFeatures = {
  sortKey: "item",
  chartType: "doughnut",
  simulatorIncome: null,
  incomeHistoryChart: null,

  sectionTitles: {
    dashboard: "Dashboard",
    profile: "Perfil",
    income: "Renda",
    allocation: "Alocação",
    simulator: "Simulador",
    data: "Dados",
  },

  getIncome() {
    if (AppFeatures.simulatorIncome != null) return AppFeatures.simulatorIncome;
    return Alloc.getNetIncome(user);
  },

  getActiveProfile() {
    migrateUserProfiles();
    return user.profiles.find((p) => p.id === user.activeProfileId) || user.profiles[0];
  },

  loadProfileData() {
    const p = AppFeatures.getActiveProfile();
    const raw = p.categories || [];
    savedCategories = Alloc.migrateCategories(raw);
    if (raw.some((c) => !c.id)) {
      p.categories = savedCategories.map(Alloc.cloneCategory);
      persistUser({ profiles: user.profiles });
    }
    if (p.monthlyIncome != null) user.monthlyIncome = p.monthlyIncome;
    if (p.monthlyDeductions != null) user.monthlyDeductions = p.monthlyDeductions;
  },

  saveProfileData() {
    const p = AppFeatures.getActiveProfile();
    if (!p) return;
    p.categories = savedCategories.map(Alloc.cloneCategory);
    p.monthlyIncome = user.monthlyIncome;
    p.monthlyDeductions = user.monthlyDeductions;
    persistUser({ profiles: user.profiles, activeProfileId: user.activeProfileId });
    reloadSaved();
  },

  persistAll() {
    AppFeatures.saveProfileData();
    FinDB.syncUser(user.loginName, getUsers()[user.loginName]);
  },

  sortCategories(list) {
    const income = AppFeatures.getIncome();
    const sorted = [...list];
    sorted.sort((a, b) => {
      const ra = Alloc.resolveCategory(a, income);
      const rb = Alloc.resolveCategory(b, income);
      switch (AppFeatures.sortKey) {
        case "percent": return rb.percent - ra.percent;
        case "value": return rb.amount - ra.amount;
        case "structuralGroup": return (a.structuralGroup || "").localeCompare(b.structuralGroup || "");
        case "category": return (a.category || "").localeCompare(b.category || "");
        default: return a.item.localeCompare(b.item);
      }
    });
    return sorted;
  },

  renderDashboard() {
    const income = AppFeatures.getIncome();
    const totalPct = Alloc.sumEffectivePercent(savedCategories, income);
    const totalVal = Alloc.sumCategoryValues(income, savedCategories);
    const fixedCount = savedCategories.filter((c) => c.essential).length;

    document.getElementById("dash-income").textContent = formatCurrency(income);
    document.getElementById("dash-allocated-pct").textContent = `${totalPct.toFixed(2)}%`;
    document.getElementById("dash-allocated-val").textContent = formatCurrency(totalVal);
    document.getElementById("dash-categories").textContent = String(savedCategories.length);
    document.getElementById("dash-fixed").textContent = String(fixedCount);

    const diff = income - totalVal;
    const diffEl = document.getElementById("dash-balance");
    if (totalPct > 100.01) {
      diffEl.textContent = `${formatCurrency(Math.abs(diff))} acima da renda`;
      diffEl.className = "stat-value warn";
    } else if (diff > 0.01) {
      diffEl.textContent = formatCurrency(diff);
      diffEl.className = "stat-value ok";
    } else {
      diffEl.textContent = "R$ 0,00";
      diffEl.className = "stat-value";
    }

    const groupsEl = document.getElementById("dash-groups");
    if (!groupsEl) return;
    const groups = Alloc.groupSummary(savedCategories, income);
    groupsEl.innerHTML = Object.entries(groups)
      .map(([name, g]) => `<li><strong>${escapeHtml(name)}</strong> — ${g.percent.toFixed(2)}% · ${formatCurrency(g.amount)}</li>`)
      .join("") || "<li class='hint'>Nenhum grupo</li>";
  },

  renderIncomeHistory() {
    const list = document.getElementById("income-history-list");
    if (!list) return;
    const history = [...(user.incomeHistory || [])].reverse().slice(0, 12);
    list.innerHTML = history.length
      ? history.map((h) => `<li>${new Date(h.date).toLocaleDateString("pt-BR")} — ${formatCurrency(h.net)} (bruto ${formatCurrency(h.gross)})</li>`).join("")
      : "<li class='hint'>Sem histórico ainda.</li>";
    AppFeatures.renderIncomeChart();
  },

  renderIncomeChart() {
    const canvas = document.getElementById("income-history-chart");
    const emptyEl = document.getElementById("income-chart-empty");
    if (!canvas) return;

    const history = user.incomeHistory || [];
    const hasData = history.length > 0;
    if (emptyEl) emptyEl.hidden = hasData;
    canvas.style.display = hasData ? "block" : "none";

    if (!hasData) {
      if (AppFeatures.incomeHistoryChart) {
        AppFeatures.incomeHistoryChart.destroy();
        AppFeatures.incomeHistoryChart = null;
      }
      return;
    }

    const config = buildIncomeHistoryChartConfig(history);
    if (!config) return;

    if (AppFeatures.incomeHistoryChart) {
      AppFeatures.incomeHistoryChart.destroy();
      AppFeatures.incomeHistoryChart = null;
    }
    AppFeatures.incomeHistoryChart = new Chart(canvas, config);
    requestAnimationFrame(() => AppFeatures.incomeHistoryChart?.resize());
  },

  renderProfiles() {
    const sel = document.getElementById("profile-select");
    if (!sel) return;
    sel.innerHTML = user.profiles.map((p) => `<option value="${p.id}" ${p.id === user.activeProfileId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("");
  },

  navigateToSection(section, options = {}) {
    const { skipConfirm = false, updateUrl = true } = options;
    if (!APP_SECTIONS.includes(section)) section = "dashboard";
    if (!skipConfirm && draftCategories.length && !confirm("Há rascunho não salvo. Deseja sair mesmo assim?")) {
      return false;
    }

    document.querySelectorAll(".nav-item").forEach((b) => {
      b.classList.toggle("active", b.dataset.section === section);
    });
    document.querySelectorAll(".section").forEach((s) => {
      s.classList.toggle("active", s.id === `section-${section}`);
    });
    document.getElementById("page-title").textContent = AppFeatures.sectionTitles[section] || section;

    if (section === "dashboard") AppFeatures.renderDashboard();
    if (section === "income") AppFeatures.renderIncomeChart();
    if (section === "simulator") AppFeatures.updateSimulator();
    if (section === "allocation") updateAllocationUI();

    try {
      sessionStorage.setItem(SECTION_STORAGE_KEY, section);
    } catch {
      /* ignore */
    }
    if (updateUrl) {
      const hash = `#${section}`;
      if (location.hash !== hash) history.replaceState(null, "", hash);
    }
    return true;
  },

  getSavedSection() {
    const fromHash = location.hash.replace(/^#/, "");
    if (APP_SECTIONS.includes(fromHash)) return fromHash;
    try {
      const saved = sessionStorage.getItem(SECTION_STORAGE_KEY);
      if (APP_SECTIONS.includes(saved)) return saved;
    } catch {
      /* ignore */
    }
    return "dashboard";
  },

  initSidebarCollapse() {
    const KEY = "financas_sidebar_collapsed";
    const page = document.querySelector(".app-page");
    const sidebar = document.getElementById("sidebar");
    const btn = document.getElementById("sidebar-collapse-btn");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (!page || !sidebar || !btn) return;

    const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

    const updateCollapseBtn = () => {
      const collapsed = page.classList.contains("sidebar-collapsed");
      const open = sidebar.classList.contains("open");
      const hidden = isMobile() ? !open : collapsed;
      btn.setAttribute("aria-label", hidden ? "Mostrar menu" : "Ocultar menu");
      btn.title = hidden ? "Mostrar menu" : "Ocultar menu";
      const label = btn.querySelector(".sidebar-collapse-label");
      if (label) label.textContent = hidden ? "Mostrar menu" : "Ocultar menu";
    };

    const setBackdrop = (show) => {
      if (!backdrop) return;
      backdrop.hidden = !show;
      backdrop.classList.toggle("visible", show);
    };

    if (localStorage.getItem(KEY) === "1" && !isMobile()) {
      page.classList.add("sidebar-collapsed");
    }
    updateCollapseBtn();

    btn.addEventListener("click", () => {
      if (isMobile()) {
        sidebar.classList.toggle("open");
        setBackdrop(sidebar.classList.contains("open"));
      } else {
        page.classList.toggle("sidebar-collapsed");
        localStorage.setItem(KEY, page.classList.contains("sidebar-collapsed") ? "1" : "0");
        if (typeof syncChartCardHeight === "function") {
          requestAnimationFrame(() => syncChartCardHeight());
        }
      }
      updateCollapseBtn();
    });

    backdrop?.addEventListener("click", () => {
      sidebar.classList.remove("open");
      setBackdrop(false);
      updateCollapseBtn();
    });

    window.addEventListener("resize", () => {
      if (!isMobile()) {
        sidebar.classList.remove("open");
        setBackdrop(false);
      }
      updateCollapseBtn();
    });
  },

  initNav() {
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!AppFeatures.navigateToSection(btn.dataset.section)) return;
        if (window.matchMedia("(max-width: 768px)").matches) {
          const sidebar = document.getElementById("sidebar");
          const backdrop = document.getElementById("sidebar-backdrop");
          sidebar?.classList.remove("open");
          if (backdrop) {
            backdrop.hidden = true;
            backdrop.classList.remove("visible");
          }
        }
      });
    });
    window.addEventListener("hashchange", () => {
      const section = location.hash.replace(/^#/, "");
      if (!APP_SECTIONS.includes(section)) return;
      AppFeatures.navigateToSection(section, { skipConfirm: true, updateUrl: false });
    });
    window.addEventListener("beforeunload", (e) => {
      if (draftCategories.length) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
    AppFeatures.navigateToSection(AppFeatures.getSavedSection(), { skipConfirm: true });
  },

  initProfileSection() {
    AppFeatures.renderProfiles();
    document.getElementById("profile-select")?.addEventListener("change", (e) => {
      if (draftCategories.length && !confirm("Rascunho será descartado ao trocar perfil. Continuar?")) {
        e.target.value = user.activeProfileId;
        return;
      }
      AppFeatures.saveProfileData();
      user.activeProfileId = e.target.value;
      persistUser({ activeProfileId: user.activeProfileId });
      AppFeatures.loadProfileData();
      draftCategories = [];
      updateAllocationUI();
      AppFeatures.renderDashboard();
      showToast("Perfil financeiro alterado.");
    });
    document.getElementById("new-profile-btn")?.addEventListener("click", () => {
      const name = prompt("Nome do novo perfil financeiro:");
      if (!name?.trim()) return;
      const id = generateCategoryId();
      user.profiles.push({ id, name: name.trim(), categories: [], monthlyIncome: 0, monthlyDeductions: 0 });
      user.activeProfileId = id;
      persistUser({ profiles: user.profiles, activeProfileId: id });
      AppFeatures.loadProfileData();
      draftCategories = [];
      AppFeatures.renderProfiles();
      updateAllocationUI();
      showToast("Perfil criado.");
    });
  },

  initIncomeExtras() {
    const ded = document.getElementById("monthly-deductions");
    const useNet = document.getElementById("use-net-income");
    if (ded) ded.value = user.monthlyDeductions || "";
    if (useNet) useNet.checked = user.useNetIncome !== false;

    AppFeatures.initSidebarCollapse();

    document.getElementById("income-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const gross = Math.max(0, parseFloat(document.getElementById("monthly-income").value) || 0);
      const deductions = Math.max(0, parseFloat(ded?.value) || 0);
      const net = Alloc.getNetIncome({ monthlyIncome: gross, monthlyDeductions: deductions, useNetIncome: useNet?.checked !== false });
      user.incomeHistory = user.incomeHistory || [];
      user.incomeHistory.push({ date: Date.now(), gross, deductions, net });
      if (user.incomeHistory.length > 24) user.incomeHistory = user.incomeHistory.slice(-24);
      persistUser({ monthlyIncome: gross, monthlyDeductions: deductions, useNetIncome: useNet?.checked !== false, incomeHistory: user.incomeHistory });
      user = getCurrentUser();
      document.getElementById("income-display").textContent = formatCurrency(Alloc.getNetIncome(user));
      document.getElementById("income-net-display").textContent = formatCurrency(net);
      AppFeatures.renderIncomeHistory();
      updateAllocationUI();
      AppFeatures.renderDashboard();
    }, { capture: true });
  },

  initSimulator() {
    document.getElementById("sim-income")?.addEventListener("input", (e) => {
      AppFeatures.simulatorIncome = Math.max(0, parseFloat(e.target.value) || 0);
      AppFeatures.updateSimulator();
    });
    document.getElementById("sim-reset")?.addEventListener("click", () => {
      AppFeatures.simulatorIncome = null;
      const inp = document.getElementById("sim-income");
      if (inp) inp.value = Alloc.getNetIncome(user);
      AppFeatures.updateSimulator();
    });
  },

  updateSimulator() {
    const income = AppFeatures.getIncome();
    const inp = document.getElementById("sim-income");
    if (inp && AppFeatures.simulatorIncome == null) inp.value = Alloc.getNetIncome(user);
    const list = document.getElementById("sim-results");
    if (!list) return;
    list.innerHTML = savedCategories
      .map((cat) => {
        const r = Alloc.resolveCategory(cat, income);
        return `<li>${escapeHtml(cat.item)} — ${r.percent}% · ${formatCurrency(r.estimatedValue)}${cat.essential ? " · essencial" : ""}</li>`;
      })
      .join("") || "<li class='hint'>Nenhuma alocação salva.</li>";
    document.getElementById("sim-total").textContent = `${Alloc.sumEffectivePercent(savedCategories, income).toFixed(2)}% · ${formatCurrency(Alloc.sumCategoryValues(income, savedCategories))}`;
  },

  initDataSection() {
    document.getElementById("export-json-btn")?.addEventListener("click", () => {
      ExportData.downloadJSON(user, savedCategories);
      showToast("Backup JSON baixado.");
    });
    document.getElementById("export-csv-btn")?.addEventListener("click", () => {
      ExportData.downloadCSV(savedCategories, AppFeatures.getIncome());
      showToast("CSV exportado.");
    });
    document.getElementById("import-json-input")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await ExportData.importJSON(file, (data) => {
          if (!confirm("Importar substitui as categorias do perfil ativo. Continuar?")) return;
          savedCategories = Alloc.migrateCategories(data.categories);
          if (data.user) {
            if (data.user.monthlyIncome != null) user.monthlyIncome = data.user.monthlyIncome;
            if (data.user.monthlyDeductions != null) user.monthlyDeductions = data.user.monthlyDeductions;
          }
          AppFeatures.persistAll();
          updateAllocationUI();
          AppFeatures.renderDashboard();
          showToast("Dados importados.");
        });
      } catch (err) {
        showToast(err.message, "error");
      }
      e.target.value = "";
    });
  },

  initSortAndChart() {
    const savedType = localStorage.getItem(CHART_TYPE_STORAGE_KEY);
    if (savedType && CHART_TYPE_ORDER.includes(savedType)) {
      AppFeatures.chartType = savedType;
    }

    const select = document.getElementById("chart-type-select");
    if (select) {
      select.innerHTML = CHART_TYPE_ORDER.map(
        (key) => `<option value="${key}">${ChartTypes[key].label}</option>`
      ).join("");
      select.value = AppFeatures.chartType;
      select.addEventListener("change", (e) => {
        AppFeatures.chartType = e.target.value;
        localStorage.setItem(CHART_TYPE_STORAGE_KEY, AppFeatures.chartType);
        if (allocationChart) {
          allocationChart.destroy();
          allocationChart = null;
        }
        renderChart();
        const label = ChartTypes[AppFeatures.chartType]?.label || "Gráfico";
        showToast(`Gráfico: ${label}`);
      });
    }

    document.getElementById("table-sort")?.addEventListener("change", (e) => {
      AppFeatures.sortKey = e.target.value;
      renderAllocationTable();
    });
  },

  duplicateCategory(id) {
    const cat = findCategoryById(id);
    if (!cat) return;
    const copy = Alloc.cloneCategory(cat);
    copy.id = generateCategoryId();
    copy.item = `${cat.item} (cópia)`;
    savedCategories.push(copy);
    AppFeatures.persistAll();
    updateAllocationUI();
    showToast("Categoria duplicada.");
  },

  init() {
    migrateUserProfiles();
    AppFeatures.loadProfileData();
    Theme.init();
    AppFeatures.initNav();
    AppFeatures.initProfileSection();
    AppFeatures.initIncomeExtras();
    AppFeatures.initSimulator();
    AppFeatures.initDataSection();
    AppFeatures.initSortAndChart();
    AppFeatures.renderDashboard();
    AppFeatures.renderIncomeHistory();
  },
};

function migrateUserProfiles() {
  user = migrateUserRecord(getCurrentUser());
  if (!user.profiles?.length) {
    user.profiles = [{ id: "default", name: "Pessoal", categories: user.categories || [], monthlyIncome: user.monthlyIncome || 0, monthlyDeductions: 0 }];
    user.activeProfileId = "default";
    persistUser({ profiles: user.profiles, activeProfileId: user.activeProfileId });
    user = getCurrentUser();
  }
}
