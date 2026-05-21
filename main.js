const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const heroVideo = document.querySelector(".hero-video");
const heroVideoFrame = document.querySelector(".hero-video-frame");
const heroVideoEndScreen = document.querySelector(".hero-video-end-screen");
const heroVideoEndLogo = document.querySelector(".hero-video-end-logo");
const form = document.getElementById("contact-form");
const formStatus = document.getElementById("form-status");
const revealItems = document.querySelectorAll("[data-reveal]");
const productAlbumTriggers = document.querySelectorAll("[data-product-album-trigger]");
const storageApi = window.maylinStorageApi || null;
const dataApi = window.maylinDataApi || null;
const dataLayer = window.dataLayer || (window.dataLayer = []);
const createEntryId =
  storageApi?.createEntryId ||
  (() =>
    window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const navigationEntry =
  typeof window.performance?.getEntriesByType === "function"
    ? window.performance.getEntriesByType("navigation")[0]
    : null;
const isReloadNavigation =
  navigationEntry?.type === "reload" ||
  window.performance?.navigation?.type === window.performance?.navigation?.TYPE_RELOAD;

const resetScrollToTop = () => {
  window.requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    window.requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  });
};

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

if (isReloadNavigation) {
  window.addEventListener("pageshow", resetScrollToTop);
  window.addEventListener("load", resetScrollToTop);
}

const trackEvent = (eventName, details = {}) => {
  dataLayer.push({
    event: eventName,
    ...details,
  });
};

const getLinkLabel = (link) => {
  const label = link.getAttribute("aria-label") || link.textContent || "";
  return label.trim().replace(/\s+/g, " ");
};

if (navToggle && siteNav) {
  const closeNav = () => {
    navToggle.setAttribute("aria-expanded", "false");
    siteNav.classList.remove("is-open");
  };

  navToggle.addEventListener("click", () => {
    const isExpanded = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isExpanded));
    siteNav.classList.toggle("is-open", !isExpanded);
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeNav);
  });

  document.addEventListener("click", (event) => {
    if (!siteNav.classList.contains("is-open")) {
      return;
    }

    if (siteNav.contains(event.target) || navToggle.contains(event.target)) {
      return;
    }

    closeNav();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNav();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 820) {
      closeNav();
    }
  });
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.2,
      rootMargin: "0px 0px -40px 0px",
    },
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

if (heroVideo && heroVideoFrame && heroVideoEndScreen && heroVideoEndLogo) {
  const hideHeroEndScreen = () => {
    heroVideoFrame.classList.remove("has-ended");
    heroVideoEndScreen.classList.remove("is-visible");
  };

  const showHeroEndScreen = () => {
    heroVideoFrame.classList.add("has-ended");
    heroVideoEndScreen.classList.add("is-visible");
    trackEvent("hero_video_completed", {
      component: "hero_video",
    });
  };

  heroVideo.addEventListener("loadedmetadata", hideHeroEndScreen);
  heroVideo.addEventListener("play", hideHeroEndScreen);
  heroVideo.addEventListener("seeking", hideHeroEndScreen);
  heroVideo.addEventListener("ended", showHeroEndScreen);
}

document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
  link.addEventListener("click", () => {
    trackEvent("contact_click", {
      contact_method: "phone",
      link_text: getLinkLabel(link),
      destination: link.getAttribute("href") || "",
    });
  });
});

document.querySelectorAll('a[href^="sms:"]').forEach((link) => {
  link.addEventListener("click", () => {
    trackEvent("contact_click", {
      contact_method: "sms",
      link_text: getLinkLabel(link),
      destination: link.getAttribute("href") || "",
    });
  });
});

document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"]').forEach((link) => {
  link.addEventListener("click", () => {
    trackEvent("contact_click", {
      contact_method: "whatsapp",
      link_text: getLinkLabel(link),
      destination: link.getAttribute("href") || "",
    });
  });
});

if (productAlbumTriggers.length > 0) {
  const lightbox = document.createElement("div");
  lightbox.className = "product-lightbox";
  lightbox.hidden = true;
  lightbox.innerHTML = `
    <div class="product-lightbox-backdrop" data-lightbox-close></div>
    <div class="product-lightbox-dialog" role="dialog" aria-modal="true" aria-label="Product image gallery">
      <button class="product-lightbox-close" type="button" data-lightbox-close aria-label="Close gallery">
        Close
      </button>
      <div class="product-lightbox-stage">
        <button class="product-lightbox-nav" type="button" data-lightbox-prev aria-label="Show previous image">
          Prev
        </button>
        <figure class="product-lightbox-figure">
          <img class="product-lightbox-image" alt="" />
        </figure>
        <button class="product-lightbox-nav" type="button" data-lightbox-next aria-label="Show next image">
          Next
        </button>
      </div>
      <div class="product-lightbox-thumbnails" aria-label="Gallery thumbnails"></div>
    </div>
  `;
  document.body.append(lightbox);

  const lightboxImage = lightbox.querySelector(".product-lightbox-image");
  const lightboxThumbnails = lightbox.querySelector(".product-lightbox-thumbnails");
  const lightboxPrevButton = lightbox.querySelector("[data-lightbox-prev]");
  const lightboxNextButton = lightbox.querySelector("[data-lightbox-next]");

  const lightboxState = {
    items: [],
    index: 0,
  };

  const setLightboxItem = (index) => {
    if (lightboxState.items.length === 0) {
      return;
    }

    lightboxState.index = (index + lightboxState.items.length) % lightboxState.items.length;
    const activeItem = lightboxState.items[lightboxState.index];

    if (lightboxImage) {
      lightboxImage.src = activeItem.src;
      lightboxImage.alt = activeItem.alt;
    }

    lightboxState.items.forEach((item, itemIndex) => {
      const isActive = itemIndex === lightboxState.index;
      item.figure.classList.toggle("is-active", isActive);
      item.figure.setAttribute("aria-pressed", String(isActive));
      item.thumbnailButton?.classList.toggle("is-active", isActive);
      item.thumbnailButton?.setAttribute("aria-pressed", String(isActive));
    });
  };

  const closeLightbox = () => {
    if (lightboxImage) {
      lightboxImage.removeAttribute("src");
      lightboxImage.alt = "";
    }
    lightbox.hidden = true;
    document.body.classList.remove("lightbox-open");
  };

  const openLightbox = (items, title, index) => {
    lightboxState.items = items;

    if (lightboxThumbnails) {
      lightboxThumbnails.innerHTML = "";

      items.forEach((item, itemIndex) => {
        const thumbnailButton = document.createElement("button");
        thumbnailButton.className = "product-lightbox-thumbnail";
        thumbnailButton.type = "button";
        thumbnailButton.setAttribute(
          "aria-label",
          `Show image ${itemIndex + 1} for ${title}`,
        );
        thumbnailButton.innerHTML = `<img src="${item.src}" alt="${item.alt}" />`;
        thumbnailButton.addEventListener("click", () => setLightboxItem(itemIndex));
        lightboxThumbnails.append(thumbnailButton);
        item.thumbnailButton = thumbnailButton;
      });
    }

    setLightboxItem(index);
    lightbox.hidden = false;
    document.body.classList.add("lightbox-open");
  };

  lightbox.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.hasAttribute("data-lightbox-close")) {
      closeLightbox();
    }
  });

  lightboxPrevButton?.addEventListener("click", () => setLightboxItem(lightboxState.index - 1));
  lightboxNextButton?.addEventListener("click", () => setLightboxItem(lightboxState.index + 1));

  document.addEventListener("keydown", (event) => {
    if (lightbox.hidden) {
      return;
    }

    if (event.key === "Escape") {
      closeLightbox();
      return;
    }

    if (event.key === "ArrowLeft") {
      setLightboxItem(lightboxState.index - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      setLightboxItem(lightboxState.index + 1);
    }
  });

  const initializeAlbumGallery = (album) => {
    if (!album || album.dataset.galleryReady === "true") {
      return;
    }

    const grid = album.querySelector(".product-album-grid");
    const figures = Array.from(album.querySelectorAll(".album-figure"));
    const productTitle =
      album.closest(".product-card")?.querySelector("h3")?.textContent?.trim() || "Product";

    if (!grid || figures.length === 0) {
      return;
    }

    const items = figures.map((figure, index) => {
      const image = figure.querySelector("img");
      const caption = figure.querySelector("figcaption");

      figure.tabIndex = 0;
      figure.setAttribute("role", "button");
      figure.setAttribute(
        "aria-label",
        `Open image ${index + 1} for ${productTitle} in full screen`,
      );
      figure.setAttribute("aria-pressed", "false");

      return {
        figure,
        src: image?.getAttribute("src") || "",
        alt: image?.getAttribute("alt") || productTitle,
        caption: caption?.textContent?.trim() || "",
      };
    });

    items.forEach((item, index) => {
      item.figure.addEventListener("click", () => {
        album.dataset.currentIndex = String(index);
        openLightbox(items, productTitle, index);
      });
      item.figure.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          album.dataset.currentIndex = String(index);
          openLightbox(items, productTitle, index);
        }
      });
    });
    album.dataset.galleryReady = "true";
  };

  const closeAlbum = (trigger) => {
    const albumId = trigger.getAttribute("aria-controls");
    const album = albumId ? document.getElementById(albumId) : null;
    const card = trigger.closest(".product-card");

    trigger.setAttribute("aria-expanded", "false");
    if (album) {
      album.hidden = true;
    }
    if (card) {
      card.classList.remove("is-open");
    }
  };

  const openAlbum = (trigger) => {
    const albumId = trigger.getAttribute("aria-controls");
    const album = albumId ? document.getElementById(albumId) : null;
    const card = trigger.closest(".product-card");

    productAlbumTriggers.forEach((item) => {
      if (item !== trigger) {
        closeAlbum(item);
      }
    });

    trigger.setAttribute("aria-expanded", "true");
    if (album) {
      initializeAlbumGallery(album);
      album.hidden = false;
    }
    if (card) {
      card.classList.add("is-open");
    }

    trackEvent("product_gallery_open", {
      product_name: card?.querySelector("h3")?.textContent?.trim() || "Product",
    });
  };

  productAlbumTriggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const isExpanded = trigger.getAttribute("aria-expanded") === "true";

      if (isExpanded) {
        closeAlbum(trigger);
        return;
      }

      openAlbum(trigger);
    });
  });
}

if (form && formStatus) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const deliveryArea = String(formData.get("deliveryArea") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const submitButton = form.querySelector('button[type="submit"]');

    try {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
      }

      formStatus.textContent = "Saving your request...";

      const entry = {
        id: createEntryId(),
        createdAt: new Date().toISOString(),
        name,
        email,
        phone,
        deliveryArea,
        message,
        source: "website-questionnaire",
      };

      if (dataApi?.saveQuestionnaire) {
        await dataApi.saveQuestionnaire(entry);
      } else if (storageApi?.saveQuestionnaire) {
        storageApi.saveQuestionnaire(entry);
      } else {
        throw new Error("Storage API is unavailable.");
      }

      form.reset();
      formStatus.textContent =
        "Request sent successfully. Our team can review it in the private portal and follow up by call, text, or WhatsApp.";
    } catch (error) {
      console.error(error);
      formStatus.textContent =
        "We could not save the questionnaire right now. Please try again.";
    } finally {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
        submitButton.textContent = "Send request";
      }
    }
  });
}

// --- Bottom Contact Form & Admin Modal Controls ---

const customContactForm = document.getElementById("custom-contact-form");
const contactFormStatus = document.getElementById("contact-form-status");

const footerAdminTrigger = document.getElementById("footer-admin-trigger");
const adminModalOverlay = document.getElementById("admin-modal-overlay");
const adminModalClose = document.getElementById("admin-modal-close");

const adminLoginView = document.getElementById("admin-login-view");
const adminLoginForm = document.getElementById("admin-login-form");
const adminLoginError = document.getElementById("admin-login-error");

const adminDashboardView = document.getElementById("admin-dashboard-view");
const adminLogoutBtn = document.getElementById("admin-logout-btn");
const adminStatTotal = document.getElementById("admin-stat-total");
const adminStatVisible = document.getElementById("admin-stat-visible");
const adminSearchInput = document.getElementById("admin-search-input");
const adminRefreshBtn = document.getElementById("admin-refresh-btn");
const adminRefreshStatus = document.getElementById("admin-refresh-status");
const adminSubmissionsList = document.getElementById("admin-submissions-list");

let cachedSubmissions = [];

// Helper function to escape HTML characters (XSS Prevention)
const escapeHtml = (text) => {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return String(text ?? "").replace(/[&<>"']/g, (m) => map[m]);
};

// Helper function to format ISO dates to a clean locale format
const formatDate = (isoString) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (e) {
    return isoString;
  }
};

// Unified API Handler supporting both Node/Express and PHP Fallback
const apiCall = async (endpoint, data) => {
  try {
    const response = await fetch(`/api${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });
    
    if (response.status === 404) {
      throw new Error("404");
    }

    const result = await response.json();
    if (!response.ok) {
      const requestError = new Error(result.error || "Error en la solicitud");
      requestError.status = response.status;
      throw requestError;
    }
    return result;
  } catch (error) {
    if (error.message === "404" || error.name === "TypeError") {
      // Fallback to PHP endpoint contact.php
      let phpAction = "";
      if (endpoint === "/contact") phpAction = "submit";
      else if (endpoint === "/admin/login") phpAction = "login";
      else if (endpoint === "/admin/submissions") phpAction = "submissions";
      else if (endpoint === "/admin/delete") phpAction = "delete";

      const phpData = { ...data, action: phpAction };
      
      const response = await fetch("/contact.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(phpData)
      });

      const result = await response.json();
      if (!response.ok) {
        const requestError = new Error(result.error || "Error en la solicitud PHP");
        requestError.status = response.status;
        throw requestError;
      }
      return result;
    } else {
      throw error;
    }
  }
};

// Bottom Contact Form submission handler
if (customContactForm && contactFormStatus) {
  customContactForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const submitBtn = customContactForm.querySelector(".form-submit-btn");
    const formData = new FormData(customContactForm);
    const nombre = String(formData.get("nombre") || "").trim();
    const correo = String(formData.get("correo") || "").trim();
    const celular = String(formData.get("celular") || "").trim();
    const mensaje = String(formData.get("mensaje") || "").trim();

    if (!nombre || !correo || !celular || !mensaje) {
      contactFormStatus.className = "form-status error";
      contactFormStatus.textContent = "Please complete all fields.";
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }
      contactFormStatus.className = "form-status info";
      contactFormStatus.textContent = "Sending your message...";

      await apiCall("/contact", { nombre, correo, celular, mensaje });

      contactFormStatus.className = "form-status success";
      contactFormStatus.textContent = "Message sent successfully. We will contact you soon.";
      customContactForm.reset();
    } catch (error) {
      console.error("Error submitting contact form:", error);
      contactFormStatus.className = "form-status error";
      contactFormStatus.textContent = "There was an error sending your message. Please try again.";
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Message";
      }
    }
  });
}

// Handle Admin Trigger click (Hijack standard lock link)
if (footerAdminTrigger && adminModalOverlay) {
  footerAdminTrigger.addEventListener("click", (e) => {
    e.preventDefault();
    adminModalOverlay.removeAttribute("hidden");
    adminModalOverlay.style.display = "flex";
    
    // Check if there is a saved token session
    const token = sessionStorage.getItem("maylin_admin_session_token");
    if (token) {
      showDashboardView();
    } else {
      showLoginView();
    }
  });
}

// Close Modal functions
const closeAdminModal = () => {
  if (adminModalOverlay) {
    adminModalOverlay.setAttribute("hidden", "");
    adminModalOverlay.style.display = "none";
  }
};

if (adminModalClose) {
  adminModalClose.addEventListener("click", closeAdminModal);
}

if (adminModalOverlay) {
  adminModalOverlay.addEventListener("click", (e) => {
    if (e.target === adminModalOverlay) {
      closeAdminModal();
    }
  });
}

// Views Switcher
const showLoginView = () => {
  if (adminLoginView) adminLoginView.removeAttribute("hidden");
  if (adminDashboardView) adminDashboardView.setAttribute("hidden", "");
  if (adminLoginError) adminLoginError.textContent = "";
  if (adminLoginForm) adminLoginForm.reset();
};

const showDashboardView = () => {
  if (adminLoginView) adminLoginView.setAttribute("hidden", "");
  if (adminDashboardView) adminDashboardView.removeAttribute("hidden");
  if (adminSearchInput) adminSearchInput.value = "";
  loadSubmissions();
};

// Login Form Submit handler
if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = adminLoginForm.querySelector(".admin-submit-btn");
    const username = adminLoginForm.username.value.trim();
    const password = adminLoginForm.password.value;

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Signing in...";
      }
      if (adminLoginError) adminLoginError.textContent = "";

      const result = await apiCall("/admin/login", { username, password });
      
      if (result.success && result.token) {
        sessionStorage.setItem("maylin_admin_session_token", result.token);
        showDashboardView();
      } else {
        throw new Error("Credenciales inválidas");
      }
    } catch (error) {
      console.error("Login error:", error);
      if (adminLoginError) {
        adminLoginError.textContent = "Incorrect username or password.";
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign In";
      }
    }
  });
}

// Logout handler
if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("maylin_admin_session_token");
    cachedSubmissions = [];
    renderSubmissions(cachedSubmissions);
    showLoginView();
  });
}

// Fetch submissions from backend
const loadSubmissions = async () => {
  const token = sessionStorage.getItem("maylin_admin_session_token");
  if (!token) return;

  try {
    if (adminRefreshBtn) {
      adminRefreshBtn.disabled = true;
      adminRefreshBtn.textContent = "Refreshing...";
    }
    if (adminRefreshStatus) {
      adminRefreshStatus.textContent = "Loading private messages...";
    }
    if (adminSubmissionsList) {
      adminSubmissionsList.innerHTML = '<div class="admin-loading">Loading messages...</div>';
    }

    const result = await apiCall("/admin/submissions", { token });
    if (result.success && Array.isArray(result.submissions)) {
      cachedSubmissions = result.submissions;
      renderSubmissions(cachedSubmissions);
      if (adminRefreshStatus) {
        adminRefreshStatus.textContent = `Updated: ${formatDate(new Date().toISOString())}`;
      }
    } else {
      throw new Error("Error loading submissions");
    }
  } catch (error) {
    console.error("Error loading submissions:", error);
    if (error.status === 401) {
      sessionStorage.removeItem("maylin_admin_session_token");
    }
    if (adminSubmissionsList) {
      adminSubmissionsList.innerHTML = '<div class="admin-error">Messages could not be loaded. Please sign in again.</div>';
    }
    if (adminRefreshStatus) {
      adminRefreshStatus.textContent = "Messages could not be loaded.";
    }
  } finally {
    if (adminRefreshBtn) {
      adminRefreshBtn.disabled = false;
      adminRefreshBtn.textContent = "Refresh";
    }
  }
};

// Render submissions list UI dynamically
const renderSubmissions = (submissions) => {
  if (!adminSubmissionsList) return;

  if (adminStatTotal) {
    adminStatTotal.textContent = cachedSubmissions.length;
  }

  if (adminStatVisible) {
    adminStatVisible.textContent = submissions.length;
  }

  if (submissions.length === 0) {
    adminSubmissionsList.innerHTML = '<div class="admin-empty">There are no contact messages yet.</div>';
    return;
  }

  adminSubmissionsList.innerHTML = submissions.map(sub => `
    <div class="submission-card" data-id="${escapeHtml(sub.id)}">
      <div class="submission-header">
        <div>
          <h4 class="submission-name">${escapeHtml(sub.nombre)}</h4>
          <div class="submission-meta">
            <span class="submission-date">${escapeHtml(formatDate(sub.createdAt))}</span>
          </div>
        </div>
      </div>
      <div class="submission-details">
        <div class="submission-detail-item">
          <span>Phone:</span>
          <strong><a href="tel:${escapeHtml(sub.celular)}">${escapeHtml(sub.celular)}</a></strong>
        </div>
        <div class="submission-detail-item">
          <span>Email:</span>
          <strong><a href="mailto:${escapeHtml(sub.correo)}">${escapeHtml(sub.correo)}</a></strong>
        </div>
      </div>
      <div class="submission-message">
        <p>${escapeHtml(sub.mensaje).replace(/\n/g, "<br>")}</p>
      </div>
    </div>
  `).join("");

};

if (adminRefreshBtn) {
  adminRefreshBtn.addEventListener("click", loadSubmissions);
}

// Live Search Filtering
if (adminSearchInput) {
  adminSearchInput.addEventListener("input", (e) => {
    const query = String(e.target.value).toLowerCase().trim();
    if (!query) {
      renderSubmissions(cachedSubmissions);
      return;
    }

    const filtered = cachedSubmissions.filter(sub => 
      String(sub.nombre).toLowerCase().includes(query) ||
      String(sub.correo).toLowerCase().includes(query) ||
      String(sub.celular).toLowerCase().includes(query) ||
      String(sub.mensaje).toLowerCase().includes(query)
    );
    renderSubmissions(filtered);
  });
}
