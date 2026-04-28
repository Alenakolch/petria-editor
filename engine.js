/**
 * Petria BPMN Simulator — лёгкий исполнитель BPMN-схем для bpmn-js.
 *
 * Это не полноценный BPMN-движок (нет выражений, переменных, таймеров,
 * сообщений и BPMN DI-семантики), а пошаговый симулятор токенов:
 *
 *   • Стартовые события — порождают токены.
 *   • Задачи — токен задерживается на один тик.
 *   • Шлюзы:
 *       - Exclusive  — токен идёт по первому исходящему потоку
 *                      (или по тому, чей id совпадает со значением `default`).
 *       - Parallel split — токен расщепляется на все исходящие.
 *       - Parallel join  — ждёт по одному токену на каждый входящий поток.
 *       - Inclusive — упрощённо как Parallel split.
 *   • End-события — токен поглощается.
 *
 * API:
 *   var sim = new BpmnSimulator(modeler, { onLog, onStateChange, tickSpeed });
 *   sim.start(); sim.stop(); sim.reset();
 */
(function (global) {
  'use strict';

  var TOKEN_PREFIX = 'token_';
  var ACTIVE_MARKER = 'simulation-active';

  function uid() {
    return TOKEN_PREFIX + Math.random().toString(36).slice(2, 8);
  }

  function nameOf(el) {
    if (!el) return '?';
    var bo = el.businessObject;
    return (bo && bo.name) ? bo.name : el.id;
  }

  function isType(el, type) {
    if (!el || !el.type) return false;
    return el.type === type;
  }

  function isAny(el, types) {
    for (var i = 0; i < types.length; i++) {
      if (isType(el, types[i])) return true;
    }
    return false;
  }

  function outgoingFlows(el) {
    var out = el.outgoing || [];
    return out.filter(function (f) { return isType(f, 'bpmn:SequenceFlow'); });
  }

  function incomingFlows(el) {
    var inc = el.incoming || [];
    return inc.filter(function (f) { return isType(f, 'bpmn:SequenceFlow'); });
  }

  function BpmnSimulator(modeler, opts) {
    opts = opts || {};
    this.modeler = modeler;
    this.tokens = [];
    this.running = false;
    this.tickHandle = null;
    this.tickSpeed = opts.tickSpeed || 900;
    this.logEntries = [];
    this.onLog = opts.onLog || null;
    this.onStateChange = opts.onStateChange || null;
    // Очередь ожидающих токенов на parallel join: { joinId: { flowId: count } }
    this.joinBuffers = {};
  }

  BpmnSimulator.prototype._registry = function () {
    return this.modeler.get('elementRegistry');
  };

  BpmnSimulator.prototype._canvas = function () {
    return this.modeler.get('canvas');
  };

  BpmnSimulator.prototype._highlight = function (el) {
    try { this._canvas().addMarker(el.id, ACTIVE_MARKER); } catch (e) { /* ignore */ }
  };

  BpmnSimulator.prototype._unhighlight = function (el) {
    try { this._canvas().removeMarker(el.id, ACTIVE_MARKER); } catch (e) { /* ignore */ }
  };

  BpmnSimulator.prototype._clearAllMarkers = function () {
    var registry = this._registry();
    var self = this;
    registry.forEach(function (el) { self._unhighlight(el); });
  };

  BpmnSimulator.prototype.log = function (msg, kind) {
    var entry = {
      time: new Date().toLocaleTimeString(),
      message: msg,
      kind: kind || 'info'
    };
    this.logEntries.push(entry);
    if (this.onLog) this.onLog(entry);
  };

  BpmnSimulator.prototype._setState = function (state) {
    if (this.onStateChange) this.onStateChange(state);
  };

  BpmnSimulator.prototype.findStartEvents = function () {
    var registry = this._registry();
    return registry.filter(function (el) { return isType(el, 'bpmn:StartEvent'); });
  };

  BpmnSimulator.prototype._createToken = function (element, parent) {
    var token = { id: uid(), element: element, parent: parent || null };
    this.tokens.push(token);
    this._highlight(element);
    return token;
  };

  BpmnSimulator.prototype._removeToken = function (token) {
    var idx = this.tokens.indexOf(token);
    if (idx !== -1) this.tokens.splice(idx, 1);
    // Снимаем подсветку, только если на этом элементе больше нет токенов.
    var stillActive = this.tokens.some(function (t) { return t.element.id === token.element.id; });
    if (!stillActive) this._unhighlight(token.element);
  };

  BpmnSimulator.prototype.reset = function () {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    this._clearAllMarkers();
    this.tokens = [];
    this.logEntries = [];
    this.joinBuffers = {};
    this.running = false;
    this._setState('idle');
  };

  BpmnSimulator.prototype.start = function () {
    if (this.running) return;
    this.reset();

    var starts = this.findStartEvents();
    if (starts.length === 0) {
      this.log('Не найдено ни одного стартового события', 'error');
      this._setState('idle');
      return;
    }

    var self = this;
    starts.forEach(function (se) {
      self._createToken(se);
      self.log('▶ Старт: ' + nameOf(se), 'start');
    });

    this.running = true;
    this._setState('running');
    this.tickHandle = setInterval(function () { self._tick(); }, this.tickSpeed);
  };

  BpmnSimulator.prototype.stop = function () {
    if (!this.running && !this.tickHandle) return;
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    this.running = false;
    this.log('⏸ Остановлено', 'stop');
    this._setState('stopped');
  };

  BpmnSimulator.prototype._advanceToken = function (token) {
    var el = token.element;

    // 1. End event — поглощаем токен.
    if (isType(el, 'bpmn:EndEvent')) {
      this.log('⏹ Конец: ' + nameOf(el), 'end');
      return { remove: true };
    }

    // 2. Parallel join: накапливаем токены, выпускаем когда пришли по всем входящим.
    if (isType(el, 'bpmn:ParallelGateway') && incomingFlows(el).length > 1 && outgoingFlows(el).length === 1) {
      var buf = this.joinBuffers[el.id] = this.joinBuffers[el.id] || {};
      var inFlow = token.viaFlow || null;
      if (inFlow) buf[inFlow] = (buf[inFlow] || 0) + 1;

      var requiredIn = incomingFlows(el).map(function (f) { return f.id; });
      var ready = requiredIn.every(function (fid) { return (buf[fid] || 0) >= 1; });

      if (!ready) {
        // Токен ждёт; не двигаем его, но и не дублируем.
        this.log('… Ожидание на синхронизации: ' + nameOf(el), 'wait');
        return { remove: true, wait: true };
      }

      // Освобождаем по одному токену с каждого входа.
      requiredIn.forEach(function (fid) { buf[fid] -= 1; });

      var outFlow = outgoingFlows(el)[0];
      var target = outFlow.target;
      this.log('⇉ Синхронизация: ' + nameOf(el) + ' → ' + nameOf(target), 'gateway');
      return { remove: true, spawn: [{ element: target, viaFlow: outFlow.id }] };
    }

    var outs = outgoingFlows(el);
    if (outs.length === 0) {
      this.log('⚠ Тупик у ' + nameOf(el), 'warn');
      return { remove: true };
    }

    // 3. Parallel split / Inclusive — расщепляемся.
    if ((isType(el, 'bpmn:ParallelGateway') || isType(el, 'bpmn:InclusiveGateway')) && outs.length > 1) {
      var label = isType(el, 'bpmn:ParallelGateway') ? '⇉ Параллельный split: ' : '⇉ Inclusive split: ';
      this.log(label + nameOf(el), 'gateway');
      var spawns = outs.map(function (flow) {
        return { element: flow.target, viaFlow: flow.id, label: nameOf(flow.target) };
      });
      var self = this;
      spawns.forEach(function (s) {
        self.log('   → ' + s.label, 'flow');
      });
      return { remove: true, spawn: spawns };
    }

    // 4. Exclusive gateway — выбираем default или первый исходящий.
    if (isType(el, 'bpmn:ExclusiveGateway') && outs.length > 1) {
      var bo = el.businessObject || {};
      var defaultId = bo.default && bo.default.id;
      var chosen = null;
      if (defaultId) {
        for (var i = 0; i < outs.length; i++) {
          if (outs[i].id === defaultId) { chosen = outs[i]; break; }
        }
      }
      if (!chosen) chosen = outs[0];
      this.log('◆ Условие ' + nameOf(el) + ' → ' + nameOf(chosen.target), 'gateway');
      return { remove: true, spawn: [{ element: chosen.target, viaFlow: chosen.id }] };
    }

    // 5. Обычный элемент — берём первый исходящий поток.
    var f = outs[0];
    var t = f.target;
    if (isAny(el, ['bpmn:Task', 'bpmn:UserTask', 'bpmn:ServiceTask', 'bpmn:ScriptTask',
                   'bpmn:ManualTask', 'bpmn:SendTask', 'bpmn:ReceiveTask', 'bpmn:BusinessRuleTask',
                   'bpmn:CallActivity', 'bpmn:SubProcess'])) {
      this.log('■ Задача: ' + nameOf(el) + ' → ' + nameOf(t), 'task');
    } else {
      this.log('→ ' + nameOf(el) + ' → ' + nameOf(t), 'flow');
    }
    return { remove: true, spawn: [{ element: t, viaFlow: f.id }] };
  };

  BpmnSimulator.prototype._tick = function () {
    if (this.tokens.length === 0) {
      this.log('✓ Все процессы завершены', 'done');
      this.stop();
      this._setState('done');
      return;
    }

    // Снапшот текущих токенов — действия применяем атомарно, чтобы новые токены не двигались в этом же тике.
    var snapshot = this.tokens.slice();
    var toRemove = [];
    var toSpawn = [];

    var self = this;
    snapshot.forEach(function (token) {
      var res = self._advanceToken(token);
      if (res.remove) toRemove.push(token);
      if (res.spawn) {
        res.spawn.forEach(function (s) { toSpawn.push(s); });
      }
    });

    toRemove.forEach(function (t) { self._removeToken(t); });
    toSpawn.forEach(function (s) {
      var nt = self._createToken(s.element);
      nt.viaFlow = s.viaFlow;
    });
  };

  // Экспорт
  global.BpmnSimulator = BpmnSimulator;
})(typeof window !== 'undefined' ? window : globalThis);
