import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

if (sessionStorage.getItem("login_role") !== "admin") {
  window.location.href = "./login.html";
}

const statusElement = document.getElementById("status");
const currentRoundNameElement = document.getElementById("currentRoundName");
const lockToggleButton = document.getElementById("lockToggleButton");
const logoutButton = document.getElementById("logoutButton");
const groupTabsElement = document.getElementById("groupTabs");
const selectedGroupTitleElement = document.getElementById("selectedGroupTitle");
const resultTableHeadElement = document.getElementById("resultTableHead");
const resultTableBodyElement = document.getElementById("resultTableBody");
const tableMessageElement = document.getElementById("tableMessage");

let activeRound = null;
let criteriaItems = [];
let evaluators = [];
let groups = [];
let selectedGroupId = "";
let participantsByGroup = new Map();
let allScores = [];
let assignedEvaluatorsByGroup = new Map();

function isPreliminaryRound() {
  return String(activeRound?.name ?? "").trim() === "예선";
}

function setTableMessage(text, type = "") {
  tableMessageElement.textContent = text;
  tableMessageElement.className = type ? `form-message ${type}` : "form-message";
}

function updateLockToggleButton() {
  if (!activeRound) {
    lockToggleButton.textContent = "채점 마감";
    lockToggleButton.disabled = true;
    return;
  }

  lockToggleButton.disabled = false;
  lockToggleButton.textContent = activeRound.is_locked === true
    ? "마감됨 (다시 열기)"
    : "채점 마감";
}

function renderHead(criteriaNames) {
  const dynamicColumns = criteriaNames.map((name) => `<th>${name}</th>`).join("");
  resultTableHeadElement.innerHTML = `
    <tr>
      <th>순위</th>
      <th>이름</th>
      ${dynamicColumns}
      <th>합계</th>
      <th>제출 현황</th>
    </tr>
  `;
}

function renderEmptyBody(text) {
  resultTableBodyElement.innerHTML = `
    <tr>
      <td colspan="99" class="table-empty">${text}</td>
    </tr>
  `;
}

function createGroupTabs() {
  groupTabsElement.innerHTML = "";

  groups.forEach((group) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-button ${group.id === selectedGroupId ? "active" : ""}`;
    button.textContent = group.name;
    button.addEventListener("click", () => {
      selectedGroupId = group.id;
      createGroupTabs();
      renderTable();
    });
    groupTabsElement.appendChild(button);
  });
}

function buildSubmissionSet(participantId, allowedEvaluatorIds = null) {
  const criteriaCount = criteriaItems.length;
  const perEvaluatorCriteriaMap = new Map();

  allScores
    .filter((score) => score.participant_id === participantId)
    .forEach((score) => {
      const evaluatorId = score.evaluator_id;
      if (allowedEvaluatorIds && !allowedEvaluatorIds.has(evaluatorId)) {
        return;
      }
      if (!perEvaluatorCriteriaMap.has(evaluatorId)) {
        perEvaluatorCriteriaMap.set(evaluatorId, new Set());
      }
      perEvaluatorCriteriaMap.get(evaluatorId).add(score.criteria_item_id);
    });

  const submittedEvaluatorIds = new Set();
  perEvaluatorCriteriaMap.forEach((criteriaSet, evaluatorId) => {
    if (criteriaSet.size >= criteriaCount && criteriaCount > 0) {
      submittedEvaluatorIds.add(evaluatorId);
    }
  });

  return submittedEvaluatorIds;
}

function aggregateParticipantRows(participants, groupId) {
  const assignedEvaluatorIds = assignedEvaluatorsByGroup.get(groupId) ?? new Set();
  const denominator = isPreliminaryRound()
    ? assignedEvaluatorIds.size
    : evaluators.length;

  return participants.map((participant) => {
    const participantScores = allScores.filter((score) => score.participant_id === participant.id);

    const criteriaTotals = criteriaItems.map((criteria) => {
      return participantScores
        .filter((score) => score.criteria_item_id === criteria.id)
        .reduce((sum, score) => sum + Number(score.score ?? 0), 0);
    });

    const total = criteriaTotals.reduce((sum, value) => sum + value, 0);
    const submittedEvaluatorIds = isPreliminaryRound()
      ? buildSubmissionSet(participant.id, assignedEvaluatorIds)
      : buildSubmissionSet(participant.id);
    const submissionText = `${submittedEvaluatorIds.size}명 중 ${denominator}명 제출`;

    return {
      participant,
      criteriaTotals,
      total,
      submissionText,
    };
  });
}

function renderTable() {
  const currentGroup = groups.find((group) => group.id === selectedGroupId);

  if (!currentGroup) {
    selectedGroupTitleElement.textContent = "조 결과";
    renderHead(criteriaItems.map((item) => item.name));
    renderEmptyBody("표시할 조가 없습니다.");
    setTableMessage("라운드에 조를 등록해주세요.");
    return;
  }

  selectedGroupTitleElement.textContent = `${currentGroup.name} 결과`;
  renderHead(criteriaItems.map((item) => item.name));

  const participants = participantsByGroup.get(currentGroup.id) ?? [];
  if (participants.length === 0) {
    renderEmptyBody("해당 조에 등록된 참가자가 없습니다.");
    setTableMessage("참가자를 등록하면 결과가 표시됩니다.");
    return;
  }

  const rows = aggregateParticipantRows(participants, currentGroup.id)
    .sort((left, right) => right.total - left.total);

  resultTableBodyElement.innerHTML = rows
    .map((row, index) => {
      const criteriaCells = row.criteriaTotals.map((value) => `<td>${value}</td>`).join("");
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${row.participant.name}</td>
          ${criteriaCells}
          <td><strong>${row.total}</strong></td>
          <td>${row.submissionText}</td>
        </tr>
      `;
    })
    .join("");

  setTableMessage("scores 실시간 변경을 반영 중입니다.", "success");
}

async function loadCurrentRound() {
  const roundQuery = query(
    collection(db, "rounds"),
    where("status", "==", "진행중"),
    limit(1)
  );
  const roundSnapshot = await getDocs(roundQuery);

  if (roundSnapshot.empty) {
    statusElement.textContent = "진행중인 라운드가 없습니다.";
    renderHead([]);
    renderEmptyBody("진행중인 라운드를 설정해주세요.");
    setTableMessage("rounds 컬렉션에서 status를 '진행중'으로 설정하세요.", "error");
    return false;
  }

  const roundDoc = roundSnapshot.docs[0];
  activeRound = { id: roundDoc.id, ...roundDoc.data() };
  currentRoundNameElement.textContent = activeRound.name;
  statusElement.textContent = "실시간 채점 현황을 표시합니다.";
  updateLockToggleButton();
  return true;
}

async function loadStaticData() {
  const criteriaQuery = query(
    collection(db, "criteriaItems"),
    where("round_id", "==", activeRound.id)
  );
  const evaluatorsQuery = collection(db, "evaluators");
  const groupsQuery = query(
    collection(db, "groups"),
    where("round_id", "==", activeRound.id)
  );
  const assignmentsQuery = query(
    collection(db, "assignments"),
    where("round_id", "==", activeRound.id)
  );

  const [criteriaSnapshot, evaluatorsSnapshot, groupsSnapshot, assignmentsSnapshot] = await Promise.all([
    getDocs(criteriaQuery),
    getDocs(evaluatorsQuery),
    getDocs(groupsQuery),
    getDocs(assignmentsQuery),
  ]);

  criteriaItems = criteriaSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((left, right) => left.name.localeCompare(right.name, "ko"));

  evaluators = evaluatorsSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }));

  groups = groupsSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((left, right) => left.name.localeCompare(right.name, "ko"));

  assignedEvaluatorsByGroup = new Map();
  assignmentsSnapshot.docs.forEach((document) => {
    const assignment = document.data();
    const groupId = assignment.group_id;
    const evaluatorId = assignment.evaluator_id;

    if (!groupId || !evaluatorId) {
      return;
    }

    if (!assignedEvaluatorsByGroup.has(groupId)) {
      assignedEvaluatorsByGroup.set(groupId, new Set());
    }
    assignedEvaluatorsByGroup.get(groupId).add(evaluatorId);
  });

  participantsByGroup = new Map();
  await Promise.all(
    groups.map(async (group) => {
      const participantsQuery = query(
        collection(db, "participants"),
        where("group_id", "==", group.id)
      );
      const participantsSnapshot = await getDocs(participantsQuery);
      const participants = participantsSnapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .sort((left, right) => Number(left.order) - Number(right.order));
      participantsByGroup.set(group.id, participants);
    })
  );

  selectedGroupId = groups[0]?.id ?? "";
  createGroupTabs();
  renderTable();
}

function bindScoresRealtime() {
  const scoresQuery = query(
    collection(db, "scores"),
    where("round_id", "==", activeRound.id)
  );

  onSnapshot(scoresQuery, (snapshot) => {
    allScores = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    renderTable();
  });
}

function bindRoundRealtime() {
  const roundRef = doc(db, "rounds", activeRound.id);

  onSnapshot(roundRef, (snapshot) => {
    if (!snapshot.exists()) {
      return;
    }

    activeRound = { id: snapshot.id, ...snapshot.data() };
    currentRoundNameElement.textContent = activeRound.name;
    updateLockToggleButton();
  });
}

async function init() {
  const hasRound = await loadCurrentRound();
  if (!hasRound) {
    return;
  }

  await loadStaticData();

  if (criteriaItems.length === 0) {
    setTableMessage("현재 라운드에 평가 항목이 없어 항목별 점수를 표시할 수 없습니다.", "error");
  }

  bindScoresRealtime();
  bindRoundRealtime();
}

lockToggleButton.addEventListener("click", async () => {
  if (!activeRound) {
    return;
  }

  const nextLocked = activeRound.is_locked !== true;

  try {
    lockToggleButton.disabled = true;
    await updateDoc(doc(db, "rounds", activeRound.id), {
      is_locked: nextLocked,
    });
  } catch (error) {
    setTableMessage(`채점 마감 상태 변경 실패: ${error.message}`, "error");
  } finally {
    lockToggleButton.disabled = false;
  }
});

logoutButton.addEventListener("click", () => {
  sessionStorage.clear();
  window.location.href = "./login.html";
});

init().catch((error) => {
  statusElement.textContent = `대시보드 로드 실패: ${error.message}`;
  renderHead([]);
  renderEmptyBody("데이터 로드에 실패했습니다.");
  setTableMessage("Firestore 연결 및 데이터 구조를 확인해주세요.", "error");
});