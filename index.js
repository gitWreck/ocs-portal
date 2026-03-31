let loggedInUser = null;
let currentStudent = null;
let currentSubjects = [];

/**
 * SUPABASE CONFIG
 */
const SUPABASE_URL = "https://jwoblhsdxuctlybuqzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tEjD0o5RYkwNxgGJmMKK1g_UdKPhpS0";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PASSING_GRADES = [
  "1.00",
  "1.25",
  "1.50",
  "1.75",
  "2.00",
  "2.25",
  "2.50",
  "2.75",
  "3.00",
  "S",
  "P",
];

const PLANNED_TERM_OPTIONS = [
  "",
  "Midyear 2026",
  "1st Sem 2026-2027",
  "2nd Sem 2026-2027",
  "Midyear 2027",
  "1st Sem 2027-2028",
  "2nd Sem 2027-2028",
  "Not sure yet",
];

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

function isPassingGrade(value) {
  return PASSING_GRADES.includes(
    String(value || "")
      .trim()
      .toUpperCase()
  );
}

function getEffectiveGrade(subject) {
  const rGrade = String(subject.r_grade || "")
    .trim()
    .toUpperCase();
  const grade = String(subject.grade || "")
    .trim()
    .toUpperCase();

  if (rGrade !== "") return rGrade;
  return grade;
}

function isSubjectNotPassed(subject) {
  const effectiveGrade = getEffectiveGrade(subject);

  if (effectiveGrade === "") return true;
  return !isPassingGrade(effectiveGrade);
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
  return PLANNED_TERM_OPTIONS.map((option) => {
    const selected = option === String(selectedValue || "") ? "selected" : "";
    const label = option === "" ? "Select term" : option;
    return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(
      label
    )}</option>`;
  }).join("");
}

async function getStudentByEmail(email) {
  const { data, error } = await supabaseClient
    .from("students")
    .select("student_no, lastname, firstname, middlename, fullname, email")
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

function renderSubjects(subjects) {
  const $tbody = $("#subjects-table tbody");
  $tbody.empty();

  if (!subjects.length) {
    $tbody.append(`
      <tr>
        <td colspan="6" class="text-center text-muted">No remaining subjects found.</td>
      </tr>
    `);
    return;
  }

  subjects.forEach((subject) => {
    $tbody.append(`
      <tr data-id="${subject.id}">
        <td>${escapeHtml(subject.subj_no)}</td>
        <td>${escapeHtml(subject.subj_desc)}</td>
        <td>${escapeHtml(subject.grade || "")}</td>
        <td>${escapeHtml(subject.r_grade || "")}</td>
        <td>${escapeHtml(formatEnrolled(subject.currently_enrolled))}</td>
        <td>
          <select class="form-select form-select-sm planned-term">
            ${buildPlannedTermOptions(subject.planned_term)}
          </select>
        </td>
      </tr>
    `);
  });
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

    if (!student) {
      $("#loading-section").addClass("d-none");
      $("#not-found-section").removeClass("d-none");
      return;
    }

    currentStudent = student;

    $("#student-email").text(student.email || "-");
    $("#student-name").text(student.fullname || "-");
    $("#student-no").text(student.student_no || "-");

    const allSubjects = await getSubjectsByStudentNo(student.student_no);
    const remainingSubjects = allSubjects.filter(isSubjectNotPassed);

    currentSubjects = remainingSubjects;
    renderSubjects(remainingSubjects);

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
          .from("student_subject_status")
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

    showPortalMessage("success", "Planned terms saved successfully.");
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
  sessionStorage.removeItem("student_portal_user");
  window.location.href = "login.html";
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
