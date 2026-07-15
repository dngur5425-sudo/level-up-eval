import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ADMIN_PASSWORD = "admin1234";

const evaluatorTab = document.getElementById("evaluatorTab");
const adminTab = document.getElementById("adminTab");
const evaluatorForm = document.getElementById("evaluatorForm");
const adminForm = document.getElementById("adminForm");
const evaluatorNameInput = document.getElementById("evaluatorName");
const employeeIdInput = document.getElementById("employeeId");
const adminPasswordInput = document.getElementById("adminPassword");
const loginMessage = document.getElementById("loginMessage");

function showEvaluatorTab() {
  evaluatorTab.classList.add("active");
  evaluatorTab.setAttribute("aria-selected", "true");
  adminTab.classList.remove("active");
  adminTab.setAttribute("aria-selected", "false");
  evaluatorForm.classList.remove("hidden");
  adminForm.classList.add("hidden");
  loginMessage.textContent = "";
}

function showAdminTab() {
  adminTab.classList.add("active");
  adminTab.setAttribute("aria-selected", "true");
  evaluatorTab.classList.remove("active");
  evaluatorTab.setAttribute("aria-selected", "false");
  adminForm.classList.remove("hidden");
  evaluatorForm.classList.add("hidden");
  loginMessage.textContent = "";
}

function setMessage(text, type) {
  loginMessage.textContent = text;
  loginMessage.className = type;
}

async function loginEvaluator(name, employeeId) {
  const evaluatorsRef = collection(db, "evaluators");
  const evaluatorQuery = query(
    evaluatorsRef,
    where("name", "==", name),
    where("employee_id", "==", employeeId),
    limit(1)
  );

  const snapshot = await getDocs(evaluatorQuery);
  if (snapshot.empty) {
    throw new Error("이름 또는 사번이 올바르지 않습니다.");
  }

  const evaluatorDoc = snapshot.docs[0];
  sessionStorage.setItem("evaluator_id", evaluatorDoc.id);
  sessionStorage.setItem("login_role", "evaluator");
  return evaluatorDoc.id;
}

evaluatorTab.addEventListener("click", showEvaluatorTab);
adminTab.addEventListener("click", showAdminTab);

evaluatorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = evaluatorNameInput.value.trim();
  const employeeId = employeeIdInput.value.trim();

  if (!name || !employeeId) {
    setMessage("이름과 사번을 모두 입력하세요.", "error");
    return;
  }

  try {
    setMessage("로그인 확인 중...", "pending");
    const evaluatorId = await loginEvaluator(name, employeeId);
    setMessage(`로그인 성공 (evaluator_id: ${evaluatorId})`, "success");
    window.location.href = "./evaluate.html";
  } catch (error) {
    setMessage(error.message, "error");
  }
});

adminForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const password = adminPasswordInput.value;

  if (password !== ADMIN_PASSWORD) {
    setMessage("관리자 비밀번호가 올바르지 않습니다.", "error");
    return;
  }

  sessionStorage.setItem("login_role", "admin");
  sessionStorage.removeItem("evaluator_id");
  setMessage("관리자 로그인 성공", "success");
  window.location.href = "./admin.html";
});

showEvaluatorTab();