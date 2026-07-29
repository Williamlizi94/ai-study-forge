import React from "react";
import { FileText, PencilLine, Sparkles, Upload } from "lucide-react";

export default function DashboardUploadPanel({
  selectedFile,
  isDragging,
  fileInputRef,
  onChooseFile,
  onPasteText,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
}) {
  function openFilePicker() {
    fileInputRef.current?.click();
  }

  return (
    <section className="dashboard-upload-panel" aria-labelledby="dashboard-upload-title">
      <div className="dashboard-upload-copy">
        <h3 id="dashboard-upload-title"><Sparkles size={17} />Add Study Material</h3>
        <p>Upload lecture slides, PDFs, notes, homework solutions, or paste text from course materials.</p>
      </div>

      <div className="dashboard-upload-content">
        <div
          className={isDragging ? "dashboard-dropzone dragging" : "dashboard-dropzone"}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <button
            type="button"
            className="dashboard-dropzone-target"
            onClick={openFilePicker}
            aria-label="Choose a study material file"
          >
            <Upload size={30} aria-hidden="true" />
            <strong>{selectedFile ? selectedFile.name : "Drag & drop your file here"}</strong>
            <small>{selectedFile ? "Ready to process your material" : "PDF, PPT, PPTX, DOC, DOCX, TXT (Max 200MB)"}</small>
          </button>
          <div className="dashboard-upload-options">
            <button
              type="button"
              onClick={onChooseFile}
            >
              <Upload size={18} />
              <span><strong>Upload Document</strong><small>Choose file from your computer</small></span>
            </button>
            <button
              type="button"
              onClick={onPasteText}
            >
              <PencilLine size={18} />
              <span><strong>Paste or Edit Text</strong><small>Paste notes, questions, or any text</small></span>
            </button>
          </div>
        </div>

        <div className="dashboard-upload-illustration" aria-hidden="true">
          <span className="upload-spark spark-one">✦</span>
          <span className="upload-spark spark-two">✦</span>
          <span className="upload-sheet upload-sheet-back" />
          <span className="upload-sheet upload-sheet-middle" />
          <span className="upload-sheet upload-sheet-front"><FileText size={54} /><i /><i /><i /><i /></span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        className="dashboard-upload-input"
        type="file"
        accept=".txt,.pdf,.docx,.doc,.pptx,.ppt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
        onChange={onFileChange}
      />
    </section>
  );
}
