const questionnaireStorageKey = "maylin-questionnaires";
const portalAuthKey = "maylin-admin-session";
const fallbackUsername = "revup";
const fallbackPassword = "miami";
const storageApi = window.maylinStorageApi || null;
const dataApi = window.maylinDataApi || null;
const isRemoteDataEnabled = Boolean(dataApi?.isConfigured);

const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("dashboard");
const portalGrid = document.querySelector(".portal-grid");
const loginForm = document.getElementById("portal-login-form");
const signupPanel = document.getElementById("portal-signup-panel");
const signupForm = document.getElementById("portal-signup-form");
const loginStatus = document.getElementById("login-status");
const signupStatus = document.getElementById("signup-status");
const questionnaireList = document.getElementById("questionnaire-list");
const searchInput = document.getElementById("portal-search");
const exportJsonButton = document.getElementById("export-json");
const exportCsvButton = document.getElementById("export-csv");
const totalStat = document.getElementById("stat-total");
const latestStat = document.getElementById("stat-latest");
const areasStat = document.getElementById("stat-areas");
const readyStat = document.getElementById("stat-ready");
const areaBreakdown = document.getElementById("area-breakdown");
const recentActivity = document.getElementById("recent-activity");
const resultsMeta = document.getElementById("results-meta");
const areaFilters = document.getElementById("area-filters");
const sortChips = document.getElementById("sort-chips");
const logoutButtons = document.querySelectorAll(".portal-logout-button");

let currentAreaFilter = "all";
let currentSort = "newest";
let cachedEntries = [];

const loginIdentityInput = loginForm?.querySelector('input[name="username"], input[name="email"]');
const loginIdentityLabel = loginIdentityInput?.closest("label");

const escapeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => escapeMap[char]);
const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const cleanPhone = (value) => String(value ?? "").replace(/[^\d+]/g, "");

const setStatus = (element, message, type = "default") => {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.remove("is-error", "is-success");

  if (type === "error") {
    element.classList.add("is-error");
  }

  if (type === "success") {
    element.classList.add("is-success");
  }
};

const getStoredQuestionnaires = () => {
  if (storageApi?.listQuestionnaires) {
    return storageApi.listQuestionnaires();
  }

  try {
    const storedEntries = window.localStorage.getItem(questionnaireStorageKey);

    if (!storedEntries) {
      return [];
    }

    const parsedEntries = JSON.parse(storedEntries);
    return Array.isArray(parsedEntries) ? parsedEntries : [];
  } catch {
    return [];
  }
};

const loadQuestionnaires = async () => {
  if (dataApi?.listQuestionnaires) {
    try {
      cachedEntries = await dataApi.listQuestionnaires();
      return cachedEntries;
    } catch (error) {
      console.error(error);
    }
  }

  cachedEntries = getStoredQuestionnaires();
  return cachedEntries;
};

const isFallbackAuthenticated = () =>
  window.sessionStorage.getItem(portalAuthKey) === "authenticated";

const setAuthenticated = (authenticated) => {
  if (!isRemoteDataEnabled) {
    if (authenticated) {
      window.sessionStorage.setItem(portalAuthKey, "authenticated");
    } else {
      window.sessionStorage.removeItem(portalAuthKey);
    }
  }

  if (loginPanel) {
    loginPanel.hidden = authenticated;
    loginPanel.classList.toggle("is-visible", !authenticated);
  }

  if (dashboard) {
    dashboard.hidden = !authenticated;
    dashboard.classList.toggle("is-visible", authenticated);
  }

  if (portalGrid) {
    portalGrid.classList.toggle("is-login", !authenticated);
    portalGrid.classList.toggle("is-dashboard", authenticated);
  }

  logoutButtons.forEach((button) => {
    button.hidden = !authenticated;
  });
};

const formatDate = (isoDate) => {
  if (!isoDate) {
    return "No entries yet";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
};

const getAreaValue = (entry) => String(entry?.deliveryArea ?? "").trim();
const getAreaKey = (entry) => normalizeText(getAreaValue(entry));

const sortEntries = (entries) => {
  const sortableEntries = [...entries];

  if (currentSort === "oldest") {
    return sortableEntries.sort(
      (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
    );
  }

  if (currentSort === "name") {
    return sortableEntries.sort((first, second) =>
      String(first.name ?? "").localeCompare(String(second.name ?? ""), "en", {
        sensitivity: "base",
      }),
    );
  }

  return sortableEntries.sort(
    (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  );
};

const createDownload = (filename, content, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const toCsv = (entries) => {
  const headers = ["createdAt", "name", "email", "phone", "deliveryArea", "message", "source", "id"];
  const escapeCsvValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

  const rows = entries.map((entry) =>
    headers.map((header) => escapeCsvValue(entry[header])).join(","),
  );

  return [headers.join(","), ...rows].join("\n");
};

const renderQuestionnaireCard = (entry) => {
  const fields = [
    ["Email", entry.email || "Not provided"],
    ["Phone", entry.phone || "Not provided"],
    ["Delivery area", entry.deliveryArea || "Not provided"],
    ["Source", entry.source || "website-questionnaire"],
  ];

  const fieldsMarkup = fields
    .map(
      ([label, value]) => `
        <div class="questionnaire-field">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");

  const notesMarkup = escapeHtml(entry.message || "No notes provided.").replace(/\n/g, "<br />");
  const emailAction = entry.email
    ? `<a class="record-action" href="mailto:${encodeURIComponent(entry.email)}">Email</a>`
    : "";
  const phoneHref = cleanPhone(entry.phone);
  const phoneAction = phoneHref
    ? `<a class="record-action" href="tel:${phoneHref}">Call</a>`
    : "";
  const textAction = phoneHref
    ? `<a class="record-action" href="sms:${phoneHref}">Text</a>`
    : "";

  return `
    <article class="questionnaire-card">
      <div class="questionnaire-head">
        <div class="questionnaire-head-copy">
          <h3>${escapeHtml(entry.name || "Unnamed contact")}</h3>
          <div class="questionnaire-meta">
            <span>${escapeHtml(formatDate(entry.createdAt))}</span>
            <span>${escapeHtml(entry.id || "No ID")}</span>
          </div>
        </div>
        <span class="portal-tag">${escapeHtml(entry.deliveryArea || "Questionnaire")}</span>
      </div>

      <div class="questionnaire-fields">
        ${fieldsMarkup}
      </div>

      <div class="questionnaire-message-box">
        <span>Message</span>
        <p>${notesMarkup}</p>
      </div>

      <div class="record-actions">
        ${emailAction}
        ${phoneAction}
        ${textAction}
      </div>
    </article>
  `;
};

const renderAreaBreakdown = (entries) => {
  if (!areaBreakdown) {
    return;
  }

  const areaCounts = entries.reduce((accumulator, entry) => {
    const areaLabel = getAreaValue(entry);

    if (!areaLabel) {
      return accumulator;
    }

    const existingArea = accumulator.find(
      (item) => normalizeText(item.label) === normalizeText(areaLabel),
    );

    if (existingArea) {
      existingArea.count += 1;
      return accumulator;
    }

    accumulator.push({ label: areaLabel, count: 1 });
    return accumulator;
  }, []);

  if (!areaCounts.length) {
    areaBreakdown.innerHTML = `<div class="portal-empty">No delivery areas recorded yet.</div>`;
    return;
  }

  const sortedAreas = areaCounts.sort((first, second) => second.count - first.count).slice(0, 6);
  const maxCount = sortedAreas[0]?.count || 1;

  areaBreakdown.innerHTML = sortedAreas
    .map(
      (area) => `
        <div class="area-row">
          <div class="area-row-head">
            <span>${escapeHtml(area.label)}</span>
            <strong>${escapeHtml(area.count)}</strong>
          </div>
          <div class="area-bar">
            <span style="width:${(area.count / maxCount) * 100}%"></span>
          </div>
        </div>
      `,
    )
    .join("");
};

const renderRecentActivity = (entries) => {
  if (!recentActivity) {
    return;
  }

  const latestEntries = sortEntries(entries).slice(0, 5);

  if (!latestEntries.length) {
    recentActivity.innerHTML = `<div class="portal-empty">No recent activity yet.</div>`;
    return;
  }

  recentActivity.innerHTML = latestEntries
    .map(
      (entry) => `
        <article class="activity-item">
          <div class="activity-dot" aria-hidden="true"></div>
          <div class="activity-copy">
            <strong>${escapeHtml(entry.name || "Unnamed contact")}</strong>
            <span>${escapeHtml(entry.deliveryArea || "No delivery area")} • ${escapeHtml(formatDate(entry.createdAt))}</span>
          </div>
        </article>
      `,
    )
    .join("");
};

const renderAreaFilters = (entries) => {
  if (!areaFilters) {
    return;
  }

  const uniqueAreas = Array.from(
    new Map(
      entries
        .map((entry) => getAreaValue(entry))
        .filter(Boolean)
        .map((area) => [normalizeText(area), area]),
    ).values(),
  ).slice(0, 8);

  const allFilters = ["All areas", ...uniqueAreas];

  areaFilters.innerHTML = allFilters
    .map((areaLabel, index) => {
      const areaKey = index === 0 ? "all" : normalizeText(areaLabel);
      const activeClass = areaKey === currentAreaFilter ? " is-active" : "";

      return `
        <button class="filter-chip${activeClass}" type="button" data-area="${escapeHtml(areaKey)}">
          ${escapeHtml(areaLabel)}
        </button>
      `;
    })
    .join("");
};

const renderResultsMeta = (filteredCount, totalCount) => {
  if (!resultsMeta) {
    return;
  }

  const filterLabel =
    currentAreaFilter !== "all"
      ? ` in ${currentAreaFilter.replace(/\b\w/g, (char) => char.toUpperCase())}`
      : "";
  const searchLabel = searchInput?.value?.trim()
    ? ` matching "${searchInput.value.trim()}"`
    : "";

  resultsMeta.textContent = `Showing ${filteredCount} of ${totalCount} questionnaires${filterLabel}${searchLabel}.`;
};

const getFilteredEntries = (entries, query = "") => {
  const normalizedQuery = query.trim().toLowerCase();

  return entries.filter((entry) => {
    const matchesArea = currentAreaFilter === "all" || getAreaKey(entry) === currentAreaFilter;

    if (!matchesArea) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [entry.name, entry.email, entry.phone, entry.deliveryArea, entry.message]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });
};

const renderDashboardError = (message) => {
  if (questionnaireList) {
    questionnaireList.innerHTML = `<div class="portal-empty is-error">${escapeHtml(message)}</div>`;
  }

  if (resultsMeta) {
    resultsMeta.textContent = message;
  }
};

const renderDashboard = async (query = "") => {
  if (!questionnaireList || !totalStat || !latestStat || !areasStat || !readyStat) {
    return;
  }

  try {
    const entries = await loadQuestionnaires();
    const filteredEntries = sortEntries(getFilteredEntries(entries, query));

    totalStat.textContent = String(entries.length);
    latestStat.textContent = entries.length ? formatDate(entries[0].createdAt) : "No entries yet";
    areasStat.textContent = String(
      new Set(
        entries
          .map((entry) => entry.deliveryArea)
          .filter(Boolean)
          .map((value) => String(value).trim().toLowerCase()),
      ).size,
    );
    readyStat.textContent = String(entries.filter((entry) => normalizeText(entry.phone)).length);

    renderAreaFilters(entries);
    renderAreaBreakdown(filteredEntries);
    renderRecentActivity(filteredEntries);
    renderResultsMeta(filteredEntries.length, entries.length);

    if (!filteredEntries.length) {
      questionnaireList.innerHTML = `
        <div class="portal-empty">
          No questionnaires match the current search or area filter.
        </div>
      `;
      return;
    }

    questionnaireList.innerHTML = filteredEntries.map(renderQuestionnaireCard).join("");
  } catch (error) {
    console.error(error);
    renderDashboardError(
      "We could not load the questionnaires right now. Check the data connection and try again.",
    );
  }
};

const updateLoginIdentityUi = () => {
  if (!loginIdentityInput || !loginIdentityLabel) {
    return;
  }

  const labelTextNode = Array.from(loginIdentityLabel.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
  );

  if (isRemoteDataEnabled) {
    loginIdentityInput.name = "email";
    loginIdentityInput.type = "email";
    loginIdentityInput.autocomplete = "email";
    loginIdentityInput.setAttribute("inputmode", "email");
    loginIdentityInput.placeholder = "team@example.com";

    if (labelTextNode) {
      labelTextNode.textContent = "Email\n                ";
    }
  } else {
    loginIdentityInput.name = "username";
    loginIdentityInput.type = "text";
    loginIdentityInput.autocomplete = "username";
    loginIdentityInput.setAttribute("inputmode", "text");
    loginIdentityInput.setAttribute("autocapitalize", "off");
    loginIdentityInput.setAttribute("spellcheck", "false");
    loginIdentityInput.placeholder = "revup";

    if (labelTextNode) {
      labelTextNode.textContent = "Username\n                ";
    }
  }
};

const clearDashboardSearch = () => {
  currentAreaFilter = "all";
  currentSort = "newest";

  if (searchInput) {
    searchInput.value = "";
  }

  if (sortChips) {
    sortChips.querySelectorAll("[data-sort]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.sort === "newest");
    });
  }
};

const handleLogout = async () => {
  if (isRemoteDataEnabled && dataApi?.signOut) {
    const { error } = await dataApi.signOut();

    if (error) {
      console.error(error);
    }
  }

  setAuthenticated(false);
  clearDashboardSearch();
  cachedEntries = [];
  setStatus(loginStatus, "You have been logged out.", "success");

  if (questionnaireList) {
    questionnaireList.innerHTML = "";
  }
};

const initializeSignupUi = () => {
  if (!signupPanel) {
    return;
  }

  signupPanel.hidden = !(isRemoteDataEnabled && dataApi?.allowPortalSignup);
};

const initializePortal = async () => {
  updateLoginIdentityUi();
  initializeSignupUi();

  if (isRemoteDataEnabled && dataApi?.getSession) {
    const { data, error } = await dataApi.getSession();

    if (error) {
      console.error(error);
    }

    const hasSession = Boolean(data?.session);
    setAuthenticated(hasSession);

    if (hasSession) {
      await renderDashboard();
    }

    dataApi.onAuthStateChange?.((_event, session) => {
      const authenticated = Boolean(session);
      setAuthenticated(authenticated);

      if (authenticated) {
        renderDashboard(searchInput?.value || "").catch(console.error);
      }
    });

    return;
  }

  setAuthenticated(isFallbackAuthenticated());

  if (isFallbackAuthenticated()) {
    await renderDashboard();
  }
};

if (loginPanel && dashboard && loginForm && loginStatus) {
  initializePortal().catch(console.error);

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(loginStatus, "Checking access...");

    const formData = new FormData(loginForm);

    try {
      if (isRemoteDataEnabled && dataApi?.signIn) {
        const email = String(formData.get("email") || "").trim();
        const password = String(formData.get("password") || "").trim();
        const { error } = await dataApi.signIn({ email, password });

        if (error) {
          throw error;
        }

        setStatus(loginStatus, "Access granted.", "success");
        setAuthenticated(true);
        await renderDashboard(searchInput?.value || "");
        loginForm.reset();
        return;
      }

      const username = String(formData.get("username") || "").trim();
      const password = String(formData.get("password") || "").trim();

      if (
        normalizeText(username) === fallbackUsername &&
        normalizeText(password) === fallbackPassword
      ) {
        setStatus(loginStatus, "Access granted.", "success");
        setAuthenticated(true);
        await renderDashboard(searchInput?.value || "");
        loginForm.reset();
        return;
      }

      throw new Error("Incorrect username or password.");
    } catch (error) {
      console.error(error);
      setAuthenticated(false);
      setStatus(
        loginStatus,
        isRemoteDataEnabled
          ? "Incorrect email or password."
          : "Incorrect username or password.",
        "error",
      );
    }
  });

  signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isRemoteDataEnabled || !dataApi?.signUp) {
      setStatus(signupStatus, "Portal signup is not available in fallback mode.", "error");
      return;
    }

    const formData = new FormData(signupForm);
    const fullName = String(formData.get("fullName") || "").trim();
    const email = String(formData.get("signupEmail") || "").trim();
    const password = String(formData.get("signupPassword") || "").trim();

    setStatus(signupStatus, "Creating user...");

    try {
      const { error } = await dataApi.signUp({
        email,
        password,
        metadata: fullName ? { full_name: fullName } : {},
      });

      if (error) {
        throw error;
      }

      setStatus(
        signupStatus,
        "User created. Check the inbox for verification if your auth settings require it.",
        "success",
      );
      signupForm.reset();
    } catch (error) {
      console.error(error);
      setStatus(
        signupStatus,
        error?.message || "We could not create the portal user right now.",
        "error",
      );
    }
  });

  logoutButtons.forEach((button) => {
    button.addEventListener("click", () => {
      handleLogout().catch(console.error);
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      renderDashboard(event.currentTarget.value).catch(console.error);
    });
  }

  if (areaFilters) {
    areaFilters.addEventListener("click", (event) => {
      const filterButton = event.target.closest("[data-area]");

      if (!filterButton) {
        return;
      }

      currentAreaFilter = String(filterButton.dataset.area || "all");
      renderDashboard(searchInput?.value || "").catch(console.error);
    });
  }

  if (sortChips) {
    sortChips.addEventListener("click", (event) => {
      const sortButton = event.target.closest("[data-sort]");

      if (!sortButton) {
        return;
      }

      currentSort = String(sortButton.dataset.sort || "newest");
      sortChips.querySelectorAll("[data-sort]").forEach((button) => {
        button.classList.toggle("is-active", button === sortButton);
      });
      renderDashboard(searchInput?.value || "").catch(console.error);
    });
  }

  if (exportJsonButton) {
    exportJsonButton.addEventListener("click", async () => {
      const entries = cachedEntries.length ? cachedEntries : await loadQuestionnaires();
      createDownload(
        "maylin-questionnaires.json",
        JSON.stringify(entries, null, 2),
        "application/json",
      );
    });
  }

  if (exportCsvButton) {
    exportCsvButton.addEventListener("click", async () => {
      const entries = cachedEntries.length ? cachedEntries : await loadQuestionnaires();
      createDownload("maylin-questionnaires.csv", toCsv(entries), "text/csv;charset=utf-8");
    });
  }

  window.addEventListener("storage", () => {
    if (!isRemoteDataEnabled && isFallbackAuthenticated()) {
      renderDashboard(searchInput?.value || "").catch(console.error);
    }
  });
}
