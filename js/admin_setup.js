import { db } from "./firebase-config.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const roundForm = document.getElementById("roundForm");
const groupForm = document.getElementById("groupForm");
const participantForm = document.getElementById("participantForm");
const criteriaForm = document.getElementById("criteriaForm");
const evaluatorForm = document.getElementById("evaluatorForm");
const assignmentForm = document.getElementById("assignmentForm");

const roundNameSelect = document.getElementById("roundName");
const groupRoundIdSelect = document.getElementById("groupRoundId");
const groupNameInput = document.getElementById("groupName");
const participantGroupIdSelect = document.getElementById("participantGroupId");
const participantNameInput = document.getElementById("participantName");
const participantOrderInput = document.getElementById("participantOrder");
const criteriaRoundIdSelect = document.getElementById("criteriaRoundId");
const criteriaNameInput = document.getElementById("criteriaName");
const criteriaMaxScoreInput = document.getElementById("criteriaMaxScore");
const evaluatorNameInput = document.getElementById("evaluatorName");
const evaluatorEmployeeIdInput = document.getElementById("evaluatorEmployeeId");
const assignmentEvaluatorIdSelect = document.getElementById("assignmentEvaluatorId");
const assignmentRoundIdSelect = document.getElementById("assignmentRoundId");
const assignmentGroupsContainer = document.getElementById("assignmentGroupsContainer");

const roundList = document.getElementById("roundList");
const groupList = document.getElementById("groupList");
const participantList = document.getElementById("participantList");
const criteriaList = document.getElementById("criteriaList");
const evaluatorList = document.getElementById("evaluatorList");
const assignmentList = document.getElementById("assignmentList");

const roundMessage = document.getElementById("roundMessage");
const groupMessage = document.getElementById("groupMessage");
const participantMessage = document.getElementById("participantMessage");
const criteriaMessage = document.getElementById("criteriaMessage");
const evaluatorMessage = document.getElementById("evaluatorMessage");
const assignmentMessage = document.getElementById("assignmentMessage");

const roundsById = new Map();
const groupsById = new Map();
const evaluatorsById = new Map();
let assignmentRecords = [];

function setMessage(element, text, type) {
  element.textContent = text;
  element.className = `form-message ${type}`;
}

function renderSelectOptions(selectElement, items, placeholder) {
  selectElement.innerHTML = "";

  if (items.length === 0) {
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;
    placeholderOption.selected = true;
    placeholderOption.disabled = true;
    selectElement.appendChild(placeholderOption);
    return;
  }

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    selectElement.appendChild(option);
  });
}

function createListItem(text, onDelete) {
  const item = document.createElement("li");
  item.className = "data-list-item";

  const textSpan = document.createElement("span");
  textSpan.textContent = text;

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger-button";
  deleteButton.textContent = "삭제";
  deleteButton.addEventListener("click", onDelete);

  item.appendChild(textSpan);
  item.appendChild(deleteButton);

  return item;
}

function renderEmpty(listElement, text) {
  listElement.innerHTML = "";
  const empty = document.createElement("li");
  empty.className = "data-list-empty";
  empty.textContent = text;
  listElement.appendChild(empty);
}

function renderAssignmentGroupOptions() {
  const selectedRoundId = assignmentRoundIdSelect.value;
  assignmentGroupsContainer.innerHTML = "";

  if (!selectedRoundId) {
    const empty = document.createElement("p");
    empty.className = "data-list-empty";
    empty.textContent = "라운드를 먼저 선택하세요.";
    assignmentGroupsContainer.appendChild(empty);
    return;
  }

  const groups = Array.from(groupsById.entries())
    .filter(([, group]) => group.round_id === selectedRoundId)
    .map(([id, group]) => ({ id, ...group }))
    .sort((left, right) => left.name.localeCompare(right.name, "ko"));

  if (groups.length === 0) {
    const empty = document.createElement("p");
    empty.className = "data-list-empty";
    empty.textContent = "해당 라운드에 등록된 조가 없습니다.";
    assignmentGroupsContainer.appendChild(empty);
    return;
  }

  groups.forEach((group) => {
    const label = document.createElement("label");
    label.className = "checkbox-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "assignmentGroupId";
    checkbox.value = group.id;

    const text = document.createElement("span");
    text.textContent = group.name;

    label.appendChild(checkbox);
    label.appendChild(text);
    assignmentGroupsContainer.appendChild(label);
  });
}

function renderAssignmentList() {
  assignmentList.innerHTML = "";

  if (assignmentRecords.length === 0) {
    renderEmpty(assignmentList, "등록된 배정이 없습니다.");
    return;
  }

  assignmentRecords.forEach((assignment) => {
    const evaluatorName = evaluatorsById.get(assignment.evaluator_id)?.name ?? assignment.evaluator_id;
    const roundName = roundsById.get(assignment.round_id)?.name ?? assignment.round_id;
    const groupName = groupsById.get(assignment.group_id)?.name ?? assignment.group_id;

    const item = createListItem(`${evaluatorName} | ${roundName} | ${groupName}`, async () => {
      await deleteDoc(doc(db, "assignments", assignment.id));
    });
    assignmentList.appendChild(item);
  });
}

function bindRoundList() {
  const roundsQuery = query(collection(db, "rounds"), orderBy("name"));
  onSnapshot(roundsQuery, (snapshot) => {
    roundsById.clear();
    roundList.innerHTML = "";

    if (snapshot.empty) {
      renderEmpty(roundList, "등록된 라운드가 없습니다.");
      renderSelectOptions(groupRoundIdSelect, [], "먼저 라운드를 등록하세요");
      renderSelectOptions(criteriaRoundIdSelect, [], "먼저 라운드를 등록하세요");
      renderSelectOptions(assignmentRoundIdSelect, [], "먼저 라운드를 등록하세요");
      renderAssignmentGroupOptions();
      renderAssignmentList();
      return;
    }

    const roundOptions = [];

    snapshot.forEach((roundDoc) => {
      const round = roundDoc.data();
      roundsById.set(roundDoc.id, round);
      roundOptions.push({ id: roundDoc.id, label: `${round.name} (${roundDoc.id})` });

      const item = createListItem(`${round.name}`, async () => {
        await deleteDoc(doc(db, "rounds", roundDoc.id));
      });
      roundList.appendChild(item);
    });

    renderSelectOptions(groupRoundIdSelect, roundOptions, "라운드를 선택하세요");
    renderSelectOptions(criteriaRoundIdSelect, roundOptions, "라운드를 선택하세요");
    renderSelectOptions(assignmentRoundIdSelect, roundOptions, "라운드를 선택하세요");
    renderAssignmentGroupOptions();
    renderAssignmentList();
  });
}

function bindGroupList() {
  const groupsQuery = query(collection(db, "groups"), orderBy("name"));
  onSnapshot(groupsQuery, (snapshot) => {
    groupsById.clear();
    groupList.innerHTML = "";

    if (snapshot.empty) {
      renderEmpty(groupList, "등록된 조가 없습니다.");
      renderSelectOptions(participantGroupIdSelect, [], "먼저 조를 등록하세요");
      renderAssignmentGroupOptions();
      renderAssignmentList();
      return;
    }

    const groupOptions = [];

    snapshot.forEach((groupDoc) => {
      const group = groupDoc.data();
      groupsById.set(groupDoc.id, group);

      const roundName = roundsById.get(group.round_id)?.name ?? "알 수 없음";
      groupOptions.push({ id: groupDoc.id, label: `${group.name} (${roundName})` });

      const item = createListItem(`${group.name} | 라운드: ${roundName}`, async () => {
        await deleteDoc(doc(db, "groups", groupDoc.id));
      });
      groupList.appendChild(item);
    });

    renderSelectOptions(participantGroupIdSelect, groupOptions, "조를 선택하세요");
    renderAssignmentGroupOptions();
    renderAssignmentList();
  });
}

function bindParticipantList() {
  const participantsQuery = query(collection(db, "participants"), orderBy("order"));
  onSnapshot(participantsQuery, (snapshot) => {
    participantList.innerHTML = "";

    if (snapshot.empty) {
      renderEmpty(participantList, "등록된 참가자가 없습니다.");
      return;
    }

    snapshot.forEach((participantDoc) => {
      const participant = participantDoc.data();
      const groupName = groupsById.get(participant.group_id)?.name ?? "알 수 없음";

      const item = createListItem(
        `${participant.name} | 조: ${groupName} | 발표순번: ${participant.order}`,
        async () => {
          await deleteDoc(doc(db, "participants", participantDoc.id));
        }
      );
      participantList.appendChild(item);
    });
  });
}

function bindCriteriaList() {
  const criteriaQuery = query(collection(db, "criteriaItems"), orderBy("name"));
  onSnapshot(criteriaQuery, (snapshot) => {
    criteriaList.innerHTML = "";

    if (snapshot.empty) {
      renderEmpty(criteriaList, "등록된 평가 항목이 없습니다.");
      return;
    }

    snapshot.forEach((criteriaDoc) => {
      const criteria = criteriaDoc.data();
      const roundName = roundsById.get(criteria.round_id)?.name ?? "알 수 없음";

      const item = createListItem(
        `${criteria.name} | 배점: ${criteria.max_score} | 라운드: ${roundName}`,
        async () => {
          await deleteDoc(doc(db, "criteriaItems", criteriaDoc.id));
        }
      );
      criteriaList.appendChild(item);
    });
  });
}

function bindEvaluatorList() {
  const evaluatorsQuery = query(collection(db, "evaluators"), orderBy("name"));
  onSnapshot(evaluatorsQuery, (snapshot) => {
    evaluatorsById.clear();
    evaluatorList.innerHTML = "";

    if (snapshot.empty) {
      renderEmpty(evaluatorList, "등록된 평가자가 없습니다.");
      renderSelectOptions(assignmentEvaluatorIdSelect, [], "먼저 평가자를 등록하세요");
      renderAssignmentList();
      return;
    }

    const evaluatorOptions = [];

    snapshot.forEach((evaluatorDoc) => {
      const evaluator = evaluatorDoc.data();
      evaluatorsById.set(evaluatorDoc.id, evaluator);
      evaluatorOptions.push({ id: evaluatorDoc.id, label: `${evaluator.name} (${evaluator.employee_id})` });
      const item = createListItem(
        `${evaluator.name} | 사번: ${evaluator.employee_id}`,
        async () => {
          await deleteDoc(doc(db, "evaluators", evaluatorDoc.id));
        }
      );
      evaluatorList.appendChild(item);
    });

    renderSelectOptions(assignmentEvaluatorIdSelect, evaluatorOptions, "평가자를 선택하세요");
    renderAssignmentList();
  });
}

function bindAssignmentList() {
  onSnapshot(collection(db, "assignments"), (snapshot) => {
    assignmentRecords = snapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .sort((left, right) => {
        if (left.round_id !== right.round_id) {
          return String(left.round_id).localeCompare(String(right.round_id), "ko");
        }
        if (left.group_id !== right.group_id) {
          return String(left.group_id).localeCompare(String(right.group_id), "ko");
        }
        return String(left.evaluator_id).localeCompare(String(right.evaluator_id), "ko");
      });

    renderAssignmentList();
  });
}

assignmentRoundIdSelect.addEventListener("change", () => {
  renderAssignmentGroupOptions();
});

roundForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = roundNameSelect.value;

  try {
    await addDoc(collection(db, "rounds"), {
      name,
      status: "대기",
      is_locked: false,
    });
    setMessage(roundMessage, "라운드를 등록했습니다.", "success");
  } catch (error) {
    setMessage(roundMessage, `라운드 등록 실패: ${error.message}`, "error");
  }
});

groupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const roundId = groupRoundIdSelect.value;
  const name = groupNameInput.value.trim();

  if (!roundId || !name) {
    setMessage(groupMessage, "라운드와 조 이름을 모두 입력하세요.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "groups"), {
      round_id: roundId,
      name,
    });
    groupNameInput.value = "";
    setMessage(groupMessage, "조를 등록했습니다.", "success");
  } catch (error) {
    setMessage(groupMessage, `조 등록 실패: ${error.message}`, "error");
  }
});

participantForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const groupId = participantGroupIdSelect.value;
  const name = participantNameInput.value.trim();
  const order = Number(participantOrderInput.value);

  if (!groupId || !name || !Number.isInteger(order) || order < 1) {
    setMessage(participantMessage, "조/이름/발표순번을 올바르게 입력하세요.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "participants"), {
      group_id: groupId,
      name,
      order,
    });
    participantNameInput.value = "";
    participantOrderInput.value = "";
    setMessage(participantMessage, "참가자를 등록했습니다.", "success");
  } catch (error) {
    setMessage(participantMessage, `참가자 등록 실패: ${error.message}`, "error");
  }
});

criteriaForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const roundId = criteriaRoundIdSelect.value;
  const name = criteriaNameInput.value.trim();
  const maxScore = Number(criteriaMaxScoreInput.value);

  if (!roundId || !name || !Number.isInteger(maxScore) || maxScore < 1) {
    setMessage(criteriaMessage, "라운드/항목명/배점을 올바르게 입력하세요.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "criteriaItems"), {
      round_id: roundId,
      name,
      max_score: maxScore,
    });
    criteriaNameInput.value = "";
    criteriaMaxScoreInput.value = "";
    setMessage(criteriaMessage, "평가 항목을 등록했습니다.", "success");
  } catch (error) {
    setMessage(criteriaMessage, `평가 항목 등록 실패: ${error.message}`, "error");
  }
});

evaluatorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = evaluatorNameInput.value.trim();
  const employeeId = evaluatorEmployeeIdInput.value.trim();

  if (!name || !employeeId) {
    setMessage(evaluatorMessage, "이름과 사번을 모두 입력하세요.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "evaluators"), {
      name,
      employee_id: employeeId,
    });
    evaluatorNameInput.value = "";
    evaluatorEmployeeIdInput.value = "";
    setMessage(evaluatorMessage, "평가자를 등록했습니다.", "success");
  } catch (error) {
    setMessage(evaluatorMessage, `평가자 등록 실패: ${error.message}`, "error");
  }
});

assignmentForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const evaluatorId = assignmentEvaluatorIdSelect.value;
  const roundId = assignmentRoundIdSelect.value;
  const selectedGroupIds = Array.from(
    assignmentGroupsContainer.querySelectorAll("input[name='assignmentGroupId']:checked")
  ).map((checkbox) => checkbox.value);

  if (!evaluatorId || !roundId || selectedGroupIds.length === 0) {
    setMessage(assignmentMessage, "평가자, 라운드, 조를 모두 선택하세요.", "error");
    return;
  }

  try {
    await Promise.all(
      selectedGroupIds.map((groupId) => {
        const assignmentId = `${evaluatorId}_${roundId}_${groupId}`;
        return setDoc(doc(db, "assignments", assignmentId), {
          evaluator_id: evaluatorId,
          round_id: roundId,
          group_id: groupId,
        });
      })
    );

    assignmentGroupsContainer
      .querySelectorAll("input[name='assignmentGroupId']")
      .forEach((checkbox) => {
        checkbox.checked = false;
      });

    setMessage(assignmentMessage, `${selectedGroupIds.length}개 조 배정을 등록했습니다.`, "success");
  } catch (error) {
    setMessage(assignmentMessage, `배정 등록 실패: ${error.message}`, "error");
  }
});

bindRoundList();
bindGroupList();
bindParticipantList();
bindCriteriaList();
bindEvaluatorList();
bindAssignmentList();