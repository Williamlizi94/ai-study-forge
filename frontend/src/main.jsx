import React from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  CircleHelp,
  ArrowRight,
  BookMarked,
  Crown,
  FileText,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  LibraryBig,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Target,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import "katex/dist/katex.min.css";
import "./styles.css";

const API_BASE = "/api";
const APP_NAME = "AI Study Forge";
const APP_DOMAIN = "aistudyforge.com";
const LEGAL_LAST_UPDATED = "July 8, 2026";
const AUTH_TOKEN_KEY = "aiStudyAssistantAuthToken";
const AUTH_USER_KEY = "aiStudyAssistantAuthUser";

const tabs = [
  { id: "exam-prep", label: "Exam Prep", icon: GraduationCap, priority: "primary" },
  { id: "quiz", label: "Practice Quiz", icon: CircleHelp, priority: "primary" },
  { id: "chat", label: "Ask AI Tutor", icon: MessageSquareText, priority: "primary" },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, priority: "secondary" },
  { id: "summary", label: "AI Notes", icon: FileText, priority: "secondary" },
  { id: "cheat-sheet", label: "Cheat Sheet", icon: ClipboardList, priority: "secondary" },
  { id: "flashcards", label: "Flashcards", icon: Layers3, priority: "secondary" },
  { id: "mistakes", label: "Mistakes", icon: BookMarked, priority: "secondary" },
];

function App() {
  const fileInputRef = React.useRef(null);
  const sourceTextareaRef = React.useRef(null);
  const accountMenuRef = React.useRef(null);
  const [apiOnline, setApiOnline] = React.useState(false);
  const [currentSession, setCurrentSession] = React.useState(null);
  const [sessions, setSessions] = React.useState([]);
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [title, setTitle] = React.useState("");
  const [sourceText, setSourceText] = React.useState("");
  const [uploadedMaterial, setUploadedMaterial] = React.useState(null);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);
  const [chatQuestion, setChatQuestion] = React.useState("");
  const [quizAnswers, setQuizAnswers] = React.useState({});
  const [quizReview, setQuizReview] = React.useState(null);
  const [diagnosticAnswers, setDiagnosticAnswers] = React.useState({});
  const [diagnosticReview, setDiagnosticReview] = React.useState(null);
  const [targetedPracticeAnswers, setTargetedPracticeAnswers] = React.useState({});
  const [targetedPracticeReview, setTargetedPracticeReview] = React.useState(null);
  const [notice, setNotice] = React.useState(null);
  const [clearConfirmOpen, setClearConfirmOpen] = React.useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = React.useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = React.useState(false);
  const [favoritesOpen, setFavoritesOpen] = React.useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = React.useState(false);
  const [legalDialogKind, setLegalDialogKind] = React.useState(null);
  const [feedbackText, setFeedbackText] = React.useState("");
  const [authReady, setAuthReady] = React.useState(false);
  const [authStatus, setAuthStatus] = React.useState(null);
  const [authToken, setAuthToken] = React.useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || "");
  const [authUser, setAuthUser] = React.useState(() => readStoredAuthUser());
  const [authFormMode, setAuthFormMode] = React.useState("login");
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false);
  const [authEmail, setAuthEmail] = React.useState("");
  const [accessPassword, setAccessPassword] = React.useState("");
  const [accessError, setAccessError] = React.useState("");
  const [busy, setBusyState] = React.useState({});

  React.useEffect(() => {
    consumeAuthRedirect();
    initializeApp();
  }, []);

  React.useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  React.useEffect(() => {
    function handleDocumentClick(event) {
      if (!accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function setBusy(key, value) {
    setBusyState((current) => ({ ...current, [key]: value }));
  }

  function showNotice(message, tone = "info") {
    setNotice({ message, tone });
  }

  function openUpgradeDialog() {
    setUpgradeDialogOpen(true);
  }

  function openAuthDialog(mode = "login") {
    setAuthFormMode(mode);
    setAccessError("");
    setAuthDialogOpen(true);
  }

  function handleAuthFormModeChange(mode) {
    setAuthFormMode(mode);
    setAccessError("");
  }

  function accountLoginRequired() {
    return Boolean(authReady && authStatus?.auth_mode === "account" && !authToken);
  }

  function requireSignedIn() {
    if (!accountLoginRequired()) {
      return true;
    }
    openAuthDialog("login");
    showNotice("Log in or sign up to save material and generate study tools.", "error");
    return false;
  }

  async function initializeApp() {
    await checkHealth();
    try {
      const status = await apiRequest("/auth/status", { skipAuth: true });
      setAuthStatus(status);
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY) || "";
      setAuthToken(storedToken);
      setAuthUser(readStoredAuthUser());
      if (!status.auth_required || storedToken) {
        await loadSessions();
      }
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      setAuthReady(true);
    }
  }

  function consumeAuthRedirect() {
    if (!window.location.hash) return;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const authError = params.get("auth_error");
    const token = params.get("auth_token");
    if (!authError && !token) return;

    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

    if (authError) {
      showNotice(authError, "error");
      return;
    }

    const email = params.get("auth_email") || "";
    const user = email ? { id: "google", email, plan: "free" } : null;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
    setAuthToken(token);
    setAuthUser(user);
    setAuthDialogOpen(false);
    showNotice("Signed in with Google.");
  }

  function resetFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function focusStudyMaterial() {
    if (sourceTextareaRef.current) {
      sourceTextareaRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      sourceTextareaRef.current.focus();
      return;
    }
    fileInputRef.current?.click();
  }

  function resetWorkspaceDraft() {
    setCurrentSession(null);
    setTitle("");
    setSourceText("");
    setUploadedMaterial(null);
    setSelectedFile(null);
    resetFileInput();
    setQuizAnswers({});
    setQuizReview(null);
    setDiagnosticAnswers({});
    setDiagnosticReview(null);
    setTargetedPracticeAnswers({});
    setTargetedPracticeReview(null);
    setActiveTab("dashboard");
  }

  function detachCurrentSessionForDraft() {
    if (!currentSession) return;
    setCurrentSession(null);
    setQuizAnswers({});
    setQuizReview(null);
    setDiagnosticAnswers({});
    setDiagnosticReview(null);
    setTargetedPracticeAnswers({});
    setTargetedPracticeReview(null);
  }

  function handleTitleChange(event) {
    setTitle(event.target.value);
    detachCurrentSessionForDraft();
  }

  function handleSourceTextChange(event) {
    setSourceText(event.target.value);
    setUploadedMaterial(null);
    detachCurrentSessionForDraft();
  }

  function selectUploadFile(file) {
    if (!file) return;
    setSelectedFile(file);
    setTitle(titleFromFilename(file.name));
    setSourceText("");
    setUploadedMaterial(null);
    setCurrentSession(null);
    setQuizAnswers({});
    setQuizReview(null);
    setDiagnosticAnswers({});
    setDiagnosticReview(null);
    setTargetedPracticeAnswers({});
    setTargetedPracticeReview(null);
    setActiveTab("dashboard");
  }

  function handleFileInputChange(event) {
    selectUploadFile(event.target.files?.[0] ?? null);
  }

  function handleDragOver(event) {
    event.preventDefault();
    setIsDraggingFile(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setIsDraggingFile(false);
  }

  function handleFileDrop(event) {
    event.preventDefault();
    setIsDraggingFile(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      selectUploadFile(file);
      resetFileInput();
    }
  }

  async function checkHealth() {
    try {
      await apiRequest("/health", { skipAuth: true });
      setApiOnline(true);
    } catch {
      setApiOnline(false);
    }
  }

  async function loadSessions() {
    try {
      setSessions(await apiRequest("/study/sessions"));
    } catch (error) {
      if (error.status === 401) {
        clearAuthToken();
      }
      showNotice(error.message, "error");
    }
  }

  async function handleAccessLogin(event) {
    event.preventDefault();
    setAccessError("");
    setBusy("auth", true);
    try {
      const isAccountMode = authStatus?.auth_mode === "account";
      const path = isAccountMode && authFormMode === "signup" ? "/auth/register" : "/auth/login";
      const result = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(
          isAccountMode
            ? { email: authEmail.trim(), password: accessPassword }
            : { password: accessPassword },
        ),
        skipAuth: true,
      });
      localStorage.setItem(AUTH_TOKEN_KEY, result.token);
      if (result.user) {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
        setAuthUser(result.user);
      }
      setAuthToken(result.token);
      setAuthDialogOpen(false);
      setAuthEmail("");
      setAccessPassword("");
      await loadSessions();
    } catch (error) {
      setAccessError(error.message);
    } finally {
      setBusy("auth", false);
    }
  }

  function handleGoogleAuth() {
    if (!authStatus?.google_auth_enabled) {
      showNotice("Google sign-in is not configured yet.", "error");
      return;
    }
    window.location.href = `${API_BASE}/auth/google/start`;
  }

  function clearAuthToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setAuthToken("");
    setAuthUser(null);
    setAccountMenuOpen(false);
    setAccountSettingsOpen(false);
    setFavoritesOpen(false);
    setHelpDialogOpen(false);
    setUpgradeDialogOpen(false);
    setLegalDialogKind(null);
    setSessions([]);
    resetWorkspaceDraft();
  }

  function openAccountSettings() {
    setAccountMenuOpen(false);
    setAccountSettingsOpen(true);
  }

  function openFavorites() {
    setAccountMenuOpen(false);
    setFavoritesOpen(true);
  }

  function openHelpCenter() {
    setAccountMenuOpen(false);
    setHelpDialogOpen(true);
  }

  function openLegalDialog(kind) {
    setAccountMenuOpen(false);
    setAccountSettingsOpen(false);
    setLegalDialogKind(kind);
  }

  function openClearSessionsFromAccount() {
    setAccountSettingsOpen(false);
    if (!sessions.length) {
      showNotice("No history records to clear.");
      return;
    }
    setClearConfirmOpen(true);
  }

  async function submitFeedback(event) {
    event.preventDefault();
    const message = feedbackText.trim();
    if (message.length < 10) {
      showNotice("Add a little more detail before sending feedback.", "error");
      return;
    }
    setBusy("feedback", true);
    try {
      await apiRequest("/feedback", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setFeedbackText("");
      setHelpDialogOpen(false);
      showNotice("Feedback sent. Thanks for helping improve the product.");
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      setBusy("feedback", false);
    }
  }

  async function ensureActiveSession() {
    if (!requireSignedIn()) {
      return null;
    }
    if (currentSession) {
      return currentSession;
    }

    const cleanText = sourceText.trim();
    const cleanTitle = title.trim();
    if (cleanText.length < 50) {
      showNotice("Add at least 50 characters of study material.", "error");
      return null;
    }

    const session = await apiRequest("/study/sessions", {
      method: "POST",
      body: JSON.stringify({ source_text: cleanText, title: cleanTitle || null }),
    });
    selectSession(session, { preserveTab: true, preserveUploadedMaterial: true });
    await loadSessions();
    return session;
  }

  async function uploadDocument() {
    if (!requireSignedIn()) {
      return;
    }
    if (!selectedFile) {
      showNotice("Choose a file first.", "error");
      return;
    }

    const formData = new FormData();
    const uploadFile = selectedFile;
    formData.append("file", uploadFile);

    setBusy("upload", true);
    try {
      const parsed = await apiRequest("/study/documents/parse", {
        method: "POST",
        body: formData,
      });
      setTitle(parsed.title || titleFromFilename(uploadFile.name));
      setSourceText(parsed.source_text);
      setUploadedMaterial({
        name: uploadFile.name,
        characterCount: parsed.character_count ?? parsed.source_text.length,
      });
      setCurrentSession(null);
      setQuizAnswers({});
      setQuizReview(null);
      setDiagnosticAnswers({});
      setDiagnosticReview(null);
      setTargetedPracticeAnswers({});
      setTargetedPracticeReview(null);
      setActiveTab("dashboard");
      setSelectedFile(null);
      resetFileInput();
      showNotice("Material processed. Generate an exam review pack when ready.");
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      setBusy("upload", false);
    }
  }

  async function openSession(sessionId) {
    if (!requireSignedIn()) {
      return;
    }
    try {
      const session = await apiRequest(`/study/sessions/${sessionId}`);
      selectSession(session);
    } catch (error) {
      showNotice(error.message, "error");
    }
  }

  async function deleteStudySession(sessionId) {
    if (!requireSignedIn()) {
      return;
    }
    setBusy(`delete-${sessionId}`, true);
    try {
      await apiRequest(`/study/sessions/${sessionId}`, { method: "DELETE" });
      if (currentSession?.id === sessionId) {
        resetWorkspaceDraft();
      }
      await loadSessions();
      showNotice("History record deleted.");
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      setBusy(`delete-${sessionId}`, false);
    }
  }

  function requestClearStudySessions() {
    if (!requireSignedIn()) {
      return;
    }
    if (!sessions.length) {
      return;
    }
    setClearConfirmOpen(true);
  }

  async function clearStudySessions() {
    if (!sessions.length) {
      setClearConfirmOpen(false);
      return;
    }

    setBusy("clear-sessions", true);
    try {
      await apiRequest("/study/sessions", { method: "DELETE" });
      resetWorkspaceDraft();
      setClearConfirmOpen(false);
      await loadSessions();
      showNotice("History cleared.");
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      setBusy("clear-sessions", false);
    }
  }

  async function toggleSessionFavorite(sessionId, nextFavorite) {
    if (!requireSignedIn()) {
      return;
    }

    setBusy(`favorite-${sessionId}`, true);
    try {
      const updatedSession = await apiRequest(`/study/sessions/${sessionId}/favorite`, {
        method: "POST",
        body: JSON.stringify({ is_favorite: nextFavorite }),
      });
      if (currentSession?.id === updatedSession.id) {
        setCurrentSession(updatedSession);
      }
      await loadSessions();
      showNotice(nextFavorite ? "Added to favorites." : "Removed from favorites.");
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      setBusy(`favorite-${sessionId}`, false);
    }
  }

  function selectSession(session, { preserveTab = false, preserveUploadedMaterial = false } = {}) {
    setCurrentSession(session);
    setTitle(session.title);
    setSourceText(session.source_text);
    if (!preserveUploadedMaterial) {
      setUploadedMaterial(null);
    }
    setSelectedFile(null);
    resetFileInput();
    setQuizAnswers({});
    setQuizReview(parseSavedQuizReview(session.quiz_review));
    setDiagnosticAnswers({});
    setDiagnosticReview(parseSavedDiagnosticReview(session.diagnostic_review));
    setTargetedPracticeAnswers({});
    setTargetedPracticeReview(parseSavedTargetedPracticeReview(session.targeted_practice_review));
    if (!preserveTab) {
      setActiveTab("dashboard");
    }
  }

  async function generateStudyAsset(kind) {
    setBusy(kind, true);
    try {
      const session = await ensureActiveSession();
      if (!session) {
        return;
      }

      const result = await apiRequest(`/study/sessions/${session.id}/${kind}`, {
        method: "POST",
      });
      setCurrentSession(result.session);
      if (kind === "quiz") {
        setQuizAnswers({});
        setQuizReview(null);
      }
      if (kind === "diagnostic") {
        setDiagnosticAnswers({});
        setDiagnosticReview(null);
      }
      if (kind === "targeted-practice") {
        setTargetedPracticeAnswers({});
        setTargetedPracticeReview(null);
      }
      await loadSessions();
      showNotice(`${labelForKind(kind)} ready.`);
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      setBusy(kind, false);
    }
  }

  async function generateExamReviewPack() {
    setBusy("exam-pack", true);
    try {
      let session = await ensureActiveSession();
      if (!session) {
        return;
      }

      for (const kind of ["summary", "cheat-sheet", "flashcards", "quiz"]) {
        if (isSessionAssetReady(session, kind)) {
          continue;
        }
        const result = await apiRequest(`/study/sessions/${session.id}/${kind}`, {
          method: "POST",
        });
        session = result.session;
        setCurrentSession(session);
      }

      setQuizAnswers({});
      setQuizReview(null);
      await loadSessions();
      setActiveTab("exam-prep");
      showNotice("Exam Review Pack ready.");
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      setBusy("exam-pack", false);
    }
  }

  async function reviewQuizAnswers() {
    if (!currentSession?.quiz?.length) {
      showNotice("Generate a quiz first.", "error");
      return;
    }
    if (Object.keys(quizAnswers).length < currentSession.quiz.length) {
      showNotice("Answer every quiz question before review.", "error");
      return;
    }

    setBusy("quiz-review", true);
    try {
      const result = await apiRequest(`/study/sessions/${currentSession.id}/quiz/review`, {
        method: "POST",
        body: JSON.stringify({
          answers: Object.entries(quizAnswers).map(([index, selectedAnswer]) => ({
            question_index: Number(index),
            selected_answer: selectedAnswer,
          })),
        }),
      });
      setCurrentSession(result.session);
      setQuizReview(result.review);
      await loadSessions();
      showNotice("Tutor review ready.");
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      setBusy("quiz-review", false);
    }
  }

  async function saveQuizMistakes(nextAnswers) {
    if (!currentSession?.quiz?.length) {
      return;
    }

    try {
      const result = await apiRequest(`/study/sessions/${currentSession.id}/quiz/mistakes`, {
        method: "POST",
        body: JSON.stringify({
          answers: Object.entries(nextAnswers).map(([index, selectedAnswer]) => ({
            question_index: Number(index),
            selected_answer: selectedAnswer,
          })),
        }),
      });
      setCurrentSession(result.session);
      setQuizReview(result.review);
      await loadSessions();
    } catch (error) {
      console.warn("Failed to save quiz mistakes", error);
    }
  }

  function selectQuizAnswer(index, answer) {
    const nextAnswers = { ...quizAnswers, [index]: answer };
    setQuizAnswers(nextAnswers);
    saveQuizMistakes(nextAnswers);
  }

  async function reviewDiagnosticAnswers() {
    if (!currentSession?.diagnostic?.length) {
      showNotice("Generate a diagnostic test first.", "error");
      return;
    }
    if (Object.keys(diagnosticAnswers).length < currentSession.diagnostic.length) {
      showNotice("Answer every diagnostic question before review.", "error");
      return;
    }

    setBusy("diagnostic-review", true);
    try {
      const result = await apiRequest(`/study/sessions/${currentSession.id}/diagnostic/review`, {
        method: "POST",
        body: JSON.stringify({
          answers: Object.entries(diagnosticAnswers).map(([index, selectedAnswer]) => ({
            question_index: Number(index),
            selected_answer: selectedAnswer,
          })),
        }),
      });
      setCurrentSession(result.session);
      setDiagnosticReview(result.review);
      await loadSessions();
      showNotice("Weakness report ready.");
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      setBusy("diagnostic-review", false);
    }
  }

  async function reviewTargetedPracticeAnswers() {
    if (!currentSession?.targeted_practice?.length) {
      showNotice("Generate a weak-topic drill first.", "error");
      return;
    }
    if (Object.keys(targetedPracticeAnswers).length < currentSession.targeted_practice.length) {
      showNotice("Answer every weak-topic drill question before checking mastery.", "error");
      return;
    }

    setBusy("targeted-practice-review", true);
    try {
      const result = await apiRequest(`/study/sessions/${currentSession.id}/targeted-practice/review`, {
        method: "POST",
        body: JSON.stringify({
          answers: Object.entries(targetedPracticeAnswers).map(([index, selectedAnswer]) => ({
            question_index: Number(index),
            selected_answer: selectedAnswer,
          })),
        }),
      });
      setCurrentSession(result.session);
      setTargetedPracticeReview(result.review);
      await loadSessions();
      showNotice("Mastery check saved.");
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      setBusy("targeted-practice-review", false);
    }
  }

  async function sendChatQuestion(event) {
    event.preventDefault();
    const question = chatQuestion.trim();
    if (question.length < 3) {
      return;
    }

    setBusy("chat", true);
    try {
      const session = await ensureActiveSession();
      if (!session) {
        return;
      }

      const result = await apiRequest(`/study/sessions/${session.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      setCurrentSession(result.session);
      setChatQuestion("");
      await loadSessions();
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      setBusy("chat", false);
    }
  }

  const stats = {
    chars: sourceText.length,
    files: sourceText.trim().length ? 1 : 0,
    notes: currentSession?.summary ? 1 : 0,
    cheatSheets: currentSession?.cheat_sheet ? 1 : 0,
    questions: currentSession?.quiz?.length ?? 0,
    flashcards: currentSession?.flashcards?.length ?? 0,
    tutorChats: currentSession?.chat_messages?.length ?? 0,
  };
  const hasStudyMaterial = sourceText.trim().length >= 50;
  const favoriteSessions = sessions.filter((session) => session.is_favorite);
  const isAppLoading = !authReady;
  const isAccountMode = authStatus?.auth_mode === "account";
  const isAccessLocked = Boolean(
    authReady && authStatus?.auth_required && !authToken && !isAccountMode,
  );
  const showMarketingHome = Boolean(authReady && isAccountMode && !authToken);

  return (
    <div className="app">
      {showMarketingHome ? (
        <LandingPage
          limits={authStatus}
          onLogin={() => openAuthDialog("login")}
          onSignup={() => openAuthDialog("signup")}
          onUpgrade={openUpgradeDialog}
          onLegal={openLegalDialog}
        />
      ) : (
      <>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <BookOpen size={22} aria-hidden="true" />
          </div>
          <div>
            <h1>{APP_NAME}</h1>
            <p>
              {isAccessLocked
                ? authStatus?.auth_mode === "account"
                  ? "Account access required"
                  : "Beta access required"
                : maskEmail(authUser?.email) || (currentSession ? currentSession.title : "No active history")}
            </p>
          </div>
        </div>
        <div className="topbar-actions">
          {isAccountMode && !authToken && (
            <>
              <button className="sign-out-button" type="button" onClick={() => openAuthDialog("login")}>
                Log in
              </button>
              <button className="auth-action-button" type="button" onClick={() => openAuthDialog("signup")}>
                Sign up
              </button>
            </>
          )}
          {authStatus?.auth_required && authToken && (
            <AccountMenu
              ref={accountMenuRef}
              user={authUser}
              isOpen={accountMenuOpen}
              sessionsCount={sessions.length}
              favoritesCount={favoriteSessions.length}
              limits={authStatus}
              onToggle={() => setAccountMenuOpen((current) => !current)}
              onUpgrade={() => {
                setAccountMenuOpen(false);
                openUpgradeDialog();
              }}
              onSettings={openAccountSettings}
              onFavorites={openFavorites}
              onHelp={openHelpCenter}
              onLegal={openLegalDialog}
              onSignOut={clearAuthToken}
            />
          )}
        </div>
      </header>

      {isAppLoading ? (
        <AccessGate isLoading apiOnline={apiOnline} />
      ) : isAccessLocked ? (
        <AccessGate
          apiOnline={apiOnline}
          authMode={authStatus?.auth_mode ?? "beta"}
          formMode={authFormMode}
          email={authEmail}
          password={accessPassword}
          error={accessError}
          isBusy={busy.auth}
          limits={authStatus}
          googleAuthEnabled={Boolean(authStatus?.google_auth_enabled)}
          onFormModeChange={handleAuthFormModeChange}
          onEmailChange={setAuthEmail}
          onPasswordChange={setAccessPassword}
          onGoogleAuth={handleGoogleAuth}
          onSubmit={handleAccessLogin}
        />
      ) : (
      <main className="shell">
        <aside className="sidebar" aria-label="Study material and history">
          <section className="tool-panel">
            <PanelHeader icon={Brain} title="Step 1: Add Study Material" />
            <p className="panel-helper">
              Upload lecture slides, PDFs, notes, homework solutions, or paste text from course materials.
            </p>

            <label className="field-label" htmlFor="session-title">
              Title
            </label>
            <input
              id="session-title"
              value={title}
              maxLength={120}
              onChange={handleTitleChange}
              placeholder="Study title"
            />

            <label className="field-label" htmlFor="document-file">
              Upload Document
            </label>
            <div
              className={isDraggingFile ? "upload-box dragging" : "upload-box"}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleFileDrop}
            >
              <label className="file-picker" htmlFor="document-file">
                <Upload size={18} aria-hidden="true" />
                <span title={selectedFile?.name ?? ""}>
                  {selectedFile ? selectedFile.name : "Drop a file here or choose one"}
                </span>
              </label>
              <input
                id="document-file"
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.docx,.doc,.pptx,.ppt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
                onChange={handleFileInputChange}
              />
              <button
                className="secondary-button"
                type="button"
                onClick={uploadDocument}
                disabled={busy.upload}
              >
                {busy.upload ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
                <span>Process Material</span>
              </button>
            </div>

            <label className="field-label" htmlFor={uploadedMaterial ? undefined : "source-text"}>
              {uploadedMaterial ? "Study Material" : "Paste or Edit Text"}
            </label>
            {uploadedMaterial ? (
              <div className="upload-success-card" role="status" title={uploadedMaterial.name}>
                <CheckCircle2 size={20} aria-hidden="true" />
                <div>
                  <strong>Upload successful</strong>
                  <span>{uploadedMaterial.characterCount.toLocaleString()} chars ready</span>
                </div>
              </div>
            ) : (
              <textarea
                id="source-text"
                ref={sourceTextareaRef}
                value={sourceText}
                spellCheck="true"
                onChange={handleSourceTextChange}
                placeholder="Paste course notes, homework solutions, lecture transcripts, or textbook excerpts here."
              />
            )}

            <div className="source-footer">
              <span>{stats.chars.toLocaleString()} chars</span>
              <span>Generate an exam review pack to save this material</span>
            </div>
          </section>

          <section className="tool-panel sessions-panel">
            <div className="section-title-row">
              <PanelHeader icon={LibraryBig} title="History" compact />
              <div className="section-actions">
                <button
                  className="clear-sessions-button"
                  type="button"
                  onClick={requestClearStudySessions}
                  disabled={busy["clear-sessions"] || !sessions.length}
                  title="Clear history"
                >
                  {busy["clear-sessions"] ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                  <span>Clear</span>
                </button>
                <button className="icon-button" type="button" onClick={loadSessions} title="Refresh history">
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
            <SessionList
              sessions={sessions}
              activeId={currentSession?.id}
              onOpen={openSession}
              onToggleFavorite={toggleSessionFavorite}
              onDelete={deleteStudySession}
              isDeleting={(sessionId) => Boolean(busy[`delete-${sessionId}`])}
              isFavoriteBusy={(sessionId) => Boolean(busy[`favorite-${sessionId}`])}
            />
          </section>

          <section className="tool-panel upgrade-panel">
            <div className="upgrade-sidebar-icon">
              <Crown size={16} aria-hidden="true" />
            </div>
            <div>
              <h2>Unlock Pro Exam Prep</h2>
              <p>
                Generate full exam review packs with cheat sheets, practice exams, answer explanations,
                PDF export, and higher upload limits.
              </p>
            </div>
            <button type="button" onClick={openUpgradeDialog}>
              <Crown size={15} />
              <span>Unlock Pro</span>
            </button>
          </section>
        </aside>

        <section className="workspace" aria-label="Study workspace">
          <div className="workspace-header">
            <div>
              <h2>{activeTab === "dashboard" ? "Study Workspace" : currentSession ? currentSession.title : "Workspace"}</h2>
              <p>
                {currentSession
                  ? currentSession.title
                  : sourceText.trim()
                    ? "Material ready for exam prep"
                    : "Upload notes, paste text, or open history"}
              </p>
            </div>
            {currentSession && (
              <button
                className={currentSession.is_favorite ? "favorite-current-button active" : "favorite-current-button"}
                type="button"
                onClick={() => toggleSessionFavorite(currentSession.id, !currentSession.is_favorite)}
                disabled={busy[`favorite-${currentSession.id}`]}
                aria-pressed={Boolean(currentSession.is_favorite)}
              >
                {busy[`favorite-${currentSession.id}`] ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <Star size={16} fill={currentSession.is_favorite ? "currentColor" : "none"} />
                )}
                <span>{currentSession.is_favorite ? "Favorited" : "Add favorite"}</span>
              </button>
            )}
            <div className="stat-strip" aria-label="Study stats">
              <Stat label="Files" value={stats.files.toLocaleString()} />
              <Stat label="Notes" value={stats.notes.toLocaleString()} />
              <Stat label="Questions" value={stats.questions.toLocaleString()} />
              <Stat label="Flashcards" value={stats.flashcards.toLocaleString()} />
              <Stat label="Tutor Chats" value={stats.tutorChats.toLocaleString()} />
            </div>
          </div>

          <nav className="tabs" aria-label="Study tools">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const requiresMaterial = ["exam-prep", "quiz", "chat"].includes(tab.id);
              const tabDisabled = requiresMaterial && !hasStudyMaterial;
              const tabClassName = [
                activeTab === tab.id ? "active" : "",
                tab.priority === "primary" ? "tab-primary" : "tab-secondary",
              ].filter(Boolean).join(" ");
              return (
                <button
                  key={tab.id}
                  className={tabClassName}
                  type="button"
                  disabled={tabDisabled}
                  title={tabDisabled ? "Upload material first to unlock exam prep tools" : undefined}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {notice && <div className={`notice ${notice.tone}`}>{notice.message}</div>}

          <div className="workspace-body">
            {activeTab === "dashboard" && (
              <DashboardPanel
                sessions={sessions}
                stats={stats}
                hasMaterial={hasStudyMaterial}
                currentSession={currentSession}
                quizReview={quizReview}
                onOpenSession={openSession}
                onSelectTool={setActiveTab}
                onGeneratePack={generateExamReviewPack}
                onUploadFocus={focusStudyMaterial}
                isGeneratingPack={Boolean(busy["exam-pack"])}
                onUpgrade={openUpgradeDialog}
              />
            )}
            {activeTab === "exam-prep" && (
              <ExamPrepPanel
                hasMaterial={hasStudyMaterial}
                currentSession={currentSession}
                onSelectTool={setActiveTab}
                onGenerateSummary={() => generateStudyAsset("summary")}
                onGenerateCheatSheet={() => generateStudyAsset("cheat-sheet")}
                onGenerateQuiz={() => generateStudyAsset("quiz")}
                onGenerateFlashcards={() => generateStudyAsset("flashcards")}
                isBusy={
                  busy["exam-pack"] ||
                  busy.summary ||
                  busy["cheat-sheet"] ||
                  busy.quiz ||
                  busy.flashcards
                }
              />
            )}
            {activeTab === "summary" && (
              <SummaryPanel
                summary={currentSession?.summary}
                isBusy={busy.summary}
                onGenerate={() => generateStudyAsset("summary")}
              />
            )}
            {activeTab === "cheat-sheet" && (
              <CheatSheetPanel
                cheatSheet={currentSession?.cheat_sheet}
                isBusy={busy["cheat-sheet"]}
                onGenerate={() => generateStudyAsset("cheat-sheet")}
              />
            )}
            {activeTab === "flashcards" && (
              <FlashcardsPanel
                flashcards={currentSession?.flashcards ?? []}
                isBusy={busy.flashcards}
                onGenerate={() => generateStudyAsset("flashcards")}
              />
            )}
            {activeTab === "quiz" && (
              <QuizPanel
                questions={currentSession?.quiz ?? []}
                isBusy={busy.quiz}
                isReviewing={busy["quiz-review"]}
                selectedAnswers={quizAnswers}
                review={quizReview}
                savedReview={currentSession?.quiz_review}
                onSelectAnswer={selectQuizAnswer}
                onGenerate={() => generateStudyAsset("quiz")}
                onReview={reviewQuizAnswers}
              />
            )}
            {activeTab === "mistakes" && (
              <MistakeNotebookPanel
                review={quizReview}
                savedReview={currentSession?.quiz_review}
                onSelectQuiz={() => setActiveTab("quiz")}
              />
            )}
            {activeTab === "chat" && (
              <ChatPanel
                messages={currentSession?.chat_messages ?? []}
                question={chatQuestion}
                isBusy={busy.chat}
                onQuestionChange={setChatQuestion}
                onSubmit={sendChatQuestion}
              />
            )}
          </div>
        </section>
      </main>
      )}
      </>
      )}

      {clearConfirmOpen && (
        <ConfirmDialog
          title="Clear history?"
          message={`This will delete ${sessions.length} history record${sessions.length === 1 ? "" : "s"}. This action cannot be undone.`}
          confirmLabel="Clear history"
          cancelLabel="Cancel"
          isBusy={busy["clear-sessions"]}
          onCancel={() => setClearConfirmOpen(false)}
          onConfirm={clearStudySessions}
        />
      )}
      {upgradeDialogOpen && (
        <UpgradeDialog onClose={() => setUpgradeDialogOpen(false)} />
      )}
      {accountSettingsOpen && (
        <AccountSettingsDialog
          user={authUser}
          sessionsCount={sessions.length}
          limits={authStatus}
          onClearSessions={openClearSessionsFromAccount}
          onUpgrade={() => {
            setAccountSettingsOpen(false);
            openUpgradeDialog();
          }}
          onLegal={openLegalDialog}
          onSignOut={clearAuthToken}
          onClose={() => setAccountSettingsOpen(false)}
        />
      )}
      {favoritesOpen && (
        <FavoritesDialog
          sessions={favoriteSessions}
          activeId={currentSession?.id}
          onOpen={(sessionId) => {
            setFavoritesOpen(false);
            openSession(sessionId);
          }}
          onToggleFavorite={toggleSessionFavorite}
          isFavoriteBusy={(sessionId) => Boolean(busy[`favorite-${sessionId}`])}
          onClose={() => setFavoritesOpen(false)}
        />
      )}
      {helpDialogOpen && (
        <HelpFeedbackDialog
          feedbackText={feedbackText}
          isBusy={busy.feedback}
          onFeedbackChange={setFeedbackText}
          onSubmitFeedback={submitFeedback}
          onClose={() => setHelpDialogOpen(false)}
        />
      )}
      {legalDialogKind && (
        <LegalDialog
          kind={legalDialogKind}
          onSwitch={setLegalDialogKind}
          onClose={() => setLegalDialogKind(null)}
        />
      )}
      {authDialogOpen && !isAccessLocked && (
        <AccessGate
          asDialog
          apiOnline={apiOnline}
          authMode={authStatus?.auth_mode ?? "account"}
          formMode={authFormMode}
          email={authEmail}
          password={accessPassword}
          error={accessError}
          isBusy={busy.auth}
          limits={authStatus}
          googleAuthEnabled={Boolean(authStatus?.google_auth_enabled)}
          onClose={() => setAuthDialogOpen(false)}
          onFormModeChange={handleAuthFormModeChange}
          onEmailChange={setAuthEmail}
          onPasswordChange={setAccessPassword}
          onGoogleAuth={handleGoogleAuth}
          onSubmit={handleAccessLogin}
        />
      )}
    </div>
  );
}

function LandingPage({ limits, onLogin, onSignup, onUpgrade, onLegal }) {
  const featureCards = [
    {
      icon: FileText,
      title: "AI Notes",
      body: "Condense long lectures, slides, and homework solutions into the ideas most likely to matter on an exam.",
    },
    {
      icon: ClipboardList,
      title: "Cheat Sheets",
      body: "Turn formulas, processes, and common traps into one compact review sheet.",
    },
    {
      icon: CircleHelp,
      title: "Practice Quiz",
      body: "Generate mixed practice questions and get explanations after each answer.",
    },
    {
      icon: BookMarked,
      title: "Mistake Notebook",
      body: "Missed quiz questions are saved automatically so weak spots do not disappear.",
    },
    {
      icon: MessageSquareText,
      title: "Ask AI Tutor",
      body: "Ask focused questions grounded in the material you uploaded or pasted.",
    },
    {
      icon: Layers3,
      title: "Flashcards",
      body: "Build recall cards for definitions, concepts, and exam vocabulary.",
    },
  ];

  const workflowSteps = [
    {
      icon: Upload,
      title: "Upload or paste material",
      body: "PDFs, docs, slides, homework solutions, lecture notes, and pasted text.",
    },
    {
      icon: Sparkles,
      title: "Generate a study pack",
      body: "Notes, cheat sheet, flashcards, and practice quiz from the same source.",
    },
    {
      icon: Target,
      title: "Practice what matters",
      body: "Review missed questions and ask the tutor when something is still unclear.",
    },
  ];

  return (
    <main className="marketing-page">
      <header className="marketing-nav">
        <div className="brand-lockup">
          <div className="brand-mark marketing-brand-mark">
            <BookOpen size={22} aria-hidden="true" />
          </div>
          <div>
            <h1>{APP_NAME}</h1>
            <p>Exam-ready AI study workspace</p>
          </div>
        </div>
        <nav className="marketing-links" aria-label="Product navigation">
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="marketing-actions">
          <button className="sign-out-button" type="button" onClick={onLogin}>
            Log in
          </button>
          <button type="button" onClick={onSignup}>
            <Sparkles size={16} aria-hidden="true" />
            <span>Sign up free</span>
          </button>
        </div>
      </header>

      <section className="marketing-hero">
        <div className="hero-copy">
          <span className="eyebrow">Built for the week before an exam</span>
          <h2>Turn messy course material into a focused study plan.</h2>
          <p>
            Upload slides, PDFs, homework solutions, or pasted notes. AI Study Forge creates the notes,
            cheat sheets, quizzes, flashcards, and mistake reviews students actually use before a test.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={onSignup}>
              <Sparkles size={16} aria-hidden="true" />
              <span>Start studying free</span>
            </button>
            <button className="sign-out-button" type="button" onClick={onLogin}>
              Log in
            </button>
          </div>
          <div className="hero-proof" aria-label="Product highlights">
            <div>
              <strong>PDF, DOCX, slides</strong>
              <span>Upload or paste text</span>
            </div>
            <div>
              <strong>Math ready</strong>
              <span>LaTeX rendering for formulas</span>
            </div>
            <div>
              <strong>Mistakes saved</strong>
              <span>Wrong quiz answers become review notes</span>
            </div>
          </div>
        </div>

        <section className="product-preview" aria-label="AI Study Forge product preview">
          <div className="preview-topline">
            <div>
              <span>Study pack</span>
              <strong>Algorithms midterm</strong>
            </div>
            <span className="preview-status">Ready</span>
          </div>
          <div className="preview-source-card">
            <div className="preview-icon">
              <Upload size={18} aria-hidden="true" />
            </div>
            <div>
              <strong>Lecture PDF parsed</strong>
              <span>18,420 characters converted into review material</span>
            </div>
          </div>
          <div className="preview-grid">
            <div className="preview-card accent-teal">
              <FileText size={18} aria-hidden="true" />
              <strong>AI Notes</strong>
              <span>Key ideas, examples, and exam traps</span>
            </div>
            <div className="preview-card accent-blue">
              <ClipboardList size={18} aria-hidden="true" />
              <strong>Cheat Sheet</strong>
              <span>Formulas and step-by-step templates</span>
            </div>
            <div className="preview-card accent-amber">
              <CircleHelp size={18} aria-hidden="true" />
              <strong>Practice Quiz</strong>
              <span>5 questions with explanations</span>
            </div>
            <div className="preview-card accent-red">
              <BookMarked size={18} aria-hidden="true" />
              <strong>Mistakes</strong>
              <span>2 weak spots saved for review</span>
            </div>
          </div>
        </section>
      </section>

      <section className="marketing-band" id="workflow">
        <div className="marketing-section-heading">
          <span className="eyebrow">Simple workflow</span>
          <h2>From raw notes to exam practice in three steps.</h2>
        </div>
        <div className="workflow-grid">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article className="workflow-card" key={step.title}>
                <span className="workflow-number">0{index + 1}</span>
                <div className="workflow-icon">
                  <Icon size={20} aria-hidden="true" />
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="marketing-band" id="features">
        <div className="marketing-section-heading">
          <span className="eyebrow">Study tools</span>
          <h2>Everything points back to faster review.</h2>
        </div>
        <div className="feature-grid">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <article className="feature-card" key={feature.title}>
                <div className="feature-icon">
                  <Icon size={19} aria-hidden="true" />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="marketing-pricing" id="pricing">
        <div>
          <span className="eyebrow">Beta plan</span>
          <h2>Start with a focused free workspace.</h2>
          <p>
            Current beta users can generate study tools within daily limits. Pro exam prep and exportable
            study packs will be added after payment testing is complete.
          </p>
        </div>
        <div className="pricing-card">
          <div className="pricing-icon">
            <Crown size={20} aria-hidden="true" />
          </div>
          <strong>Free beta</strong>
          <span>{limits?.per_user_daily_ai_limit ?? 20} AI generations per day</span>
          <button type="button" onClick={onSignup}>
            <Sparkles size={16} aria-hidden="true" />
            <span>Create account</span>
          </button>
          <button className="sign-out-button" type="button" onClick={onUpgrade}>
            See planned Pro
          </button>
        </div>
      </section>

      <footer className="marketing-footer">
        <span>{APP_NAME}</span>
        <div>
          <button className="marketing-footer-link" type="button" onClick={() => onLegal("privacy")}>
            Privacy
          </button>
          <button className="marketing-footer-link" type="button" onClick={() => onLegal("terms")}>
            Terms
          </button>
        </div>
      </footer>
    </main>
  );
}

const AccountMenu = React.forwardRef(function AccountMenu(
  {
    user,
    isOpen,
    sessionsCount,
    favoritesCount,
    limits,
    onToggle,
    onUpgrade,
    onSettings,
    onFavorites,
    onHelp,
    onLegal,
    onSignOut,
  },
  ref,
) {
  const rawEmail = user?.email || "";
  const displayEmail = maskEmail(rawEmail) || "Signed in";
  const plan = user?.plan ? `${user.plan.slice(0, 1).toUpperCase()}${user.plan.slice(1)}` : "Free";
  const initial = getAccountInitial(rawEmail || displayEmail);

  return (
    <div className="account-menu" ref={ref}>
      <button
        className="account-avatar-button"
        type="button"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        {initial}
      </button>

      {isOpen && (
        <section className="account-dropdown" role="menu" aria-label="Account menu">
          <div className="account-profile-row">
            <div className="account-avatar-large" aria-hidden="true">
              {initial}
            </div>
            <div>
              <strong>{displayEmail}</strong>
              <span>{plan} plan</span>
            </div>
          </div>

          <div className="account-metrics">
            <div>
              <span>History</span>
              <strong>{sessionsCount}</strong>
            </div>
            <div>
              <span>Favorites</span>
              <strong>{favoritesCount}</strong>
            </div>
            <div>
              <span>AI limit</span>
              <strong>{limits?.per_user_daily_ai_limit ?? 0}</strong>
            </div>
          </div>

          <button className="account-menu-item" type="button" role="menuitem" onClick={onSettings}>
            <LibraryBig size={16} aria-hidden="true" />
            <span>
              <strong>Account settings</strong>
              <small>Profile and preferences</small>
            </span>
          </button>

          <button className="account-menu-item" type="button" role="menuitem" onClick={onFavorites}>
            <Star size={16} aria-hidden="true" />
            <span>
              <strong>Favorites</strong>
              <small>{favoritesCount ? `${favoritesCount} saved study record${favoritesCount === 1 ? "" : "s"}` : "Bookmark key study records"}</small>
            </span>
          </button>

          <button className="account-menu-item" type="button" role="menuitem" onClick={onUpgrade}>
            <Crown size={16} aria-hidden="true" />
            <span>
              <strong>Unlock Pro</strong>
              <small>Exam packs, exports, and higher limits</small>
            </span>
          </button>

          <button className="account-menu-item" type="button" role="menuitem" onClick={onHelp}>
            <CircleHelp size={16} aria-hidden="true" />
            <span>
              <strong>Help & feedback</strong>
              <small>Support and product requests</small>
            </span>
          </button>

          <button className="account-menu-item" type="button" role="menuitem" onClick={() => onLegal("privacy")}>
            <FileText size={16} aria-hidden="true" />
            <span>
              <strong>Privacy & terms</strong>
              <small>Policies for beta users</small>
            </span>
          </button>

          <button className="account-menu-item danger" type="button" role="menuitem" onClick={onSignOut}>
            <XCircle size={16} aria-hidden="true" />
            <span>
              <strong>Sign out</strong>
              <small>End this browser session</small>
            </span>
          </button>
        </section>
      )}
    </div>
  );
});

function getAccountInitial(email) {
  return (email.trim()[0] || "A").toUpperCase();
}

function maskEmail(email = "") {
  const normalized = email.trim();
  if (!normalized) {
    return "";
  }
  if (!normalized.includes("@")) {
    return normalized;
  }

  const [local, domain] = normalized.split("@");
  const visibleLocal =
    local.length <= 2 ? local.slice(0, 1) : `${local.slice(0, 2)}...${local.slice(-1)}`;
  const [domainName = "", ...domainParts] = domain.split(".");
  const topLevel = domainParts.length ? domainParts[domainParts.length - 1] : "";
  const visibleDomain = domainName ? `${domainName[0]}***${topLevel ? `.${topLevel}` : ""}` : "email";

  return `${visibleLocal}@${visibleDomain}`;
}

function formatCount(count, singular, plural = `${singular}s`) {
  const value = Number(count) || 0;
  return `${value} ${value === 1 ? singular : plural}`;
}

function DashboardPanel({
  sessions,
  stats,
  hasMaterial,
  currentSession,
  quizReview,
  onOpenSession,
  onSelectTool,
  onGeneratePack,
  onUploadFocus,
  isGeneratingPack,
  onUpgrade,
}) {
  const recentSessions = sessions.slice(0, 4);
  const missedCount = quizReview?.incorrect?.length ?? 0;
  const readinessItems = [
    { label: "Material", value: stats.files ? "Added" : "Not added" },
    { label: "AI Notes", value: stats.notes ? "Ready" : "Not ready" },
    { label: "Practice Quiz", value: stats.questions ? `${stats.questions} questions` : "Not ready" },
    { label: "Flashcards", value: stats.flashcards ? `${stats.flashcards} flashcards` : "Not ready" },
    { label: "Mistakes", value: missedCount ? `${missedCount} to review` : "No review yet" },
  ];

  const tasks = [
    {
      title: "Exam Review Pack",
      body: "One workflow creates AI Notes, Cheat Sheet, Flashcards, and a broad Practice Quiz.",
      icon: GraduationCap,
      status: "Main workflow",
    },
    {
      title: "Practice Quiz",
      body: "Answer a broad mixed quiz. Missed questions are saved to Mistakes automatically.",
      icon: CircleHelp,
      action: stats.questions ? "Review" : "Generate",
      requiresMaterial: true,
      onClick: () => onSelectTool("quiz"),
    },
    {
      title: "Ask AI Tutor",
      body: "Ask focused questions grounded in the uploaded material.",
      icon: MessageSquareText,
      action: "Ask",
      requiresMaterial: true,
      onClick: () => onSelectTool("chat"),
    },
    {
      title: "Mistake Notebook",
      body: "Turn missed quiz questions into targeted review notes.",
      icon: BookMarked,
      action: "Open",
      onClick: () => onSelectTool("mistakes"),
    },
  ];

  return (
    <section className="dashboard-panel">
      <div className="dashboard-hero">
        <div>
          <span className="eyebrow">Exam-ready study workspace</span>
          <h3>Turn your lecture slides into an exam review pack</h3>
          <p>
            Upload PDFs, slides, notes, or homework materials to generate cheat sheets, practice quizzes,
            flashcards, and AI tutor responses based on your course content.
          </p>
          {!hasMaterial && (
            <p className="hero-hint">Start by uploading a file or pasting course material on the left.</p>
          )}
        </div>
        <div className="dashboard-hero-actions">
          <button type="button" onClick={onGeneratePack} disabled={!hasMaterial || isGeneratingPack}>
            {isGeneratingPack ? <Loader2 className="spin" size={16} /> : <GraduationCap size={16} />}
            <span>{isGeneratingPack ? "Generating Pack" : "Generate Exam Review Pack"}</span>
          </button>
          {!hasMaterial && (
            <button className="secondary-button" type="button" onClick={onUploadFocus}>
              <Upload size={16} />
              <span>Upload Study Material</span>
            </button>
          )}
        </div>
      </div>

      <div className="readiness-strip">
        {readinessItems.map((item) => (
          <div className="readiness-item" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="task-grid">
        {tasks.map((task) => {
          const Icon = task.icon;
          const taskDisabled = task.requiresMaterial && !hasMaterial;
          return (
            <article className="task-card" key={task.title}>
              <div className="task-icon">
                <Icon size={18} aria-hidden="true" />
              </div>
              <div>
                <h3>{task.title}</h3>
                <p>{task.body}</p>
              </div>
              {task.onClick ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={task.onClick}
                  disabled={taskDisabled}
                  title={taskDisabled ? "Upload material first to unlock exam prep tools" : undefined}
                >
                  <span>{task.action}</span>
                  <ArrowRight size={15} />
                </button>
              ) : (
                <span className="task-badge">{task.status}</span>
              )}
            </article>
          );
        })}
      </div>

      <div className="dashboard-lower">
        <section className="recent-panel">
          <div className="section-title-row">
            <h3>Continue Studying</h3>
          </div>
          {recentSessions.length ? (
            <div className="recent-session-list">
              {recentSessions.map((session) => (
                <button
                  className="recent-session"
                  type="button"
                  key={session.id}
                  onClick={() => onOpenSession(session.id)}
                >
                  <strong>
                    {session.is_favorite && <Star size={13} fill="currentColor" aria-hidden="true" />}
                    <span>{session.title}</span>
                  </strong>
                  <span>{sessionSummary(session)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">No history yet</div>
          )}
        </section>

        <section className="upgrade-panel-inline">
          <div className="upgrade-icon">
            <Crown size={18} aria-hidden="true" />
          </div>
          <h3>Unlock Pro Exam Prep</h3>
          <p>
            Generate full exam review packs with cheat sheets, practice exams, answer explanations,
            PDF export, and higher upload limits.
          </p>
          <button type="button" onClick={onUpgrade}>
            <Crown size={16} />
            <span>Unlock Pro</span>
          </button>
        </section>
      </div>
    </section>
  );
}

function ExamPrepPanel({
  hasMaterial,
  currentSession,
  onSelectTool,
  onGenerateSummary,
  onGenerateCheatSheet,
  onGenerateQuiz,
  onGenerateFlashcards,
  isBusy,
}) {
  const prepSteps = [
    {
      number: "01",
      title: "AI Notes",
      description: "Condensed explanation of the most testable ideas.",
      tab: "summary",
      generated: Boolean(currentSession?.summary),
      generateLabel: "Generate Notes",
      showLabel: "Show AI Notes",
      onGenerate: onGenerateSummary,
    },
    {
      number: "02",
      title: "Cheat Sheet",
      description: "Formulas, processes, and key mistakes in one review sheet.",
      tab: "cheat-sheet",
      generated: Boolean(currentSession?.cheat_sheet),
      generateLabel: "Generate Sheet",
      showLabel: "Show Sheet",
      onGenerate: onGenerateCheatSheet,
    },
    {
      number: "03",
      title: "Practice Quiz",
      description: "A broad mixed quiz. Missed questions are saved to Mistakes automatically.",
      tab: "quiz",
      generated: Boolean(currentSession?.quiz?.length),
      generateLabel: "Generate Quiz",
      showLabel: "Show Quiz",
      onGenerate: onGenerateQuiz,
    },
    {
      number: "04",
      title: "Flashcards",
      description: "Quick recall cards for definitions, facts, and core concepts.",
      tab: "flashcards",
      generated: Boolean(currentSession?.flashcards?.length),
      generateLabel: "Generate Cards",
      showLabel: "Show Cards",
      onGenerate: onGenerateFlashcards,
    },
  ];

  return (
    <section className="content-panel exam-prep-panel">
      <div className="content-header">
        <div>
          <h3>Exam Review Pack</h3>
        </div>
        <button type="button" onClick={() => onSelectTool("dashboard")}>
          <LayoutDashboard size={16} />
          <span>Dashboard</span>
        </button>
      </div>

      <div className="exam-prep-hero">
        <div>
          <span className="eyebrow">{currentSession ? currentSession.title : "Current material"}</span>
          <h3>{hasMaterial ? "Generate your exam review pack" : "Add material to start"}</h3>
          <p>
            {hasMaterial
              ? "Generate the core study assets students need before an exam."
              : "Upload a file or paste notes on the left, then return here."}
          </p>
        </div>
      </div>

      <div className="prep-step-grid">
        {prepSteps.map((step) => {
          const Icon = step.generated ? ArrowRight : Sparkles;
          return (
            <article className="prep-step" key={step.tab}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <button
                type="button"
                onClick={step.generated ? () => onSelectTool(step.tab) : step.onGenerate}
                disabled={!hasMaterial || (!step.generated && isBusy)}
              >
                <Icon size={16} />
                <span>{step.generated ? step.showLabel : step.generateLabel}</span>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MistakeNotebookPanel({
  review,
  savedReview,
  onSelectQuiz,
}) {
  const savedQuiz = parseSavedQuizReview(savedReview);
  const issues = mistakeIssuesFrom(review ?? savedQuiz, "Practice Quiz");
  const savedTutorReview =
    review?.tutor_explanation ??
    savedQuiz?.tutor_explanation ??
    (typeof savedReview === "string" ? savedReview : "");
  return (
    <section className="content-panel">
      <div className="content-header">
        <div>
          <h3>Mistake Notebook</h3>
          <p>Practice Quiz questions you miss are saved here automatically.</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={onSelectQuiz}>
            <CircleHelp size={16} />
            <span>Practice Quiz</span>
          </button>
        </div>
      </div>

      {issues.length ? (
        <div className="mistake-list">
          {issues.map((issue, index) => (
            <article className="mistake-item" key={`${issue.question}-${index}`}>
              <span>{index + 1}</span>
              <div>
                <div className="mistake-meta">
                  <span>{issue.source}</span>
                  {issue.topic && <span>{issue.topic}</span>}
                </div>
                <h3>
                  <RenderedContent content={issue.question} inline />
                </h3>
                <p>
                  <strong>Your answer:</strong> {issue.selected_answer}
                </p>
                <p>
                  <strong>Correct answer:</strong> {issue.correct_answer}
                </p>
                <div className="mistake-explanation">
                  <RenderedContent content={issue.explanation} />
                </div>
                {issue.study_tip && (
                  <div className="mistake-explanation">
                    <strong>Study tip</strong>
                    <RenderedContent content={issue.study_tip} />
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : savedTutorReview ? (
        <article className="text-output">
          <RenderedContent content={savedTutorReview} />
        </article>
      ) : (
        <EmptyState
          icon={BookMarked}
          title="No mistakes saved yet"
          description="Missed Practice Quiz questions will appear here automatically."
        />
      )}
    </section>
  );
}

function AccessGate({
  asDialog = false,
  apiOnline,
  authMode = "beta",
  formMode = "login",
  email = "",
  password = "",
  error = "",
  isBusy = false,
  isLoading = false,
  limits = null,
  googleAuthEnabled = false,
  onClose = null,
  onFormModeChange = () => {},
  onEmailChange = () => {},
  onPasswordChange = () => {},
  onGoogleAuth = () => {},
  onSubmit = () => {},
}) {
  const isAccountMode = authMode === "account";
  const isSignup = formMode === "signup";
  const canUseGoogleAuth = isAccountMode && googleAuthEnabled;
  const title = isLoading
    ? "Checking access"
    : isAccountMode
      ? isSignup
        ? "Create your study account"
        : "Sign in to your study account"
      : "Enter beta access password";
  const description = isLoading
    ? "Preparing your study workspace."
    : isAccountMode
      ? "Save your study history, notes, quizzes, mistakes, and review progress to your account."
      : "This beta is protected to control OpenAI usage while testing.";

  const panel = (
      <section className={asDialog ? "access-panel dialog" : "access-panel"}>
        {asDialog && (
          <button
            className="access-close-button"
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close login dialog"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
        <div className="access-icon">
          <BookOpen size={24} aria-hidden="true" />
        </div>
        <div className="access-copy">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        {isLoading ? (
          <div className="access-loading">
            <Loader2 className="spin" size={18} />
            <span>{apiOnline ? "Loading access settings" : "Waiting for API"}</span>
          </div>
        ) : (
          <form className="access-form" onSubmit={onSubmit}>
            {isAccountMode && (
              <>
                <div className="auth-mode-toggle" role="tablist" aria-label="Authentication mode">
                  <button
                    className={formMode === "login" ? "active" : ""}
                    type="button"
                    onClick={() => onFormModeChange("login")}
                  >
                    Login
                  </button>
                  <button
                    className={formMode === "signup" ? "active" : ""}
                    type="button"
                    onClick={() => onFormModeChange("signup")}
                  >
                    Sign up
                  </button>
                </div>

                {canUseGoogleAuth && (
                  <>
                    <button
                      className="google-auth-button"
                      type="button"
                      onClick={onGoogleAuth}
                      disabled={isBusy}
                      title="Continue with Google"
                    >
                      <span className="google-mark" aria-hidden="true">
                        G
                      </span>
                      <span>Continue with Google</span>
                    </button>

                    <div className="auth-divider" aria-hidden="true">
                      <span>or use email</span>
                    </div>
                  </>
                )}

                <label className="field-label" htmlFor="access-email">
                  Email
                </label>
                <input
                  id="access-email"
                  type="email"
                  value={email}
                  autoComplete="email"
                  onChange={(event) => onEmailChange(event.target.value)}
                  placeholder="you@example.com"
                />
              </>
            )}
            <label className="field-label" htmlFor="access-password">
              {isAccountMode ? "Password" : "Access Password"}
            </label>
            <input
              id="access-password"
              type="password"
              value={password}
              autoComplete={isSignup ? "new-password" : "current-password"}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder={isAccountMode ? "Enter password" : "Enter beta password"}
            />
            {error && <div className="access-error">{error}</div>}
            <button
              type="submit"
              disabled={isBusy || password.trim().length < 1 || (isAccountMode && email.trim().length < 3)}
            >
              {isBusy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
              <span>{isAccountMode ? (isSignup ? "Create account" : "Login") : "Unlock"}</span>
            </button>
          </form>
        )}

        {limits && (
          <div className="access-limits">
            <span>{limits.per_user_daily_ai_limit} AI generations per visitor per day</span>
            <span>{limits.global_daily_ai_limit} site-wide AI generations per day</span>
          </div>
        )}
      </section>
  );

  if (asDialog) {
    return (
      <div
        className="modal-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isBusy && onClose) {
            onClose();
          }
        }}
      >
        <div className="access-dialog-shell" role="dialog" aria-modal="true">
          {panel}
        </div>
      </div>
    );
  }

  return (
    <main className="access-shell" aria-label="Access gate">
      {panel}
    </main>
  );
}

function AccountSettingsDialog({
  user,
  sessionsCount,
  limits,
  onClearSessions,
  onUpgrade,
  onLegal,
  onSignOut,
  onClose,
}) {
  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  const email = user?.email || "";
  const displayEmail = maskEmail(email) || "Signed in";
  const plan = user?.plan ? `${user.plan.slice(0, 1).toUpperCase()}${user.plan.slice(1)}` : "Free";

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropClick}>
      <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-settings-title">
        <button className="dialog-close-button" type="button" onClick={onClose} aria-label="Close account settings">
          <X size={18} />
        </button>
        <div className="account-dialog-icon">
          <LibraryBig size={22} aria-hidden="true" />
        </div>
        <div className="account-dialog-copy">
          <span className="eyebrow">Account</span>
          <h2 id="account-settings-title">Account settings</h2>
          <p>Manage your profile, usage, plan, and study history.</p>
        </div>

        <div className="account-detail-grid">
          <div className="account-detail-card">
            <span>Email</span>
            <strong>{displayEmail}</strong>
          </div>
          <div className="account-detail-card">
            <span>Plan</span>
            <strong>{plan}</strong>
          </div>
          <div className="account-detail-card">
            <span>History records</span>
            <strong>{sessionsCount}</strong>
          </div>
          <div className="account-detail-card">
            <span>Daily AI limit</span>
            <strong>{limits?.per_user_daily_ai_limit ?? 0}</strong>
          </div>
        </div>

        <div className="account-settings-section">
          <h3>Plan and billing</h3>
          <p>Payments are not enabled yet. Use this entry point later for Stripe billing, invoices, and plan changes.</p>
          <button type="button" onClick={onUpgrade}>
            <Crown size={16} />
            <span>View upgrade options</span>
          </button>
        </div>

        <div className="account-settings-section">
          <h3>Legal and privacy</h3>
          <p>Review the current beta policies for data handling, AI output limitations, and acceptable use.</p>
          <div className="account-dialog-actions left">
            <button className="secondary-button" type="button" onClick={() => onLegal("privacy")}>
              <FileText size={16} />
              <span>Privacy Policy</span>
            </button>
            <button className="secondary-button" type="button" onClick={() => onLegal("terms")}>
              <ClipboardCheck size={16} />
              <span>Terms</span>
            </button>
          </div>
        </div>

        <div className="account-settings-section">
          <h3>Data management</h3>
          <p>Clear study history from this account when you want to reset the workspace.</p>
          <div className="account-dialog-actions">
            <button className="secondary-button" type="button" onClick={onClearSessions}>
              <Trash2 size={16} />
              <span>Clear history</span>
            </button>
            <button className="danger-button" type="button" onClick={onSignOut}>
              <XCircle size={16} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FavoritesDialog({
  sessions,
  activeId,
  onOpen,
  onToggleFavorite,
  isFavoriteBusy,
  onClose,
}) {
  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropClick}>
      <section className="account-dialog favorites-dialog" role="dialog" aria-modal="true" aria-labelledby="favorites-title">
        <button className="dialog-close-button" type="button" onClick={onClose} aria-label="Close favorites">
          <X size={18} />
        </button>
        <div className="account-dialog-icon">
          <Star size={22} fill="currentColor" aria-hidden="true" />
        </div>
        <div className="account-dialog-copy">
          <span className="eyebrow">Study shortcuts</span>
          <h2 id="favorites-title">Favorites</h2>
          <p>Keep important study records one click away from your account menu.</p>
        </div>

        {sessions.length ? (
          <div className="favorite-list">
            {sessions.map((session) => {
              const favoriteBusy = isFavoriteBusy(session.id);
              return (
                <div className={session.id === activeId ? "favorite-row active" : "favorite-row"} key={session.id}>
                  <button className="favorite-row-main" type="button" onClick={() => onOpen(session.id)}>
                    <strong>{session.title}</strong>
                    <span>{sessionSummary(session)}</span>
                  </button>
                  <button
                    className="favorite-list-action"
                    type="button"
                    onClick={() => onToggleFavorite(session.id, false)}
                    disabled={favoriteBusy}
                    title={`Remove ${session.title} from favorites`}
                    aria-label={`Remove ${session.title} from favorites`}
                  >
                    {favoriteBusy ? <Loader2 className="spin" size={15} /> : <Star size={15} fill="currentColor" />}
                    <span>Remove</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Star}
            title="No favorites yet"
            description="Use the star on any history record to save it here."
          />
        )}
      </section>
    </div>
  );
}

function HelpFeedbackDialog({
  feedbackText,
  isBusy,
  onFeedbackChange,
  onSubmitFeedback,
  onClose,
}) {
  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && !isBusy) {
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropClick}>
      <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="help-feedback-title">
        <button
          className="dialog-close-button"
          type="button"
          onClick={onClose}
          disabled={isBusy}
          aria-label="Close help and feedback"
        >
          <X size={18} />
        </button>
        <div className="account-dialog-icon">
          <CircleHelp size={22} aria-hidden="true" />
        </div>
        <div className="account-dialog-copy">
          <span className="eyebrow">Support</span>
          <h2 id="help-feedback-title">Help & feedback</h2>
          <p>Quick answers for beta users, plus a feedback form saved for product review.</p>
        </div>

        <div className="help-topic-list">
          <div>
            <strong>Where is my study history saved?</strong>
            <p>History records are saved to your account after you generate a study tool from uploaded or pasted material.</p>
          </div>
          <div>
            <strong>Why is Google login not active yet?</strong>
            <p>Google OAuth needs a configured Google Client ID and Secret before launch.</p>
          </div>
          <div>
            <strong>What should I test before launch?</strong>
            <p>Test upload, AI Notes, Cheat Sheet, Practice Quiz, Mistakes, Flashcards, and Ask AI Tutor.</p>
          </div>
        </div>

        <form className="feedback-form" onSubmit={onSubmitFeedback}>
          <label className="field-label" htmlFor="feedback-message">
            Feedback
          </label>
          <textarea
            id="feedback-message"
            value={feedbackText}
            onChange={(event) => onFeedbackChange(event.target.value)}
            placeholder="Tell us what confused you, what broke, or what would make exam prep faster."
            rows={5}
          />
          <div className="account-dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose} disabled={isBusy}>
              Cancel
            </button>
            <button type="submit" disabled={isBusy || feedbackText.trim().length < 10}>
              {isBusy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
              <span>Send feedback</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel, cancelLabel, isBusy, onCancel, onConfirm }) {
  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && !isBusy) {
      onCancel();
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropClick}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className="confirm-dialog-icon">
          <Trash2 size={20} aria-hidden="true" />
        </div>
        <div className="confirm-dialog-copy">
          <h2 id="confirm-dialog-title">{title}</h2>
          <p>{message}</p>
        </div>
        <div className="confirm-dialog-actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={isBusy}>
            {cancelLabel}
          </button>
          <button className="danger-button" type="button" onClick={onConfirm} disabled={isBusy}>
            {isBusy ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function UpgradeDialog({ onClose }) {
  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropClick}>
      <section className="upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="upgrade-dialog-title">
        <button className="dialog-close-button" type="button" onClick={onClose} aria-label="Close upgrade dialog">
          <X size={18} />
        </button>
        <div className="upgrade-dialog-icon">
          <Crown size={22} aria-hidden="true" />
        </div>
        <div className="upgrade-dialog-copy">
          <span className="eyebrow">Beta access</span>
          <h2 id="upgrade-dialog-title">Pro upgrade is coming soon</h2>
          <p>
            Payments are not enabled yet. You can keep testing the current exam prep tools with the beta limits.
          </p>
        </div>
        <div className="upgrade-dialog-list">
          <span>Planned Pro features</span>
          <ul>
            <li>Higher daily AI generation limits</li>
            <li>Exportable study packs</li>
            <li>Practice exam mode</li>
          </ul>
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" onClick={onClose}>
            <CheckCircle2 size={16} />
            <span>Got it</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function LegalDialog({ kind, onSwitch, onClose }) {
  const isPrivacy = kind === "privacy";
  const title = isPrivacy ? "Privacy Policy" : "Terms of Service";
  const description = isPrivacy
    ? "How AI Study Forge handles study material, accounts, and product usage data during beta."
    : "The basic rules for using AI Study Forge as an exam-prep study tool.";

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropClick}>
      <section className="legal-dialog" role="dialog" aria-modal="true" aria-labelledby="legal-dialog-title">
        <button className="dialog-close-button" type="button" onClick={onClose} aria-label={`Close ${title}`}>
          <X size={18} />
        </button>
        <div className="account-dialog-icon">
          {isPrivacy ? <FileText size={22} aria-hidden="true" /> : <ClipboardCheck size={22} aria-hidden="true" />}
        </div>
        <div className="account-dialog-copy">
          <span className="eyebrow">{APP_DOMAIN}</span>
          <h2 id="legal-dialog-title">{title}</h2>
          <p>{description}</p>
        </div>

        <div className="legal-toggle" role="tablist" aria-label="Legal document">
          <button className={isPrivacy ? "active" : ""} type="button" onClick={() => onSwitch("privacy")}>
            Privacy Policy
          </button>
          <button className={!isPrivacy ? "active" : ""} type="button" onClick={() => onSwitch("terms")}>
            Terms of Service
          </button>
        </div>

        <div className="legal-content">
          <p className="legal-updated">Last updated: {LEGAL_LAST_UPDATED}</p>
          {isPrivacy ? <PrivacyPolicyContent /> : <TermsOfServiceContent />}
        </div>
      </section>
    </div>
  );
}

function PrivacyPolicyContent() {
  return (
    <>
      <section>
        <h3>Information we process</h3>
        <p>
          {APP_NAME} processes account details, uploaded or pasted study material, generated notes,
          quizzes, flashcards, tutor chat history, mistake review data, and basic usage metadata needed to
          run the product.
        </p>
      </section>
      <section>
        <h3>How we use information</h3>
        <p>
          We use this information to generate study tools, save study history to your account, enforce usage
          limits, troubleshoot errors, improve product quality, and protect the service from abuse.
        </p>
      </section>
      <section>
        <h3>AI providers</h3>
        <p>
          Study material may be sent to AI model providers, including OpenAI, to generate summaries,
          cheat sheets, quizzes, flashcards, and tutor responses. Do not upload highly sensitive personal,
          medical, financial, or confidential information.
        </p>
      </section>
      <section>
        <h3>Data control</h3>
        <p>
          You can delete individual history records or clear saved history from the app. Some operational logs
          and backups may remain for a limited period for security, debugging, and reliability.
        </p>
      </section>
      <section>
        <h3>Contact</h3>
        <p>
          For privacy questions, use the Help & feedback form in the account menu while the product is in beta.
        </p>
      </section>
    </>
  );
}

function TermsOfServiceContent() {
  return (
    <>
      <section>
        <h3>Use of the service</h3>
        <p>
          {APP_NAME} is an AI-assisted study workspace for summarizing course material, creating practice
          tools, and reviewing mistakes. You are responsible for deciding whether generated content is
          correct and appropriate for your class.
        </p>
      </section>
      <section>
        <h3>No guarantee of grades or accuracy</h3>
        <p>
          AI output can be incomplete or wrong. The service does not guarantee exam scores, academic
          outcomes, or perfect explanations. Always verify important material against your course notes,
          textbook, instructor guidance, or official solutions.
        </p>
      </section>
      <section>
        <h3>Acceptable use</h3>
        <p>
          Do not use the service to cheat, violate academic rules, upload material you do not have the
          right to use, attack the system, scrape at high volume, or bypass usage limits.
        </p>
      </section>
      <section>
        <h3>Beta product status</h3>
        <p>
          The product is currently in beta. Features, limits, pricing, availability, and saved data behavior
          may change as the product is prepared for broader launch.
        </p>
      </section>
      <section>
        <h3>Plans and billing</h3>
        <p>
          Paid plans are not active yet. Upgrade screens describe planned features only until payments are
          enabled through a production billing provider.
        </p>
      </section>
    </>
  );
}

function PanelHeader({ icon: Icon, title, compact = false }) {
  return (
    <div className={compact ? "panel-heading compact" : "panel-heading"}>
      <Icon size={18} aria-hidden="true" />
      <h2>{title}</h2>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SessionList({
  sessions,
  activeId,
  onOpen,
  onToggleFavorite,
  onDelete,
  isDeleting,
  isFavoriteBusy,
}) {
  if (!sessions.length) {
    return (
      <EmptyState
        icon={LibraryBig}
        title="No history yet"
        description="Add study material and generate a review pack to save your first record."
      />
    );
  }

  return (
    <div className="session-list">
      {sessions.map((session) => {
        const deleting = isDeleting(session.id);
        const favoriteBusy = isFavoriteBusy(session.id);
        return (
          <div className={session.id === activeId ? "session-row active" : "session-row"} key={session.id}>
            <button className="session-open" type="button" onClick={() => onOpen(session.id)}>
              <span className="session-name">{session.title}</span>
              <span className="session-meta">{sessionSummary(session)}</span>
            </button>
            <button
              className={session.is_favorite ? "session-favorite active" : "session-favorite"}
              type="button"
              onClick={() => onToggleFavorite(session.id, !session.is_favorite)}
              disabled={deleting || favoriteBusy}
              title={session.is_favorite ? `Remove ${session.title} from favorites` : `Add ${session.title} to favorites`}
              aria-label={session.is_favorite ? `Remove ${session.title} from favorites` : `Add ${session.title} to favorites`}
              aria-pressed={Boolean(session.is_favorite)}
            >
              {favoriteBusy ? (
                <Loader2 className="spin" size={14} />
              ) : (
                <Star size={14} fill={session.is_favorite ? "currentColor" : "none"} />
              )}
            </button>
            <button
              className="session-delete"
              type="button"
              onClick={() => onDelete(session.id)}
              disabled={deleting}
              title={`Delete ${session.title}`}
              aria-label={`Delete ${session.title}`}
            >
              {deleting ? <Loader2 className="spin" size={14} /> : <X size={14} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function sessionSummary(session) {
  return [
    formatCount(session.has_summary ? 1 : 0, "note"),
    formatCount(session.has_cheat_sheet ? 1 : 0, "cheat sheet"),
    formatCount(session.flashcard_count, "flashcard"),
    formatCount(session.quiz_count, "quiz question"),
  ].join(" \u00b7 ");
}

function SummaryPanel({ summary, isBusy, onGenerate }) {
  return (
    <section className="content-panel">
      <ContentHeader title="AI Notes" actionLabel="Generate" busy={isBusy} onAction={onGenerate} />
      {summary ? (
        <article className="text-output">
          <RenderedContent content={summary} />
        </article>
      ) : (
        <EmptyState
          icon={FileText}
          title="No AI notes yet"
          description="Generate concise notes after adding study material."
        />
      )}
    </section>
  );
}

function CheatSheetPanel({ cheatSheet, isBusy, onGenerate }) {
  return (
    <section className="content-panel">
      <ContentHeader title="Cheat Sheet" actionLabel="Generate" busy={isBusy} onAction={onGenerate} />
      {cheatSheet ? (
        <article className="text-output cheat-sheet-output">
          <RenderedContent content={cheatSheet} />
        </article>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No cheat sheet yet"
          description="Generate a focused sheet of formulas, steps, and exam traps."
        />
      )}
    </section>
  );
}

function FlashcardsPanel({ flashcards, isBusy, onGenerate }) {
  return (
    <section className="content-panel">
      <ContentHeader title="Flashcards" actionLabel="Generate" busy={isBusy} onAction={onGenerate} />
      {flashcards.length ? (
        <div className="flashcard-grid">
          {flashcards.map((card, index) => (
            <article className="flashcard" key={`${card.question}-${index}`}>
              <span className="number">{index + 1}</span>
              <h3>
                <RenderedContent content={card.question} inline />
              </h3>
              <div className="flashcard-answer">
                <RenderedContent content={card.answer} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Layers3}
          title="No flashcards yet"
          description="Generate recall cards from the current material."
        />
      )}
    </section>
  );
}

function DiagnosticPanel({
  questions,
  isBusy,
  isReviewing,
  selectedAnswers,
  review,
  savedReview,
  onSelectAnswer,
  onGenerate,
  onReview,
}) {
  const savedDiagnostic = parseSavedDiagnosticReview(savedReview);
  const activeReview = review ?? savedDiagnostic;

  return (
    <section className="content-panel">
      <div className="content-header">
        <div>
          <h3>Diagnostic Test</h3>
        </div>
        <div className="header-actions">
          <button type="button" onClick={onReview} disabled={isReviewing || !questions.length}>
            {isReviewing ? <Loader2 className="spin" size={16} /> : <GraduationCap size={16} />}
            <span>Review</span>
          </button>
          <button type="button" onClick={onGenerate} disabled={isBusy}>
            {isBusy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
            <span>Generate</span>
          </button>
        </div>
      </div>

      {questions.length ? (
        <>
          {activeReview && (
            <section className="diagnostic-report">
              <div className="score-panel diagnostic-score">
                <strong>{activeReview.score_percent ?? Math.round((activeReview.correct / activeReview.total) * 100)}%</strong>
                <span>
                  {activeReview.correct}/{activeReview.total} correct
                </span>
              </div>

              <div className="report-grid">
                <ReportList
                  title="Weak Topics"
                  items={activeReview.weak_topics}
                  emptyText="No major weak topics found"
                />
                <ReportList
                  title="Priority Review"
                  items={activeReview.priority_review}
                  emptyText="Keep practicing with harder questions"
                />
                <ReportList
                  title="Strengths"
                  items={activeReview.strengths}
                  emptyText="Review complete"
                />
              </div>

              {activeReview.tutor_explanation && (
                <article className="tutor-review">
                  <h3>Weakness Report</h3>
                  <RenderedContent content={activeReview.tutor_explanation} />
                </article>
              )}
            </section>
          )}

          <div className="quiz-list">
            {questions.map((question, index) => {
              const selectedAnswer = selectedAnswers[index] ?? "";
              const wasAnswered = Boolean(selectedAnswer);
              const isCorrect = wasAnswered && selectedAnswer === question.answer;

              return (
                <article className="quiz-item diagnostic-item" key={`${question.question}-${index}`}>
                  <div className="quiz-title">
                    <span>{index + 1}</span>
                    <div>
                      <div className="question-tags">
                        <span>{question.topic || "General"}</span>
                        <span>{question.difficulty || "medium"}</span>
                      </div>
                      <h3>
                        <RenderedContent content={question.question} inline />
                      </h3>
                    </div>
                  </div>
                  <div className="choice-list">
                    {question.choices.map((choice) => {
                      const isSelected = selectedAnswer === choice;
                      const isAnswer = wasAnswered && choice === question.answer;
                      const isWrongSelection = wasAnswered && isSelected && choice !== question.answer;
                      return (
                        <button
                          className={[
                            "choice-button",
                            isSelected ? "selected" : "",
                            isAnswer ? "correct" : "",
                            isWrongSelection ? "incorrect" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          key={choice}
                          type="button"
                          onClick={() => onSelectAnswer(index, choice)}
                        >
                          <RenderedContent content={choice} inline />
                        </button>
                      );
                    })}
                  </div>
                  {wasAnswered && (
                    <div className="instant-feedback">
                      <div className={isCorrect ? "answer correct" : "answer incorrect"}>
                        {isCorrect ? (
                          <CheckCircle2 size={16} aria-hidden="true" />
                        ) : (
                          <XCircle size={16} aria-hidden="true" />
                        )}
                        <span>
                          {isCorrect ? "Correct" : "Incorrect"} - Correct answer: {question.answer}
                        </span>
                      </div>
                      <div className="explanation">
                        <strong>Why</strong>
                        <RenderedContent content={question.explanation} />
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState icon={ClipboardCheck} title="No diagnostic test yet" />
      )}
    </section>
  );
}

function ReportList({ title, items = [], emptyText }) {
  const cleanItems = Array.isArray(items) ? items.filter(Boolean) : [];
  return (
    <article className="report-list">
      <h3>{title}</h3>
      {cleanItems.length ? (
        <ul>
          {cleanItems.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </article>
  );
}

function TargetedPracticePanel({
  questions,
  isBusy,
  isReviewing,
  selectedAnswers,
  review,
  savedReview,
  weakTopics,
  onSelectAnswer,
  onGenerate,
  onReview,
  onOpenDiagnostic,
}) {
  const savedTargeted = parseSavedTargetedPracticeReview(savedReview);
  const activeReview = review ?? savedTargeted;
  const cleanWeakTopics = Array.isArray(weakTopics) ? weakTopics.filter(Boolean) : [];

  return (
    <section className="content-panel">
      <div className="content-header">
        <div>
          <h3>Weak Topic Drill</h3>
          <p>Uses Diagnostic weak topics. Best after you review the diagnostic results.</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={onOpenDiagnostic}>
            <ClipboardCheck size={16} />
            <span>Diagnostic</span>
          </button>
          <button type="button" onClick={onReview} disabled={isReviewing || !questions.length}>
            {isReviewing ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
            <span>Check Mastery</span>
          </button>
          <button type="button" onClick={onGenerate} disabled={isBusy}>
            {isBusy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
            <span>Generate</span>
          </button>
        </div>
      </div>

      <div className="practice-context">
        <strong>Focus</strong>
        <span>
          {cleanWeakTopics.length
            ? cleanWeakTopics.join(", ")
            : "Run Diagnostic Review first so this drill knows which weak topics to practice."}
        </span>
      </div>

      {questions.length ? (
        <>
          {activeReview && (
            <section className="diagnostic-report">
              <div className="score-panel diagnostic-score">
                <strong>{activeReview.score_percent}%</strong>
                <span>
                  {activeReview.correct}/{activeReview.total} correct
                </span>
              </div>

              <div className="report-grid">
                <ReportList
                  title="Still Weak"
                  items={activeReview.still_weak_topics}
                  emptyText="No weak topics left in this drill"
                />
                <ReportList
                  title="Mastered"
                  items={activeReview.mastered_topics}
                  emptyText="Mastery not confirmed yet"
                />
                <ReportList
                  title="Next Steps"
                  items={activeReview.next_steps}
                  emptyText="Answer the drill to get next steps"
                />
              </div>
            </section>
          )}

          <div className="quiz-list">
            {questions.map((question, index) => {
              const selectedAnswer = selectedAnswers[index] ?? "";
              const wasAnswered = Boolean(selectedAnswer);
              const isCorrect = wasAnswered && selectedAnswer === question.answer;

              return (
                <article className="quiz-item diagnostic-item" key={`${question.question}-${index}`}>
                  <div className="quiz-title">
                    <span>{index + 1}</span>
                    <div>
                      <div className="question-tags">
                        <span>{question.topic || "General"}</span>
                        <span>{question.difficulty || "medium"}</span>
                      </div>
                      <h3>
                        <RenderedContent content={question.question} inline />
                      </h3>
                    </div>
                  </div>
                  <div className="choice-list">
                    {question.choices.map((choice) => {
                      const isSelected = selectedAnswer === choice;
                      const isAnswer = wasAnswered && choice === question.answer;
                      const isWrongSelection = wasAnswered && isSelected && choice !== question.answer;
                      return (
                        <button
                          className={[
                            "choice-button",
                            isSelected ? "selected" : "",
                            isAnswer ? "correct" : "",
                            isWrongSelection ? "incorrect" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          key={choice}
                          type="button"
                          onClick={() => onSelectAnswer(index, choice)}
                        >
                          <RenderedContent content={choice} inline />
                        </button>
                      );
                    })}
                  </div>
                  {wasAnswered && (
                    <div className="instant-feedback">
                      <div className={isCorrect ? "answer correct" : "answer incorrect"}>
                        {isCorrect ? (
                          <CheckCircle2 size={16} aria-hidden="true" />
                        ) : (
                          <XCircle size={16} aria-hidden="true" />
                        )}
                        <span>
                          {isCorrect ? "Correct" : "Incorrect"} - Correct answer: {question.answer}
                        </span>
                      </div>
                      <div className="explanation">
                        <strong>Why</strong>
                        <RenderedContent content={question.explanation} />
                      </div>
                      <div className="explanation">
                        <strong>Study tip</strong>
                        <RenderedContent content={question.study_tip} />
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState icon={Target} title="No weak-topic drill yet" />
      )}
    </section>
  );
}

function QuizPanel({
  questions,
  isBusy,
  isReviewing,
  selectedAnswers,
  review,
  savedReview,
  onSelectAnswer,
  onGenerate,
  onReview,
}) {
  const savedQuiz = parseSavedQuizReview(savedReview);
  const activeReview = review ?? savedQuiz;
  const tutorReview = activeReview?.tutor_explanation ?? "";

  return (
    <section className="content-panel">
      <div className="content-header">
        <div>
          <h3>Practice Quiz</h3>
          <p>Broad mixed quiz from the whole material. Best as a final self-check.</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={onReview} disabled={isReviewing || !questions.length}>
            {isReviewing ? <Loader2 className="spin" size={16} /> : <GraduationCap size={16} />}
            <span>Review</span>
          </button>
          <button type="button" onClick={onGenerate} disabled={isBusy}>
            {isBusy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
            <span>Generate</span>
          </button>
        </div>
      </div>
      {questions.length ? (
        <>
          {activeReview?.total && tutorReview && (
            <div className="score-panel">
              <strong>
                {activeReview.correct}/{activeReview.total}
              </strong>
              <span>{activeReview.incorrect?.length ? "Review the missed concepts below" : "All correct"}</span>
            </div>
          )}

          <div className="quiz-list">
            {questions.map((question, index) => {
              const selectedAnswer = selectedAnswers[index] ?? "";
              const wasAnswered = Boolean(selectedAnswer);
              const isCorrect = wasAnswered && selectedAnswer === question.answer;

              return (
                <article className="quiz-item" key={`${question.question}-${index}`}>
                  <div className="quiz-title">
                    <span>{index + 1}</span>
                    <h3>
                      <RenderedContent content={question.question} inline />
                    </h3>
                  </div>
                  <div className="choice-list">
                    {question.choices.map((choice) => {
                      const isSelected = selectedAnswer === choice;
                      const isAnswer = wasAnswered && choice === question.answer;
                      const isWrongSelection = wasAnswered && isSelected && choice !== question.answer;
                      return (
                        <button
                          className={[
                            "choice-button",
                            isSelected ? "selected" : "",
                            isAnswer ? "correct" : "",
                            isWrongSelection ? "incorrect" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          key={choice}
                          type="button"
                          onClick={() => onSelectAnswer(index, choice)}
                        >
                          <RenderedContent content={choice} inline />
                        </button>
                      );
                    })}
                  </div>
                  {wasAnswered && (
                    <div className="instant-feedback">
                      <div className={isCorrect ? "answer correct" : "answer incorrect"}>
                        {isCorrect ? (
                          <CheckCircle2 size={16} aria-hidden="true" />
                        ) : (
                          <XCircle size={16} aria-hidden="true" />
                        )}
                        <span>
                          {isCorrect ? "Correct" : "Incorrect"} - Correct answer: {question.answer}
                        </span>
                      </div>
                      <div className="explanation">
                        <strong>Explanation</strong>
                        <RenderedContent content={question.explanation} />
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {tutorReview && (
            <article className="tutor-review">
              <h3>AI Tutor Review</h3>
              <RenderedContent content={tutorReview} />
            </article>
          )}
        </>
      ) : (
        <EmptyState
          icon={CircleHelp}
          title="No practice quiz yet"
          description="Generate a broad self-check quiz from your study material."
        />
      )}
    </section>
  );
}

function ChatPanel({ messages, question, isBusy, onQuestionChange, onSubmit }) {
  return (
    <section className="content-panel chat-panel">
      <div className="content-header">
        <div>
          <h3>Ask AI Tutor</h3>
        </div>
      </div>
      <div className="chat-log">
        {messages.length ? (
          messages.map((message, index) => (
            <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
              <strong>{message.role}</strong>
              <div className="chat-content">
                <RenderedContent content={message.content} />
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            icon={MessageSquareText}
            title="No tutor chats yet"
            description="Ask a focused question after adding study material."
          />
        )}
      </div>
      <form className="chat-form" onSubmit={onSubmit}>
        <input
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          maxLength={1000}
          placeholder="Ask about this material"
        />
        <button type="submit" disabled={isBusy || question.trim().length < 3}>
          {isBusy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
          <span>Send</span>
        </button>
      </form>
    </section>
  );
}

function ContentHeader({ title, actionLabel, busy, onAction }) {
  return (
    <div className="content-header">
      <div>
        <h3>{title}</h3>
      </div>
      <button type="button" onClick={onAction} disabled={busy}>
        {busy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
        <span>{actionLabel}</span>
      </button>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="empty-state">
      <Icon size={24} aria-hidden="true" />
      <div>
        <span>{title}</span>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}

function RenderedContent({ content, inline = false }) {
  return (
    <ReactMarkdown
      className={inline ? "rendered-content inline" : "rendered-content"}
      remarkPlugins={[remarkMath]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
      components={
        inline
          ? {
              p: ({ children }) => <>{children}</>,
            }
          : undefined
      }
    >
      {normalizeMathDelimiters(content)}
    </ReactMarkdown>
  );
}

function normalizeMathDelimiters(content) {
  const normalized = String(content ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\\\\\[/g, "\n$$\n")
    .replace(/\\\\\]/g, "\n$$\n")
    .replace(/\\\[/g, "\n$$\n")
    .replace(/\\\]/g, "\n$$\n")
    .replace(/\\\\\(/g, "$")
    .replace(/\\\\\)/g, "$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");

  return normalizeDisplayMathBlocks(normalized);
}

function normalizeDisplayMathBlocks(content) {
  const lines = content.split("\n");
  const output = [];
  let mathLines = null;

  for (const line of lines) {
    if (/^\s*\${1,2}\s*$/.test(line)) {
      if (mathLines) {
        const cleanMath = trimBlankLines(mathLines).map(normalizeLatexEscapes);
        output.push("$$", ...cleanMath, "$$");
        mathLines = null;
      } else {
        mathLines = [];
      }
      continue;
    }

    if (mathLines) {
      mathLines.push(line);
    } else {
      output.push(line);
    }
  }

  if (mathLines) {
    output.push("$", ...mathLines);
  }

  return output.join("\n");
}

function trimBlankLines(lines) {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim() === "") {
    start += 1;
  }
  while (end > start && lines[end - 1].trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end);
}

function normalizeLatexEscapes(line) {
  return line.replace(/\\\\(?=[A-Za-z])/g, "\\");
}

async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const { skipAuth, headers = {}, ...requestOptions } = options;
  const token = skipAuth ? "" : localStorage.getItem(AUTH_TOKEN_KEY);
  const requestHeaders = isFormData
    ? { ...headers }
    : {
        "Content-Type": "application/json",
        ...headers,
      };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: requestHeaders,
    ...requestOptions,
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch {
      // Keep fallback.
    }
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function labelForKind(kind) {
  return {
    summary: "AI Notes",
    "cheat-sheet": "Cheat Sheet",
    diagnostic: "Diagnostic Test",
    "targeted-practice": "Weak Topic Drill",
    flashcards: "Flashcards",
    quiz: "Practice Quiz",
  }[kind];
}

function isSessionAssetReady(session, kind) {
  if (!session) {
    return false;
  }

  return {
    summary: Boolean(session.summary),
    "cheat-sheet": Boolean(session.cheat_sheet),
    flashcards: Boolean(session.flashcards?.length),
    quiz: Boolean(session.quiz?.length),
  }[kind] ?? false;
}

function parseSavedDiagnosticReview(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function parseSavedQuizReview(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    return { tutor_explanation: value, incorrect: [] };
  }
  return null;
}

function parseSavedTargetedPracticeReview(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function mistakeIssuesFrom(review, source) {
  if (!review?.incorrect?.length) {
    return [];
  }
  return review.incorrect.map((issue) => ({
    ...issue,
    source,
  }));
}

function readStoredAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function titleFromFilename(filename) {
  const withoutExtension = String(filename ?? "").replace(/\.[^/.]+$/, "");
  const cleaned = withoutExtension.replace(/[_-]+/g, " ").trim();
  return cleaned.slice(0, 120) || "Untitled Study Session";
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
