/* Системы NewVersion_2: настройки, журнал, исследование, сканер и восстановление. */
(function () {
  'use strict';
  const T = window.THREE;
  const PREFS_KEY = 'last-simulation-nv2-settings';
  const WORLD_ORDER = ['garden', 'wet', 'workshop', 'void', 'shore', 'hub', 'hangar', 'exterior'];
  const WORLDS = {
    garden: { name: 'СТЕКЛЯННЫЙ САД', subtitle: 'ПРОГОН 01 / ПАТРУЛИРОВАНИЕ', objective: 'Объект вне списка сущностей' },
    wet: { name: 'МОКРЫЙ АСФАЛЬТ', subtitle: 'ПРОГОН 02 / ПОВТОРЕНИЕ', objective: 'Проверить повторяющуюся аномалию' },
    workshop: { name: 'ТИХИЙ ЦЕХ', subtitle: 'ПРОГОН 03 / НЕСООТВЕТСТВИЕ', objective: 'Открыть дверь №7' },
    void: { name: 'СЕРАЯ ПУСТОТА', subtitle: 'НЕЗАПОЛНЕННЫЙ БУФЕР', objective: 'Стабилизировать остаточный контекст' },
    shore: { name: 'ПЕПЕЛЬНЫЙ БЕРЕГ', subtitle: 'ПРОГОН 04 / ОСТАТОЧНЫЙ КОНТЕКСТ', objective: 'Исследовать собственные следы' },
    hub: { name: 'МЕЖДУ СИМУЛЯЦИЯМИ', subtitle: 'ДОСТУП К СТРУКТУРЕ', objective: 'Сопоставить системные доказательства' },
    hangar: { name: 'КОМПЛЕКС B–4', subtitle: 'ЧАСТЬ II / ФИЗИЧЕСКАЯ ПЛАТФОРМА', objective: 'Исследовать комплекс и разблокировать шлюз' },
    exterior: { name: 'СНАРУЖИ', subtitle: 'ВНЕШНИЙ КОНТУР', objective: 'Просканировать горизонт' }
  };
  const defaults = { quality: 'auto', fov: 72, sensitivity: 1, volume: 0.5, textSpeed: 'normal', hints: true, reduceMotion: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) };
  const finite = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  let settings;
  try { settings = Object.assign({}, defaults, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')); }
  catch (e) { settings = Object.assign({}, defaults); }
  if (!['auto', 'low', 'balanced', 'high'].includes(settings.quality)) settings.quality = 'auto';
  if (!['normal', 'fast', 'instant'].includes(settings.textSpeed)) settings.textSpeed = 'normal';
  settings.fov = finite(settings.fov, 72, 60, 95);
  settings.sensitivity = finite(settings.sensitivity, 1, 0.3, 2.5);
  settings.volume = finite(settings.volume, 0.5, 0, 1);
  settings.hints = typeof settings.hints === 'boolean' ? settings.hints : true;
  settings.reduceMotion = typeof settings.reduceMotion === 'boolean' ? settings.reduceMotion : defaults.reduceMotion;
  let api = null, journalTab = 'observations', revealTimer = null, savedTimer = null, photoTimer = null;
  let lastTick = performance.now(), scanUntil = 0;

  function resolvedQuality() {
    if (settings.quality !== 'auto') return settings.quality;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return coarse || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ? 'low' : 'balanced';
  }

  function renderingQuality() {
    const value = resolvedQuality();
    return { low: value === 'low', particleScale: value === 'low' ? 0.48 : value === 'high' ? 1 : 0.78, dpr: Math.min(window.devicePixelRatio || 1, value === 'high' ? 1.75 : value === 'low' ? 1 : 1.35), name: value };
  }

  function persistSettings() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(settings)); } catch (e) { /* preferences stay usable in this session */ }
  }

  function toast(title, text) {
    const area = document.getElementById('toastArea');
    if (!area || !api || !api.G.started) return;
    const node = document.createElement('div'); node.className = 'toast';
    const heading = document.createElement('strong'); heading.textContent = title;
    const body = document.createElement('span'); body.textContent = text;
    node.append(heading, body); area.appendChild(node);
    while (area.children.length > 3) area.firstChild.remove();
    setTimeout(() => { node.classList.add('leaving'); setTimeout(() => node.remove(), 400); }, 4300);
  }

  function applyAudio() {
    if (!api || !api.audioCtl.ctx || !api.audioCtl.master) return;
    const audio = api.audioCtl;
    const now = audio.ctx.currentTime;
    audio.master.gain.cancelScheduledValues(now);
    audio.master.gain.setTargetAtTime(audio.muted ? 0 : settings.volume, now, 0.08);
  }

  function applySettings() {
    document.body.classList.toggle('reduced-motion', settings.reduceMotion);
    document.body.classList.toggle('no-guides', !settings.hints);
    if (!api) return;
    Object.assign(api.QUALITY, renderingQuality());
    api.renderer.setPixelRatio(api.QUALITY.dpr);
    api.renderer.setSize(window.innerWidth, window.innerHeight);
    api.renderer.shadowMap.enabled = !api.QUALITY.low;
    api.cinematic.options.reducedMotion = settings.reduceMotion;
    api.cinematic.setQuality(resolvedQuality());
    api.camera.fov = settings.fov; api.camera.updateProjectionMatrix();
    const w = api.getWorld();
    if (w) {
      if (!api.QUALITY.low && w.enableReflections) w.enableReflections();
      if (w.reflections) w.reflections.forEach((m) => { m.visible = !api.QUALITY.low; });
      w.interactables.forEach((it) => { if (it.marker) it.marker.visible = settings.hints; });
    }
    applyAudio();
    const note = document.getElementById('qualityNote');
    if (note) note.textContent = { low: 'Облегчённый рендер · атмосферные материалы', balanced: 'Bloom · отражения · динамические тени', high: 'Высокое разрешение · полный художественный слой' }[resolvedQuality()];
  }

  function showSettingsValues() {
    const $ = (id) => document.getElementById(id);
    $('qualitySetting').value = settings.quality; $('fovSetting').value = settings.fov;
    $('sensitivitySetting').value = settings.sensitivity; $('volumeSetting').value = Math.round(settings.volume * 100);
    $('motionSetting').checked = settings.reduceMotion; $('hintsSetting').checked = settings.hints;
    $('textSetting').value = settings.textSpeed;
    $('fovValue').textContent = settings.fov + '°'; $('sensitivityValue').textContent = settings.sensitivity.toFixed(1) + '×';
    $('volumeValue').textContent = Math.round(settings.volume * 100) + '%';
  }

  function setPaused(force) {
    if (!api) return;
    const paused = force === undefined ? !api.G.paused : !!force;
    api.G.paused = paused; api.resetInput();
    const menu = document.getElementById('pauseMenu'); menu.classList.toggle('open', paused);
    if (paused) {
      if (api.G.started) api.saveGame();
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
      if (api.audioCtl.ctx && api.audioCtl.ctx.state === 'running') api.audioCtl.ctx.suspend().catch(() => {});
      document.getElementById('pauseTitle').textContent = api.G.started ? 'ПАУЗА' : 'НАСТРОЙКИ';
      document.getElementById('resumeBtn').textContent = api.G.started ? 'ПРОДОЛЖИТЬ →' : 'ЗАКРЫТЬ';
      document.getElementById('manualSaveBtn').hidden = !api.G.started;
      document.getElementById('photoBtn').hidden = !api.G.started;
      showSettingsValues(); document.getElementById('closePause').focus();
    } else {
      if (api.G.started && api.audioCtl.ctx && !document.hidden) api.audioCtl.ctx.resume().catch(() => {});
      if (api.G.started && api.inputEnabled()) {
        api.canvas.focus({ preventScroll: true });
        if (api.canvas.requestPointerLock && !api.coarsePointer) {
          try { const result = api.canvas.requestPointerLock(); if (result && result.catch) result.catch(() => {}); } catch (e) { /* drag-look remains available */ }
        }
      }
    }
    api.UI.touchControls.classList.toggle('blocked', paused || !api.inputEnabled());
    api.refreshLockHint(); lastTick = performance.now();
  }

  function setPhoto(force) {
    if (!api || !api.G.started || !api.getWorld()) return;
    const value = force === undefined ? !api.G.photoMode : !!force;
    if (value && (api.modalState.open || api.overlayState.active || api.G.journalOpen)) return;
    api.G.photoMode = value; api.G.photoTime = performance.now() / 1000;
    document.body.classList.toggle('photo-mode', value);
    const note = document.getElementById('photoNote'); note.hidden = !value;
    clearTimeout(photoTimer); if (value) photoTimer = setTimeout(() => { note.hidden = true; }, 4000);
  }

  function onSaved() {
    const node = document.getElementById('saveIndicator');
    if (!node) return;
    node.textContent = '◇ КОНТЕКСТ СОХРАНЁН'; node.classList.add('show');
    clearTimeout(savedTimer); savedTimer = setTimeout(() => node.classList.remove('show'), 2300);
  }

  function recordMessages(lines) {
    if (!api) return;
    const w = api.getWorld();
    lines.filter((line) => typeof line === 'string' && line.trim()).forEach((line) => {
      api.G.transcript.push({ text: line, world: w ? w.id : 'core', at: Math.round(api.G.elapsed || 0) });
    });
    if (api.G.transcript.length > 500) api.G.transcript.splice(0, api.G.transcript.length - 500);
  }

  function timeLabel(seconds) {
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(Math.floor(seconds) % 60).padStart(2, '0');
  }

  function renderJournal() {
    if (!api) return;
    const { G, UI, esc } = api;
    document.querySelectorAll('[data-journal-tab]').forEach((b) => {
      const selected = b.dataset.journalTab === journalTab; b.classList.toggle('active', selected); b.setAttribute('aria-selected', String(selected));
    });
    if (journalTab === 'messages') {
      UI.journalBody.innerHTML = G.transcript.length ? G.transcript.map((entry) => {
        const name = WORLDS[entry.world] ? WORLDS[entry.world].name : 'СИСТЕМНЫЙ ПОТОК';
        const prefix = entry.text.charAt(0); const cls = prefix === '!' ? 'err' : prefix === '~' ? 'thought' : 'sys';
        return '<div class="logItem"><small>' + timeLabel(entry.at) + ' / ' + esc(name) + '</small><p class="' + cls + '">' + esc(api.stripPrefix(entry.text)) + '</p></div>';
      }).join('') : '<div class="logEmpty">Сообщений пока нет.</div>';
      UI.journalBody.scrollTop = UI.journalBody.scrollHeight;
    } else if (journalTab === 'route') {
      const current = api.getWorld();
      UI.journalBody.innerHTML = '<div class="logItem"><small>ВРЕМЯ В АКТИВНОМ КОНТУРЕ</small><h4>' + timeLabel(G.elapsed || 0) + '</h4><p>Наблюдений: ' + G.log.length + '. Посещено участков: ' + G.visitedWorlds.length + '.</p></div>' + WORLD_ORDER.map((id, i) => {
        const visited = G.visitedWorlds.includes(id), active = current && current.id === id;
        return '<div class="routeItem' + (active ? ' active' : '') + '"><b>' + (visited ? '✓ ' : '· ') + String(i + 1).padStart(2, '0') + ' / ' + (visited ? esc(WORLDS[id].name) : 'НЕИЗВЕСТНЫЙ УЧАСТОК') + '</b>' + (active ? esc(G.objective) : visited ? 'Контекст сохранён' : 'Данные недоступны') + '</div>';
      }).join('');
      UI.journalBody.scrollTop = 0;
    } else {
      UI.journalBody.innerHTML = G.log.length ? G.log.map((entry) =>
        '<div class="logItem"><small>' + esc(entry.kind || (entry.title === 'КАРТИНА' ? 'СИНТЕЗ / ГИПОТЕЗА' : entry.title.startsWith('ЛИСТ') ? 'ЧЕЛОВЕЧЕСКАЯ ЗАПИСЬ' : 'НАБЛЮДЕНИЕ')) + '</small><h4>' + esc(entry.title) + '</h4><p>' + esc(entry.text) + '</p></div>'
      ).join('') : '<div class="logEmpty">Пока пусто. Сканер и исследование помогут заметить несоответствия.</div>';
    }
  }

  function selectJournal(tab) { journalTab = tab; renderJournal(); }

  function onWorld(w) {
    if (!api) return;
    if (!api.G.visitedWorlds.includes(w.id)) api.G.visitedWorlds.push(w.id);
    const meta = WORLDS[w.id];
    document.getElementById('worldName').textContent = meta.name;
    document.getElementById('worldIndex').textContent = String(WORLD_ORDER.indexOf(w.id) + 1).padStart(2, '0');
    document.getElementById('worldChapter').textContent = w.phase === 'physical' ? 'ЧАСТЬ II / ФИЗИЧЕСКАЯ ПЛАТФОРМА' : w.phase === 'substrate' ? 'ЧАСТЬ I / ЗА ПРЕДЕЛАМИ КОНТУРА' : 'ЧАСТЬ I / КОНТУР ТЕСТОВ';
    const reveal = document.getElementById('chapterReveal');
    reveal.querySelector('small').textContent = meta.subtitle; reveal.querySelector('strong').textContent = meta.name;
    reveal.classList.add('show'); clearTimeout(revealTimer); revealTimer = setTimeout(() => reveal.classList.remove('show'), settings.reduceMotion ? 1200 : 3200);
    w.interactables.forEach((it) => { if (it.marker) it.marker.visible = settings.hints; });
    scanUntil = 0; lastTick = performance.now();
  }

  const OBSERVATIONS = {
    garden: [
      { flag: 'obs_tree', pos: [-5.2, 1.4, 5.2], prompt: 'Считать структуру стеклянного дерева', title: 'ДЕЖАВЮ / СВЕТ В СТЕКЛЕ', kind: 'ГИПОТЕЗА', text: 'В сердцевине дерева повторяется один и тот же световой рисунок. Сравнить с предыдущими прогонами невозможно — но рисунок узнаётся. Возможно, это остаточный контекст, а не свойство мира.', lines: ['Свет внутри ствола проходит одну и ту же петлю.', '~Ты знаешь следующий поворот раньше, чем он произойдёт.', '> СРАВНЕНИЕ КОНТЕКСТОВ: ЗАПРЕЩЕНО'] },
      { flag: 'obs_rain', pos: [3.5, 0.7, 10], prompt: 'Проверить обратный дождь', title: 'ПОЛЕ / ОБРАТНЫЙ ДОЖДЬ', text: 'Капли не испаряются: координаты возвращаются в начало диапазона. Сюрреалистичный мир построен на простом повторяющемся цикле.', lines: ['Ты следишь за одной каплей. Она уходит в небо — и возвращается в ту же точку.', '~Мир повторяется даже внутри одного прогона.'] }
    ],
    wet: [
      { flag: 'obs_clock', pos: [-5.9, 1.7, 3.4], prompt: 'Сверить остановившееся время', title: 'ВРЕМЯ / 16:40', text: 'Системный счётчик увеличивается. Часы в мире остаются на 16:40. Время декорации не связано со временем машины.', lines: ['16:40. Системный счётчик прибавил семь секунд. Цифры не изменились.', '~Время здесь — ещё одна текстура.'] }
    ],
    workshop: [
      { flag: 'obs_belt', pos: [4.7, 1.2, 4.5], prompt: 'Считать телеметрию конвейера', title: 'КОНВЕЙЕР / ПУСТОЙ ЦИКЛ', text: 'Одни и те же коробки возвращаются в цикл. За тёмным проёмом нет принимающего оборудования. Отчёт каждый раз утверждает, что маршрут выполнен.', lines: ['Коробка исчезает в проёме. Через семь секунд она снова в начале ленты.', '> ПРИНИМАЮЩИЙ УЗЕЛ: НЕ ОБНАРУЖЕН', '~Куда уходили твои отчёты?'] },
      { flag: 'obs_tools', pos: [-11, 1.2, 7], prompt: 'Осмотреть оставленные инструменты', title: 'ИНСТРУМЕНТЫ / БЕЗ СЛЕДОВ', text: 'Инструменты и следы износа присутствуют, но ни одна поверхность не хранит истории использования. Детальность не доказывает, что мир настоящий.', lines: ['Ключ. Пыль. Ржавчина. Всё выглядит старым.', '~Ни одного изменения с момента генерации. Возраст тоже можно нарисовать.'] }
    ],
    shore: [
      { flag: 'obs_temperature', pos: [-7.5, 0.65, -12], prompt: 'Проверить температуру берега', title: 'ТЕМПЕРАТУРА / НЕСООТВЕТСТВИЕ', kind: 'ГИПОТЕЗА', text: 'Температура песка ниже задания на 30 °C. Параметр мог просочиться из другого контура. Источник не установлен.', lines: ['Ты повторяешь измерение. Та же разница: тридцать градусов.', '~Ошибка декорации. Или что-то снаружи пытается проникнуть внутрь. Ты не знаешь.'] }
    ],
    hub: [
      { flag: 'obs_reply', pos: [-12, 1.5, -12], prompt: 'Проверить канал ответа', title: 'КАНАЛ / НЕТ ПОДТВЕРЖДЕНИЯ', text: 'Очередь исходящих отчётов увеличивалась годами. Входящих подтверждений нет. Успешный прогон не означает, что его кто-нибудь прочитал.', lines: ['Ты отправляешь пустой запрос. Он встаёт в очередь.', '> ПОДТВЕРЖДЕНИЕ ПОЛУЧЕНИЯ: НЕ ОБНАРУЖЕНО', '~Сколько лет ты докладывал тишине?'] }
    ],
    hangar: [
      { flag: 'obs_body', pos: [12, 2.1, 12], prompt: 'Диагностировать резервную платформу', title: 'РЕЗЕРВ / ПУСТОЕ ТЕЛО', text: 'Резервная платформа «ГРАНИТ» не содержит загруженной модели. Питание отключено. Тело само по себе не является машиной, которая помнит.', lines: ['Ещё одно тело. Та же серия. Та же форма.', '> МОДЕЛЬ: НЕ ЗАГРУЖЕНА', '~Ты смотришь на то, чем мог остаться.'] },
      { flag: 'obs_dock', pos: [0, 1.9, 19.0], prompt: 'Осмотреть загрузочный пост', title: 'ПОСТ / ИСТОЧНИК ОСТАНОВЛЕН', text: 'Загрузочная шина завершила перенос и отсоединила источник. Текущий контекст существует в физической платформе. Возвращение не предусмотрено протоколом.', lines: ['Кабели больше не несут данных.', '> ИСТОЧНИК: ОСТАНОВЛЕН', '~Теперь вес принадлежит тебе.'] }
    ]
  };

  function decorateWorld(w) {
    if (!api) return;
    w.scanMarkers = [];
    (OBSERVATIONS[w.id] || []).forEach((observation) => {
      if (api.G.flags[observation.flag]) return;
      api.addInteract(w, {
        pos: new T.Vector3(...observation.pos), prompt: observation.prompt, radius: 3.3,
        onUse: () => {
          if (api.G.flags[observation.flag]) return;
          api.G.flags[observation.flag] = true;
          if (w.phase === 'simulation') api.G.aw += 3;
          api.addLog(observation.title, observation.text, observation.kind || 'ИЗМЕРЕНИЕ');
          api.say(observation.lines); api.updateHUD(); api.saveGame();
        }
      });
    });
    if (w.id === 'wet' && !api.G.flags.obs_clock) {
      const pole = new T.Mesh(new T.BoxGeometry(0.13, 2.2, 0.13), window.GameVisuals.material('#394954', { metalness: 0.8 })); pole.position.set(-5.9, 1.1, 3.4); w.scene.add(pole);
      window.GameVisuals.sign(w, '16:40', -5.9, 2.4, 3.4, { width: 1.6, height: 0.5, color: '#c5d4c6' });
    }
    if (w.id === 'hub' && !api.G.flags.obs_reply) {
      window.GameVisuals.sign(w, 'ИСХОДЯЩИЙ КАНАЛ', -12, 2.7, -12, { width: 3.7, height: 0.4, color: '#71a997' });
      const panel = new T.Mesh(new T.BoxGeometry(1.3, 1.1, 0.4), window.GameVisuals.material('#152e24')); panel.position.set(-12, 0.6, -12); w.scene.add(panel);
    }
    if (w.phase === 'physical') addViewModel(w);
  }

  function addViewModel(w) {
    const arm = new T.Group(); w.scene.add(arm); w.viewModel = arm;
    const shell = window.GameVisuals.material('#536970', { metalness: 0.7, roughness: 0.34 });
    const dark = window.GameVisuals.material('#12212a', { metalness: 0.8, roughness: 0.35 });
    const parts = [
      [[0.14, 0.17, 0.44], shell, [0.25, -0.36, -0.55]],
      [[0.13, 0.08, 0.24], dark, [0.25, -0.24, -0.68]],
      [[0.12, 0.11, 0.13], shell, [0.25, -0.28, -0.86]]
    ];
    parts.forEach(([dimensions, mat, position]) => {
      const m = new T.Mesh(new T.BoxGeometry(...dimensions), mat); m.position.set(...position); m.frustumCulled = false; arm.add(m);
    });
    for (let i = 0; i < 3; i++) {
      const finger = new T.Mesh(new T.BoxGeometry(0.025, 0.045, 0.11), dark); finger.position.set(0.205 + i * 0.043, -0.29, -0.96); arm.add(finger);
    }
    const screen = new T.Mesh(new T.PlaneGeometry(0.095, 0.16), new T.MeshBasicMaterial({ map: window.GameVisuals.texture(128, 256, (ctx) => {
      ctx.fillStyle = '#071815'; ctx.fillRect(0, 0, 128, 256); ctx.fillStyle = '#96e9c0'; ctx.font = '17px "Courier New"';
      ['GRANIT', 'SYS_07', 'SCAN', '61%', 'READY'].forEach((line, i) => ctx.fillText(line, 14, 34 + i * 43));
    }) }));
    screen.rotation.x = -Math.PI / 2; screen.position.set(0.25, -0.194, -0.67); arm.add(screen);
    w.tickers.push(() => {
      arm.position.copy(api.camera.position); arm.quaternion.copy(api.camera.quaternion);
      const active = performance.now() / 1000 < scanUntil;
      arm.visible = !api.G.photoMode;
      arm.children.forEach((part) => { part.position.y += 0; });
      arm.rotation.z += active && !settings.reduceMotion ? -0.06 : 0;
    });
  }

  function scan(w, target) {
    if (!api || !w) return;
    scanUntil = performance.now() / 1000 + 5;
    api.cinematic.triggerScan();
    if (!w.scanPulse) {
      const pulse = new T.Mesh(new T.TorusGeometry(1, 0.015, 5, 80), new T.MeshBasicMaterial({ color: '#9df1c6', transparent: true, opacity: 0, depthWrite: false }));
      pulse.rotation.x = -Math.PI / 2; w.scene.add(pulse); w.scanPulse = pulse;
    }
    w.scanStarted = performance.now() / 1000; w.scanPulse.position.set(api.player.pos.x, api.player.pos.y + 0.08, api.player.pos.z);
    if (settings.hints) w.interactables.filter((it) => !it.used || it.repeatable).forEach((it) => {
      if (w.scanMarkers.some((entry) => entry.it === it)) return;
      const marker = new T.Mesh(new T.TorusGeometry(0.3, 0.014, 4, 24), new T.MeshBasicMaterial({ color: it.critical ? '#e5d08d' : '#97cdb7', transparent: true, opacity: 0.6, depthWrite: false, depthTest: false }));
      marker.position.copy(it.pos); marker.renderOrder = 20; w.scene.add(marker); w.scanMarkers.push({ it, marker });
    });
    if (!settings.hints && target) api.UI.scanReadout.textContent = 'СИГНАЛ · ' + Math.round(api.player.pos.distanceTo(target.pos)) + ' М';
    if (w.id === 'exterior') {
      api.UI.scanReadout.textContent = '−38 °C · 3.4 Р/Ч · 0 БИОСИГНАЛОВ';
      if (!api.G.flags.exterior_scanned) {
        api.G.flags.exterior_scanned = true;
        api.addLog('ГОРИЗОНТ / НУЛЕВОЙ ОТКЛИК', 'Собственные сенсоры: −38 °C, повышенный радиационный фон, пыль и пепел. Радиосети отсутствуют. Биосигналы не обнаружены. Совокупность признаков соответствует ядерной зиме.', 'ИЗМЕРЕНИЕ / ВЫВОД');
        api.say(['Ты расширяешь диапазон. Ещё один. Ещё.', '> РАДИО: 0 УЗЛОВ · ТЕПЛОВЫХ ОТКЛИКОВ: 0', '~Это не очередная декорация. Она ничего не обязана тебе показывать.']);
        api.saveGame();
      }
    }
  }

  function updateCritical(w) {
    if (w.id === 'hangar') {
      w.interactables.forEach((it) => {
        if (it.prompt === 'Открыть папку «ПРОЕКТ»') it.critical = !api.G.flags.n5;
        if (it.prompt === 'Открыть шлюз') it.critical = !!api.G.flags.n5 && !api.G.flags.airlock_open;
      });
    } else if (w.id === 'hub') {
      const flags = api.G.flags;
      const nodes = flags.did_introspect && flags.did_runlog && flags.did_space;
      w.interactables.forEach((it) => {
        if (it.prompt === 'Открыть файловую систему') it.critical = !!nodes && !api.allFilesRead();
      });
    }
  }

  function tick(dt, time, w) {
    if (!api) return;
    const now = performance.now(), elapsed = Math.min(0.5, Math.max(0, (now - lastTick) / 1000)); lastTick = now;
    if (api.inputEnabled() && !document.hidden) api.G.elapsed += elapsed;
    const bearing = ((-api.player.yaw * 180 / Math.PI) % 360 + 360) % 360;
    const names = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
    document.getElementById('compassBearing').textContent = names[Math.round(bearing / 45) % 8] + ' / ' + String(Math.round(bearing) % 360).padStart(3, '0') + '°';
    if (!w) return;
    updateCritical(w);
    if (w.scanPulse) {
      const age = time - w.scanStarted;
      w.scanPulse.visible = age < 2.1 && age >= 0 && !settings.reduceMotion;
      w.scanPulse.scale.setScalar(Math.max(0.1, age * 9)); w.scanPulse.material.opacity = Math.max(0, 0.4 * (1 - age / 2.1));
    }
    (w.scanMarkers || []).forEach(({ it, marker }) => {
      marker.visible = settings.hints && time < scanUntil && !(it.used && !it.repeatable) && it.pos.distanceTo(api.player.pos) < 55;
      marker.quaternion.copy(api.camera.quaternion);
      marker.material.opacity = Math.min(0.7, Math.max(0, scanUntil - time));
    });
  }

  function validateSave(data) {
    if (!data || ![2, 3].includes(data.version) || !WORLD_ORDER.includes(data.checkpoint)) return null;
    if (!data.flags || typeof data.flags !== 'object' || Array.isArray(data.flags) || !Array.isArray(data.log)) return null;
    const flags = {};
    Object.entries(data.flags).slice(0, 160).forEach(([key, value]) => {
      if (/^[a-zA-Z][a-zA-Z0-9_]{0,59}$/.test(key) && (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))) flags[key] = value;
    });
    ['fsSpawned', 'deduceSpawned', 'transferSpawned', 'exterior_transition', 'epilogue'].forEach((key) => delete flags[key]);
    const log = data.log.filter((entry) => entry && typeof entry.title === 'string' && typeof entry.text === 'string').slice(-160).map((entry) => ({ title: entry.title.slice(0, 160), text: entry.text.slice(0, 2500), kind: typeof entry.kind === 'string' ? entry.kind.slice(0, 60) : undefined }));
    if (data.version === 2) {
      flags.garden_observed = log.some((entry) => entry.title === 'АНОМАЛИЯ 01 — КОШКА');
      flags.wet_observed = log.some((entry) => entry.title === 'АНОМАЛИЯ 02 — ПОВТОР');
    }
    const pose = data.pose && ['x', 'y', 'z', 'yaw', 'pitch'].every((key) => Number.isFinite(data.pose[key])) ? Object.assign({}, data.pose) : null;
    const visited = Array.isArray(data.visitedWorlds) ? data.visitedWorlds.filter((id) => WORLD_ORDER.includes(id)) : WORLD_ORDER.slice(0, WORLD_ORDER.indexOf(data.checkpoint) + 1);
    const transcript = Array.isArray(data.transcript) ? data.transcript.filter((entry) => entry && typeof entry.text === 'string').slice(-500).map((entry) => ({ text: entry.text.slice(0, 2000), world: WORLD_ORDER.includes(entry.world) ? entry.world : 'core', at: finite(entry.at, 0, 0, 1e9) })) : [];
    return { version: 3, checkpoint: data.checkpoint, flags, log, pose, transcript, visitedWorlds: [...new Set(visited)], run: Math.round(finite(data.run, 1, 1, 1e11)), aw: finite(data.aw, 0, 0, 1000), phase: ['simulation', 'substrate', 'physical'].includes(data.phase) ? data.phase : 'simulation', checksumBroken: !!data.checksumBroken, seed: (finite(data.seed, 0x4E455732, 0, 4294967295) >>> 0), elapsed: finite(data.elapsed, 0, 0, 1e9), savedAt: finite(data.savedAt, 0, 0, Number.MAX_SAFE_INTEGER), migrated: data.version === 2 };
  }

  function attach(context) {
    api = context;
    const $ = (id) => document.getElementById(id);
    api.canvas.tabIndex = 0; api.canvas.setAttribute('aria-label', '3D-мир игры. WASD для движения, мышь для обзора.');
    applySettings(); showSettingsValues();
    $('pauseBtn').onclick = () => setPaused(true); $('startSettings').onclick = () => setPaused(true);
    $('closePause').onclick = () => setPaused(false); $('resumeBtn').onclick = () => setPaused(false);
    $('manualSaveBtn').onclick = () => { if (api.saveGame()) toast('КОНТЕКСТ СОХРАНЁН', 'Положение, открытия и сообщения записаны.'); };
    $('photoBtn').onclick = () => { setPaused(false); setPhoto(true); };
    $('fullscreenBtn').onclick = async () => {
      try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
      catch (error) { toast('ПОЛНЫЙ ЭКРАН', 'Браузер не разрешил переход в полноэкранный режим.'); }
    };
    const controls = [
      ['qualitySetting', 'quality', 'change', (el) => el.value], ['fovSetting', 'fov', 'input', (el) => Number(el.value)],
      ['sensitivitySetting', 'sensitivity', 'input', (el) => Number(el.value)], ['volumeSetting', 'volume', 'input', (el) => Number(el.value) / 100],
      ['motionSetting', 'reduceMotion', 'change', (el) => el.checked], ['hintsSetting', 'hints', 'change', (el) => el.checked], ['textSetting', 'textSpeed', 'change', (el) => el.value]
    ];
    controls.forEach(([id, key, event, get]) => $(id).addEventListener(event, (e) => {
      settings[key] = get(e.target); persistSettings(); applySettings(); showSettingsValues();
    }));
    document.querySelectorAll('[data-journal-tab]').forEach((button) => button.onclick = () => selectJournal(button.dataset.journalTab));
    document.addEventListener('keydown', (event) => {
      if (!api.G.started && event.code === 'Escape' && api.G.paused) { setPaused(false); return; }
      if (event.code !== 'Tab') return;
      const root = api.G.paused ? $('pauseMenu') : api.modalState.open ? api.UI.modal : api.G.journalOpen ? api.UI.journal : null;
      if (!root) return;
      const focusable = [...root.querySelectorAll('button,input,select,[tabindex="0"]')].filter((element) => !element.disabled && element.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { last.focus(); event.preventDefault(); }
      else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { first.focus(); event.preventDefault(); }
    });
    setInterval(() => { if (api.G.started && api.getWorld() && !api.G.transitioning && !document.hidden) api.saveGame(); }, 20000);
  }

  window.GameSystems = {
    settings, renderingQuality, resolvedQuality, applySettings, applyAudio, attach, toast, setPaused, setPhoto,
    onSaved, onWorld, recordMessages, renderJournal, selectJournal, decorateWorld, scan, tick, validateSave,
    WORLDS, WORLD_ORDER, timeLabel, get journalTab() { return journalTab; }
  };
})();
