const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const form = document.getElementById("contact-form");
const formStatus = document.getElementById("form-status");
const revealItems = document.querySelectorAll("[data-reveal]");
const storageApi = window.maylinStorageApi || null;
const createEntryId =
  storageApi?.createEntryId ||
  (() =>
    window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`);

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

if (form && formStatus) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const deliveryArea = String(formData.get("deliveryArea") || "").trim();
    const message = String(formData.get("message") || "").trim();

    try {
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

      if (storageApi?.saveQuestionnaire) {
        storageApi.saveQuestionnaire(entry);
      } else {
        throw new Error("Storage API is unavailable.");
      }

      form.reset();
      formStatus.textContent =
        "Request sent successfully. Our team can review it in the private portal and continue the conversation on WhatsApp.";
    } catch (error) {
      console.error(error);
      formStatus.textContent =
        "We could not save the questionnaire right now. Please try again.";
    }
  });
}
