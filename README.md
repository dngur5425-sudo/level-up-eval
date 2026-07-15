# Firebase Firestore Static Web App

정적 웹앱 구조로 Firebase Firestore를 초기화하는 예제입니다.

## 구조

```text
.
├─ index.html
├─ css/
│  └─ styles.css
└─ js/
   ├─ app.js
   └─ firebase-config.js
```

## 설정

1. Firebase 콘솔에서 웹앱을 등록합니다.
2. `js/firebase-config.js`의 `firebaseConfig` 값을 콘솔 값으로 교체합니다.
3. Firestore 데이터베이스를 생성합니다.

## 실행

정적 파일을 로컬 서버로 열어야 ES Module이 정상 동작합니다.

예시(파워셸):

```powershell
npx serve .
```

또는 원하는 정적 서버 도구를 사용해도 됩니다.