async function hashPassword(password) {
  return CryptoAuth.hashPassword(password);
}

async function verifyPassword(password, encoded) {
  return CryptoAuth.verifyPassword(password, encoded);
}

function getSession() {
  const fromLocal = readJSON(StorageKeys.SESSION, null);
  if (fromLocal?.loginName || fromLocal?.userId) return fromLocal;
  try {
    const raw = sessionStorage.getItem(StorageKeys.SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(loginName, userId, remember) {
  const payload = JSON.stringify({ loginName, userId, loggedAt: Date.now() });
  sessionStorage.removeItem(StorageKeys.SESSION);
  localStorage.removeItem(StorageKeys.SESSION);
  if (remember) {
    localStorage.setItem(StorageKeys.SESSION, payload);
  } else {
    sessionStorage.setItem(StorageKeys.SESSION, payload);
  }
}

function resolveUserFromSession(session) {
  if (!session) return null;

  let resolved = null;

  if (session.userId) {
    resolved = findUserById(session.userId);
  }

  if (!resolved && session.loginName) {
    const user = getUserData(session.loginName);
    if (!user) return null;
    const id = ensureUserHasId(session.loginName, user);
    resolved = { loginName: session.loginName, ...user, id };
  }

  if (resolved && session.userId !== resolved.id) {
    const remember = localStorage.getItem(StorageKeys.SESSION) !== null;
    setSession(resolved.loginName, resolved.id, remember);
  }

  return resolved;
}

function clearSession() {
  localStorage.removeItem(StorageKeys.SESSION);
  sessionStorage.removeItem(StorageKeys.SESSION);
}

function isLoggedIn() {
  return Boolean(resolveUserFromSession(getSession()));
}

function getCurrentUser() {
  return resolveUserFromSession(getSession());
}

function migrateUserRecord(user) {
  if (!user.profiles || !user.profiles.length) {
    const cats = typeof Alloc !== "undefined" ? Alloc.migrateCategories(user.categories || []) : user.categories || [];
    user.profiles = [{
      id: "default",
      name: "Pessoal",
      categories: cats,
      monthlyIncome: user.monthlyIncome || 0,
      monthlyDeductions: user.monthlyDeductions || 0,
    }];
    user.activeProfileId = "default";
  }
  if (!user.incomeHistory) user.incomeHistory = [];
  if (user.monthlyDeductions == null) user.monthlyDeductions = 0;
  if (user.useNetIncome == null) user.useNetIncome = true;
  return user;
}

async function register(name, password) {
  const loginName = name.trim().toLowerCase();
  if (!loginName) {
    return { ok: false, message: "Informe um nome válido." };
  }
  if (password.length < 4) {
    return { ok: false, message: "A senha deve ter pelo menos 4 caracteres." };
  }

  const users = getUsers();
  if (users[loginName]) {
    return { ok: false, message: "Este nome já está em uso. Faça login ou escolha outro." };
  }

  const userId = generateUserId();
  const passwordHash = await hashPassword(password);
  users[loginName] = migrateUserRecord({
    id: userId,
    displayName: name.trim(),
    password: passwordHash,
    monthlyIncome: 0,
    monthlyDeductions: 0,
    useNetIncome: true,
    categories: [],
    incomeHistory: [],
    profiles: [{ id: "default", name: "Pessoal", categories: [], monthlyIncome: 0, monthlyDeductions: 0 }],
    activeProfileId: "default",
    createdAt: Date.now(),
  });
  saveUsers(users);
  return { ok: true, loginName, userId };
}

async function login(name, password, remember = true) {
  const loginName = name.trim().toLowerCase();
  const user = getUserData(loginName);

  if (!user) {
    return { ok: false, message: "Usuário não encontrado. Crie uma conta primeiro." };
  }
  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    return { ok: false, message: "Senha incorreta." };
  }

  if (CryptoAuth.isLegacy(user.password)) {
    user.password = await hashPassword(password);
    saveUserData(loginName, { password: user.password });
  }

  migrateUserRecord(user);
  saveUserData(loginName, user);

  const userId = ensureUserHasId(loginName, user);
  setSession(loginName, userId, remember);
  return { ok: true, loginName, userId };
}

function logout() {
  clearSession();
}

function requireAuth(redirectTo = "index.html") {
  if (!isLoggedIn()) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}
