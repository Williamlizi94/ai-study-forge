import React from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Flame,
  FolderOpen,
  History,
  Layers3,
  MessageCircle,
  NotebookText,
  Play,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Users,
  X,
} from "lucide-react";
import "./landing.css";

const LANDING_STATS = {
  studentCount: "10,000+",
  weeklyHoursSaved: "10+",
};

const previewNavigation = [
  [BookOpen, "Home"],
  [FolderOpen, "My Files"],
  [NotebookText, "Notes"],
  [Brain, "AI Tutor"],
  [CircleHelp, "Quiz"],
  [Layers3, "Flashcards"],
  [History, "History"],
  [Settings, "Settings"],
];

const features = [
  [Sparkles, "AI Summaries", "Concise notes from long study material."],
  [NotebookText, "Cheat Sheets", "High-yield formulas and key concepts."],
  [CircleHelp, "Practice Questions", "Custom quizzes with explanations."],
  [MessageCircle, "AI Tutor", "Clear help grounded in your material."],
  [Layers3, "Flashcards", "Spaced repetition that actually sticks."],
];

const workflow = [
  [Upload, "Upload or paste", "Upload PDFs, slides, notes, or paste text."],
  [Sparkles, "AI generates your study pack", "Summaries, cheat sheets, flashcards, and practice questions."],
  [Target, "Practice & master", "Review, quiz yourself, and ask the AI tutor when stuck."],
];

const recentFiles = [
  ["Dynamic Programming.pdf", "Summary"],
  ["Graph Algorithms - Lecture 8.pdf", "Quiz"],
  ["Network Flow - Notes.pdf", "Cheat Sheet"],
];

export default function LandingPage({ appName, onLogin, onSignup, onUpgrade, onLegal }) {
  const [videoOpen, setVideoOpen] = React.useState(false);

  React.useEffect(() => {
    if (!videoOpen) return undefined;
    const handleKeyDown = (event) => event.key === "Escape" && setVideoOpen(false);
    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [videoOpen]);

  return (
    <main className="landing">
      <header className="landing-header">
        <div className="landing-nav">
          <a className="landing-brand" href="#top" aria-label={`${appName} home`}>
            <span className="landing-logo"><BookOpen size={22} aria-hidden="true" /></span>
            <span>{appName}</span>
          </a>
          <nav className="landing-links" aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#workflow">Workflow</a>
            <a href="#pricing">Pricing</a>
            <a href="#resources">Resources</a>
          </nav>
          <div className="landing-auth">
            <button className="landing-button landing-button-ghost" type="button" onClick={onLogin}>Log in</button>
            <button className="landing-button landing-button-primary" type="button" onClick={onSignup}>Sign up free</button>
          </div>
        </div>
      </header>

      <section className="landing-hero" id="top">
        <div className="hero-glow hero-glow-green" aria-hidden="true" />
        <div className="hero-glow hero-glow-violet" aria-hidden="true" />
        <div className="landing-hero-copy landing-reveal">
          <span className="landing-pill"><Sparkles size={15} />Built for students who want to study smarter, not harder.</span>
          <h1>Turn any study material into your <em>unfair advantage.</em></h1>
          <p>Upload PDFs, slides, or notes. Get AI summaries, cheat sheets, quizzes, flashcards, and tutor help — all in one place.</p>
          <div className="landing-hero-actions">
            <button className="landing-button landing-button-primary landing-button-large" type="button" onClick={onSignup}>
              Start studying for free <ArrowRight size={17} />
            </button>
            <button className="landing-button landing-button-ghost landing-button-large" type="button" onClick={() => setVideoOpen(true)}>
              <Play size={17} fill="currentColor" /> See how it works
            </button>
          </div>
          <div className="landing-trust" aria-label="Why students trust AI Study Forge">
            <Trust icon={Users} title={`Loved by ${LANDING_STATS.studentCount} students`} />
            <Trust icon={Clock3} title={`Save ${LANDING_STATS.weeklyHoursSaved} hours every week`} />
            <Trust icon={ShieldCheck} title="Privacy first — Your data is yours" />
          </div>
        </div>
        <DashboardPreview />
      </section>

      <section className="feature-strip landing-reveal" id="features" aria-label="Product features">
        {features.map(([Icon, title, body]) => (
          <article key={title}>
            <span className="feature-strip-icon"><Icon size={22} aria-hidden="true" /></span>
            <div><h2>{title}</h2><p>{body}</p></div>
          </article>
        ))}
      </section>

      <section className="workflow-section" id="workflow">
        <div className="section-heading landing-reveal">
          <span>SIMPLE. POWERFUL. EFFECTIVE.</span>
          <h2>From raw notes to exam ready in <em>3 steps.</em></h2>
        </div>
        <div className="workflow-cards">
          {workflow.map(([Icon, title, body], index) => (
            <React.Fragment key={title}>
              <article className="workflow-card landing-reveal">
                <div className="workflow-card-top"><b>{index + 1}</b><span><Icon size={21} /></span></div>
                <h3>{title}</h3><p>{body}</p>
              </article>
              {index < workflow.length - 1 && <ChevronRight className="workflow-arrow" size={28} aria-hidden="true" />}
            </React.Fragment>
          ))}
        </div>
      </section>

      <section className="landing-bottom" id="pricing">
        <div><span>Ready when you are.</span><h2>Build your first study pack for free.</h2></div>
        <button className="landing-button landing-button-primary" type="button" onClick={onSignup}>Get started <ArrowRight size={16} /></button>
      </section>
      <footer className="landing-footer" id="resources">
        <span>© 2026 {appName}</span>
        <div>
          <button type="button" onClick={onUpgrade}>Pricing</button>
          <button type="button" onClick={() => onLegal("privacy")}>Privacy</button>
          <button type="button" onClick={() => onLegal("terms")}>Terms</button>
        </div>
      </footer>

      {videoOpen && (
        <div className="landing-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setVideoOpen(false)}>
          <section className="landing-video-modal" role="dialog" aria-modal="true" aria-labelledby="demo-title">
            <button className="landing-modal-close" type="button" onClick={() => setVideoOpen(false)} aria-label="Close demo"><X size={20} /></button>
            <div className="video-placeholder"><span><Play size={30} fill="currentColor" /></span></div>
            <div><span className="landing-eyebrow">PRODUCT TOUR</span><h2 id="demo-title">See AI Study Forge in action</h2><p>The guided product video will live here. For now, create a free account to explore the complete study workflow.</p></div>
            <button className="landing-button landing-button-primary" type="button" onClick={() => { setVideoOpen(false); onSignup(); }}>Start studying for free</button>
          </section>
        </div>
      )}
    </main>
  );
}

function Trust({ icon: Icon, title }) {
  return <div><span><Icon size={18} /></span><strong>{title}</strong></div>;
}

function DashboardPreview() {
  return (
    <section className="dashboard-preview landing-reveal" aria-label="AI Study Forge dashboard preview">
      <aside className="preview-sidebar">
        <span className="preview-logo"><BookOpen size={18} /></span>
        <nav>{previewNavigation.map(([Icon, label], index) => <span className={index === 0 ? "active" : ""} key={label}><Icon size={14} />{label}</span>)}</nav>
      </aside>
      <div className="preview-main">
        <div className="preview-greeting">
          <div><h2>Good morning, Alex <span>👋</span></h2><p>Ready to crush today’s study goals?</p></div>
          <span className="streak-badge"><b>12</b> Day streak <Flame size={14} /></span>
        </div>
        <div className="preview-content">
          <div className="preview-center">
            <article className="study-pack-card">
              <span className="study-pack-icon"><FileText size={20} /></span>
              <div><small>Study pack</small><strong>Algorithms Midterm</strong><div className="progress-track"><i /></div><small>4 of 6 tasks completed</small></div>
              <button type="button">Continue</button>
            </article>
            <div className="preview-tools">
              <PreviewTool icon={Sparkles} title="AI Notes" body="Smart notes & key takeaways" tone="green" />
              <PreviewTool icon={NotebookText} title="Cheat Sheet" body="High-yield formulas & concepts" tone="blue" />
              <PreviewTool icon={CircleHelp} title="Practice Quiz" body="20 questions generated" tone="orange" />
              <PreviewTool icon={Brain} title="AI Tutor" body="Ask anything. Get explanations." tone="purple" />
            </div>
            <article className="recent-files">
              <div className="recent-title"><strong>Recent files</strong><span>View all</span></div>
              {recentFiles.map(([name, action], index) => <div className="recent-file" key={name}><span className="file-badge">PDF</span><div><strong>{name}</strong><small>Uploaded {index === 1 ? "yesterday" : index === 2 ? "2 days ago" : "2h ago"}</small></div><button type="button">{action}</button></div>)}
            </article>
          </div>
          <aside className="preview-stats">
            <article className="progress-card"><strong>Today’s progress</strong><div className="progress-ring"><span>75%</span></div><small>Great progress!</small></article>
            <article className="metric-list"><div><b>3</b><span>Files uploaded</span></div><div><b>28</b><span>Questions practiced</span></div><div><b>15</b><span>Tutor messages</span></div></article>
            <article className="chart-card"><strong>Study streak</strong><div className="bar-chart">{[36, 38, 58, 44, 56, 80].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div><small>12 days in a row! 🔥</small></article>
          </aside>
        </div>
      </div>
    </section>
  );
}

function PreviewTool({ icon: Icon, title, body, tone }) {
  return <article className="preview-tool"><div><strong>{title}</strong><small>{body}</small></div><span className={tone}><Icon size={20} /></span></article>;
}
