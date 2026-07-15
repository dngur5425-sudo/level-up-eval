# 신입사원 레벨업 평가웹앱 - Copilot 개발 프롬프트

이 문서는 VSCode의 GitHub Copilot Chat에 붙여넣고 사용하는 용도입니다.
프로젝트 루트에 `PROJECT_BRIEF.md`로 저장해두면, Copilot이 이 파일을 참조하며 코드를 짤 때 일관성을 유지하기 쉬워집니다.

---

## 0. 확정 스택 (가정)

명세서에는 React(Vite) / Vanilla JS 두 옵션을 남겨뒀는데, 이 프롬프트에서는 **개발 속도**를 우선해서 아래로 확정합니다.
(React로 바꾸고 싶으면 이 섹션만 교체하면 나머지 프롬프트는 그대로 재사용 가능합니다.)

- **프론트엔드**: Vanilla HTML + CSS + JavaScript (빌드 도구 없음, 번들러 없음)
- **백엔드/DB**: Firebase Firestore
- **배포**: GitHub Pages (또는 Firebase Hosting)
- **인증**: Firebase Authentication 없이, `evaluators` 컬렉션에 사전 등록된 이름(ID)+사번(PW)을 앱에서 직접 대조하는 방식

> ⚠️ **알아두면 좋은 점**: 이 방식은 Firebase의 "진짜 로그인 인증"이 아니라 앱 레벨에서 이름/사번을 비교하는 수준이라, 브라우저 개발자도구를 열면 Firestore 규칙을 완전히 우회할 수는 없지만 어느 정도 지식이 있으면 데이터를 건드릴 여지가 있습니다. 평가자 3~4명, 발표 점수 데이터라는 낮은 민감도·소규모 신뢰 기반 운영이라 이 정도 수준이면 충분하다고 판단했습니다. 더 강하게 하고 싶다면 나중에 Firebase Anonymous Authentication을 추가하는 것도 가능합니다.

---

## 1. 프로젝트 한 줄 설명

신입사원 레벨업 프로젝트의 예선(3개 조 × 8명)·본선(3명) 발표를 평가자 3~4명이 각자 노트북으로 채점하는 웹앱. 관리자는 조별로 점수 정렬 리스트를 실시간으로 확인한다.

---

## 2. 데이터 모델 (Firestore 컬렉션)

```
rounds/{roundId}
  - name: "예선" | "본선"
  - status: "대기" | "진행중" | "종료"
  - is_locked: boolean

groups/{groupId}
  - round_id: string
  - name: "1조" | "2조" | "3조"

participants/{participantId}
  - group_id: string
  - name: string
  - order: number

evaluators/{evaluatorId}
  - name: string       // 로그인 ID
  - employee_id: string // 로그인 PW (사번)

criteriaItems/{itemId}
  - round_id: string
  - name: string        // 예: "전달력"
  - max_score: number

scores/{scoreId}
  - evaluator_id: string
  - participant_id: string
  - criteria_item_id: string
  - round_id: string
  - score: number
  - status: "제출됨" | "수정됨"
  - submitted_at: timestamp
  - updated_at: timestamp

notes/{noteId}          // 선택 사항
  - evaluator_id: string
  - participant_id: string
  - round_id: string
  - memo: string
  - updated_at: timestamp

assignments/{assignmentId}  // 예선 전용 - 평가자별 담당 조 배정
  - evaluator_id: string
  - round_id: string
  - group_id: string
```

---

## 3. 화면과 동작 상세

### 3.1 로그인 화면
- 평가자/관리자 탭으로 구분
- 평가자: 이름(ID) + 사번(PW) 입력 → `evaluators` 컬렉션과 대조
- 관리자: 별도 고정 비밀번호 1개 (환경변수 또는 코드에 하드코딩 수준으로 충분)
- 로그인 성공 시 `sessionStorage`에 evaluator_id 저장 (새로고침해도 유지, 탭 닫으면 초기화)

### 3.2 평가 입력 화면 (평가자용)
- **예선의 경우 로그인한 evaluator_id가 assignments 컬렉션에서 배정받은 group_id(들)만 조회**해서, 그 조에 속한 participant만 순서대로 표시 (배정 없는 조는 아예 노출되지 않음)
- **본선은 assignments 조회 없이 전체 참가자를 순서대로 표시** (조 구분이 없으므로)
- 현재 라운드의 조 → 발표자 목록을 순서대로 표시, 이전/다음 버튼으로 이동
- 각 발표자마다 `criteriaItems`를 슬라이더 또는 숫자 입력으로 표시
- 하단에 합계 자동 계산 (프론트에서 실시간 합산)
- 메모 입력란 (선택 사항, textarea)
- "제출하기" 버튼 → `scores`, `notes` 문서 생성/갱신 (`status: "제출됨"`, `submitted_at` 기록)
- 이미 제출한 발표자는 "제출됨" 표시 + "수정하기"로 버튼 텍스트 변경
  - 수정 시 `status: "수정됨"`, `updated_at` 갱신, 값 덮어쓰기
- **라운드가 `is_locked === true`면 입력/수정 UI를 비활성화**하고 "채점이 마감되었습니다" 안내 표시

### 3.3 관리자 대시보드
- 상단: 현재 라운드 표시, 라운드 전환 버튼, "채점 마감" 버튼 (`is_locked` 토글)
- 조 탭(1조/2조/3조)으로 전환
- 각 조: 참가자를 **합산 점수 내림차순**으로 정렬한 표
  - 컬럼: 순위, 이름, 항목별 점수(전달력/내용/창의성/실현가능성 등 동적으로), 합계, 메모 아이콘
  - 메모 아이콘 클릭 시 해당 참가자의 평가자별 메모를 모달/펼침으로 표시
- `scores` 컬렉션에 `onSnapshot` 리스너를 걸어서 실시간 갱신 (평가자가 제출하는 즉시 화면 반영)
- 참가자별 제출 현황 (예: "4명 중 3명 제출") 표시
- "엑셀로 내보내기" 버튼 → 현재 조/라운드 데이터를 CSV로 다운로드

### 3.4 참가자/조/평가 항목 관리 (관리자)
- 참가자 등록 폼 (이름, 조, 발표순번) — 인원이 적으므로 수동 입력 폼이면 충분, CSV 업로드는 선택
- 평가 항목 등록 폼 (항목명, 배점) — 라운드별로 자유롭게 추가/수정/삭제
- **평가자-조 배정 폼**: 평가자 선택 + 라운드 선택 + 조 선택(체크박스, 다중 선택 가능) → assignments 문서 생성. 한 명이 여러 조를 담당할 수도 있음

---

## 4. UI 디자인 가이드 (metacareers.com 톤)

- 배경: 흰색 기본, 카드 구분이 필요할 때만 옅은 회색 (#F5F6F7 정도)
- 텍스트: 진한 회색/블랙 (#1C2B33 계열), 보조 텍스트는 중간 회색
- 액센트 컬러: 파란색 1가지만 사용 (버튼, 링크, 진행 표시). 예: #0668E1
- 상태 컬러: 저장됨/제출완료 = 초록, 미제출 = 회색, 마감 = 빨강 (남발하지 않고 상태 표시에만 사용)
- 폰트: 산세리프 (시스템 폰트 또는 Inter), 굵기는 기본(400)/미디엄(500) 두 단계만
- 카드: 흰 배경 + 얇은 테두리(1px, 연한 회색) + 모서리 둥글게(12px), 그림자·그라데이션 없음
- 여백: 넉넉하게 (특히 평가 입력 화면은 발표 중간중간 빠르게 봐야 하므로 클릭 수·시각적 복잡도 최소화)
- 아이콘: 최소한만, 의미가 명확한 아웃라인 아이콘 (이전/다음, 메모 등)

---

## 5. Firestore 보안 규칙 (초안 — 검토 후 사용)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 관리자 여부는 별도 검증 수단이 마땅치 않으므로,
    // 관리자 전용 쓰기 작업(라운드/조/참가자/항목/평가자 등록)은
    // 관리자 화면에서만 노출하고, 규칙에서는 아래처럼 느슨하게 열어둡니다.
    // (외부에 공개되지 않는 내부용 소규모 도구 전제)

    match /rounds/{roundId} {
      allow read: if true;
      allow write: if true; // 관리자 화면에서만 호출됨을 전제
    }
    match /groups/{groupId} {
      allow read: if true;
      allow write: if true;
    }
    match /participants/{participantId} {
      allow read: if true;
      allow write: if true;
    }
    match /criteriaItems/{itemId} {
      allow read: if true;
      allow write: if true;
    }
    match /evaluators/{evaluatorId} {
      allow read: if true;   // 로그인 시 이름/사번 대조를 위해 읽기 허용
      allow write: if true;  // 관리자 화면에서만 호출됨을 전제
    }

    match /scores/{scoreId} {
      allow read: if true; // 관리자 대시보드/평가자 본인 화면 모두 필요
      allow create, update: if
        request.resource.data.keys().hasAll(['evaluator_id','participant_id','criteria_item_id','round_id','score']) &&
        request.resource.data.score is number;
      allow delete: if false;
    }

    match /notes/{noteId} {
      allow read: if true;
      allow create, update: if
        request.resource.data.keys().hasAll(['evaluator_id','participant_id','round_id','memo']);
      allow delete: if false;
    }
  }
}
```

> 이 규칙은 "완전히 잠근" 버전이 아니라, 사내 소규모 신뢰 기반 운영에 맞춘 **최소한의 방어**입니다.
> 라운드 마감(`is_locked`) 이후 쓰기를 막고 싶다면, `scores`/`notes`의 `allow create, update`에
> `get(/databases/$(database)/documents/rounds/$(request.resource.data.round_id)).data.is_locked == false`
> 조건을 추가하면 됩니다. (Firestore 규칙에서 다른 문서를 읽는 `get()` 호출은 과금/속도에 영향이 있을 수 있어, 소규모 트래픽인 지금 규모에서는 문제 없습니다.)

---

## 6. 개발 순서 (Copilot Chat에 단계별로 붙여넣어 진행)

1. **프로젝트 초기화**
   > "Firebase Firestore를 사용하는 정적 웹앱 프로젝트 구조를 만들어줘. index.html, css, js 폴더로 구성하고 firebase-config.js에서 Firebase 초기화하도록 해줘."
2. **로그인 화면**
   > "PROJECT_BRIEF.md의 3.1 로그인 화면 요구사항대로 login.html과 login.js를 만들어줘. 평가자는 evaluators 컬렉션과 이름/사번을 대조하고, 로그인 성공 시 sessionStorage에 evaluator_id를 저장해."
3. **평가 입력 화면**
   > "PROJECT_BRIEF.md의 3.2 평가 입력 화면 요구사항대로 evaluate.html과 evaluate.js를 만들어줘. criteriaItems를 동적으로 불러와서 슬라이더로 렌더링하고, 제출/수정 로직을 scores, notes 컬렉션에 반영해줘."
4. **관리자 대시보드**
   > "PROJECT_BRIEF.md의 3.3 관리자 대시보드 요구사항대로 admin.html과 admin.js를 만들어줘. scores 컬렉션에 onSnapshot 리스너를 걸어서 조별로 합산 점수 내림차순 정렬된 표를 실시간으로 보여줘."
5. **참가자/조/평가항목 관리 화면**
   > "PROJECT_BRIEF.md의 3.4 요구사항대로 관리자가 참가자, 조, 평가 항목을 등록/수정할 수 있는 폼 화면을 만들어줘."
6. **엑셀 내보내기**
   > "관리자 대시보드에 현재 조의 결과를 CSV로 다운로드하는 버튼을 추가해줘."
7. **Firestore 보안 규칙 적용**
   > 위 5절의 규칙을 Firebase 콘솔의 Firestore Rules 탭에 붙여넣기
8. **배포**
   > GitHub 저장소 생성(private 권장) → GitHub Pages 또는 `firebase deploy`로 배포 → 평가자 노트북에서 접속 테스트

---

## 7. 발표 당일 체크리스트 (참고)

- [ ] 사무실 Wi-Fi 연결 상태 사전 확인 (평가자 노트북 전부)
- [ ] 평가자 계정(이름/사번) 사전 등록 완료 확인
- [ ] 평가 항목/배점 최종 입력 완료
- [ ] 리허설: 실제 노트북 3~4대로 동시 접속해서 점수 입력 → 관리자 화면 실시간 반영 확인
- [ ] 결과 엑셀 다운로드 테스트
- [ ] 라운드 마감 버튼 동작 확인 (마감 후 수정 안 되는지)