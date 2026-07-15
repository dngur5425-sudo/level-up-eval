import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const evaluatorId = sessionStorage.getItem("evaluator_id");
if (!evaluatorId) {
  window.location.href = "./login.html";
}

const statusElement = document.getElementById("status");
const roundNameElement = document.getElementById("roundName");
const groupNameElement = document.getElementById("groupName");
const participantNameElement = document.getElementById("participantName");
const participantOrderElement = document.getElementById("participantOrder");
const progressTextElement = document.getElementById("progressText");
const criteriaContainer = document.getElementById("criteriaContainer");
const memoInput = document.getElementById("memoInput");
const totalScoreElement = document.getElementById("totalScore");
const submissionStateElement = document.getElementById("submissionState");
const formMessageElement = document.getElementById("formMessage");
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
const submitButton = document.getElementById("submitButton");

let activeRound = null;
let criteriaItems = [];
let participantQueue = [];
let currentParticipantIndex = 0;

function applyRoundLockState() {
  if (activeRound?.is_locked === true) {
    statusElement.textContent = "채점이 마감되었습니다";
    setInputsDisabled(true);
    return true;
  }
  return false;
}

function setFormMessage(text, type = "") {
  formMessageElement.textContent = text;
  formMessageElement.className = type ? `form-message ${type}` : "form-message";
}

function setSubmissionState(text, type = "") {
  submissionStateElement.textContent = text;
  submissionStateElement.className = type ? `form-message ${type}` : "form-message";
}

function scoreDocId(evaluator, participant, criteria) {
  return `${evaluator}_${participant}_${criteria}`;
}

function noteDocId(evaluator, participant, round) {
  return `${evaluator}_${participant}_${round}`;
}

function updateTotalScore() {
  const sliders = criteriaContainer.querySelectorAll("input[type='range']");
  const total = Array.from(sliders).reduce((sum, slider) => sum + Number(slider.value), 0);
  totalScoreElement.textContent = `합계: ${total}점`;
}

function setInputsDisabled(disabled) {
  const sliders = criteriaContainer.querySelectorAll("input[type='range']");
  sliders.forEach((slider) => {
    slider.disabled = disabled;
  });
  memoInput.disabled = disabled;
  submitButton.disabled = disabled;
}

function renderCriteriaSliders() {
  criteriaContainer.innerHTML = "";
  criteriaItems.forEach((item) => {
    const block = document.createElement("div");
    block.className = "criteria-item";

    const title = document.createElement("div");
    title.className = "criteria-title";
    title.textContent = `${item.name} (최대 ${item.max_score}점)`;

    const valueText = document.createElement("div");
    valueText.className = "criteria-value";
    valueText.id = `criteria-value-${item.id}`;
    valueText.textContent = "0점";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = String(item.max_score);
    slider.value = "0";
    slider.dataset.criteriaId = item.id;
    slider.className = "criteria-slider";
    slider.addEventListener("input", () => {
      valueText.textContent = `${slider.value}점`;
      updateTotalScore();
    });

    block.appendChild(title);
    block.appendChild(valueText);
    block.appendChild(slider);
    criteriaContainer.appendChild(block);
  });

  updateTotalScore();
}

function updateNavigationButtons() {
  prevButton.disabled = currentParticipantIndex <= 0;
  nextButton.disabled = currentParticipantIndex >= participantQueue.length - 1;
}

function isPreliminaryRound(roundName) {
  return String(roundName ?? "").trim() === "예선";
}

function bindRoundRealtime() {
  const roundRef = doc(db, "rounds", activeRound.id);

  onSnapshot(roundRef, (snapshot) => {
    if (!snapshot.exists()) {
      return;
    }

    activeRound = { id: snapshot.id, ...snapshot.data() };
    roundNameElement.textContent = activeRound.name;

    if (applyRoundLockState()) {
      return;
    }

    if (participantQueue.length > 0) {
      statusElement.textContent = "평가를 입력하고 제출하세요.";
      setInputsDisabled(false);
    }
  });
}

async function loadCurrentParticipantValues() {
  const current = participantQueue[currentParticipantIndex];
  if (!current) {
    return;
  }

  participantNameElement.textContent = current.participant.name;
  participantOrderElement.textContent = String(current.participant.order);
  groupNameElement.textContent = current.group.name;
  progressTextElement.textContent = `${currentParticipantIndex + 1} / ${participantQueue.length}`;

  const scoreDocs = await Promise.all(
    criteriaItems.map(async (item) => {
      const reference = doc(db, "scores", scoreDocId(evaluatorId, current.participant.id, item.id));
      const snapshot = await getDoc(reference);
      return { itemId: item.id, snapshot };
    })
  );

  let hasSubmitted = false;
  scoreDocs.forEach(({ itemId, snapshot }) => {
    const slider = criteriaContainer.querySelector(`input[data-criteria-id='${itemId}']`);
    const valueText = document.getElementById(`criteria-value-${itemId}`);
    if (!slider || !valueText) {
      return;
    }

    if (snapshot.exists()) {
      const data = snapshot.data();
      slider.value = String(data.score ?? 0);
      valueText.textContent = `${slider.value}점`;
      hasSubmitted = true;
    } else {
      slider.value = "0";
      valueText.textContent = "0점";
    }
  });

  const noteRef = doc(db, "notes", noteDocId(evaluatorId, current.participant.id, activeRound.id));
  const noteSnap = await getDoc(noteRef);
  memoInput.value = noteSnap.exists() ? noteSnap.data().memo ?? "" : "";

  updateTotalScore();

  if (hasSubmitted) {
    submitButton.textContent = "수정하기";
    setSubmissionState("제출됨", "success");
  } else {
    submitButton.textContent = "제출하기";
    setSubmissionState("미제출", "");
  }

  if (!applyRoundLockState()) {
    statusElement.textContent = "평가를 입력하고 제출하세요.";
    setInputsDisabled(false);
  }
}

async function buildParticipantQueue(roundId, roundName) {
  const groupsQuery = query(collection(db, "groups"), where("round_id", "==", roundId));
  const groupsSnapshot = await getDocs(groupsQuery);

  let groups = groupsSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((left, right) => left.name.localeCompare(right.name, "ko"));

  if (isPreliminaryRound(roundName)) {
    const assignmentsQuery = query(
      collection(db, "assignments"),
      where("evaluator_id", "==", evaluatorId),
      where("round_id", "==", roundId)
    );
    const assignmentsSnapshot = await getDocs(assignmentsQuery);
    const assignedGroupIds = new Set(
      assignmentsSnapshot.docs
        .map((document) => document.data().group_id)
        .filter((groupId) => Boolean(groupId))
    );

    if (assignedGroupIds.size === 0) {
      return { queue: [], noAssignedGroups: true };
    }

    groups = groups.filter((group) => assignedGroupIds.has(group.id));

    if (groups.length === 0) {
      return { queue: [], noAssignedGroups: true };
    }
  }

  const queue = [];

  for (const group of groups) {
    const participantsQuery = query(
      collection(db, "participants"),
      where("group_id", "==", group.id)
    );
    const participantsSnapshot = await getDocs(participantsQuery);
    const participants = participantsSnapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .sort((left, right) => Number(left.order) - Number(right.order));

    participants.forEach((participant) => {
      queue.push({ group, participant });
    });
  }

  return { queue, noAssignedGroups: false };
}

async function loadInitialData() {
  const roundQuery = query(
    collection(db, "rounds"),
    where("status", "==", "진행중"),
    limit(1)
  );
  const roundSnapshot = await getDocs(roundQuery);

  if (roundSnapshot.empty) {
    statusElement.textContent = "진행중인 라운드가 없습니다.";
    setInputsDisabled(true);
    prevButton.disabled = true;
    nextButton.disabled = true;
    return;
  }

  const roundDoc = roundSnapshot.docs[0];
  activeRound = { id: roundDoc.id, ...roundDoc.data() };
  roundNameElement.textContent = activeRound.name;
  bindRoundRealtime();

  const criteriaQuery = query(
    collection(db, "criteriaItems"),
    where("round_id", "==", activeRound.id)
  );
  const criteriaSnapshot = await getDocs(criteriaQuery);
  criteriaItems = criteriaSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((left, right) => left.name.localeCompare(right.name, "ko"));

  if (criteriaItems.length === 0) {
    statusElement.textContent = "현재 라운드에 등록된 평가 항목이 없습니다.";
    setInputsDisabled(true);
    prevButton.disabled = true;
    nextButton.disabled = true;
    return;
  }

  renderCriteriaSliders();

  const { queue, noAssignedGroups } = await buildParticipantQueue(activeRound.id, activeRound.name);
  participantQueue = queue;

  if (noAssignedGroups) {
    const noAssignmentMessage = "배정된 조가 없습니다. 관리자에게 문의하세요";
    if (!applyRoundLockState()) {
      statusElement.textContent = noAssignmentMessage;
    }
    setFormMessage(noAssignmentMessage, "error");
    setSubmissionState("", "");
    setInputsDisabled(true);
    prevButton.disabled = true;
    nextButton.disabled = true;
    groupNameElement.textContent = "-";
    participantNameElement.textContent = "-";
    participantOrderElement.textContent = "-";
    progressTextElement.textContent = "-";
    return;
  }

  if (participantQueue.length === 0) {
    if (!applyRoundLockState()) {
      statusElement.textContent = "현재 라운드에 등록된 참가자가 없습니다.";
    }
    setInputsDisabled(true);
    prevButton.disabled = true;
    nextButton.disabled = true;
    return;
  }

  currentParticipantIndex = 0;
  updateNavigationButtons();
  await loadCurrentParticipantValues();
}

async function saveCurrentParticipant() {
  if (!activeRound || activeRound.is_locked === true) {
    setFormMessage("채점이 마감되어 저장할 수 없습니다.", "error");
    return;
  }

  const current = participantQueue[currentParticipantIndex];
  if (!current) {
    return;
  }

  const sliderElements = criteriaContainer.querySelectorAll("input[type='range']");

  try {
    submitButton.disabled = true;
    setFormMessage("저장 중...", "");

    let hasExistingScore = false;
    for (const slider of sliderElements) {
      const criteriaId = slider.dataset.criteriaId;
      const scoreValue = Number(slider.value);
      const scoreRef = doc(db, "scores", scoreDocId(evaluatorId, current.participant.id, criteriaId));
      const scoreSnap = await getDoc(scoreRef);

      if (scoreSnap.exists()) {
        hasExistingScore = true;
        await setDoc(
          scoreRef,
          {
            evaluator_id: evaluatorId,
            participant_id: current.participant.id,
            criteria_item_id: criteriaId,
            round_id: activeRound.id,
            score: scoreValue,
            status: "수정됨",
            updated_at: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        await setDoc(
          scoreRef,
          {
            evaluator_id: evaluatorId,
            participant_id: current.participant.id,
            criteria_item_id: criteriaId,
            round_id: activeRound.id,
            score: scoreValue,
            status: "제출됨",
            submitted_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    const noteRef = doc(db, "notes", noteDocId(evaluatorId, current.participant.id, activeRound.id));
    await setDoc(
      noteRef,
      {
        evaluator_id: evaluatorId,
        participant_id: current.participant.id,
        round_id: activeRound.id,
        memo: memoInput.value.trim(),
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );

    if (hasExistingScore) {
      submitButton.textContent = "수정하기";
      setSubmissionState("제출됨 (최근 수정됨)", "success");
      setFormMessage("점수를 수정 저장했습니다.", "success");
    } else {
      submitButton.textContent = "수정하기";
      setSubmissionState("제출됨", "success");
      setFormMessage("점수를 제출했습니다.", "success");
    }
  } catch (error) {
    setFormMessage(`저장 실패: ${error.message}`, "error");
  } finally {
    submitButton.disabled = activeRound.is_locked === true;
  }
}

prevButton.addEventListener("click", async () => {
  if (currentParticipantIndex <= 0) {
    return;
  }
  currentParticipantIndex -= 1;
  updateNavigationButtons();
  setFormMessage("");
  await loadCurrentParticipantValues();
});

nextButton.addEventListener("click", async () => {
  if (currentParticipantIndex >= participantQueue.length - 1) {
    return;
  }
  currentParticipantIndex += 1;
  updateNavigationButtons();
  setFormMessage("");
  await loadCurrentParticipantValues();
});

submitButton.addEventListener("click", async () => {
  await saveCurrentParticipant();
});

loadInitialData().catch((error) => {
  statusElement.textContent = `초기화 실패: ${error.message}`;
  setFormMessage("데이터를 불러오지 못했습니다.", "error");
  setInputsDisabled(true);
  prevButton.disabled = true;
  nextButton.disabled = true;
});