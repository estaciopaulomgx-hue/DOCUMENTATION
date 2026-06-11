/* ============================================================
   DocTrack — Document Monitoring System (Vanilla JS)
   Persists to localStorage. Auto-computes due date & status.
   ============================================================ */

const STORAGE_KEY = "doctrack.documents.v1";
const ACTIVITY_KEY = "doctrack.activity.v1";

// ---------- Utilities ----------
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function uid() {
  return "d_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function diffDays(fromISO, toISO) {
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(toISO + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function computeStatus(doc) {
  if (doc.completed_at) return "completed";
  const today = todayISO();
  const diff = diffDays(today, doc.due_date);
  if (diff < 0) return "overdue";
  if (diff === 0) return "due_today";
  return "ongoing";
}

const STATUS_LABEL = {
  ongoing: "Ongoing",
  due_today: "Due Today",
  overdue: "Overdue",
  completed: "Completed",
};

function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.add("hidden"), 2400);
}

// ---------- Storage ----------
function loadDocs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveDocs(docs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}
function loadActivity() {
  try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]"); }
  catch { return []; }
}
function saveActivity(list) {
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(list.slice(0, 50)));
}
function logActivity(action, doc) {
  const list = loadActivity();
  list.unshift({
    id: uid(),
    action,
    document_number: doc.document_number,
    customer_name: doc.customer_name,
    at: new Date().toISOString(),
  });
  saveActivity(list);
}

// ---------- Sample Data ----------
function sampleData() {
  const t = todayISO();
  const mk = (n, type, customer, serial, assigned, startOffset, days, completed = false, remarks = "") => {
    const start_date = addDays(t, startOffset);
    return {
      id: uid(),
      document_number: n,
      document_type: type,
      customer_name: customer,
      item_description: "",
      serial_number: serial,
      assigned_name: assigned,
      start_date,
      allowed_days: days,
      due_date: addDays(start_date, days),
      completed_at: completed ? new Date().toISOString() : null,
      remarks,
      created_at: new Date().toISOString(),
    };
  };
  return [
    mk("DOC-2026-0001", "Invoice", "Acme Corporation", "SN-10231", "Maria Santos", -1, 3, false, "Pending client review"),
    mk("DOC-2026-0002", "Purchase Order", "Globex Industries", "SN-10232", "Juan Dela Cruz", -2, 2),
    mk("DOC-2026-0003", "Contract", "Initech Ltd.", "", "Ana Reyes", -5, 7),
    mk("DOC-2026-0004", "Service Request", "Umbrella Co.", "SN-10250", "Carlos Lim", -3, 3),
    mk("DOC-2026-0005", "RMA", "Stark Industries", "SN-99812", "Maria Santos", -7, 4),
    mk("DOC-2026-0006", "Quotation", "Wayne Enterprises", "", "Juan Dela Cruz", -2, 2),
    mk("DOC-2026-0007", "Delivery Receipt", "Cyberdyne Systems", "SN-44102", "Ana Reyes", 0, 5),
    mk("DOC-2026-0008", "Invoice", "Hooli Inc.", "SN-21001", "Carlos Lim", -10, 5, true, "Closed and archived"),
    mk("DOC-2026-0009", "Purchase Order", "Pied Piper", "SN-21002", "Maria Santos", -4, 6),
    mk("DOC-2026-0010", "Service Request", "Tyrell Corp.", "SN-21003", "Juan Dela Cruz", -8, 3),
    mk("DOC-2026-0011", "Contract", "Soylent Co.", "", "Ana Reyes", -1, 10),
    mk("DOC-2026-0012", "Quotation", "Massive Dynamic", "SN-30099", "Carlos Lim", -6, 2, true),
  ];
}

// ---------- State ----------
let state = {
  docs: [],
  view: "dashboard",
  tab: "all",
  filters: { search: "", type: "all", status: "all", from: "", to: "" },
  editId: null,
  deleteId: null,
};

function init() {
  let docs = loadDocs();
  if (!docs) {
    docs = sampleData();
    saveDocs(docs);
  }
  state.docs = docs;
  bindEvents();
  renderAll();
}

// ---------- Filtering ----------
function filterDocs(docs) {
  const { search, type, status, from, to } = state.filters;
  const q = search.trim().toLowerCase();
  return docs.filter((d) => {
    const st = computeStatus(d);
    if (state.tab !== "all" && st !== state.tab) return false;
    if (status !== "all" && st !== status) return false;
    if (type !== "all" && d.document_type !== type) return false;
    if (from && d.start_date < from) return false;
    if (to && d.start_date > to) return false;
    if (q) {
      const hay = [d.document_number, d.customer_name, d.serial_number, d.assigned_name]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ---------- Render ----------
function renderAll() {
  renderStats();
  renderDashboard();
  renderTypeFilter();
  renderDocuments();
}

function renderStats() {
  const c = { all: 0, ongoing: 0, due_today: 0, overdue: 0, completed: 0 };
  state.docs.forEach((d) => { c[computeStatus(d)]++; c.all++; });
  $("#stat-total").textContent = c.all;
  $("#stat-ongoing").textContent = c.ongoing;
  $("#stat-due").textContent = c.due_today;
  $("#stat-overdue").textContent = c.overdue;
  $("#stat-completed").textContent = c.completed;
  // Tab counts
  $("#c-all").textContent = c.all;
  $("#c-ongoing").textContent = c.ongoing;
  $("#c-due_today").textContent = c.due_today;
  $("#c-overdue").textContent = c.overdue;
  $("#c-completed").textContent = c.completed;
}

function renderDashboard() {
  const today = todayISO();
  // Nearing due — open docs due in 0..1 days
  const near = state.docs
    .filter((d) => !d.completed_at)
    .map((d) => ({ d, diff: diffDays(today, d.due_date) }))
    .filter(({ diff }) => diff >= 0 && diff <= 1)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 8);
  const nearEl = $("#near-list");
  $("#near-count").textContent = near.length;
  nearEl.innerHTML = near.length ? near.map(({ d, diff }) => `
    <div class="list-item">
      <div>
        <div class="li-title">${escapeHtml(d.document_number)} · ${escapeHtml(d.customer_name)}</div>
        <div class="li-sub">${escapeHtml(d.document_type)} · Due ${formatDate(d.due_date)}</div>
      </div>
      <span class="badge ${diff === 0 ? "due_today" : "ongoing"}">${diff === 0 ? "Due Today" : "Tomorrow"}</span>
    </div>
  `).join("") : `<div class="empty">No documents due within 24 hours.</div>`;

  // Top overdue
  const overdue = state.docs
    .filter((d) => computeStatus(d) === "overdue")
    .sort((a, b) => diffDays(today, a.due_date) - diffDays(today, b.due_date))
    .slice(0, 8);
  $("#topov-count").textContent = overdue.length;
  $("#topov-list").innerHTML = overdue.length ? overdue.map((d) => {
    const days = Math.abs(diffDays(today, d.due_date));
    return `
      <div class="list-item">
        <div>
          <div class="li-title">${escapeHtml(d.document_number)} · ${escapeHtml(d.customer_name)}</div>
          <div class="li-sub">${escapeHtml(d.document_type)} · Was due ${formatDate(d.due_date)}</div>
        </div>
        <span class="badge overdue">${days}d late</span>
      </div>
    `;
  }).join("") : `<div class="empty">No overdue documents. 🎉</div>`;

  // Recent activity
  const acts = loadActivity().slice(0, 10);
  $("#activity-list").innerHTML = acts.length ? acts.map((a) => `
    <div class="list-item">
      <div>
        <div class="li-title">${escapeHtml(actionLabel(a.action))} · ${escapeHtml(a.document_number)}</div>
        <div class="li-sub">${escapeHtml(a.customer_name)} · ${new Date(a.at).toLocaleString()}</div>
      </div>
    </div>
  `).join("") : `<div class="empty">No recent activity yet.</div>`;
}

function actionLabel(a) {
  return { created: "Created", updated: "Updated", deleted: "Deleted", completed: "Marked Completed" }[a] || a;
}

function renderTypeFilter() {
  const types = [...new Set(state.docs.map((d) => d.document_type))].sort();
  const sel = $("#f-type");
  const cur = sel.value || "all";
  sel.innerHTML = `<option value="all">All types</option>` +
    types.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  sel.value = types.includes(cur) || cur === "all" ? cur : "all";
}

function renderDocuments() {
  const tbody = $("#doc-tbody");
  const rows = filterDocs(state.docs).sort((a, b) => a.due_date.localeCompare(b.due_date));
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty">No documents match these filters.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((d) => {
    const st = computeStatus(d);
    return `
      <tr>
        <td><strong>${escapeHtml(d.document_number)}</strong></td>
        <td>${escapeHtml(d.document_type)}</td>
        <td>${escapeHtml(d.customer_name)}</td>
        <td class="muted">${escapeHtml(d.serial_number || "—")}</td>
        <td>${escapeHtml(d.assigned_name || "—")}</td>
        <td>${formatDate(d.start_date)}</td>
        <td>${d.allowed_days}</td>
        <td>${formatDate(d.due_date)}</td>
        <td><span class="badge ${st}">${STATUS_LABEL[st]}</span></td>
        <td class="ta-r">
          <div class="row-actions">
            ${st !== "completed" ? `<button class="icon-btn" data-act="complete" data-id="${d.id}" title="Mark complete">✓</button>` : ""}
            <button class="icon-btn" data-act="edit" data-id="${d.id}" title="Edit">✎</button>
            <button class="icon-btn" data-act="delete" data-id="${d.id}" title="Delete">🗑</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------- Navigation ----------
function switchView(view) {
  state.view = view;
  $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("#view-dashboard").classList.toggle("hidden", view !== "dashboard");
  $("#view-documents").classList.toggle("hidden", view !== "documents");
  if (view === "dashboard") {
    $("#page-title").textContent = "Dashboard";
    $("#page-sub").textContent = "Overview of document SLAs and recent activity.";
  } else {
    $("#page-title").textContent = "Documents";
    $("#page-sub").textContent = "Track, filter, and update every document.";
  }
}

// ---------- Modal: Document Form ----------
function openModal(doc = null) {
  state.editId = doc ? doc.id : null;
  $("#modal-title").textContent = doc ? "Edit Document" : "New Document";
  $("#submit-btn").textContent = doc ? "Save Changes" : "Save Document";
  $("#d-id").value = doc?.id || "";
  $("#d-number").value = doc?.document_number || nextDocNumber();
  $("#d-type").value = doc?.document_type || "Invoice";
  $("#d-customer").value = doc?.customer_name || "";
  $("#d-serial").value = doc?.serial_number || "";
  $("#d-assigned").value = doc?.assigned_name || "";
  $("#d-start").value = doc?.start_date || todayISO();
  $("#d-days").value = doc?.allowed_days ?? 2;
  $("#d-desc").value = doc?.item_description || "";
  $("#d-remarks").value = doc?.remarks || "";
  updateDueDate();
  $("#modal").classList.remove("hidden");
}
function closeModal() {
  $("#modal").classList.add("hidden");
  state.editId = null;
}
function updateDueDate() {
  const start = $("#d-start").value;
  const days = parseInt($("#d-days").value, 10) || 0;
  $("#d-due").value = start ? addDays(start, days) : "";
}
function nextDocNumber() {
  const year = new Date().getFullYear();
  const prefix = `DOC-${year}-`;
  const nums = state.docs
    .map((d) => d.document_number)
    .filter((n) => n.startsWith(prefix))
    .map((n) => parseInt(n.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return prefix + String(next).padStart(4, "0");
}

// ---------- CRUD ----------
function handleSubmit(e) {
  e.preventDefault();
  const start = $("#d-start").value;
  const days = parseInt($("#d-days").value, 10);
  const payload = {
    document_number: $("#d-number").value.trim(),
    document_type: $("#d-type").value,
    customer_name: $("#d-customer").value.trim(),
    serial_number: $("#d-serial").value.trim(),
    assigned_name: $("#d-assigned").value.trim(),
    start_date: start,
    allowed_days: days,
    due_date: addDays(start, days),
    item_description: $("#d-desc").value.trim(),
    remarks: $("#d-remarks").value.trim(),
  };

  if (state.editId) {
    const idx = state.docs.findIndex((d) => d.id === state.editId);
    if (idx > -1) {
      state.docs[idx] = { ...state.docs[idx], ...payload, updated_at: new Date().toISOString() };
      logActivity("updated", state.docs[idx]);
      showToast("Document updated");
    }
  } else {
    const doc = {
      id: uid(),
      completed_at: null,
      created_at: new Date().toISOString(),
      ...payload,
    };
    state.docs.unshift(doc);
    logActivity("created", doc);
    showToast("Document created");
  }
  saveDocs(state.docs);
  closeModal();
  renderAll();
}

function markComplete(id) {
  const idx = state.docs.findIndex((d) => d.id === id);
  if (idx > -1) {
    state.docs[idx].completed_at = new Date().toISOString();
    saveDocs(state.docs);
    logActivity("completed", state.docs[idx]);
    showToast("Marked as completed");
    renderAll();
  }
}

function askDelete(id) {
  const d = state.docs.find((x) => x.id === id);
  if (!d) return;
  state.deleteId = id;
  $("#confirm-msg").textContent = `Permanently delete ${d.document_number} for ${d.customer_name}? This cannot be undone.`;
  $("#confirm").classList.remove("hidden");
}
function doDelete() {
  const d = state.docs.find((x) => x.id === state.deleteId);
  if (d) {
    state.docs = state.docs.filter((x) => x.id !== state.deleteId);
    saveDocs(state.docs);
    logActivity("deleted", d);
    showToast("Document deleted");
  }
  $("#confirm").classList.add("hidden");
  state.deleteId = null;
  renderAll();
}

// ---------- Export / Reset ----------
function exportJSON() {
  const blob = new Blob([JSON.stringify(state.docs, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `doctrack-export-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported JSON");
}
function resetSample() {
  if (!confirm("Reset all data to sample records? This will erase your current documents.")) return;
  state.docs = sampleData();
  saveDocs(state.docs);
  saveActivity([]);
  showToast("Sample data restored");
  renderAll();
}

// ---------- Events ----------
function bindEvents() {
  $$(".nav-item").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.view)));

  $("#btn-new").addEventListener("click", () => { switchView("documents"); openModal(); });
  $("#btn-export").addEventListener("click", exportJSON);
  $("#btn-reset").addEventListener("click", resetSample);

  // Modal close
  $$("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
  $$("[data-close-confirm]").forEach((el) => el.addEventListener("click", () => {
    $("#confirm").classList.add("hidden"); state.deleteId = null;
  }));
  $("#confirm-yes").addEventListener("click", doDelete);

  // Form
  $("#doc-form").addEventListener("submit", handleSubmit);
  $("#d-start").addEventListener("input", updateDueDate);
  $("#d-days").addEventListener("input", updateDueDate);

  // Filters
  $("#f-search").addEventListener("input", (e) => { state.filters.search = e.target.value; renderDocuments(); });
  $("#f-type").addEventListener("change", (e) => { state.filters.type = e.target.value; renderDocuments(); });
  $("#f-status").addEventListener("change", (e) => { state.filters.status = e.target.value; renderDocuments(); });
  $("#f-from").addEventListener("change", (e) => { state.filters.from = e.target.value; renderDocuments(); });
  $("#f-to").addEventListener("change", (e) => { state.filters.to = e.target.value; renderDocuments(); });
  $("#f-clear").addEventListener("click", () => {
    state.filters = { search: "", type: "all", status: "all", from: "", to: "" };
    $("#f-search").value = ""; $("#f-type").value = "all"; $("#f-status").value = "all";
    $("#f-from").value = ""; $("#f-to").value = "";
    renderDocuments();
  });

  // Tabs
  $$(".tab").forEach((t) => t.addEventListener("click", () => {
    state.tab = t.dataset.tab;
    $$(".tab").forEach((x) => x.classList.toggle("active", x === t));
    renderDocuments();
  }));

  // Row actions (delegated)
  $("#doc-tbody").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    if (act === "edit") openModal(state.docs.find((d) => d.id === id));
    else if (act === "delete") askDelete(id);
    else if (act === "complete") markComplete(id);
  });

  // Esc to close modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      $("#modal").classList.add("hidden");
      $("#confirm").classList.add("hidden");
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
