const ChartTypes = {
  doughnut: { label: "Pizza (itens)", value: "doughnut" },
  bar: { label: "Barras R$ (itens)", value: "bar" },
  barHorizontal: { label: "Barras horizontais", value: "barHorizontal" },
  doughnutGroup: { label: "Pizza (grupos)", value: "doughnutGroup" },
  barGroup: { label: "Barras R$ (grupos)", value: "barGroup" },
};

const CHART_TYPE_ORDER = ["doughnut", "bar", "barHorizontal", "doughnutGroup", "barGroup"];

function chartSurfaceColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--surface")?.trim() || "#1a2332";
}

function chartMutedColor() {
  return "#8b9cb3";
}

function buildItemAllocationData(categories, income, chartType) {
  const labels = categories.map((c) => c.item);
  const percents = categories.map((c) => Alloc.resolveCategory(c, income).percent);
  const amounts = categories.map((c) => Alloc.resolveCategory(c, income).amount);
  const colors = categories.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
  const total = Alloc.sumEffectivePercent(categories, income);
  const isDoughnut = chartType === "doughnut";

  if (isDoughnut && total < 99.99) {
    labels.push("Não alocado");
    percents.push(Alloc.roundMoney(100 - total));
    amounts.push(Alloc.roundMoney((income * (100 - total)) / 100));
    colors.push("#3d4d63");
  }

  return { labels, percents, amounts, colors, total };
}

function buildGroupAllocationData(categories, income) {
  const groups = Alloc.groupSummary(categories, income);
  const labels = Object.keys(groups);
  const percents = labels.map((k) => Alloc.roundMoney(groups[k].percent));
  const amounts = labels.map((k) => groups[k].amount);
  const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
  return { labels, percents, amounts, colors };
}

function buildAllocationChartOptions(chartType, meta) {
  const isGroup = chartType === "doughnutGroup" || chartType === "barGroup";
  const isBarMoney = chartType === "bar" || chartType === "barGroup";
  const isHorizontal = chartType === "barHorizontal";
  const isDoughnut = chartType === "doughnut" || chartType === "doughnutGroup";
  const jsType = isDoughnut ? "doughnut" : "bar";
  const { labels, percents, amounts, colors } = meta;
  const values = isBarMoney ? amounts : percents;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 8, bottom: 4, left: 8, right: 8 } },
    plugins: {
      legend: {
        position: isHorizontal ? "right" : "bottom",
        fullSize: false,
        labels: { color: chartMutedColor(), padding: 6, boxWidth: 10, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label(ctx) {
            const idx = ctx.dataIndex;
            const pct = percents[idx];
            const amt = amounts[idx];
            if (isBarMoney || isHorizontal) {
              return ` ${ctx.label}: ${formatCurrency(ctx.parsed)} (${pct}%)`;
            }
            return ` ${ctx.label}: ${pct}% (${formatCurrency(amt)})`;
          },
        },
      },
    },
  };

  if (!isDoughnut) {
    options.indexAxis = isHorizontal ? "y" : "x";
    options.scales = {
      x: {
        ticks: { color: chartMutedColor() },
        grid: { color: "rgba(139, 156, 179, 0.15)" },
      },
      y: {
        ticks: { color: chartMutedColor() },
        grid: { color: "rgba(139, 156, 179, 0.15)" },
      },
    };
    if (isHorizontal) {
      options.scales.x.ticks.callback = (v) => formatCurrency(v);
    } else {
      options.scales.y.ticks.callback = (v) => formatCurrency(v);
    }
  } else {
    options.cutout = "52%";
    options.radius = "70%";
  }

  return {
    type: jsType,
    data: {
      labels,
      datasets: [{
        label: isGroup ? "Grupo estrutural" : "Alocação",
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: chartSurfaceColor(),
      }],
    },
    options,
    meta: { percents, amounts },
  };
}

function getAllocationChartConfig(chartType, categories, income) {
  if (chartType === "doughnutGroup" || chartType === "barGroup") {
    const meta = buildGroupAllocationData(categories, income);
    if (!meta.labels.length) return null;
    return buildAllocationChartOptions(chartType, meta);
  }
  const meta = buildItemAllocationData(categories, income, chartType);
  if (!meta.labels.length) return null;
  return buildAllocationChartOptions(chartType, meta);
}

function buildIncomeHistoryChartConfig(history) {
  const sorted = [...(history || [])].sort((a, b) => a.date - b.date).slice(-12);
  if (!sorted.length) return null;

  const labels = sorted.map((h) =>
    new Date(h.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  );

  return {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Líquida",
          data: sorted.map((h) => h.net),
          borderColor: CHART_COLORS[0],
          backgroundColor: "rgba(34, 197, 94, 0.15)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
        },
        {
          label: "Bruta",
          data: sorted.map((h) => h.gross),
          borderColor: CHART_COLORS[1],
          backgroundColor: "transparent",
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: chartMutedColor(), boxWidth: 10, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              return ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { color: chartMutedColor() }, grid: { color: "rgba(139, 156, 179, 0.1)" } },
        y: {
          ticks: {
            color: chartMutedColor(),
            callback: (v) => formatCurrency(v),
          },
          grid: { color: "rgba(139, 156, 179, 0.15)" },
        },
      },
    },
  };
}
