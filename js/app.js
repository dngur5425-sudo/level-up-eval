import { db } from "./firebase-config.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const statusElement = document.getElementById("status");
const nameInput = document.getElementById("nameInput");
const employeeIdInput = document.getElementById("employeeIdInput");
const addEvaluatorButton = document.getElementById("addEvaluatorButton");
const resultMessage = document.getElementById("resultMessage");

if (db) {
  statusElement.textContent = "Firestore가 정상적으로 초기화되었습니다.";
} else {
  statusElement.textContent = "Firestore 초기화에 실패했습니다.";
}

async function addEvaluator(name, employeeId) {
  const evaluatorsRef = collection(db, "evaluators");
  const docRef = await addDoc(evaluatorsRef, {
    name,
    employee_id: employeeId,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

addEvaluatorButton.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const employeeId = employeeIdInput.value.trim();

  if (!name || !employeeId) {
    resultMessage.textContent = "이름과 사번을 모두 입력해주세요.";
    resultMessage.className = "error";
    return;
  }

  try {
    addEvaluatorButton.disabled = true;
    resultMessage.textContent = "Firestore에 저장 중...";
    resultMessage.className = "pending";

    const docId = await addEvaluator(name, employeeId);
    resultMessage.textContent = `추가 완료: evaluators/${docId}`;
    resultMessage.className = "success";
  } catch (error) {
    resultMessage.textContent = `추가 실패: ${error.message}`;
    resultMessage.className = "error";
  } finally {
    addEvaluatorButton.disabled = false;
  }
});