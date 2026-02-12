function setActiveSidebar(href) {
    document.querySelectorAll(".side-links a").forEach(a => {
        a.classList.toggle("active", a.getAttribute("href") === href);
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function openConfirmModal({ title, message, messageHtml = "", confirmText = "Confirm", onConfirm }) {
    const wrap = document.getElementById("vs-modal");
    const t = document.getElementById("vs-modal-title");
    const m = document.getElementById("vs-modal-msg");
    const ok = document.getElementById("vs-modal-ok");
    const cancel = document.getElementById("vs-modal-cancel");

    if (!wrap || !t || !m || !ok || !cancel) return;

    t.textContent = title || "";
    if (messageHtml) {
        m.innerHTML = messageHtml;
    } else {
        m.textContent = message || "";
    }
    ok.textContent = confirmText || "Confirm";

    ok.style.display = "";
    cancel.textContent = "Cancel";
    ok.disabled = false;

    ok.onclick = async () => {
        ok.disabled = true;
        try {
            if (typeof onConfirm === "function") await onConfirm();
            closeModal();
        } catch (err) {
            ok.disabled = false;
            m.textContent = err?.message || "Action failed. Please try again.";
        }
    };

    cancel.onclick = closeModal;

    wrap.classList.remove("hidden");
    wrap.setAttribute("aria-hidden", "false");
}

function openInfoModal({ title = "Info", html = "", message = "", okText = "OK" }) {
    const wrap = document.getElementById("vs-modal");
    const t = document.getElementById("vs-modal-title");
    const m = document.getElementById("vs-modal-msg");
    const ok = document.getElementById("vs-modal-ok");
    const cancel = document.getElementById("vs-modal-cancel");

    if (!wrap || !t || !m || !ok || !cancel) return;

    t.textContent = title;
    m.innerHTML = html || `<pre style="white-space:pre-wrap;margin:0;">${escapeHtml(message)}</pre>`;
    ok.textContent = okText;

    ok.style.display = "inline-flex";
    cancel.textContent = "Close";

    ok.onclick = closeModal;
    cancel.onclick = closeModal;

    wrap.classList.remove("hidden");
    wrap.setAttribute("aria-hidden", "false");
}


function closeModal() {
    const wrap = document.getElementById("vs-modal");
    const ok = document.getElementById("vs-modal-ok");
    const cancel = document.getElementById("vs-modal-cancel");

    if (ok) ok.onclick = null;
    if (cancel) cancel.onclick = null;

    wrap?.classList.add("hidden");
    wrap?.setAttribute("aria-hidden", "true");
}
