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
};
