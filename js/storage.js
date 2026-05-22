const StorageKeys = {
  USERS: "financas_users",
  SESSION: "financas_session",
  REMEMBER: "financas_remember",
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getUsers() {
  return readJSON(StorageKeys.USERS, {});
}

function saveUsers(users) {
  writeJSON(StorageKeys.USERS, users);
}

function getUserData(loginName) {
  const users = getUsers();
  return users[loginName] || null;
}

function saveUserData(loginName, data) {
  const users = getUsers();
  users[loginName] = { ...users[loginName], ...data };
  saveUsers(users);
}

function generateUserId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

function generateCategoryId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

function findUserById(userId) {
  const users = getUsers();
  for (const [loginName, user] of Object.entries(users)) {
    if (user.id === userId) {
      return { loginName, ...user };
    }
  }
  return null;
}

function ensureUserHasId(loginName, user) {
  if (user.id) return user.id;
  const id = generateUserId();
  saveUserData(loginName, { id });
  return id;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

const CHART_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#f59e0b",
  "#ec4899",
  "#14b8a6",
  "#ef4444",
  "#6366f1",
  "#84cc16",
  "#06b6d4",
];
