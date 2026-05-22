const Theme = {
  key: "financas_theme",

  init() {
    const saved = localStorage.getItem(Theme.key) || "dark";
    Theme.apply(saved);
    const toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.checked = saved === "light";
      toggle.addEventListener("change", () => {
        Theme.apply(toggle.checked ? "light" : "dark");
      });
    }
  },

  apply(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem(Theme.key, mode);
  },
};
