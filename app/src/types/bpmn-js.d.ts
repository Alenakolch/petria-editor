// Минимальная декларация: bpmn-js пока используем как `any`,
// уточним типы на следующих неделях, когда будет понятна структура
// внутреннего JSON-формата схемы.
declare module 'bpmn-js/lib/Modeler' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BpmnModeler: any;
  export default BpmnModeler;
}

declare module 'bpmn-js/dist/assets/diagram-js.css';
declare module 'bpmn-js/dist/assets/bpmn-js.css';
declare module 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
