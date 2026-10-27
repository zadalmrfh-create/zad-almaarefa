(() => {
  "use strict";

  const PLATFORM_URL = "https://zadalmrfh-create.github.io/zad-almaarefa/";
  const SHARE_TITLE = "زاد المعرفة — منصة تعليمية إسلامية";
  const SHARE_TEXT = "🎁 المنصة وخدماتها مجانية بالكامل بدون أي اشتراك، والدفع فقط مقابل الحصة التعليمية التي تحجزها.";

  function showToast(message) {
    let toast = document.getElementById("zadShareToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "zadShareToast";
      Object.assign(toast.style, {
        position: "fixed",
        left: "50%",
        bottom: "90px",
        transform: "translateX(-50%)",
        background: "#111827",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: "12px",
        fontFamily: "Cairo, Tajawal, sans-serif",
        fontSize: "14px",
        zIndex: "10000000",
        boxShadow: "0 8px 24px rgba(0,0,0,.28)",
        opacity: "0",
        transition: "opacity .2s ease"
      });
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = "1";
    clearTimeout(window.__zadShareToastTimer);
    window.__zadShareToastTimer = setTimeout(() => {
      toast.style.opacity = "0";
    }, 2200);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(PLATFORM_URL);
      showToast("✅ تم نسخ رابط المنصة");
      return true;
    } catch (_) {
      try {
        const ta = document.createElement("textarea");
        ta.value = PLATFORM_URL;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        if (ok) {
          showToast("✅ تم نسخ رابط المنصة");
          return true;
        }
      } catch (_) {}
    }
    return false;
  }

  async function sharePlatform() {
    const data = {
      title: SHARE_TITLE,
      text: SHARE_TEXT,
      url: PLATFORM_URL
    };

    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }

    // Desktop fallback: open WhatsApp share with the same official link.
    const message = `${SHARE_TITLE}\n${SHARE_TEXT}\n${PLATFORM_URL}`;
    const wa = `https://wa.me/?text=${encodeURIComponent(message)}`;
    const win = window.open(wa, "_blank", "noopener,noreferrer");

    if (!win) {
      const copied = await copyLink();
      if (!copied) {
        window.prompt("انسخ رابط المنصة:", PLATFORM_URL);
      }
    }
  }

  function initShareButton() {
    const btn = document.getElementById("shareBtn");
    if (!btn) return;

    // Prevent accidental form behavior and make sure the click reaches this handler.
    btn.type = "button";
    btn.style.pointerEvents = "auto";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      sharePlatform();
    }, { passive: false });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShareButton, { once: true });
  } else {
    initShareButton();
  }
})();
