function setActiveSidebar(href) {
    document.querySelectorAll(".side-links a").forEach(a => {
        a.classList.toggle("active", a.getAttribute("href") === href);
    });
}

function openConfirmModal({ title, message, confirmText = "Confirm", onConfirm }) {
    const wrap = document.getElementById("vs-modal");
    const t = document.getElementById("vs-modal-title");
    const m = document.getElementById("vs-modal-msg");
    const ok = document.getElementById("vs-modal-ok");
    const cancel = document.getElementById("vs-modal-cancel");

    if (!wrap || !t || !m || !ok || !cancel) return;

    t.textContent = title || "";
    m.textContent = message || "";
    ok.textContent = confirmText || "Confirm";

    ok.style.display = "";
    cancel.textContent = "Cancel";
    ok.disabled = false;

    ok.onclick = () => {
        ok.disabled = true;
        closeModal();
        if (typeof onConfirm === "function") onConfirm();
    };

    cancel.onclick = closeModal;

    wrap.classList.remove("hidden");
    wrap.setAttribute("aria-hidden", "false");
}

function openInfoModal({ title = "Info", html = "", okText = "OK" }) {
    const wrap = document.getElementById("vs-modal");
    const t = document.getElementById("vs-modal-title");
    const m = document.getElementById("vs-modal-msg");
    const ok = document.getElementById("vs-modal-ok");
    const cancel = document.getElementById("vs-modal-cancel");

    t.textContent = title;
    m.innerHTML = html;
    ok.textContent = okText;

    ok.style.display = "inline-flex";
    cancel.textContent = "Close";

    ok.onclick = closeModal;
    cancel.onclick = closeModal;

    wrap.classList.remove("hidden");
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
