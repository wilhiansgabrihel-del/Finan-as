const Alloc = {
  STRUCTURAL_GROUPS: [
    "Custos Fixos",
    "Custos Variáveis",
    "Futuro & Segurança",
    "Estilo de Vida",
    "Grandes Projetos & Sonhos",
    "Conhecimento & Carreira",
  ],

  PRESET_CATEGORIES: [
    "Transporte",
    "Investimento",
    "Moradia",
    "Serviços",
    "Alimentação",
    "Pessoal",
    "Estética",
    "Assinatura",
  ],

  categoryAmount(income, percent) {
    return (income * Number(percent)) / 100;
  },

  percentFromValue(income, value) {
    if (!income || income <= 0) return 0;
    return (Number(value) / income) * 100;
  },

  roundMoney(value) {
    return Math.round(value * 100) / 100;
  },

  parseAmountInput(raw) {
    if (raw == null || String(raw).trim() === "") return NaN;
    let s = String(raw).trim().replace(/\s/g, "");
    if (s.includes(",")) {
      s = s.replace(/\./g, "").replace(",", ".");
    }
    return parseFloat(s);
  },

  migrateCategory(cat) {
    const fixedValue = Boolean(cat.fixedValue);
    const migrated = {
      id: cat.id || generateCategoryId(),
      item: (cat.item || cat.name || "").trim(),
      structuralGroup: (cat.structuralGroup || cat.group || "").trim(),
      category: (cat.category || "").trim(),
      percent: Number(cat.percent) || 0,
      essential: Boolean(cat.essential),
      fixedValue,
    };
    if (cat.estimatedValue != null) {
      migrated.estimatedValue = Alloc.roundMoney(Number(cat.estimatedValue));
    } else if (cat.fixedAmount != null) {
      migrated.estimatedValue = Alloc.roundMoney(Number(cat.fixedAmount));
    }
    return migrated;
  },

  migrateCategories(categories) {
    return (categories || []).map((c) => Alloc.migrateCategory(c));
  },

  resolveCategory(cat, income) {
    if (cat.fixedValue && cat.estimatedValue != null) {
      const amount = Alloc.roundMoney(Number(cat.estimatedValue));
      const percent = income > 0 ? Alloc.roundMoney((amount / income) * 100) : Number(cat.percent) || 0;
      return { amount, percent, estimatedValue: amount };
    }
    const percent = Number(cat.percent) || 0;
    const amount = Alloc.roundMoney(Alloc.categoryAmount(income, percent));
    return { amount, percent, estimatedValue: amount };
  },

  sumEffectivePercent(categories, income) {
    return categories.reduce((acc, c) => acc + Alloc.resolveCategory(c, income).percent, 0);
  },

  sumCategoryValues(income, categories) {
    return categories.reduce((acc, c) => acc + Alloc.resolveCategory(c, income).amount, 0);
  },

  cloneCategory(cat) {
    const copy = {
      id: cat.id,
      item: cat.item,
      structuralGroup: cat.structuralGroup || "",
      category: cat.category || "",
      percent: cat.percent,
      essential: Boolean(cat.essential),
      fixedValue: Boolean(cat.fixedValue),
    };
    if (cat.estimatedValue != null) copy.estimatedValue = cat.estimatedValue;
    return copy;
  },

  getNetIncome(user) {
    const gross = Number(user.monthlyIncome) || 0;
    const deductions = Number(user.monthlyDeductions) || 0;
    if (user.useNetIncome === false) return gross;
    return Math.max(0, Alloc.roundMoney(gross - deductions));
  },

  groupSummary(categories, income) {
    const map = {};
    categories.forEach((cat) => {
      const key = cat.structuralGroup?.trim() || "Sem grupo estrutural";
      if (!map[key]) map[key] = { percent: 0, amount: 0 };
      const r = Alloc.resolveCategory(cat, income);
      map[key].percent += r.percent;
      map[key].amount += r.amount;
    });
    return map;
  },

  PROFILE_THRESHOLDS_DEFAULTS: {
    fixedCostsMax: 70,
    investmentMin: 25,
    warningFrom: 60,
    dangerFrom: 70,
    criticalFrom: 80,
  },

  mergeProfileThresholds(raw) {
    const d = Alloc.PROFILE_THRESHOLDS_DEFAULTS;
    const t = { ...d, ...(raw || {}) };
    return {
      fixedCostsMax: Number(t.fixedCostsMax) || d.fixedCostsMax,
      investmentMin: Number(t.investmentMin) || d.investmentMin,
      warningFrom: Number(t.warningFrom) || d.warningFrom,
      dangerFrom: Number(t.dangerFrom) || d.dangerFrom,
      criticalFrom: Number(t.criticalFrom) || d.criticalFrom,
    };
  },

  sumStructuralGroupPercent(categories, income, groupName) {
    const target = groupName.trim().toLowerCase();
    return categories.reduce((acc, cat) => {
      const g = (cat.structuralGroup || "").trim().toLowerCase();
      if (g !== target) return acc;
      return acc + Alloc.resolveCategory(cat, income).percent;
    }, 0);
  },

  sumCategoryLabelPercent(categories, income, categoryName) {
    const target = categoryName.trim().toLowerCase();
    return categories.reduce((acc, cat) => {
      const c = (cat.category || "").trim().toLowerCase();
      if (c !== target) return acc;
      return acc + Alloc.resolveCategory(cat, income).percent;
    }, 0);
  },

  sumCategoryLabelAmount(categories, income, categoryName) {
    const target = categoryName.trim().toLowerCase();
    return categories.reduce((acc, cat) => {
      const c = (cat.category || "").trim().toLowerCase();
      if (c !== target) return acc;
      return acc + Alloc.resolveCategory(cat, income).amount;
    }, 0);
  },

  validateProfileThresholds(raw) {
    const t = Alloc.mergeProfileThresholds(raw);
    const errors = [];
    if (t.fixedCostsMax <= 0 || t.fixedCostsMax > 100) {
      errors.push("Máximo de Custos Fixos deve estar entre 0,1% e 100%.");
    }
    if (t.investmentMin < 0 || t.investmentMin > 100) {
      errors.push("Mínimo de Investimento deve estar entre 0% e 100%.");
    }
    if (t.warningFrom < 0 || t.warningFrom >= t.dangerFrom) {
      errors.push("Amarelo deve ser menor que vermelho.");
    }
    if (t.dangerFrom >= t.criticalFrom) {
      errors.push("Vermelho deve ser menor que rosa-choque.");
    }
    if (t.criticalFrom > 100) {
      errors.push("Rosa-choque não pode passar de 100%.");
    }
    return { ok: errors.length === 0, errors, thresholds: t };
  },

  fixedCostsColorStatus(percent, thresholds) {
    const t = Alloc.mergeProfileThresholds(thresholds);
    const p = Number(percent) || 0;
    if (p >= t.criticalFrom) return "critical";
    if (p >= t.dangerFrom) return "danger";
    if (p >= t.warningFrom) return "warning";
    return "ok";
  },

  investmentColorStatus(percent, thresholds) {
    const t = Alloc.mergeProfileThresholds(thresholds);
    const p = Number(percent) || 0;
    if (p < t.investmentMin) return "danger";
    return "ok";
  },
};
