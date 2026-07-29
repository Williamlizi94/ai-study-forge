import React from "react";
import { FileText, GraduationCap, Sparkles } from "lucide-react";

const steps = [
  ["Upload your material", "Add lecture slides, notes, or any study documents.", FileText],
  ["Generate a study pack", "Get AI Notes, Cheat Sheets, Flashcards, and Quizzes.", Sparkles],
  ["Practice and improve", "Review, test yourself, and ask AI Tutor for help anytime.", GraduationCap],
];

export default function StudyGettingStartedGuide() {
  return (
    <section className="getting-started-guide" aria-labelledby="getting-started-title">
      <div className="guide-illustration" aria-hidden="true">
        <span className="guide-spark guide-spark-one">✦</span>
        <span className="guide-spark guide-spark-two">✦</span>
        <span className="guide-cloud"><FileText size={21} /></span>
        <span className="guide-student">
          <i className="guide-hair" />
          <i className="guide-head" />
          <i className="guide-hoodie" />
          <i className="guide-laptop" />
        </span>
      </div>

      <div className="guide-content">
        <h3 id="getting-started-title">Ready to build your first study pack?</h3>
        <p>Upload your materials and let AI turn them into powerful study tools tailored to help you learn faster and remember more.</p>
        <ol className="guide-steps">
          {steps.map(([title, description, Icon], index) => (
            <li key={title}>
              <span>{index + 1}</span>
              <div>
                <strong><Icon size={13} />{title}</strong>
                <small>{description}</small>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
