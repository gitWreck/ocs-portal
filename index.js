let loggedInUser = null;
let currentStudent = null;
let currentSubjects = [];
let currentPassedHkNstp = [];
let currentPassedGe = [];
let currentPassedSpcl = [];
let currentPlaceholders = [];
let spclSubjectsData = []; // Variable to hold the fetched JSON data
let hkTypes = [];

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

// Fetch SPCL subjects from external JSON file
async function loadSpclCourses() {
  try {
    const response = await fetch("spcl.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    spclSubjectsData = await response.json();
  } catch (error) {
    console.error("Failed to load spcl.json:", error);
    spclSubjectsData = [];
  }
}

async function loadHKActivities() {
  try {
    const response = await fetch("hk.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    hkTypes = await response.json();
  } catch (error) {
    console.error("Failed to load hk.json:", error);
    hkTypes = [];
  }
}

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

function buildSpclOptions() {
  return spclSubjectsData
    .map((course) => {
      const subjNo = course["Subject No"];
      const desc = course["Description"] || "";
      // Value goes into input, text between tags shows as a hint in dropdown
      return `<option value="${escapeHtml(subjNo)}">${
        (escapeHtml(subjNo), ". ", escapeHtml(desc))
      }</option>`;
    })
    .join("");
}

function renderSpclTable(records) {
  const $tbody = $("#spcl-table tbody");
  $tbody.empty();

  if ($("#spcl-course-list").length === 0) {
    $("body").append(
      `<datalist id="spcl-course-list">${buildSpclOptions()}</datalist>`
    );
  }

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

  // Find unused SC placeholders (e.g., 'SC 1', 'SC 2')
  const spclPlaceholders = currentPlaceholders
    .filter((p) => String(p.subj_no).startsWith("SC "))
    .sort((a, b) => a.sequence - b.sequence);

  spclPlaceholders.forEach((placeholder) => {
    hasRows = true;
    $tbody.append(`
      <tr class="table-light spcl-missing-row" data-id="${placeholder.id}">
        <td>
          <input type="text" list="spcl-course-list" class="form-control form-control-sm spcl-subject-input" placeholder="Select Specialized" onclick="try{this.showPicker()}catch(e){}" onfocus="try{this.showPicker()}catch(e){}">
        </td>
        <td class="spcl-description-cell"><span class="text-muted">To be completed</span></td>
        <td>Remaining</td>
        <td>
          <select class="form-select form-select-sm spcl-semester-input">
            ${buildPlannedTermOptions("")}
          </select>
        </td>
      </tr>
    `);
  });

  if (!hasRows) {
    $tbody.append(
      `<tr><td colspan="4" class="text-center text-muted py-4">No SPCL records found.</td></tr>`
    );
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

function buildHkTypeOptions() {
  return hkTypes
    .filter((option) => option !== "") // Remove the empty default option
    .map((option) => {
      return `<option value="${escapeHtml(option)}"></option>`;
    })
    .join("");
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
  return '<span class="badge text-bg-secondary">Saved</span>';
}

function getDisplaySemester(record) {
  if (record.planned_term && PLANNED_TERM_OPTIONS[record.planned_term]) {
    return PLANNED_TERM_OPTIONS[record.planned_term].year;
  }

  if (record.term && record.enrolled_year) {
    const year = Number(record.enrolled_year);
    const termRaw = String(record.term).toUpperCase().trim();

    if (termRaw === "1T") {
      return `1st Tri ${year}-${year + 1}`;
    }

    if (termRaw === "2T") {
      return `2nd Tri ${year}-${year + 1}`;
    }

    if (termRaw === "3T") {
      return `3rd Tri ${year}-${year + 1}`;
    }

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

// Helper functions to map your database numbers to readable text
function getLevelLabel(level) {
  const map = {
    1: "1st Year",
    2: "2nd Year",
    3: "3rd Year",
    4: "Summer",
    5: "Midyear",
    6: "4th Year",
  };
  return map[level] || `Year/Level ${level}`;
}

function getSemesterLabel(semester) {
  const map = {
    1: "1st Semester",
    2: "2nd Semester",
    0: "Midyear",
  };
  return map[semester] || `Term ${semester}`;
}

function renderSubjects(subjects) {
  const $enrolledTbody = $("#enrolled-table tbody");
  const $curriculumContainer = $("#curriculum-container");

  $enrolledTbody.empty();
  $curriculumContainer.empty();

  // 1. Separate Enrolled from Remaining
  const enrolledSubjects = subjects.filter((s) => s.currently_enrolled);
  const remainingSubjects = subjects.filter((s) => !s.currently_enrolled);

  // 2. Render Enrolled Table
  if (enrolledSubjects.length === 0) {
    $enrolledTbody.append(`
      <tr><td colspan="3" class="text-center text-muted py-4">No currently enrolled subjects.</td></tr>
    `);
  } else {
    enrolledSubjects.forEach((subject) => {
      $enrolledTbody.append(`
        <tr>
          <td>${escapeHtml(subject.subj_no)}</td>
          <td>${escapeHtml(subject.subj_desc)}</td>
          <td><span class="badge text-bg-success">Currently Enrolled</span></td>
        </tr>
      `);
    });
  }

  // 3. Group and Render Remaining Subjects
  if (remainingSubjects.length === 0) {
    $curriculumContainer.append(`
      <div class="text-center text-muted py-4 border rounded-3 bg-white">No remaining subjects found. You are all caught up!</div>
    `);
    return;
  }

  // Group by Level and Semester
  const grouped = {};
  remainingSubjects.forEach((subject) => {
    const lvl = subject.level || 99; // 99 pushes unassigned subjects to the bottom
    const sem = subject.semester || "99";
    const groupKey = `${lvl}-${sem}`;

    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        level: lvl,
        semester: sem,
        subjects: [],
      };
    }
    grouped[groupKey].subjects.push(subject);
  });

  // Sort the groups (First by Level, then by Semester)
  const sortedGroups = Object.values(grouped).sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;

    // Sort semester: 1st Sem -> 2nd Sem -> Midyear(0)
    const semOrder = { 1: 1, 2: 2, 0: 3 };
    const aSem = semOrder[a.semester] || 99;
    const bSem = semOrder[b.semester] || 99;
    return aSem - bSem;
  });

  // Render each group as its own mini-table
  sortedGroups.forEach((group) => {
    // Sort subjects within the group by their sequence
    group.subjects.sort((a, b) => (a.sequence || 99) - (b.sequence || 99));

    const groupTitle = `${getLevelLabel(group.level)} — ${getSemesterLabel(
      group.semester
    )}`;

    let tableHtml = `
      <div class="mb-4">
        <h6 class="fw-bold text-maroon mb-2" style="font-size: 1.05rem;">${groupTitle}</h6>
        <div class="table-responsive border border-light-subtle rounded-3 shadow-sm bg-white">
          <table class="table table-custom align-middle mb-0" id="subjects-table">
            <thead>
              <tr>
                <th style="width: 15%">Subject Code</th>
                <th>Subject Description</th>
                <th style="width: 15%">Status</th>
                <th style="width: 25%">Planned Term</th>
              </tr>
            </thead>
            <tbody>
    `;

    group.subjects.forEach((subject) => {
      const hasExistingData =
        subject.planned_term && subject.planned_term.trim() !== "";
      const isLocked = hasExistingData;
      const statusHtml = hasExistingData
        ? '<span class="badge text-bg-secondary">Saved</span>'
        : "Remaining";

      tableHtml += `
        <tr data-id="${subject.id}">
          <td>${escapeHtml(subject.subj_no)}</td>
          <td>${escapeHtml(subject.subj_desc)}</td>
          <td>${statusHtml}</td>
          <td>
            <select class="form-select form-select-sm planned-term" ${
              isLocked ? "disabled" : ""
            }>
              ${buildPlannedTermOptions(subject.planned_term)}
            </select>
          </td>
        </tr>
      `;
    });

    tableHtml += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    $curriculumContainer.append(tableHtml);
  });
}

function renderHkNstpTable(records) {
  const $tbody = $("#hk-nstp-table tbody");
  $tbody.empty();

  if ($("#hk-course-list").length === 0) {
    $("body").append(
      `<datalist id="hk-course-list">${buildHkTypeOptions()}</datalist>`
    );
  }

  const grouped = {};
  HK_NSTP_REQUIREMENTS.forEach(
    (req) =>
      (grouped[req.code] = records.filter((row) =>
        String(row.subj_no || "")
          .toUpperCase()
          .trim()
          .includes(req.code)
      ))
  );

  let hasRows = false;
  HK_NSTP_REQUIREMENTS.forEach((req) => {
    const existingRows = grouped[req.code] || [];
    existingRows.forEach((row) => {
      hasRows = true;
      $tbody.append(`
        <tr><td>${escapeHtml(req.code)}</td><td>${escapeHtml(
        row.subj_desc || row.subj_no
      )}</td><td>${getStatusBadge(row)}</td><td>${escapeHtml(
        getDisplaySemester(row)
      )}</td></tr>
      `);
    });

    const reqPlaceholders = currentPlaceholders.filter(
      (p) => p.subj_no === req.code
    );
    const missingCount = Math.max(req.required - existingRows.length, 0);

    for (let i = 0; i < missingCount; i++) {
      const ph = reqPlaceholders[i];
      if (!ph) continue;
      hasRows = true;
      $tbody.append(`
        <tr class="table-light hk-nstp-missing-row" data-id="${
          ph.id
        }" data-requirement="${escapeHtml(req.code)}" data-needs-type="${
        req.needsType ? "1" : "0"
      }">
          <td>${escapeHtml(req.code)}</td>
          <td>
            ${
              req.needsType
                ? `<input type="text" list="hk-course-list" class="form-control form-control-sm hk-type-input" placeholder="Select HK Activity" onclick="try{this.showPicker()}catch(e){}" onfocus="try{this.showPicker()}catch(e){}">`
                : `<span class="text-muted">To be completed</span>`
            }
          </td>
          <td>Remaining</td>
          <td><select class="form-select form-select-sm hk-semester-input">${buildPlannedTermOptions(
            ""
          )}</select></td>
        </tr>
      `);
    }
  });

  if (!hasRows)
    $tbody.append(
      `<tr><td colspan="4" class="text-center text-muted py-4">No HK/NSTP records found.</td></tr>`
    );
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

  const electiveRows = records.filter((row) =>
    ELECTIVE_GE_SUBJECTS.includes(getGeRequirementMatch(row.subj_no))
  );

  let hasRows = false;

  // Render Required GEs
  REQUIRED_GE_REQUIREMENTS.forEach((req) => {
    const existingRows = groupedRequired[req.code] || [];
    existingRows.forEach((row) => {
      hasRows = true;
      $tbody.append(`
        <tr><td>Required GE</td><td>${escapeHtml(
          req.code
        )}</td><td>${escapeHtml(
        row.subj_desc || row.subj_no
      )}</td><td>${getStatusBadge(row)}</td><td>${escapeHtml(
        getDisplaySemester(row)
      )}</td></tr>
      `);
    });

    // Find placeholders for this specific Required GE
    const reqPlaceholders = currentPlaceholders.filter((p) => {
      if (req.code === "KAS 1 / HIST 1")
        return p.subj_no === "KAS 1" || p.subj_no === "HIST 1";
      return p.subj_no === req.code;
    });

    const missingCount = Math.max(req.required - existingRows.length, 0);
    for (let i = 0; i < missingCount; i++) {
      const ph = reqPlaceholders[i];
      if (!ph) continue;
      hasRows = true;
      $tbody.append(`
        <tr class="table-light ge-missing-row" data-ge-type="required" data-id="${
          ph.id
        }" data-subj="${escapeHtml(ph.subj_no)}">
          <td>Required GE</td>
          <td>${escapeHtml(ph.subj_no)}</td>
          <td><span class="text-muted">To be completed</span></td>
          <td>Remaining</td>
          <td><select class="form-select form-select-sm ge-semester-input">${buildPlannedTermOptions(
            ""
          )}</select></td>
        </tr>
      `);
    }
  });

  // Render Elective GEs
  electiveRows.forEach((row) => {
    hasRows = true;
    $tbody.append(`
      <tr><td>Elective GE</td><td>${escapeHtml(
        getGeRequirementMatch(row.subj_no) || row.subj_no
      )}</td><td>${escapeHtml(
      row.subj_desc || row.subj_no
    )}</td><td>${getStatusBadge(row)}</td><td>${escapeHtml(
      getDisplaySemester(row)
    )}</td></tr>
    `);
  });

  const electivePlaceholders = currentPlaceholders.filter(
    (p) => p.subj_no === "GE" || p.category_label === "GE Elective"
  );
  const missingElectives = Math.max(3 - electiveRows.length, 0);

  for (let i = 0; i < missingElectives; i++) {
    const ph = electivePlaceholders[i];
    if (!ph) continue;
    hasRows = true;
    $tbody.append(`
      <tr class="table-light ge-missing-row" data-ge-type="elective" data-id="${
        ph.id
      }">
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
        <td><select class="form-select form-select-sm ge-semester-input">${buildPlannedTermOptions(
          ""
        )}</select></td>
      </tr>
    `);
  }

  if (!hasRows)
    $tbody.append(
      `<tr><td colspan="5" class="text-center text-muted py-4">No GE records found.</td></tr>`
    );
}

function showPortalMessage(type, message) {
  const $msg = $("#save-message");
  $msg
    .removeClass("d-none alert-success alert-danger alert-warning")
    .addClass(`alert-${type}`)
    .text(message);
}

// NEW: Fetch unused placeholders for the UI binding
async function getUnusedPlaceholders(studentNo) {
  const { data, error } = await supabaseClient
    .from("subjects_status")
    .select("id, subj_no, category_label, sequence, level")
    .eq("stu_no", studentNo)
    .is("grade", null)
    .eq("currently_enrolled", false)
    .is("planned_term", null);

  if (error) {
    console.error("Placeholder lookup error:", error);
    return [];
  }
  return data || [];
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

    // <--- NEW: Fetch placeholders before rendering tables
    currentPlaceholders = await getUnusedPlaceholders(student.student_no);

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

  // 1a. Gather Remaining Subjects updates (Top Table - Updates existing IDs)
  $("#subjects-table tbody tr[data-id]").each(function () {
    const $select = $(this).find(".planned-term");
    if (!$select.prop("disabled") && $select.val()) {
      updates.push(
        supabaseClient
          .from("subjects_status")
          .update({
            planned_term: $select.val(),
          })
          .eq("id", Number($(this).attr("data-id")))
      );
    }
  });

  // 1b. SPCL Updates (Updating the placeholder row)
  $(".spcl-missing-row").each(function () {
    const id = $(this).data("id");
    const subjectCode = $(this).find(".spcl-subject-input").val().trim();
    const term = $(this).find(".spcl-semester-input").val();

    // Only update if they selected both a subject and a term
    if (id && subjectCode && term) {
      const courseData = spclSubjectsData.find(
        (course) => course["Subject No"] === subjectCode
      );
      updates.push(
        supabaseClient
          .from("subjects_status")
          .update({
            subj_no: subjectCode,
            planned_term: term,
            subj_desc: courseData
              ? courseData["Description"]
              : "Specialization Course",
            units: courseData ? courseData["Units"] : null,
            acad_units: courseData ? courseData["Units"] : null,
            category:
              courseData && courseData["category"]
                ? courseData["category"]
                : "SPCL",
            category_label: courseData
              ? courseData["category_label"]
              : "Specialized",
            acad_org: courseData ? courseData["acad_org"] : null,
            acad_group: courseData ? courseData["acad_group"] : null,
          })
          .eq("id", id)
      );
    }
  });

  // 1c. GE Updates (Updating the placeholder row)
  $(".ge-missing-row").each(function () {
    const id = $(this).data("id");
    const type = $(this).data("ge-type");
    const subject =
      type === "required"
        ? $(this).data("subj")
        : $(this).find(".ge-elective-input").val();
    const term = $(this).find(".ge-semester-input").val();

    if (id && subject && term) {
      updates.push(
        supabaseClient
          .from("subjects_status")
          .update({
            subj_no: subject,
            planned_term: term,
            subj_desc: type === "elective" ? "GE Elective" : null,
          })
          .eq("id", id)
      );
    }
  });

  // 1d. Gather HK/NSTP Updates (Updating the placeholder row)
  $(".hk-nstp-missing-row").each(function () {
    const id = $(this).data("id");
    const requirement = $(this).data("requirement");
    const needsType = $(this).data("needs-type") == "1";
    const hkType = needsType ? $(this).find(".hk-type-input").val() : null;
    const term = $(this).find(".hk-semester-input").val();

    if (id && term && (!needsType || (needsType && hkType))) {
      // Base data to update
      const updateData = {
        subj_no: requirement,
        planned_term: term,
      };

      // Only overwrite the description if they picked a specific HK activity
      if (hkType) {
        updateData.subj_desc = hkType;
      }

      updates.push(
        supabaseClient.from("subjects_status").update(updateData).eq("id", id)
      );
    }
  });

  // 2. Gather student concerns (safely handling optional input)
  const $concernsInput = $("#student-concerns");
  const studentConcerns = $concernsInput.length
    ? ($concernsInput.val() || "").trim()
    : "";

  if (studentConcerns !== "") {
    updates.push(
      supabaseClient.from("portal_concerns").insert({
        student_no: currentStudent.student_no,
        email: currentStudent.email,
        concern_text: studentConcerns,
      })
    );
  }

  console.log("Total items ready to save:", updates.length);

  if (updates.length === 0) {
    // Hide modal if nothing to save so they can see the warning on the main page
    const modalEl = document.getElementById("confirmSaveModal");
    if (modalEl) bootstrap.Modal.getInstance(modalEl).hide();

    showPortalMessage(
      "warning",
      "Please select at least one planned term or enter a concern before saving."
    );
    return;
  }

  // --- NEW: MODAL "SAVING" STATE ---
  const $modalBody = $("#confirmSaveModal .modal-body");
  const $modalFooter = $("#confirmSaveModal .modal-footer");

  // Hide the footer buttons so the user can't click anything else
  $modalFooter.hide();

  // Show a saving spinner inside the modal
  $modalBody.html(`
    <div class="text-center py-4">
      <div class="spinner-border text-dark mb-3" role="status"></div>
      <h5 class="fw-semibold">Saving your responses...</h5>
      <p class="text-muted small">Please do not close this window.</p>
    </div>
  `);

  try {
    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);

    if (failed) {
      throw failed.error; // Send to catch block
    }

    // --- SUCCESS & MODAL COUNTDOWN LOGIC ---
    let secondsLeft = 5;
    $modalBody.html(`
      <div class="text-center py-4">
        <h4 class="text-success fw-bold mb-3">Saved Successfully!</h4>
        <p class="mb-1">Your responses have been locked.</p>
        <p class="text-muted small">You will be logged out in <span id="logout-timer" class="fw-bold fs-5">${secondsLeft}</span> seconds...</p>
      </div>
    `);

    // Clear the concerns box safely in the background
    const $concernsInput = $("#student-concerns");
    if ($concernsInput.length) {
      $concernsInput.val("");
    }

    // Start countdown
    const timerInterval = setInterval(() => {
      secondsLeft--;
      $("#logout-timer").text(secondsLeft);
      if (secondsLeft <= 0) {
        clearInterval(timerInterval);

        // Hide modal backdrop properly before redirecting
        const modalEl = document.getElementById("confirmSaveModal");
        if (modalEl) bootstrap.Modal.getInstance(modalEl).hide();

        logoutUser();
      }
    }, 1000);
  } catch (error) {
    console.error("Save JS error:", error);

    // Revert modal to error state and show footer again so they can close it
    $modalBody.html(`
      <div class="py-4 text-center">
        <h5 class="fw-bold text-danger">Error Saving Data</h5>
        <p class="mb-0">Something went wrong. Please check your connection and try again.</p>
      </div>
    `);
    $modalFooter.show();
    $("#confirm-save-btn").text("Try Again");

    showPortalMessage("danger", "Failed to save your data.");
  }
}

function logoutUser() {
  loggedInUser = null;
  currentStudent = null;
  currentSubjects = [];
  currentPassedHkNstp = [];
  currentPassedGe = [];
  sessionStorage.removeItem("student_portal_user");
  window.location.href = "index.html";
  currentPassedSpcl = [];
}

$(document).ready(async function () {
  // Load SPCL JSON before initializing portal
  await loadSpclCourses();
  await loadHKActivities();

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

    // Change this to open the modal instead of saving directly
    $("#save-plan-btn").on("click", function () {
      const confirmModal = new bootstrap.Modal(
        document.getElementById("confirmSaveModal")
      );
      confirmModal.show();
    });

    // Add this to do the actual saving when "Yes, Submit" is clicked
    $("#confirm-save-btn").on("click", async function () {
      // Hide the modal
      // const modalEl = document.getElementById("confirmSaveModal");
      // const modalInstance = bootstrap.Modal.getInstance(modalEl);
      // modalInstance.hide();

      // Run the save function
      await savePlannedTerms();
    });
  }

  if (path.includes("login.html") || path.endsWith("/")) {
    const storedUser = getStoredUser();

    if (storedUser && storedUser.email) {
      window.location.href = "portal.html";
    }
  }

  // Auto-fill SPCL Description when a subject is selected
  $(document).on("input", ".spcl-subject-input", function () {
    const selectedSubjNo = $(this).val().trim();
    const $row = $(this).closest("tr");
    const $descCell = $row.find(".spcl-description-cell");

    // Find the matching subject from the JSON data we loaded earlier
    const matchedSubject = spclSubjectsData.find(
      (course) => course["Subject No"] === selectedSubjNo
    );

    if (matchedSubject && matchedSubject["Description"]) {
      // Show the actual description
      $descCell.text(matchedSubject["Description"]);
    } else {
      // Revert to default if input is cleared or invalid
      $descCell.html('<span class="text-muted">To be completed</span>');
    }
  });
});
