const STORAGE_KEYS = {
  ITEMS: "findit_preview_items_v1",
  CLAIMS: "findit_preview_claims_v1",
  ADMIN_SESSION: "findit_itso_session_v1",
};

const DEFAULT_SEED_ITEMS = [
  {
    id: 1,
    title: "Black HydroFlask 32oz",
    category: "Bottles / Bags",
    item_type: "found",
    location: "Main Library, 3rd Floor",
    date_reported: "2026-10-19",
    description:
      "Matte black insulated flask with a protective rubber boot and an NU Bulldogs sticker near the base.",
    reporter_name: "Kennedy",
    reporter_contact: "kennedy@students.edu.ph",
    status: "open",
  },
  {
    id: 2,
    title: "Casio fx-991EX Calculator",
    category: "Electronics",
    item_type: "lost",
    location: "Engineering Lab 402",
    date_reported: "2026-10-18",
    description:
      "Black solar scientific calculator. Slide-on hard cover has student initials 'RS' etched on the inside.",
    reporter_name: "Rey",
    reporter_contact: "rey@students.edu.ph",
    status: "open",
  },
  {
    id: 3,
    title: "Student ID & Lanyard",
    category: "ID / Cards",
    item_type: "lost",
    location: "Canteen Annex Table 6",
    date_reported: "2026-10-18",
    description:
      "Clear rigid card holder on a campus lanyard with a silver locker key ring attached.",
    reporter_name: "Josh",
    reporter_contact: "josh@students.edu.ph",
    status: "open",
  },
  {
    id: 4,
    title: "Anker 65W USB-C Charger",
    category: "Electronics",
    item_type: "found",
    location: "Computer Lab 3",
    date_reported: "2026-10-17",
    description:
      "Compact black GaN charger block with a braided USB-C cable secured by a gray hook-and-loop tie.",
    reporter_name: "Kim",
    reporter_contact: "kim@students.edu.ph",
    status: "returned",
  },
];

const DEFAULT_SEED_CLAIMS = [
  {
    id: 1,
    item_id: 1,
    item_title: "Black HydroFlask 32oz",
    claimant_name: "Dom",
    student_id: "2024-100482",
    proof_description:
      "Has a small scratch on the lid handle and a Bulldogs sticker on the bottom right side.",
    status: "pending",
    created_at: "2026-10-19T14:30:00",
  },
];

const appState = {
  items: [],
  claims: [],
  activeView: document.body.dataset.portal === "admin" ? "claims" : "board",
  itemFilter: "all",
  categoryFilter: "all",
  claimFilter: "all",
  searchQuery: "",
  isLoading: true,
  isBackendLive: false,
};

const ICONS = {
  location: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
  arrowUpRight: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>`,
  inbox: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>`,
};

const getCategorySvg = (category) => {
  switch (category) {
    case "Electronics":
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
    case "ID / Cards":
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>`;
    case "Bottles / Bags":
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;
    case "Books / Notes":
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;
    case "Keys / Accessories":
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>`;
    default:
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
  }
};

const escapeHtml = (unsafeText) => {
  return String(unsafeText ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const loadPreviewStorage = () => {
  try {
    const rawItems = localStorage.getItem(STORAGE_KEYS.ITEMS);
    const rawClaims = localStorage.getItem(STORAGE_KEYS.CLAIMS);
    const items = rawItems ? JSON.parse(rawItems) : [...DEFAULT_SEED_ITEMS];
    const claims = rawClaims ? JSON.parse(rawClaims) : [...DEFAULT_SEED_CLAIMS];
    if (!rawItems) localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
    if (!rawClaims) localStorage.setItem(STORAGE_KEYS.CLAIMS, JSON.stringify(claims));
    return { items, claims };
  } catch {
    return { items: [...DEFAULT_SEED_ITEMS], claims: [...DEFAULT_SEED_CLAIMS] };
  }
};

const savePreviewStorage = (items, claims) => {
  try {
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
    localStorage.setItem(STORAGE_KEYS.CLAIMS, JSON.stringify(claims));
  } catch {
    // Fallback if storage is unavailable
  }
};

const fetchAllRegistryData = async () => {
  appState.isLoading = true;
  renderItemsBoard();

  const refreshBtn = document.getElementById("refresh-data-btn");
  refreshBtn?.classList.add("is-spinning");

  try {
    if (window.location.protocol === "file:") {
      throw new Error("Local preview");
    }

    const [itemsResponse, claimsResponse] = await Promise.all([
      fetch("/api/items", { headers: { Accept: "application/json" } }),
      fetch("/api/claims", { headers: { Accept: "application/json" } }),
    ]);

    if (!itemsResponse.ok || !claimsResponse.ok) {
      throw new Error("API unavailable");
    }

    const itemsData = await itemsResponse.json();
    const claimsData = await claimsResponse.json();

    appState.items = Array.isArray(itemsData) ? itemsData : itemsData.items || [];
    appState.claims = Array.isArray(claimsData) ? claimsData : claimsData.claims || [];
    appState.isBackendLive = true;
    updateConnectionBadge(true);
  } catch {
    const previewData = loadPreviewStorage();
    appState.items = previewData.items;
    appState.claims = previewData.claims;
    appState.isBackendLive = false;
    updateConnectionBadge(false);
  } finally {
    appState.isLoading = false;
    refreshBtn?.classList.remove("is-spinning");
    renderStatsAndCounters();
    renderItemsBoard();
    renderAdminItemsList();
    renderClaimsQueue();
  }
};

const updateConnectionBadge = (isLive) => {
  const badge = document.getElementById("api-status-badge");
  const label = document.getElementById("api-status-label");
  const resetBtn = document.getElementById("reset-demo-btn");
  if (!badge || !label) return;

  badge.classList.remove("is-online", "is-preview");
  if (isLive) {
    badge.classList.add("is-online");
    label.textContent = "Live API";
    resetBtn?.classList.add("is-hidden");
  } else {
    badge.classList.add("is-preview");
    label.textContent = "Preview";
    resetBtn?.classList.remove("is-hidden");
  }
};

const renderStatsAndCounters = () => {
  const totalCount = appState.items.length;
  const lostCount = appState.items.filter(
    (item) => item.item_type === "lost" && item.status !== "returned"
  ).length;
  const foundCount = appState.items.filter(
    (item) => item.item_type === "found" && item.status !== "returned"
  ).length;
  const returnedCount = appState.items.filter((item) => item.status === "returned").length;
  const pendingClaimsCount = appState.claims.filter((claim) => claim.status === "pending").length;

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  };

  setText("stat-total", totalCount);
  setText("pill-count-all", totalCount);
  setText("stat-lost", lostCount);
  setText("stat-found", foundCount);
  setText("stat-returned", returnedCount);
  setText("pending-claims-count", pendingClaimsCount);
};

const getFilteredItems = () => {
  const query = appState.searchQuery.trim().toLowerCase();

  return appState.items.filter((item) => {
    if (appState.itemFilter === "lost") {
      if (item.item_type !== "lost" || item.status === "returned") return false;
    } else if (appState.itemFilter === "found") {
      if (item.item_type !== "found" || item.status === "returned") return false;
    } else if (appState.itemFilter === "returned") {
      if (item.status !== "returned") return false;
    }

    if (appState.categoryFilter !== "all" && item.category !== appState.categoryFilter) {
      return false;
    }

    if (query) {
      const searchableText = [
        item.title,
        item.category,
        item.location,
        item.description,
        item.reporter_name,
        item.reporter_contact,
      ]
        .join(" ")
        .toLowerCase();
      if (!searchableText.includes(query)) return false;
    }

    return true;
  });
};

const renderItemsBoard = () => {
  const grid = document.getElementById("items-grid");
  if (!grid) return;

  if (appState.isLoading) {
    grid.innerHTML = [1, 2, 3]
      .map(
        () => `
        <div class="skeleton-card" aria-hidden="true">
          <div class="skeleton-line skeleton-line--short"></div>
          <div class="skeleton-line skeleton-line--title"></div>
        </div>
      `
      )
      .join("");
    return;
  }

  const filteredItems = getFilteredItems();

  if (filteredItems.length === 0) {
    grid.innerHTML = `
      <div class="state-box">
        <div class="state-box__icon">${ICONS.inbox}</div>
        <h3 class="state-box__title">No matching items</h3>
        <p class="state-box__desc">
          Try clearing your search filter or report a new lost or found campus item.
        </p>
        <div style="margin-top: 0.5rem;">
          <button type="button" class="btn btn--ghost btn--sm" id="clear-filters-btn">Reset Filters</button>
        </div>
      </div>
    `;
    document.getElementById("clear-filters-btn")?.addEventListener("click", resetBoardFilters);
    return;
  }

  grid.innerHTML = filteredItems
    .map((item, index) => {
      const isReturned = item.status === "returned";
      const isLost = item.item_type === "lost";
      const staggerDelayMs = Math.min(index * 50, 250);

      const statusBadgeHtml = isReturned
        ? `<span class="badge badge--returned"><span class="status-dot-sm status-dot-sm--returned" aria-hidden="true"></span>Returned</span>`
        : isLost
        ? `<span class="badge badge--lost"><span class="status-dot-sm status-dot-sm--lost" aria-hidden="true"></span>Lost</span>`
        : `<span class="badge badge--found"><span class="status-dot-sm status-dot-sm--found" aria-hidden="true"></span>Found</span>`;

      const ctaText = isReturned ? "Resolved" : "Inspect";

      return `
        <article
          class="item-card ${isReturned ? "item-card--returned" : ""}"
          style="animation-delay: ${staggerDelayMs}ms"
          tabindex="0"
          role="button"
          aria-label="Inspect ${escapeHtml(item.title)}"
          data-inspect-item-id="${Number(item.id)}"
        >
          <div class="item-card__visual">
            <div class="item-card__float-left">${statusBadgeHtml}</div>
            <span class="item-card__float-right">#${String(item.id).padStart(3, "0")}</span>
            <div class="item-card__glyph">${getCategorySvg(item.category)}</div>
          </div>

          <div class="item-card__body">
            <span class="item-card__category">${escapeHtml(item.category)}</span>
            <h3 class="item-card__title">${escapeHtml(item.title)}</h3>

            <div class="item-card__sub">
              <span class="item-card__location">
                ${ICONS.location}
                <span>${escapeHtml(item.location)}</span>
              </span>
              <span class="item-card__cta">
                <span>${ctaText}</span>
                ${ICONS.arrowUpRight}
              </span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  grid.querySelectorAll("[data-inspect-item-id]").forEach((card) => {
    const openItem = () => {
      const targetId = Number(card.getAttribute("data-inspect-item-id"));
      openItemDetailModal(targetId);
    };
    card.addEventListener("click", openItem);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openItem();
      }
    });
  });
};

const renderAdminItemsList = () => {
  const listEl = document.getElementById("admin-items-list");
  if (!listEl) return;

  const filteredItems = getFilteredItems();

  if (filteredItems.length === 0) {
    listEl.innerHTML = `
      <div class="state-box">
        <div class="state-box__icon">${ICONS.inbox}</div>
        <h3 class="state-box__title">No matching items</h3>
        <p class="state-box__desc">Try clearing the active search or category filter.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filteredItems
    .map((item) => {
      const isReturned = item.status === "returned";
      const isLost = item.item_type === "lost";

      const statusBadgeHtml = isReturned
        ? `<span class="badge badge--returned"><span class="status-dot-sm status-dot-sm--returned"></span>Returned</span>`
        : isLost
        ? `<span class="badge badge--lost"><span class="status-dot-sm status-dot-sm--lost"></span>Lost</span>`
        : `<span class="badge badge--found"><span class="status-dot-sm status-dot-sm--found"></span>Found</span>`;

      const staffActionBtn = isReturned
        ? `<button type="button" class="btn btn--ghost btn--sm" data-staff-item-id="${Number(item.id)}" data-next-status="open">
             Reopen Item
           </button>`
        : `<button type="button" class="btn btn--primary btn--sm" data-staff-item-id="${Number(item.id)}" data-next-status="returned">
             Mark Returned
           </button>`;

      return `
        <article class="claim-card">
          <div class="claim-card__body">
            <div class="claim-card__header">
              ${statusBadgeHtml}
              <span class="claim-card__student-id">#${String(item.id).padStart(3, "0")}</span>
              <span class="claim-card__claimant">${escapeHtml(item.title)}</span>
              <span class="claim-card__item-ref">&middot; ${escapeHtml(item.location)} (${escapeHtml(item.date_reported)})</span>
            </div>
            <p class="claim-card__proof">${escapeHtml(item.description)}</p>
            <span class="claim-card__item-ref">
              Reporter: <strong>${escapeHtml(item.reporter_name)}</strong> (${escapeHtml(item.reporter_contact)})
            </span>
          </div>

          <div class="claim-card__actions">
            ${staffActionBtn}
          </div>
        </article>
      `;
    })
    .join("");

  listEl.querySelectorAll("[data-staff-item-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = Number(btn.getAttribute("data-staff-item-id"));
      const nextStatus = btn.getAttribute("data-next-status");
      handleDirectItemStatusChange(itemId, nextStatus);
    });
  });
};

const renderClaimsQueue = () => {
  const listEl = document.getElementById("claims-list");
  if (!listEl) return;

  const filteredClaims = appState.claims.filter((claim) => {
    if (appState.claimFilter === "all") return true;
    return claim.status === appState.claimFilter;
  });

  if (filteredClaims.length === 0) {
    listEl.innerHTML = `
      <div class="state-box">
        <div class="state-box__icon">${ICONS.inbox}</div>
        <h3 class="state-box__title">No ${escapeHtml(appState.claimFilter === "all" ? "" : appState.claimFilter)} claims</h3>
        <p class="state-box__desc">
          When students submit ownership claims on the Student Portal, they appear here for verification.
        </p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filteredClaims
    .map((claim) => {
      const linkedItem = appState.items.find((i) => Number(i.id) === Number(claim.item_id));
      const itemTitle = claim.item_title || linkedItem?.title || `Item #${claim.item_id}`;

      const badgeClass =
        claim.status === "pending"
          ? "badge--found"
          : claim.status === "approved"
          ? "badge--returned"
          : "badge--lost";

      const dotClass =
        claim.status === "pending"
          ? "status-dot-sm--found"
          : claim.status === "approved"
          ? "status-dot-sm--returned"
          : "status-dot-sm--lost";

      const actionButtonsHtml =
        claim.status === "pending"
          ? `
            <button type="button" class="btn btn--primary btn--sm" data-review-id="${Number(claim.id)}" data-decision="approved">
              Approve &amp; Return
            </button>
            <button type="button" class="btn btn--ghost btn--sm" data-review-id="${Number(claim.id)}" data-decision="rejected">
              Reject
            </button>
          `
          : "";

      return `
        <article class="claim-card">
          <div class="claim-card__body">
            <div class="claim-card__header">
              <span class="badge ${badgeClass}">
                <span class="status-dot-sm ${dotClass}" aria-hidden="true"></span>
                ${escapeHtml(claim.status)}
              </span>
              <span class="claim-card__claimant">${escapeHtml(claim.claimant_name)}</span>
              <span class="claim-card__student-id">${escapeHtml(claim.student_id)}</span>
              <span class="claim-card__item-ref">for ${escapeHtml(itemTitle)}</span>
            </div>
            <p class="claim-card__proof">"${escapeHtml(claim.proof_description)}"</p>
          </div>

          <div class="claim-card__actions">
            ${actionButtonsHtml}
          </div>
        </article>
      `;
    })
    .join("");

  listEl.querySelectorAll("[data-review-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const claimId = Number(button.getAttribute("data-review-id"));
      const decision = button.getAttribute("data-decision");
      handleReviewClaimDecision(claimId, decision);
    });
  });
};

const handleReportItemSubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const errorEl = document.getElementById("report-form-error");
  const submitBtn = document.getElementById("report-submit-btn");

  const formData = new FormData(form);
  const payload = {
    item_type: String(formData.get("item_type") || "lost").trim(),
    title: String(formData.get("title") || "").trim(),
    category: String(formData.get("category") || "Other").trim(),
    location: String(formData.get("location") || "").trim(),
    date_reported: String(formData.get("date_reported") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    reporter_name: String(formData.get("reporter_name") || "").trim(),
    reporter_contact: String(formData.get("reporter_contact") || "").trim(),
  };

  if (
    !payload.title ||
    !payload.location ||
    !payload.date_reported ||
    !payload.description ||
    !payload.reporter_name ||
    !payload.reporter_contact
  ) {
    if (errorEl) {
      errorEl.textContent = "Please complete all required fields.";
      errorEl.classList.remove("is-hidden");
    }
    return;
  }

  errorEl?.classList.add("is-hidden");
  if (submitBtn) submitBtn.disabled = true;

  try {
    if (appState.isBackendLive) {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to save item");
      await fetchAllRegistryData();
    } else {
      const nextId =
        appState.items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
      const newItem = { id: nextId, ...payload, status: "open" };
      appState.items.unshift(newItem);
      savePreviewStorage(appState.items, appState.claims);
      renderStatsAndCounters();
      renderItemsBoard();
    }

    form.reset();
    setDefaultReportDate();
    closeModal("report-modal");
    showToast(`Published "${payload.title}"`);
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || "Unable to submit report.";
      errorEl.classList.remove("is-hidden");
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
};

const openItemDetailModal = (itemId) => {
  const targetItem = appState.items.find((item) => Number(item.id) === Number(itemId));
  if (!targetItem) return;

  const hiddenInput = document.getElementById("claim-item-id");
  const summaryBox = document.getElementById("claim-target-summary");
  const modalTitle = document.getElementById("claim-modal-title");
  const modalKicker = document.getElementById("detail-modal-kicker");
  const claimForm = document.getElementById("submit-claim-form");
  const errorEl = document.getElementById("claim-form-error");

  if (hiddenInput) hiddenInput.value = String(targetItem.id);
  errorEl?.classList.add("is-hidden");

  const isReturned = targetItem.status === "returned";
  const isLost = targetItem.item_type === "lost";

  if (modalKicker) {
    modalKicker.textContent = `ITEM #${String(targetItem.id).padStart(3, "0")} · ${targetItem.category.toUpperCase()}`;
  }
  if (modalTitle) {
    modalTitle.textContent = targetItem.title;
  }

  const statusBadgeHtml = isReturned
    ? `<span class="badge badge--returned"><span class="status-dot-sm status-dot-sm--returned"></span>Returned</span>`
    : isLost
    ? `<span class="badge badge--lost"><span class="status-dot-sm status-dot-sm--lost"></span>Lost</span>`
    : `<span class="badge badge--found"><span class="status-dot-sm status-dot-sm--found"></span>Found</span>`;

  if (summaryBox) {
    summaryBox.innerHTML = `
      <div class="item-detail-sheet__top">
        ${statusBadgeHtml}
        <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--ink-muted);">
          ${escapeHtml(targetItem.date_reported || "Recently")}
        </span>
      </div>
      <p class="item-detail-sheet__desc">${escapeHtml(targetItem.description)}</p>
      <div class="item-detail-sheet__meta">
        <div><strong>Location:</strong> ${escapeHtml(targetItem.location)}</div>
        <div><strong>Reported by:</strong> ${escapeHtml(targetItem.reporter_name)}</div>
      </div>
    `;
  }

  if (claimForm) {
    claimForm.classList.toggle("is-hidden", isReturned);
  }

  openModal("claim-modal");
};

const handleClaimSubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const errorEl = document.getElementById("claim-form-error");
  const submitBtn = document.getElementById("claim-submit-btn");

  const formData = new FormData(form);
  const itemId = Number(formData.get("item_id"));
  const claimantName = String(formData.get("claimant_name") || "").trim();
  const studentId = String(formData.get("student_id") || "").trim();
  const proofDescription = String(formData.get("proof_description") || "").trim();

  if (!itemId || !claimantName || !studentId || !proofDescription) {
    if (errorEl) {
      errorEl.textContent = "Please provide your name, Student ID, and proof of ownership.";
      errorEl.classList.remove("is-hidden");
    }
    return;
  }

  errorEl?.classList.add("is-hidden");
  if (submitBtn) submitBtn.disabled = true;

  try {
    if (appState.isBackendLive) {
      const response = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: itemId,
          claimant_name: claimantName,
          student_id: studentId,
          proof_description: proofDescription,
        }),
      });
      if (!response.ok) throw new Error("Failed to submit claim");
      await fetchAllRegistryData();
    } else {
      const targetItem = appState.items.find((i) => Number(i.id) === itemId);
      const nextClaimId =
        appState.claims.reduce((max, c) => Math.max(max, Number(c.id) || 0), 0) + 1;

      appState.claims.unshift({
        id: nextClaimId,
        item_id: itemId,
        item_title: targetItem?.title || `Item #${itemId}`,
        claimant_name: claimantName,
        student_id: studentId,
        proof_description: proofDescription,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      savePreviewStorage(appState.items, appState.claims);
      renderStatsAndCounters();
      renderClaimsQueue();
    }

    form.reset();
    closeModal("claim-modal");
    showToast("Claim submitted to ITSO for verification");
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || "Could not submit claim.";
      errorEl.classList.remove("is-hidden");
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
};

const handleReviewClaimDecision = async (claimId, decision) => {
  try {
    if (appState.isBackendLive) {
      const response = await fetch(`/api/claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: decision }),
      });
      if (!response.ok) throw new Error("Failed to update claim");
      await fetchAllRegistryData();
    } else {
      const targetClaim = appState.claims.find((c) => Number(c.id) === Number(claimId));
      if (!targetClaim) return;

      targetClaim.status = decision;
      if (decision === "approved") {
        const linkedItem = appState.items.find(
          (i) => Number(i.id) === Number(targetClaim.item_id)
        );
        if (linkedItem) linkedItem.status = "returned";
      }

      savePreviewStorage(appState.items, appState.claims);
      renderStatsAndCounters();
      renderItemsBoard();
      renderAdminItemsList();
      renderClaimsQueue();
    }

    showToast(
      decision === "approved" ? "Claim approved & item marked Returned" : "Claim rejected"
    );
  } catch (err) {
    showToast(err.message || "Error updating claim");
  }
};

const handleDirectItemStatusChange = async (itemId, nextStatus) => {
  try {
    if (appState.isBackendLive) {
      const response = await fetch(`/api/items/${itemId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("Failed to update item status");
      await fetchAllRegistryData();
    } else {
      const targetItem = appState.items.find((i) => Number(i.id) === Number(itemId));
      if (!targetItem) return;
      targetItem.status = nextStatus;
      savePreviewStorage(appState.items, appState.claims);
      renderStatsAndCounters();
      renderItemsBoard();
      renderAdminItemsList();
    }
    showToast(`Item #${String(itemId).padStart(3, "0")} marked ${nextStatus.toUpperCase()}`);
  } catch (err) {
    showToast(err.message || "Unable to update status");
  }
};

const initAdminAuthGate = () => {
  const authGate = document.getElementById("admin-auth-gate");
  const consoleShell = document.getElementById("admin-console-shell");
  const loginForm = document.getElementById("admin-login-form");
  const logoutBtn = document.getElementById("admin-logout-btn");
  if (!authGate || !consoleShell) return;

  const unlockAdminConsole = () => {
    sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, "authenticated");
    authGate.classList.add("is-hidden");
    consoleShell.classList.remove("is-hidden");
    fetchAllRegistryData();
  };

  if (sessionStorage.getItem(STORAGE_KEYS.ADMIN_SESSION) === "authenticated") {
    unlockAdminConsole();
  }

  loginForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const staffId = document.getElementById("admin-staff-id")?.value.trim();
    const passcode = document.getElementById("admin-passcode")?.value.trim();
    const errorEl = document.getElementById("admin-login-error");

    if (!staffId || !passcode) {
      if (errorEl) {
        errorEl.textContent = "Enter your ITSO Staff ID and passcode.";
        errorEl.classList.remove("is-hidden");
      }
      return;
    }

    errorEl?.classList.add("is-hidden");
    unlockAdminConsole();
    showToast("Signed in to ITSO Verification Console");
  });

  logoutBtn?.addEventListener("click", () => {
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
    consoleShell.classList.add("is-hidden");
    authGate.classList.remove("is-hidden");
    showToast("Signed out of ITSO Console");
  });
};

const switchPrimaryView = (viewName) => {
  appState.activeView = viewName;
  const boardView = document.getElementById("view-board");
  const claimsView = document.getElementById("view-claims");
  const tabBoardBtn = document.getElementById("tab-board-btn");
  const tabClaimsBtn = document.getElementById("tab-claims-btn");

  if (viewName === "board") {
    boardView?.classList.remove("is-hidden");
    claimsView?.classList.add("is-hidden");
    tabBoardBtn?.classList.add("is-active");
    tabBoardBtn?.setAttribute("aria-selected", "true");
    tabClaimsBtn?.classList.remove("is-active");
    tabClaimsBtn?.setAttribute("aria-selected", "false");
    renderItemsBoard();
    renderAdminItemsList();
  } else {
    boardView?.classList.add("is-hidden");
    claimsView?.classList.remove("is-hidden");
    tabClaimsBtn?.classList.add("is-active");
    tabClaimsBtn?.setAttribute("aria-selected", "true");
    tabBoardBtn?.classList.remove("is-active");
    tabBoardBtn?.setAttribute("aria-selected", "false");
    renderClaimsQueue();
  }
};

const resetBoardFilters = () => {
  appState.itemFilter = "all";
  appState.categoryFilter = "all";
  appState.searchQuery = "";

  const searchInput = document.getElementById("search-input");
  const categorySelect = document.getElementById("category-filter");
  if (searchInput) searchInput.value = "";
  if (categorySelect) categorySelect.value = "all";

  document.querySelectorAll(".filter-pill").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-filter") === "all");
  });

  renderItemsBoard();
  renderAdminItemsList();
};

const openModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("is-hidden");
  const firstInput = modal.querySelector("input:not([type='hidden']), select, textarea");
  firstInput?.focus();
};

const closeModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add("is-hidden");
};

const showToast = (message) => {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3200);
};

const setDefaultReportDate = () => {
  const dateInput = document.getElementById("report-date");
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }
};

const normalizeBuildBadge = () => {
  const badgeEl = document.getElementById("build-number-label");
  if (badgeEl && badgeEl.textContent.includes("__BUILD_NUMBER__")) {
    badgeEl.textContent = "Build #dev";
  }
};

const initEventListeners = () => {
  document.getElementById("brand-home-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    resetBoardFilters();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.getElementById("tab-board-btn")?.addEventListener("click", () => switchPrimaryView("board"));
  document.getElementById("tab-claims-btn")?.addEventListener("click", () => switchPrimaryView("claims"));

  document.getElementById("search-input")?.addEventListener("input", (e) => {
    appState.searchQuery = e.target.value;
    renderItemsBoard();
    renderAdminItemsList();
  });

  document.getElementById("category-filter")?.addEventListener("change", (e) => {
    appState.categoryFilter = e.target.value;
    renderItemsBoard();
    renderAdminItemsList();
  });

  document.querySelectorAll(".filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      appState.itemFilter = pill.getAttribute("data-filter") || "all";
      document.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("is-active"));
      pill.classList.add("is-active");
      renderItemsBoard();
      renderAdminItemsList();
    });
  });

  document.querySelectorAll(".claim-filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      appState.claimFilter = pill.getAttribute("data-claim-filter") || "all";
      document.querySelectorAll(".claim-filter-pill").forEach((p) => p.classList.remove("is-active"));
      pill.classList.add("is-active");
      renderClaimsQueue();
    });
  });

  document.getElementById("open-report-modal-btn")?.addEventListener("click", () => openModal("report-modal"));
  document.getElementById("refresh-data-btn")?.addEventListener("click", () => {
    fetchAllRegistryData();
    showToast("Synced");
  });

  document.getElementById("reset-demo-btn")?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.ITEMS);
    localStorage.removeItem(STORAGE_KEYS.CLAIMS);
    fetchAllRegistryData();
    showToast("Sample items restored");
  });

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.getAttribute("data-close-modal")));
  });

  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal(backdrop.id);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal("report-modal");
      closeModal("claim-modal");
    }
  });

  window.addEventListener("storage", () => {
    fetchAllRegistryData();
  });

  document.getElementById("report-item-form")?.addEventListener("submit", handleReportItemSubmit);
  document.getElementById("submit-claim-form")?.addEventListener("submit", handleClaimSubmit);
};

document.addEventListener("DOMContentLoaded", () => {
  normalizeBuildBadge();
  setDefaultReportDate();
  initEventListeners();
  initAdminAuthGate();
  fetchAllRegistryData();
});
