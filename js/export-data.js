const ExportData = {
  buildPayload(user, savedCategories) {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      user: {
        displayName: user.displayName,
        loginName: user.loginName,
        monthlyIncome: user.monthlyIncome,
        monthlyDeductions: user.monthlyDeductions,
        useNetIncome: user.useNetIncome,
        incomeHistory: user.incomeHistory || [],
        profiles: user.profiles || [],
        activeProfileId: user.activeProfileId,
      },
      categories: savedCategories.map((c) => Alloc.cloneCategory(c)),
    };
  },

  downloadJSON(user, savedCategories) {
    const blob = new Blob([JSON.stringify(ExportData.buildPayload(user, savedCategories), null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `financas-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  downloadCSV(savedCategories, income) {
    const rows = [["Item", "Grupo Estrutural", "Categoria", "Valor Estimado", "Porcentagem", "Essencial"]];
    savedCategories.forEach((cat) => {
      const r = Alloc.resolveCategory(cat, income);
      rows.push([
        cat.item,
        cat.structuralGroup || "",
        cat.category || "",
        r.estimatedValue,
        r.percent,
        cat.essential ? "Essencial" : "Não Essencial",
      ]);
    });
    const csv = rows.map((row) => row.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `financas-alocacoes-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  async importJSON(file, onApply) {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.categories || !Array.isArray(data.categories)) {
      throw new Error("Arquivo inválido: sem categorias.");
    }
    onApply(data);
  },
};
