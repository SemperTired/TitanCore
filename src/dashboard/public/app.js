const state = {
  token: localStorage.getItem("titancoreToken") || "",
  tab: "overview",
  store: null,
  overview: null,
};

const tabs = [
  ["overview", "Overview", "Server health and recent activity"],
  ["players", "Players", "Profiles, links, and notes"],
  ["wallets", "Wallets", "Economy balances and ledger"],
  ["shop", "Shop", "Purchasable rewards"],
  ["teleports", "Teleports", "Waypoints and paid travel"],
  ["commands", "Commands", "In-game chat automation"],
  ["dinos", "Dino Profiles", "Dinosaur and nesting records"],
  ["events", "Events", "Community event operations"],
  ["moderation", "Moderation", "Cases and reports"],
  ["server", "Server", "RCON and presets"],
  ["settings", "Settings", "Bot configuration"],
];

const view = document.querySelector("#view");
const tabRoot = document.querySelector("#tabs");
const pageTitle = document.querySelector("#pageTitle");
const pageMeta = document.querySelector("#pageMeta");
const tokenInput = document.querySelector("#tokenInput");

tokenInput.value = state.token;

document.querySelector("#saveToken").addEventListener("click", async () => {
  state.token = tokenInput.value.trim();
  localStorage.setItem("titancoreToken", state.token);
  await load();
});

function renderTabs() {
  tabRoot.innerHTML = tabs.map(([id, label]) => `
    <button class="tab ${state.tab === id ? "active" : ""}" data-tab="${id}">
      <span>${icon(id)}</span><span>${label}</span>
    </button>
  `).join("");

  tabRoot.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      render();
    });
  });
}

function icon(id) {
  return {
    overview: "01",
    players: "02",
    wallets: "03",
    shop: "04",
    teleports: "05",
    commands: "06",
    dinos: "07",
    events: "08",
    moderation: "09",
    server: "10",
    settings: "11",
  }[id] || "--";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${state.token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function load() {
  try {
    state.overview = await api("/api/overview");
    state.store = await api("/api/store");
    render();
  } catch (error) {
    view.innerHTML = `<div class="panel"><div class="panel-body status">${escapeHtml(error.message)}. Enter the dashboard token from .env.</div></div>`;
  }
}

function render() {
  renderTabs();
  const tab = tabs.find(row => row[0] === state.tab);
  pageTitle.textContent = tab[1];
  pageMeta.textContent = tab[2];

  if (!state.store) {
    view.innerHTML = `<div class="panel"><div class="panel-body status">Unlock the dashboard.</div></div>`;
    return;
  }

  const renderers = {
    overview: renderOverview,
    players: renderPlayers,
    wallets: renderWallets,
    shop: () => renderCrud("shop", "Shop Items", "shopItems", "/api/shop-items", shopFields()),
    teleports: () => renderCrud("teleports", "Teleport Locations", "teleportLocations", "/api/teleports", teleportFields()),
    commands: () => renderCrud("commands", "Custom Commands", "customCommands", "/api/custom-commands", commandFields()),
    dinos: () => renderCrud("dinos", "Dino Profiles", "dinoProfiles", "/api/dino-profiles", dinoFields()),
    events: () => renderCrud("events", "Events", "events", "/api/events", eventFields()),
    moderation: renderModeration,
    server: renderServer,
    settings: renderSettings,
  };

  renderers[state.tab]();
}

function renderOverview() {
  const counts = state.overview.counts;
  view.innerHTML = `
    <div class="grid stats-grid">
      ${stat("Players", counts.players)}
      ${stat("Linked", counts.linked)}
      ${stat("Wallets", counts.wallets)}
      ${stat("Shop Items", counts.shopItems)}
      ${stat("Cases", counts.moderationCases)}
      ${stat("Events Today", counts.todayEvents)}
    </div>
    <div class="grid two-col" style="margin-top:14px">
      ${tablePanel("Recent PoT Events", state.overview.recentEvents, ["event_type", "agid", "created_at"])}
      ${tablePanel("Audit Trail", state.overview.auditLogs, ["action", "target", "created_at"])}
    </div>
  `;
}

function renderPlayers() {
  view.innerHTML = `
    <div class="grid two-col">
      ${tablePanel("Player Profiles", state.store.playerProfiles, ["agid", "alderon_username", "discord_id", "last_seen_at", "notes"])}
      <div class="panel">
        <div class="panel-header"><h3>Save Player</h3></div>
        <div class="panel-body">
          <form id="playerForm" class="form-grid">
            ${input("agid", "AGID")}
            ${input("alderonUsername", "Alderon Username")}
            ${input("discordId", "Discord ID")}
            ${textarea("notes", "Notes", "wide")}
            <button class="button primary wide">Save Player</button>
          </form>
        </div>
      </div>
    </div>
  `;
  bindJsonForm("#playerForm", "/api/players", "POST");
}

function renderWallets() {
  view.innerHTML = `
    <div class="grid two-col">
      ${tablePanel("Wallets", state.store.wallets, ["agid", "balance", "updated_at"])}
      <div class="panel">
        <div class="panel-header"><h3>Modify Wallet</h3></div>
        <div class="panel-body">
          <form id="walletForm" class="form-grid">
            ${input("agid", "AGID")}
            <label>Mode<select name="mode"><option value="add">Add</option><option value="subtract">Subtract</option><option value="set">Set</option></select></label>
            ${input("amount", "Amount", "number")}
            ${input("reason", "Reason", "text", "wide")}
            <button class="button primary wide">Apply Change</button>
          </form>
        </div>
      </div>
    </div>
    <div style="margin-top:14px">${tablePanel("Ledger", state.store.ledger.slice(-100).reverse(), ["agid", "amount", "reason", "actor_discord_id", "created_at"])}</div>
  `;

  document.querySelector("#walletForm").addEventListener("submit", async event => {
    event.preventDefault();
    const data = formData(event.currentTarget);
    const agid = data.agid;
    delete data.agid;
    data.amount = Number(data.amount);
    await api(`/api/wallets/${encodeURIComponent(agid)}`, { method: "PATCH", body: JSON.stringify(data) });
    await load();
  });
}

function renderCrud(tabId, title, collection, endpoint, fields) {
  const rows = state.store[collection] || [];
  view.innerHTML = `
    <div class="grid two-col">
      ${tablePanel(title, rows, fields.map(field => field.name).filter(name => name !== "config_json"))}
      <div class="panel">
        <div class="panel-header"><h3>Manage ${title}</h3></div>
        <div class="panel-body">
          <form id="${tabId}Form" class="form-grid">
            ${input("id", "ID for Update/Delete", "number")}
            ${fields.map(fieldInput).join("")}
            <div class="actions wide">
              <button class="button primary" data-mode="save">Save</button>
              <button class="button danger" data-mode="delete" type="button">Delete ID</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  bindCrudForm(`#${tabId}Form`, endpoint);
}

function renderModeration() {
  view.innerHTML = `
    <div class="grid two-col">
      ${tablePanel("Moderation Cases", state.store.moderationCases.slice().reverse(), ["id", "agid", "type", "reason", "moderator_discord_id", "created_at"])}
      ${tablePanel("Reports and Alerts", state.store.potEvents.filter(row => ["player-report", "player-hack", "security-alert", "server-error"].includes(row.event_type)).slice(-50).reverse(), ["event_type", "agid", "created_at", "payload_json"])}
    </div>
  `;
}

function renderServer() {
  view.innerHTML = `
    <div class="grid two-col">
      <div class="panel">
        <div class="panel-header"><h3>Presets</h3></div>
        <div class="panel-body grid">
          <form id="announceForm" class="form-grid">${input("message", "Announcement", "text", "wide")}<button class="button primary wide">Announce</button></form>
          <form id="weatherForm" class="form-grid">${input("weather", "Weather")}<button class="button wide">Set Weather</button></form>
          <form id="timeForm" class="form-grid">${input("time", "Time")}<button class="button wide">Set Time</button></form>
          <div class="actions">
            <button id="saveServer" class="button warning">Save Server</button>
            <button id="listPlayers" class="button">List Players</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Raw RCON</h3></div>
        <div class="panel-body">
          <form id="rconForm" class="form-grid">
            ${input("command", "Command", "text", "wide")}
            <button class="button primary wide">Run Command</button>
          </form>
          <pre id="rconOutput" class="code status"></pre>
        </div>
      </div>
    </div>
  `;
  bindAction("#announceForm", "announce");
  bindAction("#weatherForm", "weather");
  bindAction("#timeForm", "time");
  document.querySelector("#saveServer").addEventListener("click", () => serverAction("save", {}));
  document.querySelector("#listPlayers").addEventListener("click", () => serverAction("players", {}));
  document.querySelector("#rconForm").addEventListener("submit", async event => {
    event.preventDefault();
    const result = await api("/api/rcon", { method: "POST", body: JSON.stringify(formData(event.currentTarget)) });
    document.querySelector("#rconOutput").textContent = result.response || "OK";
  });
}

function renderSettings() {
  const s = state.store.settings;
  view.innerHTML = `
    <div class="grid two-col">
      <div class="panel">
        <div class="panel-header"><h3>Settings</h3></div>
        <div class="panel-body">
          <form id="settingsForm" class="form-grid">
            ${input("shopTitle", "Shop Title", "text", "", s.shopTitle)}
            ${input("commandPrefix", "Command Prefix", "text", "", s.commandPrefix)}
            ${textarea("shopDescription", "Shop Description", "wide", s.shopDescription)}
            <label>Bank Enabled<select name="bankEnabled"><option value="true" ${s.bankEnabled ? "selected" : ""}>Enabled</option><option value="false" ${!s.bankEnabled ? "selected" : ""}>Disabled</option></select></label>
            <label>Auto Verify<select name="autoVerifyLinkCodes"><option value="true" ${s.autoVerifyLinkCodes ? "selected" : ""}>Enabled</option><option value="false" ${!s.autoVerifyLinkCodes ? "selected" : ""}>Disabled</option></select></label>
            <button class="button primary wide">Save Settings</button>
          </form>
        </div>
      </div>
      ${tablePanel("Audit Trail", state.store.auditLogs.slice(-100).reverse(), ["action", "target", "created_at"])}
    </div>
  `;
  document.querySelector("#settingsForm").addEventListener("submit", async event => {
    event.preventDefault();
    const data = formData(event.currentTarget);
    data.bankEnabled = data.bankEnabled === "true";
    data.autoVerifyLinkCodes = data.autoVerifyLinkCodes === "true";
    await api("/api/settings", { method: "PATCH", body: JSON.stringify(data) });
    await load();
  });
}

function bindAction(selector, action) {
  document.querySelector(selector).addEventListener("submit", async event => {
    event.preventDefault();
    await serverAction(action, formData(event.currentTarget));
  });
}

async function serverAction(action, values) {
  const result = await api("/api/server-action", { method: "POST", body: JSON.stringify({ action, values }) });
  alert(result.response || "OK");
}

function bindJsonForm(selector, endpoint, method) {
  document.querySelector(selector).addEventListener("submit", async event => {
    event.preventDefault();
    const data = formData(event.currentTarget);
    for (const key of Object.keys(data)) {
      if (/price|cost|cooldown|limit|enabled/i.test(key)) data[key] = Number(data[key]);
    }
    await api(endpoint, { method, body: JSON.stringify(data) });
    await load();
  });
}

function bindCrudForm(selector, endpoint) {
  const form = document.querySelector(selector);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const data = normalizeCrudData(formData(form));
    const id = data.id;
    delete data.id;
    const method = id ? "PATCH" : "POST";
    const path = id ? `${endpoint}/${encodeURIComponent(id)}` : endpoint;
    await api(path, { method, body: JSON.stringify(data) });
    await load();
  });

  form.querySelector("[data-mode='delete']").addEventListener("click", async () => {
    const id = formData(form).id;
    if (!id) {
      alert("Enter an ID first.");
      return;
    }
    await api(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  });
}

function normalizeCrudData(data) {
  for (const key of Object.keys(data)) {
    if (data[key] === "") {
      delete data[key];
      continue;
    }
    if (/^id$|price|cost|cooldown|limit|enabled/i.test(key)) data[key] = Number(data[key]);
  }
  return data;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function shopFields() {
  return [
    { name: "name", label: "Name" },
    { name: "price", label: "Price", type: "number" },
    { name: "rcon_command_template", label: "RCON Template", wide: true },
    { name: "enabled", label: "Enabled", type: "number", value: "1" },
  ];
}

function teleportFields() {
  return [
    { name: "name", label: "Name" },
    { name: "tag", label: "Tag" },
    { name: "price", label: "Price", type: "number", value: "0" },
    { name: "cooldown_seconds", label: "Cooldown Seconds", type: "number", value: "0" },
    { name: "rcon_command_template", label: "RCON Template", wide: true },
    { name: "enabled", label: "Enabled", type: "number", value: "1" },
  ];
}

function commandFields() {
  return [
    { name: "name", label: "Name" },
    { name: "trigger", label: "Trigger" },
    { name: "cost", label: "Cost", type: "number", value: "0" },
    { name: "cooldown_seconds", label: "Cooldown Seconds", type: "number", value: "0" },
    { name: "description", label: "Description", wide: true },
    { name: "rcon_command_template", label: "RCON Template", wide: true },
    { name: "enabled", label: "Enabled", type: "number", value: "1" },
  ];
}

function dinoFields() {
  return [
    { name: "agid", label: "AGID" },
    { name: "dinosaur", label: "Dinosaur" },
    { name: "gender", label: "Gender" },
    { name: "growth", label: "Growth" },
    { name: "diet", label: "Diet" },
    { name: "nesting_limit", label: "Nesting Limit", type: "number", value: "0" },
    { name: "notes", label: "Notes", wide: true },
  ];
}

function eventFields() {
  return [
    { name: "name", label: "Name" },
    { name: "type", label: "Type" },
    { name: "starts_at", label: "Starts At" },
    { name: "ends_at", label: "Ends At" },
    { name: "status", label: "Status", value: "scheduled" },
    { name: "config_json", label: "Config JSON", wide: true, value: "{}" },
  ];
}

function fieldInput(field) {
  return input(field.name, field.label, field.type || "text", field.wide ? "wide" : "", field.value || "");
}

function input(name, label, type = "text", cls = "", value = "") {
  return `<label class="${cls}">${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}"></label>`;
}

function textarea(name, label, cls = "", value = "") {
  return `<label class="${cls}">${label}<textarea name="${name}">${escapeHtml(value)}</textarea></label>`;
}

function stat(label, value) {
  return `<article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`;
}

function tablePanel(title, rows, columns) {
  return `
    <div class="panel">
      <div class="panel-header"><h3>${title}</h3><span class="pill">${rows.length}</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr>${columns.map(column => `<th>${column}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows.map(row => `<tr>${columns.map(column => `<td>${formatCell(row[column])}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function formatCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return `<span class="code">${escapeHtml(JSON.stringify(value))}</span>`;
  const text = String(value);
  return `<span class="${text.length > 90 ? "code" : ""}">${escapeHtml(text.length > 220 ? `${text.slice(0, 220)}...` : text)}</span>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

renderTabs();
load();
