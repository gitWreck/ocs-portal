let loggedInUser = null;
let currentStudent = null;
let currentSubjects = [];
let currentPassedHkNstp = [];
let currentPassedGe = [];
let currentPassedSpcl = [];

/**
 * SUPABASE CONFIG
 */
const SUPABASE_URL = "https://jwoblhsdxuctlybuqzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tEjD0o5RYkwNxgGJmMKK1g_UdKPhpS0";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PLANNED_TERM_OPTIONS = {
  "": { year: "" },

  1253: { year: "Mid 2026" },
  1261: { year: "1st 2026-2027" },
  1262: { year: "2nd 2026-2027" },

  1263: { year: "Mid 2027" },
  1271: { year: "1st 2027-2028" },
  1272: { year: "2nd 2027-2028" },

  1273: { year: "Mid 2028" },
  1281: { year: "1st 2028-2029" },
  1282: { year: "2nd 2028-2029" },

  1283: { year: "Mid 2029" },
  1291: { year: "1st 2029-2030" },
  1292: { year: "2nd 2029-2030" },
};

const HK_TYPE_OPTIONS = [
  "",
  "Aerobic Dancing",
  "Aikido",
  "Arnis",
  "Asian Dance",
  "Archery",
  "Ballet for Beginners",
  "Basketball",
  // "Basketball Female",
  // "Basketball Male",
  "Billiards",
  "Belly Dancing",
  "Baseball",
  "Badminton",
  "Beach Volleyball",
  // "Beach Volleyball (COED)",
  "Contract Bridge Game",
  "Contemporary Dance",
  "Chess",
  "Cheer Dance",
  "Cardio Kung Fu",
  "Duckpin Bowling",
  "DanceSport",
  "Darts",
  "Football/Soccer",
  // "Football (COED)",
  // "Football/Soccer for female",
  // "Football/Soccer for male",
  "Female Handball",
  "Futsal",
  // "Futsal (Indoor Football)",
  // "Futsal for female",
  // "Futsal for male",
  "Hawaii",
  "Hoof Dance",
  "Hooping Fitness",
  "Hula/Tahitian",
  "Judo",
  "Karatedo",
  "Line Dance",
  "Lawn Tennis",
  "Laughter Yoga",
  "Modern Dance",
  "Male Handball",
  "Modern Jazz",
  "Muslim Dance",
  "Neo-Filipino",
  "Outdoor Recreation",
  "Pickle Ball",
  "Philippine Folk Dance",
  "Philippine Game",
  "Pilates",
  "Polynesian Dance",
  "Running for Fitness",
  "Roper Flow",
  "Social Dance",
  "Self-Defense",
  "Softball",
  // "Softball Female",
  // "Softball Male",
  "Shakti",
  "Street Jazz",
  "Slo-Pitch Softball",
  "Sepak takraw",
  "Stretching",
  "Swimming",
  // "Swimming (COED)",
  // "Swimming Female",
  // "Swimming Male",
  "Tai-chi-chuan",
  "Tap Dance",
  "Track & Field",
  "Taekwondo",
  "Table Tennis",
  "Ultimate Frisbee",
  "Volleyball",
  // "Volleyball Female",
  // "Volleyball Male",
  "Woodball",
  "Walking for Fitness",
  "Weight Training",
  // "Weight Training (COED)",
  "Yoga",
  "Zumba",
];

const HK_NSTP_REQUIREMENTS = [
  { code: "HK 11", required: 1, needsType: false },
  { code: "HK 12", required: 3, needsType: true },
  { code: "NSTP 1", required: 1, needsType: false },
  { code: "NSTP 2", required: 1, needsType: false },
];

const REQUIRED_GE_REQUIREMENTS = [
  { code: "ARTS 1", required: 1 },
  { code: "COMM 10", required: 1 },
  { code: "ETHICS 1", required: 1 },
  { code: "KAS 1 / HIST 1", required: 1 },
  { code: "STS 1", required: 1 },
  { code: "PI 10", required: 1 },
];

const ELECTIVE_GE_SUBJECTS = [
  "HUM 3",
  "KAS 4",
  "MATH 10",
  "PHILARTS 1",
  "PHLO 1",
  "PS 21",
  "SAS 1",
  "SCIENCE 10",
  "SCIENCE 11",
  "SOSC 3",
  "WIKA 1",
];

const REQUIRED_GE_CODES = [
  "ARTS 1",
  "COMM 10",
  "ETHICS 1",
  "KAS 1",
  "HIST 1",
  "STS 1",
  "PI 10",
];

const SPCL_SUBJECTS = ["SPCM 1", "SPCM 2", "SPCM 3", "SPCM 4"];

function normalizeDegree(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function shouldShowGeSection(degree) {
  const normalized = normalizeDegree(degree);
  return normalized !== "CIF";
}

function shouldShowSpclSection(degree) {
  const normalized = normalizeDegree(degree);
  return normalized !== "ASCF" && normalized !== "CIF";
}

async function getPassedSpclByStudentNo(studentNo) {
  const { data, error } = await supabaseClient
    .from("v_passed_spcl")
    .select("*")
    .eq("stu_no", studentNo)
    .order("subj_no", { ascending: true });

  if (error) {
    console.error("Passed SPCL lookup error:", error);
    throw error;
  }

  return data || [];
}

function buildSpclOptions(selectedValue) {
  return SPCL_SUBJECTS.map((code) => {
    const selected =
      String(code) === String(selectedValue || "") ? "selected" : "";

    return `<option value="${escapeHtml(code)}" ${selected}>${escapeHtml(
      code
    )}</option>`;
  }).join("");
}

function renderSpclTable(records) {
  const $tbody = $("#spcl-table tbody");
  $tbody.empty();

  let hasRows = false;

  records.forEach((row) => {
    hasRows = true;
    $tbody.append(`
      <tr>
        <td>${escapeHtml(row.subj_no)}</td>
        <td>${escapeHtml(row.subj_desc || row.subj_no)}</td>
        <td>${getStatusBadge(row)}</td>
        <td>${escapeHtml(getDisplaySemester(row))}</td>
      </tr>
    `);
  });

  const missingCount = Math.max(3 - records.length, 0);

  for (let i = 0; i < missingCount; i++) {
    hasRows = true;
    $tbody.append(`
      <tr class="table-light spcl-missing-row">
        <td>
          <select class="form-select form-select-sm spcl-subject-input">
            <option value="">Select SPCL</option>
            ${buildSpclOptions("")}
          </select>
        </td>
        <td><span class="text-muted">To be completed</span></td>
        <td>Remaining</td>
        <td>
          <select class="form-select form-select-sm spcl-semester-input">
            ${buildPlannedTermOptions("")}
          </select>
        </td>
      </tr>
    `);
  }

  if (!hasRows) {
    $tbody.append(`
      <tr>
        <td colspan="4" class="text-center text-muted">No SPCL records found.</td>
      </tr>
    `);
  }
}

function handleCredentialResponse(response) {
  const userData = parseJwt(response.credential);

  loggedInUser = {
    email: userData.email || "",
    name: userData.name || "",
  };

  sessionStorage.setItem("student_portal_user", JSON.stringify(loggedInUser));
  window.location.href = "portal.html";
}

function parseJwt(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );

  return JSON.parse(jsonPayload);
}

function getStoredUser() {
  try {
    const raw = sessionStorage.getItem("student_portal_user");
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function formatEnrolled(value) {
  return value ? "Yes" : "No";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildPlannedTermOptions(selectedValue) {
  return Object.entries(PLANNED_TERM_OPTIONS)
    .map(([value, option]) => {
      const selected =
        String(value) === String(selectedValue || "") ? "selected" : "";
      const label = value === "" ? "Select term" : option.year;

      return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(
        label
      )}</option>`;
    })
    .join("");
}

function buildHkTypeOptions(selectedValue) {
  return HK_TYPE_OPTIONS.map((option) => {
    const selected =
      String(option) === String(selectedValue || "") ? "selected" : "";
    const label = option === "" ? "Select HK" : option;

    return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(
      label
    )}</option>`;
  }).join("");
}

function normalizeRequirementCode(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function getStatusBadge(record) {
  if (record.currently_enrolled) {
    return '<span class="badge text-bg-success">Currently Enrolled</span>';
  }
  return '<span class="badge text-bg-secondary">Passed</span>';
}

function getDisplaySemester(record) {
  if (record.planned_term && PLANNED_TERM_OPTIONS[record.planned_term]) {
    return PLANNED_TERM_OPTIONS[record.planned_term].year;
  }

  if (record.term && record.enrolled_year) {
    const year = Number(record.enrolled_year);
    const termRaw = String(record.term).toUpperCase().trim();

    // handle trimester (1T, 2T, 3T)
    if (termRaw === "1T") {
      return `1st Tri ${year}-${year + 1}`;
    }

    if (termRaw === "2T") {
      return `2nd Tri ${year}-${year + 1}`;
    }

    if (termRaw === "3T") {
      return `3rd Tri ${year}-${year + 1}`;
    }

    // handle regular terms
    if (termRaw === "S" || termRaw === "M") {
      return `${year} Midyear`;
    }

    if (termRaw === "1") {
      return `1st ${year}-${year + 1}`;
    }

    if (termRaw === "2") {
      return `2nd ${year}-${year + 1}`;
    }

    return `${termRaw} ${year}`;
  }

  return "-";
}

async function getStudentByEmail(email) {
  const { data, error } = await supabaseClient
    .from("students")
    .select("student_no, fullname, email, degree")
    .ilike("email", String(email).trim())
    .maybeSingle();

  if (error) {
    console.error("Student lookup error:", error);
    throw error;
  }

  return data || null;
}

async function getSubjectsByStudentNo(studentNo) {
  const { data, error } = await supabaseClient
    .from("v_remaining_subjects")
    .select("*")
    .eq("stu_no", studentNo);

  if (error) {
    console.error("Subjects lookup error:", error);
    throw error;
  }

  return data || [];
}

async function getPassedHkNstpByStudentNo(studentNo) {
  const { data, error } = await supabaseClient
    .from("v_passed_hk_nstp")
    .select("*")
    .eq("stu_no", studentNo)
    .order("subj_no", { ascending: true });

  if (error) {
    console.error("Passed HK/NSTP lookup error:", error);
    throw error;
  }

  return data || [];
}

async function getPassedGeByStudentNo(studentNo) {
  const { data, error } = await supabaseClient
    .from("v_ge_passed_enrolled")
    .select("*")
    .eq("stu_no", studentNo)
    .order("subj_no", { ascending: true });

  if (error) {
    console.error("Passed GE lookup error:", error);
    throw error;
  }

  return data || [];
}

function getGeRequirementMatch(subjNo) {
  const value = String(subjNo || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  if (value.includes("ARTS 1")) return "ARTS 1";
  if (value.includes("COMM 10")) return "COMM 10";
  if (value.includes("ETHICS 1")) return "ETHICS 1";
  if (value.includes("STS 1")) return "STS 1";
  if (value.includes("PI 10")) return "PI 10";
  if (value.includes("KAS 1") || value.includes("HIST 1"))
    return "KAS 1 / HIST 1";

  const electiveMatch = ELECTIVE_GE_SUBJECTS.find((code) =>
    value.includes(code)
  );

  if (electiveMatch) return electiveMatch;

  return null;
}

function renderSubjects(subjects) {
  const $tbody = $("#subjects-table tbody");
  $tbody.empty();

  if (!subjects.length) {
    $tbody.append(`
      <tr>
        <td colspan="4" class="text-center text-muted">No remaining subjects found.</td>
      </tr>
    `);
    return;
  }

  const sortedSubjects = [...subjects].sort((a, b) => {
    if (a.currently_enrolled === b.currently_enrolled) return 0;
    return a.currently_enrolled ? -1 : 1;
  });

  sortedSubjects.forEach((subject) => {
    $tbody.append(`
      <tr data-id="${subject.id}">
        <td>${escapeHtml(subject.subj_no)}</td>
        <td>${escapeHtml(subject.subj_desc)}</td>
        <td>
          ${
            subject.currently_enrolled
              ? '<span class="badge text-bg-success">Currently Enrolled</span>'
              : "Remaining"
          }
        </td>
        <td>
          <select class="form-select form-select-sm planned-term" ${
            subject.currently_enrolled ? "disabled" : ""
          }>
            ${buildPlannedTermOptions(subject.planned_term)}
          </select>
        </td>
      </tr>
    `);
  });
}

function renderHkNstpTable(records) {
  const $tbody = $("#hk-nstp-table tbody");
  $tbody.empty();

  // console.log("records", records);

  function getRequirementMatch(subjNo) {
    const value = String(subjNo || "")
      .toUpperCase()
      .trim();

    if (value.includes("HK 11")) return "HK 11";
    if (value.includes("HK 12")) return "HK 12";
    if (value.includes("NSTP 1")) return "NSTP 1";
    if (value.includes("NSTP 2")) return "NSTP 2";

    return null;
  }

  const grouped = {};
  HK_NSTP_REQUIREMENTS.forEach((req) => {
    grouped[req.code] = records.filter(
      (row) => getRequirementMatch(row.subj_no) === req.code
    );
  });

  let hasRows = false;

  HK_NSTP_REQUIREMENTS.forEach((req) => {
    const existingRows = grouped[req.code] || [];
    const missingCount = Math.max(req.required - existingRows.length, 0);

    existingRows.forEach((row) => {
      // console.log("row", row);
      hasRows = true;
      $tbody.append(`
        <tr>
          <td>${escapeHtml(req.code)}</td>
          <td>${escapeHtml(row.subj_desc || row.subj_no)}</td>
          <td>${getStatusBadge(row)}</td>
          <td>${escapeHtml(getDisplaySemester(row))}</td>
        </tr>
      `);
    });

    for (let i = 0; i < missingCount; i++) {
      hasRows = true;
      $tbody.append(`
        <tr class="table-light hk-nstp-missing-row"
            data-requirement="${escapeHtml(req.code)}"
            data-needs-type="${req.needsType ? "1" : "0"}">
          <td>${escapeHtml(req.code)}</td>
          <td>
            ${
              req.needsType
                ? `<select class="form-select form-select-sm hk-type-input">
                    ${buildHkTypeOptions("")}
                  </select>`
                : `<span class="text-muted">To be completed</span>`
            }
          </td>
          <td><span class="">Remaining</span></td>
          <td>
          <select class="form-select form-select-sm hk-semester-input">
          ${buildPlannedTermOptions("")}
          </select>
          </td>
          </tr>
          `);
      // <td><span class="badge text-bg-warning">Missing</span></td>
    }
  });

  if (!hasRows) {
    $tbody.append(`
      <tr>
        <td colspan="4" class="text-center text-muted">No HK/NSTP records found.</td>
      </tr>
    `);
  }
}

function renderGeTable(records) {
  const $tbody = $("#ge-table tbody");
  $tbody.empty();

  const groupedRequired = {};
  REQUIRED_GE_REQUIREMENTS.forEach((req) => {
    groupedRequired[req.code] = records.filter(
      (row) => getGeRequirementMatch(row.subj_no) === req.code
    );
  });

  const electiveRows = records.filter((row) => {
    const match = getGeRequirementMatch(row.subj_no);
    return ELECTIVE_GE_SUBJECTS.includes(match);
  });

  let hasRows = false;

  REQUIRED_GE_REQUIREMENTS.forEach((req) => {
    const existingRows = groupedRequired[req.code] || [];
    const missingCount = Math.max(req.required - existingRows.length, 0);

    existingRows.slice(0, req.required).forEach((row) => {
      hasRows = true;
      $tbody.append(`
        <tr>
          <td>Required GE</td>
          <td>${escapeHtml(req.code)}</td>
          <td>${escapeHtml(row.subj_desc || row.subj_no)}</td>
          <td>${getStatusBadge(row)}</td>
          <td>${escapeHtml(getDisplaySemester(row))}</td>
        </tr>
      `);
    });

    for (let i = 0; i < missingCount; i++) {
      hasRows = true;
      $tbody.append(`
        <tr class="table-light ge-missing-row" data-ge-type="required" data-requirement="${escapeHtml(
          req.code
        )}">
          <td>Required GE</td>
          <td>${escapeHtml(req.code)}</td>
          <td><span class="text-muted">To be completed</span></td>
          <td>Remaining</td>
          <td>
            <select class="form-select form-select-sm ge-semester-input">
              ${buildPlannedTermOptions("")}
            </select>
          </td>
        </tr>
      `);
    }
  });

  electiveRows.forEach((row) => {
    hasRows = true;
    $tbody.append(`
      <tr>
        <td>Elective GE</td>
        <td>${escapeHtml(
          getGeRequirementMatch(row.subj_no) || row.subj_no
        )}</td>
        <td>${escapeHtml(row.subj_desc || row.subj_no)}</td>
        <td>${getStatusBadge(row)}</td>
        <td>${escapeHtml(getDisplaySemester(row))}</td>
      </tr>
    `);
  });

  const missingElectives = Math.max(3 - electiveRows.length, 0);

  for (let i = 0; i < missingElectives; i++) {
    hasRows = true;
    $tbody.append(`
      <tr class="table-light ge-missing-row" data-ge-type="elective">
        <td>Elective GE</td>
        <td>
          <select class="form-select form-select-sm ge-elective-input">
            <option value="">Select elective GE</option>
            ${ELECTIVE_GE_SUBJECTS.map(
              (code) =>
                `<option value="${escapeHtml(code)}">${escapeHtml(
                  code
                )}</option>`
            ).join("")}
          </select>
        </td>
        <td><span class="text-muted">To be completed</span></td>
        <td>Remaining</td>
        <td>
          <select class="form-select form-select-sm ge-semester-input">
            ${buildPlannedTermOptions("")}
          </select>
        </td>
      </tr>
    `);
  }

  if (!hasRows) {
    $tbody.append(`
      <tr>
        <td colspan="5" class="text-center text-muted">No GE records found.</td>
      </tr>
    `);
  }
}

function showPortalMessage(type, message) {
  const $msg = $("#save-message");
  $msg
    .removeClass("d-none alert-success alert-danger alert-warning")
    .addClass(`alert-${type}`)
    .text(message);
}

async function loadStudentPortal(email) {
  $("#loading-section").removeClass("d-none");
  $("#portal-section").addClass("d-none");
  $("#not-found-section").addClass("d-none");
  $("#portal-error-section").addClass("d-none");
  $("#save-message")
    .addClass("d-none")
    .removeClass("alert-success alert-danger alert-warning")
    .text("");

  try {
    const student = await getStudentByEmail(email);
    console.log("student info: ", student);
    const studentDegree = normalizeDegree(student.degree);

    if (shouldShowGeSection(studentDegree)) {
      $("#ge-section").show();
    } else {
      $("#ge-section").hide();
    }

    if (shouldShowSpclSection(studentDegree)) {
      $("#spcl-section").show();
    } else {
      $("#spcl-section").hide();
    }

    if (!student) {
      $("#loading-section").addClass("d-none");
      $("#not-found-section").removeClass("d-none");
      return;
    }

    currentStudent = student;

    $("#student-email").text(student.email || "-");
    $("#student-name").text(student.fullname || "-");
    $("#student-no").text(student.student_no || "-");

    const remainingSubjects = await getSubjectsByStudentNo(student.student_no);
    const passedHkNstp = await getPassedHkNstpByStudentNo(student.student_no);

    let passedGe = [];
    let passedSpcl = [];

    if (shouldShowGeSection(studentDegree)) {
      passedGe = await getPassedGeByStudentNo(student.student_no);
    }

    if (shouldShowSpclSection(studentDegree)) {
      passedSpcl = await getPassedSpclByStudentNo(student.student_no);
    }

    currentSubjects = remainingSubjects;
    currentPassedHkNstp = passedHkNstp;
    currentPassedGe = passedGe;
    currentPassedSpcl = passedSpcl;

    renderSubjects(remainingSubjects);
    renderHkNstpTable(passedHkNstp);

    if (shouldShowGeSection(studentDegree)) {
      renderGeTable(passedGe);
    }

    if (shouldShowSpclSection(studentDegree)) {
      renderSpclTable(passedSpcl);
    }
    $("#loading-section").addClass("d-none");
    $("#portal-section").removeClass("d-none");
  } catch (error) {
    console.error("Error loading portal:", error);
    $("#loading-section").addClass("d-none");
    $("#portal-error-message").text("Failed to load student data.");
    $("#portal-error-section").removeClass("d-none");
  }
}

async function savePlannedTerms() {
  if (!currentStudent) {
    showPortalMessage("danger", "No student loaded.");
    return;
  }

  const updates = [];

  $("#subjects-table tbody tr[data-id]").each(function () {
    const id = Number($(this).attr("data-id"));
    const plannedTerm = $(this).find(".planned-term").val();

    if (!Number.isNaN(id)) {
      updates.push(
        supabaseClient
          // .from("student_subject_status")
          .from("subjects_status")
          .update({
            planned_term: plannedTerm === "" ? null : plannedTerm,
          })
          .eq("id", id)
      );
    }
  });

  if (!updates.length) {
    showPortalMessage("warning", "No subjects available to update.");
    return;
  }

  $("#save-plan-btn").prop("disabled", true).text("Saving...");

  try {
    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);

    if (failed) {
      console.error("Save error:", failed.error);
      showPortalMessage("danger", "Failed to save some planned terms.");
      return;
    }

    showPortalMessage(
      "success",
      "Planned terms saved successfully. HK/NSTP missing rows are currently for display/input only."
    );
  } catch (error) {
    console.error("Save planned terms error:", error);
    showPortalMessage("danger", "Failed to save planned terms.");
  } finally {
    $("#save-plan-btn").prop("disabled", false).text("Save Planned Terms");
  }
}

function logoutUser() {
  loggedInUser = null;
  currentStudent = null;
  currentSubjects = [];
  currentPassedHkNstp = [];
  currentPassedGe = [];
  sessionStorage.removeItem("student_portal_user");
  window.location.href = "login.html";
  currentPassedSpcl = [];
}

$(document).ready(function () {
  const path = window.location.pathname.toLowerCase();

  if (path.includes("portal.html")) {
    const storedUser = getStoredUser();

    if (!storedUser || !storedUser.email) {
      window.location.href = "login.html";
      return;
    }

    loggedInUser = storedUser;
    loadStudentPortal(loggedInUser.email);

    $("#logout-btn").on("click", function () {
      logoutUser();
    });

    $("#save-plan-btn").on("click", function () {
      savePlannedTerms();
    });
  }

  if (path.includes("login.html") || path.endsWith("/")) {
    const storedUser = getStoredUser();

    if (storedUser && storedUser.email) {
      window.location.href = "portal.html";
    }
  }
});
