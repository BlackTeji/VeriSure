/* =================================================
   VeriSure — Global App Controller
================================================= */

const API_URL =
    "https://script.google.com/macros/s/AKfycbwe0MmVaLwBL4zLCz98FjVYk0Yb9CoGNhycVnhS9dCx1KzbJgPeewT2I1ecxWSAqy9lZQ/exec";

/* ======================
   SESSION
====================== */
const Session = {
    get() {
        try {
            return JSON.parse(localStorage.getItem("verisure_session"));
        } catch {
            return null;
        }
    },
    set(data) {
        localStorage.setItem("verisure_session", JSON.stringify(data));
    },
    clear() {
        localStorage.removeItem("verisure_session");
        window.location.href = "/login.html";
    }
};

/* ======================
   AUTH GUARD
====================== */
function protect() {

    if (window.location.pathname.startsWith("/app/")) {
        const s = Session.get();
        if (!s) window.location.href = "/login.html";
    }
}

/* ======================
   NAVIGATION
====================== */
function renderNav() {
    const session = Session.get();
    const nav = document.querySelector(".nav-links");
    const logoutBtn = document.querySelector(".btn-ghost");

    if (!session || !nav) return;

    const linksByRole = {
        holder: [{ label: "Wallet", href: "/app/wallet.html" }],
        issuer: [{ label: "Issuer", href: "/app/issuer.html" }],
        verifier: [{ label: "Verify", href: "/app/verify.html" }],
        admin: [{ label: "Admin", href: "/app/admin.html" }]
    };

    nav.innerHTML = "";

    (linksByRole[session.role] || []).forEach(link => {
        const a = document.createElement("a");
        a.href = link.href;
        a.textContent = link.label;
        nav.appendChild(a);
    });

    if (logoutBtn) logoutBtn.onclick = Session.clear;
}

/* ======================
   BANNERS (GLOBAL HELPERS)
====================== */
function showBanner(type, message) {
    const banner = document.getElementById("banner");
    if (!banner) return;

    banner.className = `banner banner-${type}`;
    banner.textContent = message;

    setTimeout(() => {
        banner.textContent = "";
        banner.className = "";
    }, 4000);
}

/* ======================
   SAFE POST (ALWAYS JSON)
====================== */
async function postForm(url, payload) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams(payload).toString()
    });

    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return { error: "Invalid server response", raw: text };
    }
}

/* ======================
   ISSUER APPROVAL LOCK
====================== */
function ensureApprovalModal() {
    if (document.getElementById("vs-approval-modal")) return;

    const wrap = document.createElement("div");
    wrap.id = "vs-approval-modal";
    wrap.className = "modal hidden";
    wrap.innerHTML = `
    <div class="modal-box">
      <h3 style="margin:0 0 10px;">Issuer approval pending</h3>
      <p style="margin:0; opacity:.8;">
        Your issuer account has been created successfully, but you can’t issue credentials yet.
        Please complete onboarding and wait for an admin to approve your issuer authority.
      </p>

      <div style="margin-top:14px; font-size:13px; opacity:.7;" id="vs-approval-status">
        Checking approval status…
      </div>

      <div class="modal-actions" style="margin-top:14px;">
        <button type="button" class="btn" id="vs-approval-logout">Logout</button>
      </div>
    </div>
  `;

    document.body.appendChild(wrap);

    const logout = wrap.querySelector("#vs-approval-logout");
    if (logout) logout.onclick = () => Session.clear();
}

function lockIssuerUntilApproved() {
    const s = Session.get();
    if (!s || s.role !== "issuer") return;


    if (!window.location.pathname.startsWith("/app/")) return;

    const status = String(s.issuerStatus || "").toLowerCase();


    if (status === "approved") return;


    if (!s.entityId) {
        showBanner("error", "Issuer session is missing entityId. Please login again.");
        Session.clear();
        return;
    }

    ensureApprovalModal();
    const modal = document.getElementById("vs-approval-modal");
    const statusEl = document.getElementById("vs-approval-status");

    modal.classList.remove("hidden");


    document.querySelectorAll("main button, main a.btn.primary, main .btn.primary").forEach(el => {
        el.dataset.wasDisabled = el.disabled ? "1" : "0";
        el.disabled = true;
        el.style.pointerEvents = "none";
        el.style.opacity = ".55";
    });

    const poll = async () => {
        try {
            const res = await postForm(API_URL, {
                action: "issuer_status",
                entity_id: s.entityId
            });

            if (res?.error) {

                statusEl.textContent = `Error: ${String(res.error)}`;
                showBanner("error", String(res.error));
            } else if (res?.issuerStatus) {
                const next = String(res.issuerStatus).toLowerCase();
                statusEl.textContent = `Current status: ${next}`;

                if (next === "approved") {

                    Session.set({
                        ...s,
                        issuerStatus: next,
                        issuerName: res.issuerName || s.issuerName
                    });

                    modal.classList.add("hidden");

                    document
                        .querySelectorAll("main button, main a.btn.primary, main .btn.primary")
                        .forEach(el => {
                            el.disabled = el.dataset.wasDisabled === "1";
                            el.style.pointerEvents = "";
                            el.style.opacity = "";
                            delete el.dataset.wasDisabled;
                        });


                    location.reload();
                    return;
                }
            } else {
                statusEl.textContent = "Still pending…";
            }
        } catch (e) {
            statusEl.textContent = "Still pending…";
        }

        setTimeout(poll, 4000);
    };

    poll();
}

/* ======================
   INIT
====================== */
document.addEventListener("DOMContentLoaded", () => {
    protect();
    renderNav();


    lockIssuerUntilApproved();
});
