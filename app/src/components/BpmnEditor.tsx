import { useCallback, useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

import { dataLayer } from '../lib/dataLayer';
import { EMPTY_XML } from '../lib/bpmn';
import { Toolbar } from './Toolbar';

/**
 * Обёртка над bpmn-js Modeler.
 *
 * bpmn-js — императивная библиотека: создаёт собственный DOM внутри
 * `container`. Поэтому модельер живёт в `useRef`, а не в state, и весь
 * жизненный цикл — внутри одного useEffect с cleanup через destroy().
 *
 * Тип у `modelerRef` пока `any` — типизированный публичный API
 * библиотеки добавим, когда зафиксируем свой внутренний JSON-формат
 * (план, неделя 3).
 */
export function BpmnEditor() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelerRef = useRef<any>(null);
  const [status, setStatus] = useState('Загрузка…');

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return undefined;

    const modeler = new BpmnModeler({
      container,
      keyboard: { bindTo: window },
    });
    modelerRef.current = modeler;

    let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
    let autosaveEnabled = false;

    const scheduleAutosave = () => {
      if (!autosaveEnabled) return;
      if (autosaveTimer) clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(async () => {
        try {
          const result = await modeler.saveXML({ format: false });
          if (result.xml) dataLayer.saveCurrentDiagram(result.xml);
        } catch {
          // схема ещё не валидна — пропускаем тик
        }
      }, 500);
    };

    const fitView = () => {
      try {
        modeler.get('canvas').zoom('fit-viewport', 'auto');
      } catch {
        // ignore
      }
    };

    modeler.on('commandStack.changed', scheduleAutosave);
    modeler.on('elements.changed', scheduleAutosave);

    // Восстанавливаем последнюю схему из localStorage; иначе пустая.
    const saved = dataLayer.loadCurrentDiagram();
    const xmlToLoad = saved ?? EMPTY_XML;
    modeler
      .importXML(xmlToLoad)
      .then(() => {
        fitView();
        setStatus('Готово к работе');
        autosaveEnabled = true;
      })
      .catch(() => {
        // Сохранённая схема битая — выкидываем и грузим пустую.
        dataLayer.clearCurrentDiagram();
        return modeler.importXML(EMPTY_XML).then(() => {
          fitView();
          setStatus('Новая схема');
          autosaveEnabled = true;
        });
      });

    return () => {
      if (autosaveTimer) clearTimeout(autosaveTimer);
      try {
        modeler.destroy();
      } catch {
        // ignore destroy errors during double-mount in StrictMode
      }
      modelerRef.current = null;
    };
  }, []);

  const handleNew = useCallback(async () => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    if (!confirm('Очистить текущую схему?')) return;
    await modeler.importXML(EMPTY_XML);
    setStatus('Новая схема');
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    try {
      const text = await file.text();
      await modeler.importXML(text);
      setStatus(`Загружено: ${file.name}`);
    } catch {
      setStatus('Ошибка: неверный формат файла');
    }
  }, []);

  const handleDownloadXML = useCallback(async () => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    const result = await modeler.saveXML({ format: true });
    if (!result.xml) return;
    triggerDownload(result.xml, 'schema.bpmn', 'application/xml');
  }, []);

  const handleDownloadSVG = useCallback(async () => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    const result = await modeler.saveSVG();
    triggerDownload(result.svg, 'schema.svg', 'image/svg+xml');
  }, []);

  const handleFit = useCallback(() => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    try {
      modeler.get('canvas').zoom('fit-viewport', 'auto');
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="editor">
      <header className="header">
        <span className="logo">
          <strong>Petria</strong>
          <span className="logo-sub">Editor</span>
        </span>
      </header>
      <Toolbar
        onNew={handleNew}
        onUpload={handleUpload}
        onDownloadXML={handleDownloadXML}
        onDownloadSVG={handleDownloadSVG}
        onFit={handleFit}
      />
      <div className="canvas-wrapper">
        <div ref={canvasRef} className="canvas" />
      </div>
      <footer className="statusbar">
        <span>{status}</span>
        <span className="statusbar-meta">Petria Editor</span>
      </footer>
    </div>
  );
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
