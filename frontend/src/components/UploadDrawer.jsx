import React from "react";
import { CheckCircle2, Loader2, Upload, X } from "lucide-react";

export default function UploadDrawer({ open, onClose, title, onTitleChange, selectedFile, isDraggingFile, onDragOver, onDragLeave, onDrop, fileInputRef, onFileChange, busy, onProcess, uploadedMaterial, sourceText, sourceTextareaRef, onSourceTextChange, characters }) {
  if (!open) return null;
  return <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="upload-drawer" role="dialog" aria-modal="true" aria-labelledby="upload-drawer-title">
      <header><div><span>NEW STUDY MATERIAL</span><h2 id="upload-drawer-title">Add study material</h2><p>Upload a file or paste your notes to create a new study pack.</p></div><button type="button" className="drawer-close" onClick={onClose} aria-label="Close upload drawer"><X size={20} /></button></header>
      <div className="drawer-body">
        <label className="field-label" htmlFor="drawer-session-title">Title</label>
        <input id="drawer-session-title" value={title} maxLength={120} onChange={onTitleChange} placeholder="e.g. Biology midterm notes" autoFocus />
        <label className="field-label" htmlFor="drawer-document-file">Upload document</label>
        <div className={isDraggingFile ? "drawer-dropzone dragging" : "drawer-dropzone"} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
          <Upload size={22} aria-hidden="true" /><strong>{selectedFile ? selectedFile.name : "Drag and drop a file here"}</strong><span>PDF, slides, Word, or text file</span>
          <label className="drawer-file-button" htmlFor="drawer-document-file">Choose file</label>
          <input id="drawer-document-file" ref={fileInputRef} type="file" accept=".txt,.pdf,.docx,.doc,.pptx,.ppt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint" onChange={onFileChange} />
        </div>
        <div className="drawer-divider"><span>OR</span></div>
        <label className="field-label" htmlFor={uploadedMaterial ? undefined : "drawer-source-text"}>Paste or edit text</label>
        {uploadedMaterial ? <div className="upload-success-card" role="status"><CheckCircle2 size={20} /><div><strong>Material processed</strong><span>{uploadedMaterial.characterCount.toLocaleString()} characters ready</span></div></div> : <textarea id="drawer-source-text" ref={sourceTextareaRef} value={sourceText} onChange={onSourceTextChange} placeholder="Paste course notes, homework solutions, lecture transcripts, or textbook excerpts here." />}
      </div>
      <footer><span>{characters.toLocaleString()} chars</span><button className="primary-button" type="button" onClick={onProcess} disabled={busy || !selectedFile}>{busy ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}Process Material</button></footer>
    </section>
  </div>;
}
