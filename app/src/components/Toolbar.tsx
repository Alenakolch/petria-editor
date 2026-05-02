import type { ChangeEvent } from 'react';

type Props = {
  onNew: () => void;
  onUpload: (file: File) => void;
  onDownloadXML: () => void;
  onDownloadSVG: () => void;
  onFit: () => void;
};

export function Toolbar({
  onNew,
  onUpload,
  onDownloadXML,
  onDownloadSVG,
  onFit,
}: Props) {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = '';
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button type="button" className="btn btn-primary" onClick={onNew}>
          + Новая схема
        </button>
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-group">
        <label className="btn">
          ↑ Загрузить XML
          <input
            type="file"
            accept=".bpmn,.xml"
            hidden
            onChange={handleFileChange}
          />
        </label>
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-group">
        <button type="button" className="btn" onClick={onDownloadXML}>
          ↓ Скачать XML
        </button>
        <button type="button" className="btn" onClick={onDownloadSVG}>
          ↓ Скачать SVG
        </button>
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-group">
        <button type="button" className="btn" onClick={onFit}>
          ⊞ По размеру
        </button>
      </div>
    </div>
  );
}
