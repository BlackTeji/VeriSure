let parsedRows = [];

const REQUIRED = ["full_name", "email", "credential_type", "credential_title"];

function downloadTemplate() {
    const header = REQUIRED.concat(["internal_id", "expiry_date", "description"]).join(",");
    const example =
        "Ada Lovelace,ada@example.com,Degree,B.Sc. Economics,MAT/2020/1234,2028-12-31,Graduated with honors";
    const blob = new Blob([header + "\n" + example + "\n"], { type: "text/csv;charset=utf-8" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "verisure_issuance_template.csv";
    a.click();
}

function parseCSV(text) {
    const rows = [];
    let i = 0, field = "", row = [], inQuotes = false;

    while (i < text.length) {
        const c = text[i];

        if (c === '"' && text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
        }

        if (c === '"') {
            inQuotes = !inQuotes;
            i++;
            continue;
        }

        if (!inQuotes && (c === "," || c === "\n" || c === "\r")) {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(field.trim());
            field = "";

            if (c !== ",") {
                if (row.some(v => v !== "")) rows.push(row);
                row = [];
            }

            i++;
            continue;
        }

        field += c;
        i++;
    }

    row.push(field.trim());
    if (row.some(v => v !== "")) rows.push(row);

    return rows;
}

function normalizeHeader(h) {
    return String(h || "").toLowerCase().trim().replace(/\s+/g, "_");
}

function escapeHTML(v) {
    return String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function showErrors(msgs) {
    const box = document.getElementById("csvErrors");
    if (!box) return;
    box.style.display = "block";
    box.innerHTML = msgs.map(m => `• ${m}`).join("<br>");
}

function clearErrors() {
    const box = document.getElementById("csvErrors");
    if (!box) return;
    box.style.display = "none";
    box.innerHTML = "";
}

function renderPreview(headers, rows) {
    const wrap = document.getElementById("previewWrap");
    const table = document.getElementById("previewTable");
    if (!wrap || !table) return;

    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");

    if (thead) thead.innerHTML = `<tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join("")}</tr>`;
    if (tbody) {
        tbody.innerHTML = rows
            .slice(0, 50)
            .map(r => `<tr>${headers.map(h => `<td>${escapeHTML(r[h] ?? "")}</td>`).join("")}</tr>`)
            .join("");
    }

    wrap.style.display = "block";
}

function confirmIssue(onConfirm) {
    openConfirmModal({
        title: "Confirm issuance",
        message: "Once issued, credentials cannot be edited. You may only freeze or revoke them. Proceed?",
        confirmText: "Issue now",
        onConfirm
    });
}

async function postJSON(payload) {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
    });

    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { error: "Invalid server response", raw: text }; }
}

function getSessionIssuer() {
    const s = Session.get();
    if (!s || s.role !== "issuer") throw new Error("Unauthorized. Please log in as an issuer.");
    if (!s.entityId) throw new Error("Issuer entityId missing. Please log in again.");
    if (!s.email) throw new Error("Issuer email missing. Please log in again.");
    return s;
}

function info(title, message) {
    if (typeof openInfoModal === "function") {
        openInfoModal({ title, message, okText: "Close" });
        return;
    }
    openConfirmModal({ title, message, confirmText: "Close", onConfirm: null });
}

function resetSingleForm() {
    ["s_fullName", "s_email", "s_type", "s_title", "s_internalId", "s_expiry", "s_desc"]
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });
}

async function issueBatch() {
    let issuer;
    try { issuer = getSessionIssuer(); }
    catch (e) { info("Not allowed", e.message); return; }

    if (!parsedRows.length) {
        info("No rows", "Upload a CSV and preview it before issuing.");
        return;
    }

    confirmIssue(async () => {
        const btn = document.getElementById("btnIssueBatch");
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Issuing...";
        }

        try {
            const data = await postJSON({
                action: "issuer_issue_batch",
                issuer_email: issuer.email,
                rows: parsedRows
            });

            if (!data || data.ok !== true) {
                throw new Error(data?.error || "Batch issuance failed.");
            }

            const errors = (data.results || []).filter(r => r.ok === false);
            let msg = `Issued: ${data.issued}\nFailed: ${data.failed}`;

            if (errors.length) {
                msg += "\n\n" + errors
                    .slice(0, 5)
                    .map(e => `Row ${e.index + 1}: ${e.error}`)
                    .join("\n");
            }

            info("Batch issued", msg);
        } catch (e) {
            info("Batch failed", e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Issue batch";
            }
        }
    });
}

async function issueSingle() {
    let issuer;
    try { issuer = getSessionIssuer(); }
    catch (e) { info("Not allowed", e.message); return; }

    const holder_full_name = document.getElementById("s_fullName")?.value.trim();
    const holder_email = document.getElementById("s_email")?.value.trim().toLowerCase();
    const credential_type = document.getElementById("s_type")?.value.trim();
    const credential_title = document.getElementById("s_title")?.value.trim();

    if (!holder_full_name || !holder_email || !credential_type || !credential_title) {
        info("Missing fields", "Please fill: full name, email, credential type, credential title.");
        return;
    }

    if (!holder_email.includes("@")) {
        info("Invalid email", "Please enter a valid holder email address.");
        return;
    }

    const holder_internal_id = document.getElementById("s_internalId")?.value.trim() || "";
    const expiry_date = document.getElementById("s_expiry")?.value || "";
    const description = document.getElementById("s_desc")?.value.trim() || "";

    confirmIssue(async () => {
        const btn = document.getElementById("btnIssueSingle");
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Issuing...";
        }

        try {
            const data = await postJSON({
                action: "issue",
                issuer_email: issuer.email,
                holder_email,
                credential_title,
                credential_type,
                holder_full_name,
                holder_internal_id,
                expiry_date,
                description
            });

            if (!data || data.error || data.success !== true) {
                throw new Error(data?.error || "Issuance failed.");
            }

            info(
                "Credential issued",
                `Credential ID: ${data.credential_id}\nVerify link: ${data.qr_url || "—"}`
            );

            resetSingleForm();
        } catch (e) {
            info("Issuance failed", e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Issue credential";
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btnDownloadTemplate")?.addEventListener("click", downloadTemplate);
    document.getElementById("btnIssueBatch")?.addEventListener("click", issueBatch);
    document.getElementById("btnIssueSingle")?.addEventListener("click", issueSingle);

    const csvFile = document.getElementById("csvFile");
    const csvMeta = document.getElementById("csvMeta");
    const btnIssueBatch = document.getElementById("btnIssueBatch");

    if (!csvFile) return;

    csvFile.addEventListener("change", async () => {
        clearErrors();
        parsedRows = [];
        if (btnIssueBatch) btnIssueBatch.disabled = true;

        const file = csvFile.files?.[0];
        if (!file) return;

        if (csvMeta) csvMeta.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;

        const raw = parseCSV(await file.text());
        if (raw.length < 2) {
            showErrors(["CSV must include a header row and at least one data row."]);
            return;
        }

        const header = raw[0].map(normalizeHeader);
        const missing = REQUIRED.filter(r => !header.includes(r));
        if (missing.length) {
            showErrors([`Missing required columns: ${missing.join(", ")}`]);
            return;
        }

        parsedRows = raw.slice(1)
            .map(cols => {
                const o = {};
                header.forEach((h, i) => o[h] = (cols[i] || "").trim());
                return o;
            })
            .filter(r => r.email && r.full_name && r.credential_type && r.credential_title);

        if (!parsedRows.length) {
            showErrors(["No valid rows found."]);
            return;
        }

        renderPreview(header, parsedRows);
        if (btnIssueBatch) btnIssueBatch.disabled = false;
    });
});