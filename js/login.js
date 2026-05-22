if (isLoggedIn()) {
  window.location.href = "app.html";
}

document.querySelectorAll(".password-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.classList.toggle("visible", show);
    btn.querySelector(".icon-eye").hidden = show;
    btn.querySelector(".icon-eye-off").hidden = !show;
  });
});

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const isLogin = tab.dataset.tab === "login";
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", t === tab);
      t.setAttribute("aria-selected", t === tab ? "true" : "false");
    });
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
  });
});

function showError(el, message) {
  el.textContent = message;
  el.hidden = !message;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("login-error");
  const result = await login(
    document.getElementById("login-name").value,
    document.getElementById("login-password").value,
    document.getElementById("remember").checked
  );
  if (!result.ok) {
    showError(err, result.message);
    return;
  }
  window.location.href = "app.html";
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("register-error");
  const password = document.getElementById("register-password").value;
  if (password !== document.getElementById("register-password-confirm").value) {
    showError(err, "As senhas não coincidem.");
    return;
  }
  const result = await register(document.getElementById("register-name").value, password);
  if (!result.ok) {
    showError(err, result.message);
    return;
  }
  await login(document.getElementById("register-name").value, password, true);
  window.location.href = "app.html";
});
