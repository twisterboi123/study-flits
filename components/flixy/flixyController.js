/*
 * StudyFlits' reusable Rive mascot controller.
 * The Flixy Rive file must contain an artboard and a state machine called
 * "FlixyStateMachine" with these trigger inputs: happy, sad, talking,
 * thinking, correct, wrong and excited. Optional Boolean inputs are isTalking
 * and isThinking; the optional Number input is talkAmount.
 */
(function () {
  const STATE_MACHINE = 'FlixyStateMachine';
  const VALID_STATES = new Set(['idle', 'happy', 'sad', 'talking', 'thinking', 'correct', 'wrong', 'excited']);
  let instance = null;
  let returnTimer = null;

  function fallbackMarkup() {
    return `<svg class="flixy-fallback" viewBox="0 0 180 180" role="img" aria-label="Flixy, de groene StudyFlits vogel">
      <defs><radialGradient id="flixyGreen" cx="30%" cy="20%"><stop stop-color="#f3d7ff"/><stop offset=".42" stop-color="#bd7cff"/><stop offset="1" stop-color="#7141c6"/></radialGradient><linearGradient id="flixyOrange" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffe166"/><stop offset="1" stop-color="#ff7b1f"/></linearGradient></defs>
      <path class="f-tail" d="M49 122Q4 145 13 100Q19 78 60 94Z" fill="#9c69ed" stroke="#5d35ad" stroke-width="6"/>
      <g class="f-dino-spikes"><path d="M51 54l10-24 10 23 11-27 10 28 12-24 9 26" fill="#f5bdff" stroke="#5d35ad" stroke-width="5" stroke-linejoin="round"/></g>
      <g class="f-wing f-wing-left"><path d="M57 113q-22 3-28 18l10 4 6-7 5 11 9-4-5-10 13-2" fill="#9c69ed" stroke="#5d35ad" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>
      <g class="f-wing f-wing-right"><path d="M123 113q22 3 28 18l-10 4-6-7-5 11-9-4 5-10-13-2" fill="#9c69ed" stroke="#5d35ad" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>
      <ellipse class="f-body" cx="90" cy="95" rx="61" ry="64" fill="url(#flixyGreen)" stroke="#5d35ad" stroke-width="6"/>
      <ellipse cx="68" cy="58" rx="18" ry="8" fill="#fff" opacity=".53" transform="rotate(-27 68 58)"/>
      <g class="f-eyes"><ellipse cx="68" cy="88" rx="14" ry="19" fill="#21333a"/><ellipse cx="112" cy="88" rx="14" ry="19" fill="#21333a"/><circle cx="64" cy="82" r="4" fill="#fff"/><circle cx="108" cy="82" r="4" fill="#fff"/></g>
      <g class="f-beak"><path d="M72 103Q90 96 121 104Q132 110 121 121Q93 129 73 119Q66 112 72 103Z" fill="#c58aff" stroke="#5d35ad" stroke-width="4"/><circle cx="108" cy="108" r="3" fill="#4a276f"/><circle cx="119" cy="110" r="3" fill="#4a276f"/><path class="f-mouth" d="M82 120q19 5 37-1" fill="none" stroke="#4a276f" stroke-width="3" stroke-linecap="round"/><path d="M92 120l4 6 4-5 5 5 4-6" fill="#fff"/></g>
      <g class="f-feet"><path d="M67 150v12l-8 3m8-3 7 3m35-15v12l-8 3m8-3 7 3" fill="none" stroke="#9c69ed" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>
    </svg>`;
  }

  function showFallback(canvas) {
    const holder = canvas.parentElement;
    if (!holder) return;
    holder.innerHTML = fallbackMarkup();
    holder.classList.add('flixy-vector-fallback');
    instance = { fallback: holder, inputs: [] };
  }

  function reducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  function input(name) {
    return instance?.inputs?.find((item) => item.name === name);
  }

  function trigger(name) {
    const control = input(name);
    if (!control) return;
    if (typeof control.fire === 'function') control.fire();
    else if ('value' in control) control.value = true;
  }

  function setFlixyState(state) {
    if (!VALID_STATES.has(state) || !instance) return;
    clearTimeout(returnTimer);
    if (instance.fallback) {
      instance.fallback.dataset.state = state;
      if (['happy', 'sad', 'correct', 'wrong', 'excited'].includes(state)) returnTimer = window.setTimeout(() => setFlixyState('idle'), reducedMotion() ? 350 : 1500);
      return;
    }
    const isTalking = input('isTalking');
    const isThinking = input('isThinking');
    if (isTalking) isTalking.value = state === 'talking';
    if (isThinking) isThinking.value = state === 'thinking';
    if (state !== 'idle') trigger(state);

    // Reactions are short; the Rive timeline may return itself, and this is a
    // safe second path when it does not.
    if (['happy', 'sad', 'correct', 'wrong', 'excited'].includes(state)) {
      returnTimer = window.setTimeout(() => setFlixyState('idle'), reducedMotion() ? 350 : 1500);
    }
  }

  function setTalkAmount(amount) {
    const control = input('talkAmount');
    if (control && 'value' in control) control.value = Math.max(0, Math.min(1, amount));
  }

  function mount(canvas, options = {}) {
    if (!canvas) return null;
    if (!window.rive?.Rive) {
      showFallback(canvas);
      return instance;
    }
    instance = { rive: null, inputs: [] };
    instance.rive = new window.rive.Rive({
      src: options.src || '/assets/flixy/flixy.riv',
      canvas,
      stateMachines: STATE_MACHINE,
      autoplay: true,
      layout: new window.rive.Layout({ fit: window.rive.Fit.Contain, alignment: window.rive.Alignment.Center }),
      onLoad: () => {
        instance.inputs = instance.rive.stateMachineInputs(STATE_MACHINE) || [];
        setFlixyState('idle');
        instance.rive.resizeDrawingSurfaceToCanvas();
      },
      onLoadError: () => showFallback(canvas),
    });
    return instance;
  }

  window.FlixyMascot = { mount, setState: setFlixyState, setTalkAmount };
  window.setFlixyState = setFlixyState;
})();
