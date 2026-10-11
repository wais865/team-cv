import type { AppInfo, Experience, TeamMemberInput, TeamMemberView } from "../shared/types";

// ---------- DOM helpers ----------
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T;

const esc = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

const grid = $("#grid");
const empty = $("#empty");
const count = $("#count");
const search = $<HTMLInputElement>("#search");
const detailDialog = $<HTMLDialogElement>("#detail-dialog");
const formDialog = $<HTMLDialogElement>("#form-dialog");
const confirmDialog = $<HTMLDialogElement>("#confirm-dialog");
const form = $<HTMLFormElement>("#member-form");
const formErrors = $("#form-errors");
const experienceList = $("#experience-list");
const photoInput = $<HTMLInputElement>("#photo-input");
const photoPreview = $("#photo-preview");
const photoRemove = $<HTMLButtonElement>("#photo-remove");
const toast = $("#toast");

let members: TeamMemberView[] = [];
let editingId: string | null = null;
let photoFile: File | null = null;
let removePhoto = false;
let previewUrl: string | null = null;

// ---------- API ----------
class ApiError extends Error {
  constructor(public errors: string[]) {
    super(errors.join(" "));
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.errors ?? [`Request failed (${res.status}).`]);
  return body as T;
}

const memberApi = {
  list: (q = "") => api<TeamMemberView[]>(`/api/members${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  get: (id: string) => api<TeamMemberView>(`/api/members/${id}`),
  save: (input: TeamMemberInput, photo: File | null, id?: string | null) => {
    const body = new FormData();
    body.append("data", JSON.stringify(input));
    if (photo) body.append("photo", photo);
    return api<TeamMemberView>(id ? `/api/members/${id}` : "/api/members", {
      method: id ? "PUT" : "POST",
      body,
    });
  },
  remove: (id: string) => api<void>(`/api/members/${id}`, { method: "DELETE" }),
};

// ---------- Formatting ----------
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

const avatar = (m: Pick<TeamMemberView, "name" | "photo">, size = "") =>
  `<div class="avatar ${size}">${
    m.photo ? `<img src="${esc(m.photo)}" alt="Photo of ${esc(m.name)}" />` : esc(initials(m.name))
  }</div>`;

const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

const formatMonth = (ym?: string) => {
  if (!ym) return "Present";
  const [y, m] = ym.split("-").map(Number);
  return new Date(y!, m! - 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
};

const chips = (items: string[], plain = false) =>
  items.length
    ? `<div class="chips">${items.map((i) => `<span class="chip ${plain ? "chip-plain" : ""}">${esc(i)}</span>`).join("")}</div>`
    : `<p class="hint">—</p>`;

function showToast(message: string) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout((showToast as { t?: number }).t);
  (showToast as { t?: number }).t = window.setTimeout(() => (toast.hidden = true), 2600);
}

// ---------- READ: list ----------
async function loadMembers() {
  try {
    members = await memberApi.list(search.value.trim());
    renderGrid();
  } catch (err) {
    grid.innerHTML = "";
    empty.hidden = false;
    empty.textContent = `Could not load team members. ${(err as Error).message}`;
  }
}

function renderGrid() {
  count.textContent = `${members.length} member${members.length === 1 ? "" : "s"}`;
  empty.hidden = members.length > 0;
  empty.textContent = search.value ? "No team members match your search." : "No team members yet. Add the first one!";

  grid.innerHTML = members
    .map(
      (m) => `
      <button class="card" type="button" data-id="${esc(m.id)}">
        <div class="card-top">
          ${avatar(m)}
          <div>
            <h3>${esc(m.name)}</h3>
            <div class="job">${esc(m.jobTitle)}${m.department ? ` · ${esc(m.department)}` : ""}</div>
          </div>
        </div>
        <div class="card-meta">
          <span>${m.age} years</span>
          ${m.address.city ? `<span>📍 ${esc(m.address.city)}</span>` : ""}
          <span>${m.experiences.length} experience${m.experiences.length === 1 ? "" : "s"}</span>
        </div>
        ${m.skills.length ? chips(m.skills.slice(0, 4)) : ""}
      </button>`,
    )
    .join("");
}

// ---------- READ: details ----------
function openDetails(id: string) {
  const m = members.find((x) => x.id === id);
  if (!m) return;

  const address = [m.address.street, [m.address.postalCode, m.address.city].filter(Boolean).join(" "), m.address.country]
    .filter(Boolean)
    .map(esc)
    .join("<br>");

  const experiences = [...m.experiences].sort((a, b) => b.startDate.localeCompare(a.startDate));

  $("#detail-content").innerHTML = `
    <div class="cv">
      <aside class="cv-side">
        ${avatar(m, "avatar-xl")}
        <ul class="facts">
          <li><span>Age</span>${m.age} years</li>
          <li><span>Date of birth</span>${esc(formatDate(m.dateOfBirth))}</li>
          ${m.nationality ? `<li><span>Nationality</span>${esc(m.nationality)}</li>` : ""}
          ${m.email ? `<li><span>Email</span><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></li>` : ""}
          ${m.phone ? `<li><span>Phone</span>${esc(m.phone)}</li>` : ""}
          ${address ? `<li><span>Address</span>${address}</li>` : ""}
        </ul>
        <div class="cv-section"><h4>Languages</h4>${chips(m.languages, true)}</div>
      </aside>
      <div class="cv-main">
        <div class="cv-head">
          <div>
            <h2>${esc(m.name)}</h2>
            <div class="job">${esc(m.jobTitle)}${m.department ? ` · ${esc(m.department)}` : ""}</div>
          </div>
        </div>
        ${m.bio ? `<div class="cv-section"><h4>About</h4><p style="margin:0">${esc(m.bio)}</p></div>` : ""}
        <div class="cv-section">
          <h4>Experience</h4>
          ${
            experiences.length
              ? `<ul class="timeline">${experiences
                  .map(
                    (e) => `<li>
                      <div class="when">${formatMonth(e.startDate)} – ${formatMonth(e.endDate)}</div>
                      <div class="what">${esc(e.position)} · ${esc(e.company)}</div>
                      ${e.description ? `<div class="desc">${esc(e.description)}</div>` : ""}
                    </li>`,
                  )
                  .join("")}</ul>`
              : `<p class="hint">No experience added yet.</p>`
          }
        </div>
        <div class="cv-section"><h4>Skills</h4>${chips(m.skills)}</div>
        <div class="cv-section"><h4>Hobbies</h4>${chips(m.hobbies, true)}</div>
        <div class="cv-actions">
          <button type="button" class="btn btn-primary" data-action="edit">Edit</button>
          <a class="btn btn-ghost" href="/api/members/${esc(m.id)}/yaml" download>Download YAML</a>
          <button type="button" class="btn btn-ghost" data-action="delete" style="margin-left:auto;color:var(--danger)">Delete</button>
        </div>
      </div>
    </div>`;

  $("[data-action=edit]", detailDialog).onclick = () => {
    detailDialog.close();
    openForm(m);
  };
  $("[data-action=delete]", detailDialog).onclick = () => askDelete(m);
  detailDialog.showModal();
}

// ---------- CREATE / UPDATE: form ----------
function setPhotoPreview(name: string, src?: string) {
  photoPreview.innerHTML = src ? `<img src="${esc(src)}" alt="" />` : esc(initials(name || "?"));
  photoRemove.hidden = !src;
}

function addExperienceRow(exp?: Partial<Experience>) {
  const tpl = $<HTMLTemplateElement>("#experience-row");
  const row = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
  row.querySelectorAll<HTMLInputElement>("[data-field]").forEach((input) => {
    input.value = (exp?.[input.dataset.field as keyof Experience] as string) ?? "";
  });
  $(".remove-experience", row).onclick = () => row.remove();
  experienceList.append(row);
}

function openForm(m?: TeamMemberView) {
  form.reset();
  editingId = m?.id ?? null;
  photoFile = null;
  removePhoto = false;
  formErrors.hidden = true;
  form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
  experienceList.innerHTML = "";

  $("#form-title").textContent = m ? `Edit ${m.name}` : "Add team member";
  $("#save-btn").textContent = m ? "Save changes" : "Add member";

  if (m) {
    const values: Record<string, string> = {
      name: m.name,
      jobTitle: m.jobTitle,
      department: m.department ?? "",
      dateOfBirth: m.dateOfBirth,
      nationality: m.nationality ?? "",
      email: m.email ?? "",
      phone: m.phone ?? "",
      "address.street": m.address.street,
      "address.postalCode": m.address.postalCode,
      "address.city": m.address.city,
      "address.country": m.address.country,
      bio: m.bio ?? "",
      skills: m.skills.join(", "),
      languages: m.languages.join(", "),
      hobbies: m.hobbies.join(", "),
    };
    for (const [name, value] of Object.entries(values)) {
      (form.elements.namedItem(name) as HTMLInputElement).value = value;
    }
    m.experiences.forEach((e) => addExperienceRow(e));
  }
  if (!m || m.experiences.length === 0) addExperienceRow();

  setPhotoPreview(m?.name ?? "", m?.photo);
  formDialog.showModal();
  (form.elements.namedItem("name") as HTMLInputElement).focus();
}

function readForm(): TeamMemberInput {
  const v = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value.trim();
  const list = (name: string) => v(name).split(",").map((s) => s.trim()).filter(Boolean);

  const experiences = [...experienceList.querySelectorAll<HTMLElement>(".experience-row")].map((row) => {
    const f = (field: string) => $<HTMLInputElement>(`[data-field=${field}]`, row).value.trim();
    return {
      company: f("company"),
      position: f("position"),
      startDate: f("startDate"),
      endDate: f("endDate") || undefined,
      description: f("description") || undefined,
    };
  });

  return {
    name: v("name"),
    jobTitle: v("jobTitle"),
    department: v("department") || undefined,
    dateOfBirth: v("dateOfBirth"),
    nationality: v("nationality") || undefined,
    email: v("email") || undefined,
    phone: v("phone") || undefined,
    address: {
      street: v("address.street"),
      postalCode: v("address.postalCode"),
      city: v("address.city"),
      country: v("address.country"),
    },
    bio: v("bio") || undefined,
    skills: list("skills"),
    languages: list("languages"),
    hobbies: list("hobbies"),
    experiences,
    removePhoto,
  };
}

function showErrors(errors: string[]) {
  formErrors.innerHTML = `<ul>${errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
  formErrors.hidden = false;
  formErrors.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));

  // Quick checks in the browser; the server validates everything again
  const missing = ["name", "jobTitle", "dateOfBirth"]
    .map((n) => form.elements.namedItem(n) as HTMLInputElement)
    .filter((input) => !input.value.trim());
  if (missing.length) {
    missing.forEach((input) => input.classList.add("invalid"));
    showErrors(["Please fill in name, job title and date of birth."]);
    return;
  }

  const saveBtn = $<HTMLButtonElement>("#save-btn");
  saveBtn.disabled = true;
  try {
    const saved = await memberApi.save(readForm(), photoFile, editingId);
    formDialog.close();
    showToast(editingId ? `${saved.name} updated` : `${saved.name} added to the team`);
    await loadMembers();
  } catch (err) {
    showErrors(err instanceof ApiError ? err.errors : [(err as Error).message]);
  } finally {
    saveBtn.disabled = false;
  }
});

photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  photoFile = file;
  removePhoto = false;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  setPhotoPreview("", previewUrl);
});

photoRemove.addEventListener("click", () => {
  photoFile = null;
  photoInput.value = "";
  removePhoto = true;
  setPhotoPreview((form.elements.namedItem("name") as HTMLInputElement).value);
});

$("#add-experience").addEventListener("click", () => addExperienceRow());

// ---------- DELETE ----------
function askDelete(m: TeamMemberView) {
  $("#confirm-text").textContent = `${m.name} will be removed from the team. This cannot be undone.`;
  $("#confirm-delete").onclick = async () => {
    try {
      await memberApi.remove(m.id);
      confirmDialog.close();
      detailDialog.close();
      showToast(`${m.name} deleted`);
      await loadMembers();
    } catch (err) {
      confirmDialog.close();
      showToast((err as Error).message);
    }
  };
  confirmDialog.showModal();
}

// ---------- Wiring ----------
$("#add-btn").addEventListener("click", () => openForm());

grid.addEventListener("click", (event) => {
  const card = (event.target as HTMLElement).closest<HTMLElement>(".card");
  if (card?.dataset.id) openDetails(card.dataset.id);
});

let searchTimer: number | undefined;
search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = window.setTimeout(loadMembers, 200);
});

// Close buttons and clicks on the backdrop close any dialog
for (const dialog of [detailDialog, formDialog, confirmDialog]) {
  dialog.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const r = dialog.getBoundingClientRect();
    const outside =
      event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
    if ((target === dialog && outside) || target.closest("[data-close]")) dialog.close();
  });
}

async function init() {
  try {
    const info = await api<AppInfo>("/api/info");
    document.title = info.title;
    $("#app-title").textContent = info.title;
    $("#app-subtitle").textContent = info.subtitle;
  } catch {
    /* keep defaults */
  }
  await loadMembers();
}

init();
