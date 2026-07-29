import React from "react";
import {
  ArrowRight, BookOpen, Bot, Brain, ClipboardList, FileText, History,
  LayoutDashboard, Layers3, LibraryBig, LogOut, Menu,
  Settings, Sparkles, Target, X,
} from "lucide-react";

const navigation = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["files", "My Files", LibraryBig],
  ["summary", "AI Notes", FileText],
  ["cheat-sheet", "Cheat Sheets", ClipboardList],
  ["quiz", "Practice Quiz", Target],
  ["flashcards", "Flashcards", Layers3],
  ["chat", "AI Tutor", Bot],
  ["mistakes", "Mistakes", Brain],
  ["history", "History", History],
];

export default function AppSidebar({ activeTab, onNavigate, user, plan, filesCount = 0, quota, onUpgrade, onSettings, onLogout, isOpen, onClose }) {
  const generationLabel = quota ? `${quota.remaining} / ${quota.limit} generations left` : "5 / 5 generations left";
  return (
    <>
      <button className="sidebar-toggle" type="button" aria-label="Open navigation" onClick={() => onNavigate("__menu__")}><Menu size={21} /></button>
      {isOpen && <button className="sidebar-backdrop" type="button" aria-label="Close navigation" onClick={onClose} />}
      <aside className={isOpen ? "app-sidebar is-open" : "app-sidebar"} aria-label="Main navigation">
        <div className="app-sidebar-top">
          <div className="sidebar-brand"><span><BookOpen size={20} /></span><strong>AI Study Forge</strong><button type="button" className="sidebar-close" aria-label="Close navigation" onClick={onClose}><X size={18} /></button></div>
          <button className="sidebar-user sidebar-workspace-card" type="button" onClick={onSettings} aria-label="Open workspace settings">
            <span className="sidebar-workspace-title"><Sparkles size={16} /><strong>Your study workspace</strong></span>
            <span className="sidebar-workspace-description">Upload materials and study smarter with AI.</span>
            <span className="sidebar-plan">{plan} Plan</span>
            <span className="sidebar-workspace-stat"><FileText size={16} />{filesCount} {filesCount === 1 ? "file" : "files"}</span>
            <span className="sidebar-workspace-stat"><Sparkles size={16} />{generationLabel}</span>
          </button>
          <nav className="sidebar-nav">
            <p>WORKSPACE</p>
            {navigation.map(([id, label, Icon]) => <button key={id} type="button" className={activeTab === id ? "active" : ""} onClick={() => { onNavigate(id); onClose(); }}><Icon size={18} /><span>{label}</span></button>)}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <button className="sidebar-upgrade" type="button" onClick={onUpgrade}>
            <span className="sidebar-upgrade-icon"><Sparkles size={17} /></span>
            <span className="sidebar-upgrade-copy"><strong>Upgrade to Pro</strong><small>Get higher limits, more uploads, and advanced AI features.</small></span>
            <span className="sidebar-upgrade-cta">Upgrade to Pro <ArrowRight size={16} /></span>
          </button>
          <button type="button" onClick={onSettings}><Settings size={18} />Settings</button>
          <button type="button" onClick={onLogout}><LogOut size={18} />Log out</button>
        </div>
      </aside>
    </>
  );
}
