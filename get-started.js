/* ==========================================================
   AgroIntel — Get Started wizard
   ========================================================== */

"use strict";

const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];

/* ---------- Read query params (?email= ?size= ?plan= ?mode=) ---------- */
const params = new URLSearchParams(window.location.search);
const prefillEmail = params.get("email") || "";
const prefillSize = params.get("size") || "";
const plan = (params.get("plan") || "grower").toLowerCase();
const mode = (params.get("mode") || "signup").toLowerCase();

const PLAN_LABELS = {
  starter: "Starter · Free forever",
  grower: "Grower · 14-day trial",
  enterprise: "Enterprise · Custom",
};
const planPill = $("#planPill");
planPill.textContent = PLAN_LABELS[plan] || PLAN_LABELS.grower;

/* ---------- Sign-in mode ---------- */
const signinPanel = $("#signinPanel");
const wizardPanel = $("#wizardPanel");

if (mode === "signin") {
  wizardPanel.hidden = true;
  signinPanel.hidden = false;
  const signinEmail = $("#signinEmail");
  if (prefillEmail) signinEmail.value = prefillEmail;

  const signinForm = $("#signinForm");
  const signinDone = $("#signinDone");
  const signinDoneEmail = $("#signinDoneEmail");
  // Where "sign in" takes the user afterward - the real map + Ask Agro AI
  // section, not just another marketing page. ?next= lets a caller point
  // this at a different in-site destination if ever needed.
  const nextDestination = params.get("next") || "index.html#analysis";
  signinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = signinEmail.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      signinEmail.focus();
      return;
    }
    signinDoneEmail.textContent = email;
    signinForm.hidden = true;
    signinDone.hidden = false;
    // Demo build: no real magic-link email/auth, so "signed in" is
    // simulated here - redirects straight to the real functional page
    // after a brief pause instead of leaving the user on a dead end.
    setTimeout(() => {
      window.location.href = nextDestination;
    }, 1600);
  });
} else {
  wizardPanel.hidden = false;
  signinPanel.hidden = true;
}

/* ==========================================================
   Wizard
   ========================================================== */
const form = $("#wizardForm");
if (form) {
  const steps = $$(".gs-step", form);
  const progressFill = $("#progressFill");
  const stepCount = $("#stepCount");
  const STEP_META = ["You", "Farm", "Data"];
  let currentStep = 1;

  /* Prefill from query params (carried over from the main site) */
  const gsEmail = $("#gsEmail");
  const gsFarmSize = $("#gsFarmSize");
  if (prefillEmail) gsEmail.value = prefillEmail;
  if (prefillSize && [...gsFarmSize.options].some((o) => o.value === prefillSize)) {
    gsFarmSize.value = prefillSize;
  }

  /* Crop chips — toggle aria-pressed */
  const cropChips = $$("#cropChips .gs-chip");
  cropChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chip.setAttribute("aria-pressed", String(chip.getAttribute("aria-pressed") !== "true"));
    });
  });
  const selectedCrops = () =>
    cropChips.filter((c) => c.getAttribute("aria-pressed") === "true").map((c) => c.dataset.crop);

  /* Input + error helpers */
  const fieldError = (input, errId, show) => {
    const err = document.getElementById(errId);
    input.classList.toggle("invalid", show);
    if (err) err.hidden = !show;
  };
  const shake = (el) => {
    el.classList.remove("gs-shake");
    void el.offsetWidth; // restart animation
    el.classList.add("gs-shake");
  };

  const validators = {
    1() {
      const name = $("#gsName");
      let ok = true;
      const nameOk = name.value.trim().length >= 2;
      fieldError(name, "err-name", !nameOk);
      if (!nameOk) { ok = false; shake(name); }
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(gsEmail.value.trim());
      fieldError(gsEmail, "err-email", !emailOk);
      if (!emailOk) { ok = false; shake(gsEmail); }
      if (!ok) (nameOk ? gsEmail : name).focus();
      return ok;
    },
    2() {
      const farm = $("#gsFarmName");
      let ok = true;
      const farmOk = farm.value.trim().length >= 2;
      fieldError(farm, "err-farm", !farmOk);
      if (!farmOk) { ok = false; shake(farm); }
      const sizeOk = Boolean(gsFarmSize.value);
      fieldError(gsFarmSize, "err-size", !sizeOk);
      if (!sizeOk) { ok = false; shake(gsFarmSize); }
      if (!ok) (farmOk ? gsFarmSize : farm).focus();
      return ok;
    },
    3() {
      const consent = $("#gsConsent");
      const err = $("#err-consent");
      const ok = consent.checked;
      if (err) err.hidden = ok;
      if (!ok) shake(consent.closest(".gs-consent"));
      return ok;
    },
  };

  function goTo(step) {
    currentStep = Math.min(Math.max(step, 1), steps.length);
    steps.forEach((s) => { s.hidden = Number(s.dataset.step) !== currentStep; });
    progressFill.style.width = `${(currentStep / steps.length) * 100}%`;
    stepCount.textContent = `Step ${currentStep} of ${steps.length} · ${STEP_META[currentStep - 1]}`;
    const firstInput = $(`.gs-step[data-step="${currentStep}"] input:not([type="checkbox"]), .gs-step[data-step="${currentStep}"] select`);
    if (firstInput) firstInput.focus({ preventScroll: false });
  }

  $$("[data-next]", form).forEach((btn) =>
    btn.addEventListener("click", () => {
      if (validators[currentStep]()) goTo(currentStep + 1);
    })
  );
  $$("[data-back]", form).forEach((btn) =>
    btn.addEventListener("click", () => goTo(currentStep - 1))
  );

  /* Final submit → validate → success panel */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validators[3]()) return;

    const payload = {
      name: $("#gsName").value.trim(),
      email: gsEmail.value.trim(),
      farm: $("#gsFarmName").value.trim(),
      size: gsFarmSize.value,
      country: $("#gsCountry").value,
      crops: selectedCrops(),
      goals: $$('input[name="goals"]:checked', form).map((el) => el.value),
      sources: $$('input[name="sources"]:checked', form).map((el) => el.value),
      plan,
      at: new Date().toISOString(),
    };
    try {
      const prev = JSON.parse(localStorage.getItem("agro_onboarding") || "[]");
      prev.push(payload);
      localStorage.setItem("agro_onboarding", JSON.stringify(prev.slice(-10)));
    } catch { /* private mode — fine, nothing leaves the device */ }

    // Fill success panel
    $("#doneName").textContent = payload.name ? `, ${payload.name.split(" ")[0]}` : "";
    $("#doneEmail").textContent = payload.email;
    const sizeLabel = gsFarmSize.selectedOptions[0]?.textContent?.trim() || "—";
    const countryLabel = $("#gsCountry").selectedOptions[0]?.textContent?.trim() || "";
    const chips = [
      payload.farm,
      sizeLabel,
      countryLabel,
      ...(payload.crops.length ? [payload.crops.slice(0, 3).join(", ") + (payload.crops.length > 3 ? ` +${payload.crops.length - 3}` : "")] : []),
      `${payload.sources.length} data source${payload.sources.length === 1 ? "" : "s"}`,
    ].filter(Boolean);
    $("#doneSummary").innerHTML = chips.map((c) => `<li>${c.replace(/[<>&]/g, "")}</li>`).join("");

    form.hidden = true;
    const wizardHeader = $(".gs-card-head");
    if (wizardHeader) wizardHeader.hidden = true;
    const done = $("#donePanel");
    done.hidden = false;
    done.focus();
  });

  goTo(1);
}
