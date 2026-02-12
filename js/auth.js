/* ============================================
   VeriSure — Auth Logic
============================================ */

console.log("auth.js loaded");

/* ---------- API helper ---------- */
async function postForm(payload) {
    const body = new URLSearchParams();
    Object.entries(payload || {}).forEach(([k, v]) => {
        body.append(
            k,
            typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "")
        );
    });

    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body
    });

    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return { error: "Invalid server response", raw: text };
    }
}

/* ---------- UI helpers ---------- */
function setSignupLoading(isLoading) {
    const btn = document.getElementById("signupBtn");
    if (!btn) return;
    btn.dataset.label = btn.dataset.label || btn.textContent;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Creating account…" : btn.dataset.label;
}

function setLoginLoading(isLoading) {
    const btn = document.getElementById("loginBtn");
    if (!btn) return;
    btn.dataset.label = btn.dataset.label || btn.textContent;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Logging in…" : btn.dataset.label;
}

/* ---------- Success UX (guaranteed) ---------- */
function redirectToLoginWithPrefill({ email, role, message }) {

    sessionStorage.setItem(
        "vs_login_prefill",
        JSON.stringify({ email: String(email || "").trim().toLowerCase(), role })
    );

    try {
        showBanner("success", message || "Account created. Redirecting to login…");
    } catch (_) { }

    setTimeout(() => {
        window.location.href = "login.html";
    }, 600);
}

/* ---------- Password eye toggle ---------- */
function addPwToggle(inputId) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.toggleAttached === "1") return;
    input.dataset.toggleAttached = "1";

    const wrap = document.createElement("div");
    wrap.style.position = "relative";
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";

    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pw-eye";
    btn.setAttribute("aria-label", "Toggle password visibility");

    const eye = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `;

    const lash = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
      <path d="M4 8l-2-2M8 6L7 3M12 5V2M16 6l1-3M20 8l2-2"/>
    </svg>
  `;

    btn.innerHTML = eye;

    btn.addEventListener("click", () => {
        const hidden = input.type === "password";
        input.type = hidden ? "text" : "password";
        btn.innerHTML = hidden ? lash : eye;
    });

    wrap.appendChild(btn);
}

function attachPasswordToggles() {
    [
        "holderPassword",
        "holderPasswordConfirm",
        "issuerPassword",
        "issuerPasswordConfirm",
        "verifierPassword",
        "verifierPasswordConfirm",
        "loginPassword"
    ].forEach(addPwToggle);
}

function passwordsMatch(role) {
    if (role === "holder")
        return (holderPassword.value || "") === (holderPasswordConfirm.value || "");
    if (role === "issuer")
        return (issuerPassword.value || "") === (issuerPasswordConfirm.value || "");
    if (role === "verifier")
        return (
            (verifierPassword.value || "") === (verifierPasswordConfirm.value || "")
        );
    return false;
}

/* ---------- Signup role handling ---------- */
document.addEventListener("DOMContentLoaded", () => {
    attachPasswordToggles();
    applyLoginPrefill();

    const roleSelect = document.getElementById("role");
    const container = document.getElementById("role-dependent-fields");
    if (!roleSelect || !container) return;

    roleSelect.addEventListener("change", () => {
        const role = roleSelect.value;

        container.classList.add("hidden");
        ["holder", "issuer", "verifier"].forEach(r => {
            const el = document.getElementById(`${r}-fields`);
            if (el) el.classList.add("hidden");
        });

        if (!role) return;

        container.classList.remove("hidden");
        const active = document.getElementById(`${role}-fields`);
        if (active) active.classList.remove("hidden");

        validateSignupForm();
    });

    validateSignupForm();
});

function validateSignupForm() {
    const signupBtn = document.getElementById("signupBtn");
    const role = document.getElementById("role")?.value;

    if (!signupBtn || !role) {
        if (signupBtn) signupBtn.disabled = true;
        return;
    }

    const fields = document.querySelectorAll(
        `#${role}-fields input[required], #${role}-fields select[required]`
    );
    const allFilled = [...fields].every(f => (f.value || "").trim() !== "");

    const legalChecks = document.querySelectorAll(
        ".legal-section input[type='checkbox']"
    );
    const legalOk = [...legalChecks].every(cb => cb.checked);

    const pwOk = passwordsMatch(role);

    signupBtn.disabled = !(allFilled && legalOk && pwOk);
}

document.addEventListener("input", validateSignupForm);
document.addEventListener("change", validateSignupForm);

/* ---------- Signup ---------- */
async function signup() {
    const role = document.getElementById("role")?.value;
    if (!role) return showBanner("error", "Please select an account type.");

    if (!passwordsMatch(role)) {
        showBanner("error", "Passwords do not match");
        return;
    }

    let payload = { action: "signup", role, meta: {} };
    setSignupLoading(true);

    try {
        let emailForLogin = "";

        if (role === "holder") {
            emailForLogin = holderEmail.value.trim().toLowerCase();
            payload.email = emailForLogin;
            payload.password = holderPassword.value;
            payload.meta = {
                fullName: holderName.value.trim(),
                country: holderCountry.value
            };
        }

        if (role === "issuer") {
            emailForLogin = issuerOrgEmail.value.trim().toLowerCase();
            payload.email = emailForLogin;
            payload.password = issuerPassword.value;
            payload.meta = {
                organizationName: issuerOrgName.value.trim(),
                organizationType: issuerOrgType.value,
                contactName: issuerContactName.value.trim(),
                contactEmail: issuerContactEmail.value.trim().toLowerCase(),
                country: issuerCountry.value
            };
        }

        if (role === "verifier") {
            emailForLogin = verifierOrgEmail.value.trim().toLowerCase();
            payload.email = emailForLogin;
            payload.password = verifierPassword.value;
            payload.meta = {
                organizationName: verifierOrgName.value.trim(),
                organizationType: verifierOrgType.value,
                contactName: verifierContactName.value.trim(),
                contactEmail: verifierContactEmail.value.trim().toLowerCase(),
                country: verifierCountry.value
            };
        }

        const res = await postForm(payload);

        // hard-fail if server says error
        if (res?.error) {
            showBanner("error", res.error);
            return;
        }

        
        const ok = res?.success === true || res?.email || res?.role;
        if (!ok) {
            console.warn("Unexpected signup response:", res);
            showBanner("error", "Signup completed but response was unexpected.");
            return;
        }

        const msg =
            role === "issuer"
                ? "Account created. Your issuer access is pending approval. Redirecting to login…"
                : "Account created successfully. Redirecting to login…";

        redirectToLoginWithPrefill({
            email: emailForLogin,
            role,
            message: msg
        });
    } catch (err) {
        console.error(err);
        showBanner("error", "Signup failed. Please try again.");
    } finally {
        setSignupLoading(false);
    }
}

/* ---------- Login ---------- */
async function login() {
    try {
        const emailEl = document.getElementById("loginEmail");
        const roleEl = document.getElementById("loginRole");
        const passwordEl = document.getElementById("loginPassword");

        const emailNorm = String(emailEl?.value || "").trim().toLowerCase();
        const role = String(roleEl?.value || "").trim();
        const password = String(passwordEl?.value || "");

        if (!role) return showBanner("error", "Select account type.");
        if (!emailNorm || !password)
            return showBanner("error", "Enter your email and password.");

        setLoginLoading(true);

        const res = await postForm({
            action: "login",
            email: emailNorm,
            password,
            role
        });

        if (res?.error) return showBanner("error", res.error);

        Session.set(res);

        const routes = {
            holder: "/app/wallet.html",
            issuer: "/app/issuer.html",
            verifier: "/app/verify.html",
            admin: "/app/admin.html"
        };

        location.href = routes[res.role] || "/app/wallet.html";
    } catch (err) {
        console.error(err);
        showBanner("error", "Login failed. Please try again.");
    } finally {
        setLoginLoading(false);
    }
}

/* ---------- Prefill login email + auto role (and sync custom select UI) ---------- */
function setVsSelectValue(selectId, wrapperId, value) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));

    const ui = document.getElementById(wrapperId);
    if (!ui) return;

    const valueEl = ui.querySelector(".vs-select-value");
    const options = Array.from(ui.querySelectorAll(".vs-option"));
    const match = options.find(o => o.dataset.value === value);

    if (match && valueEl) {
        valueEl.textContent = match.textContent.trim();
        options.forEach(o => o.classList.remove("active"));
        match.classList.add("active");
    }
}

function applyLoginPrefill() {
    const roleEl = document.getElementById("loginRole");
    const emailEl = document.getElementById("loginEmail");
    if (!roleEl || !emailEl) return;

    const raw = sessionStorage.getItem("vs_login_prefill");
    if (!raw) return;

    try {
        const data = JSON.parse(raw);
        if (data?.email) {
            emailEl.value = String(data.email);
            emailEl.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (data?.role) {
            setVsSelectValue("loginRole", "loginRoleSelect", String(data.role));
        }
    } catch (_) { }

    sessionStorage.removeItem("vs_login_prefill");
}

/* ---------- Login email hint ---------- */
document.addEventListener("DOMContentLoaded", () => {
    const roleSel = document.getElementById("loginRole");
    const emailEl = document.getElementById("loginEmail");
    if (!roleSel || !emailEl) return;

    function applyLoginEmailHint() {
        const role = String(roleSel.value || "").toLowerCase();
        emailEl.placeholder =
            role === "issuer" || role === "verifier"
                ? "Organization email (e.g. admin@yourorg.com)"
                : "Email address";
    }

    roleSel.addEventListener("change", applyLoginEmailHint);
    applyLoginEmailHint();
});

/* ---------- Country dropdown ---------- */
document.addEventListener("DOMContentLoaded", () => {
    const COUNTRIES = [
        "Argentina",
        "Australia",
        "Brazil",
        "Canada",
        "China",
        "Egypt",
        "France",
        "Germany",
        "Ghana",
        "India",
        "Japan",
        "Kenya",
        "Mexico",
        "Morocco",
        "Netherlands",
        "Nigeria",
        "Rwanda",
        "Saudi Arabia",
        "Singapore",
        "South Africa",
        "Tanzania",
        "Uganda",
        "United Arab Emirates",
        "United Kingdom",
        "United States",
        "Zambia",
        "Zimbabwe"
    ];

    const countrySelects = document.querySelectorAll("select[id$='Country']");
    countrySelects.forEach(select => {
        if (select.dataset.populated === "true") return;

        select.innerHTML = "";

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Select country";
        placeholder.disabled = true;
        placeholder.selected = true;
        select.appendChild(placeholder);

        COUNTRIES.forEach(country => {
            const option = document.createElement("option");
            option.value = country;
            option.textContent = country;
            select.appendChild(option);
        });

        select.dataset.populated = "true";
    });
});
