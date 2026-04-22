const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const form = document.getElementById("contact-form");
const formStatus = document.getElementById("form-status");
const revealItems = document.querySelectorAll("[data-reveal]");
const productAlbumTriggers = document.querySelectorAll("[data-product-album-trigger]");
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
        "Request sent successfully. Our team can review it in the private portal and follow up by call, text, or WhatsApp.";
    } catch (error) {
      console.error(error);
      formStatus.textContent =
        "We could not save the questionnaire right now. Please try again.";
    }
  });
}
