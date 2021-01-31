/* eslint-disable no-param-reassign */
/* eslint-disable import/extensions */
import * as storage from './storage.js';
import create from './utils/create.js';
import language from './layouts/index.js';
import Key from './Key.js';

const main = create('main', '',
  [create('h1', 'title', 'Virtual Keyboard'),
    create('h3', 'subtitle', 'Windows keyboard that has been made under Windows'),
    create('p', 'hint', 'Use left <kbd>Ctrl</kbd> + <kbd>Alt</kbd> or special key to switch language. Last language saves in localStorage'),
  ]);

export default class Keyboard {
  constructor(rowsOrder) {
    this.rowsOrder = rowsOrder;
    this.keysPressed = {};
    this.isCaps = false;
    this.isVoice = false;
    this.isDictation = false;
  }

  init(langCode) {
    this.keyBase = language[langCode];
    this.output = create('textarea', 'output', null, main,
      ['placeholder', 'Start type something...'],
      ['rows', 5],
      ['cols', 50],
      ['spellcheck', false],
      ['autocorrect', 'off']);

    this.recognition = new webkitSpeechRecognition();
    this.recognition.interimResults = true;
    this.recognition.lang = `${langCode}-${langCode.toUpperCase()}`;

    this.audio = create('audio', 'audio', null, main);
    this.audio.src = `./assets/audio/${langCode}.wav`;

    this.audioShift = create('audio', 'audio', null, main);
    this.audioShift.src = './assets/audio/shift.wav';

    this.audioEnter = create('audio', 'audio', null, main);
    this.audioEnter.src = './assets/audio/enter.wav';

    this.audioCapsLock = create('audio', 'audio', null, main);
    this.audioCapsLock.src = './assets/audio/capslock.wav';

    this.audioBackSpace = create('audio', 'audio', null, main);
    this.audioBackSpace.src = './assets/audio/backspace.wav';

    this.imgBtn = create('img', 'arrow', null, this.showButton);
    this.imgBtn.src = './assets/img/arrow-down.svg';
    this.showButton = create('div', 'toggle', this.imgBtn, main);
    this.container = create('div', 'keyboard', null, main, ['language', langCode]);
    document.body.prepend(main);
    return this;
  }

  generateLayout() {
    this.keyButtons = [];
    this.rowsOrder.forEach((row, i) => {
      const rowElement = create('div', 'keyboard__row', null, this.container, ['row', i + 1]);
      rowElement.style.gridTemplateColumns = `repeat(${row.length}, 1fr)`;
      row.forEach((code) => {
        const keyObj = this.keyBase.find((key) => key.code === code);
        if (keyObj) {
          const keyButton = new Key(keyObj);
          this.keyButtons.push(keyButton);
          rowElement.appendChild(keyButton.div);
        }
      });
    });
    document.addEventListener('keydown', this.handleEvent);
    document.addEventListener('keyup', this.handleEvent);
    this.container.addEventListener('mousedown', this.preHandleEvent);
    this.container.addEventListener('mouseup', this.preHandleEvent);
    this.showButton.addEventListener('click', this.toggleKeyboard);
  }

  preHandleEvent = (e) => {
    e.stopPropagation();
    const keyDiv = e.target.closest('.keyboard__key');
    if (!keyDiv) return;
    const {
      dataset: {
        code,
      },
    } = keyDiv;
    keyDiv.addEventListener('mouseleave', this.resetButtonState);
    this.handleEvent({
      code,
      type: e.type,
    });
  };

  resetButtonState = ({
    target: {
      dataset: {
        code,
      },
    },
  }) => {
    if (code.match('Shift')) {
      this.shiftKey = false;
      this.switchUpperCase(false);
      this.keysPressed[code].div.classList.remove('active');
    }
    if (code.match(/Control/)) this.ctrKey = false;
    if (code.match(/Alt/)) this.altKey = false;
    this.resetPressedButtons(code);
    this.output.focus();
  }

  resetPressedButtons = (targetCode) => {
    if (!this.keysPressed[targetCode]) return;
    if (!this.isCaps) this.keysPressed[targetCode].div.classList.remove('active');
    this.keysPressed[targetCode].div.removeEventListener('mouseleave', this.resetButtonState);
    delete this.keysPressed[targetCode];
  }

  handleEvent = (e) => {
    if (e.stopPropagation) e.stopPropagation();
    const {
      code,
      type,
    } = e;
    const keyObj = this.keyButtons.find((key) => key.code === code);
    if (!keyObj) return;
    this.output.focus();

    if (type.match(/keydown|mousedown/)) {
      if (!type.match(/mouse/)) e.preventDefault();

      if (code.match(/Shift/) && this.isVoice) {
        this.audioShift.currentTime = 0;
        this.audioShift.play();
      }

      if (code.match(/Enter/) && this.isVoice) {
        this.audioEnter.currentTime = 0;
        this.audioEnter.play();
      }

      if (code.match(/CapsLock/) && this.isVoice) {
        this.audioCapsLock.currentTime = 0;
        this.audioCapsLock.play();
      }

      if (code.match(/Backspace/) && this.isVoice) {
        this.audioBackSpace.currentTime = 0;
        this.audioBackSpace.play();
      }

      if (code.match(/Control|Alt|Caps/) && e.repeat) return;

      if (code.match(/Control/)) this.ctrlKey = true;
      if (code.match(/Alt/)) this.altlKey = true;
      if (code.match(/Shift/)) this.shiftKey = true;

      if (this.shiftKey) this.switchUpperCase(true);

      if (code.match(/Control/) && this.altlKey) this.switchLanguage();
      if (code.match(/Alt/) && this.ctrlKey) this.switchLanguage();
      if (code.match(/Lang/)) this.switchLanguage();

      if (code.match(/Dictation/)) {
        this.isDictation = !this.isDictation;
        keyObj.div.classList.toggle('voice-on');
      }

      if (this.isDictation) {
        this.recognition.addEventListener('result', this.handleRecorgnitionResult);
        this.recognition.start();
        this.recognition.addEventListener('end', this.recognition.start);
      } else {
        this.recognition.stop();
        this.recognition.removeEventListener('end', this.recognition.start);
      }

      if (code.match(/Voice/)) {
        this.isVoice = !this.isVoice;
        keyObj.div.classList.toggle('voice-on');
      }

      if (this.isVoice) {
        this.audio.currentTime = 0;
        this.audio.play();
      }

      keyObj.div.classList.add('active');

      // handle Caps down
      if (code.match(/Caps/) && !this.isCaps) {
        this.isCaps = true;
        this.switchUpperCase(true);
      } else if (code.match(/Caps/) && this.isCaps) {
        this.isCaps = false;
        this.switchUpperCase(false);
        keyObj.div.classList.remove('active');
      }

      if (!this.isCaps) {
        this.printToOutput(keyObj, this.shiftKey ? keyObj.shift : keyObj.small);
      } else if (this.isCaps) {
        if (this.shiftKey) {
          this.printToOutput(keyObj, keyObj.sub.innerHTML ? keyObj.shift : keyObj.small);
        } else {
          this.printToOutput(keyObj, !keyObj.sub.innerHTML ? keyObj.shift : keyObj.small);
        }
      }
      this.keysPressed[keyObj.code] = keyObj;
    } else if (type.match(/keyup|mouseup/)) {
      if (code.match(/Shift/)) {
        this.shiftKey = false;
        this.switchUpperCase(false);
      }

      if (code.match(/Control/)) this.ctrlKey = false;
      if (code.match(/Alt/)) this.altlKey = false;

      if (!code.match(/Caps/)) keyObj.div.classList.remove('active');
    }
  }

  toggleKeyboard = () => {
    if (this.container.classList.contains('close')) {
      this.container.classList.remove('close');
      this.showButton.classList.remove('opened');
    } else {
      this.container.classList.add('close');
      this.showButton.classList.add('opened');
    }
  }

  handleRecorgnitionResult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0])
      .map((result) => result.transcript)
      .join('');
    if (event.results[0].isFinal) {
      this.printDictationToOutput(transcript);
    }
  }

  switchUpperCase(isTrue) {
    if (isTrue) {
      this.keyButtons.forEach((button) => {
        if (button.sub) {
          if (this.shiftKey) {
            button.sub.classList.add('sub-active');
            button.letter.classList.add('sub-inactive');
          }
        }
        if (!button.isFnKey && this.isCaps && !this.shiftKey && !button.sub.innerHTML) {
          button.letter.innerHTML = button.shift;
        } else if (!button.isFnKey && this.isCaps && this.shiftKey) {
          button.letter.innerHTML = button.small;
        } else if (!button.isFnKey && !button.sub.innerHTML) {
          button.letter.innerHTML = button.shift;
        }
      });
    } else {
      this.keyButtons.forEach((button) => {
        if (button.sub.innerHTML && !button.isFnKey) {
          button.sub.classList.remove('sub-active');
          button.letter.classList.remove('sub-inactive');
          if (!this.isCaps) {
            button.letter.innerHTML = button.small;
          } else if (!this.isCaps) {
            button.letter.innerHTML = button.shift;
          }
        } else if (!button.isFnKey) {
          if (this.isCaps) {
            button.letter.innerHTML = button.shift;
          } else {
            button.letter.innerHTML = button.small;
          }
        }
      });
    }
  }

  switchLanguage = () => {
    const langAbbr = Object.keys(language);
    let langIndex = langAbbr.indexOf(this.container.dataset.language);
    this.keyBase = langIndex + 1 < langAbbr.length ? language[langAbbr[langIndex += 1]]
      : language[langAbbr[langIndex -= langIndex]];

    this.container.dataset.language = langAbbr[langIndex];
    storage.set('kbLang', langAbbr[langIndex]);

    this.recognition.lang = `${langAbbr[langIndex]}-${langAbbr[langIndex].toUpperCase()}`;

    this.audio.src = `./assets/audio/${langIndex + 1 < langAbbr.length ? `${langAbbr[langIndex]}.wav`
      : `${langAbbr[langIndex]}.wav`}`;

    this.keyButtons.forEach((button) => {
      const keyObj = this.keyBase.find((key) => key.code === button.code);
      if (!keyObj) return;
      button.shift = keyObj.shift;
      button.small = keyObj.small;
      if (keyObj.shift && keyObj.shift.match(/[^a-zA-Zа-яА-ЯёЁ0-9]/g)) {
        button.sub.innerHTML = keyObj.shift;
      } else {
        button.sub.innerHTML = '';
      }
      button.letter.innerHTML = keyObj.small;
    });

    if (this.isCaps) this.switchUpperCase(true);
  }

  printToOutput(keyObj, symbol) {
    let cursorPosition = this.output.selectionStart;

    const start = this.output.selectionStart;
    const end = this.output.selectionEnd;

    const selected = this.output.value.slice(start, end);

    const left = this.output.value.slice(0, cursorPosition);
    const right = this.output.value.slice(cursorPosition);
    const fnButtonsHandler = {
      Tab: () => {
        this.output.value = `${left}\t${right}`;
        cursorPosition += 1;
      },
      ArrowLeft: () => {
        cursorPosition = cursorPosition - 1 >= 0 ? cursorPosition - 1 : 0;
      },
      ArrowRight: () => {
        cursorPosition += 1;
      },
      ArrowUp: () => {
        const positionFromLeft = this.output.value.slice(0, cursorPosition).match(/(\n).*$(?!\1)/g) || [
          [1],
        ];
        cursorPosition -= positionFromLeft[0].length;
      },
      ArrowDown: () => {
        const positionFromLeft = this.output.value.slice(cursorPosition).match(/^.*(\n).*(?!\1)/) || [
          [1],
        ];
        cursorPosition += positionFromLeft[0].length;
      },
      Enter: () => {
        this.output.value = `${left}\n${right}`;
        cursorPosition += 1;
      },
      Delete: () => {
        this.output.value = `${left}${right.slice(1)}`;
      },
      Backspace: () => {
        if (selected.length) {
          this.output.value = this.output.value.replace(selected, '');
        } else {
          this.output.value = `${left.slice(0, -1)}${right}`;
          cursorPosition -= 1;
        }
      },
      Space: () => {
        this.output.value = `${left} ${right}`;
        cursorPosition += 1;
      },
    };

    if (fnButtonsHandler[keyObj.code]) fnButtonsHandler[keyObj.code]();

    else if (!keyObj.isFnKey) {
      if (selected.length) {
        this.output.value = this.output.value.replace(selected, symbol);
        cursorPosition += selected.length;
      } else {
        cursorPosition += 1;
        this.output.value = `${left}${symbol || ''}${right}`;
      }
    }
    this.output.setSelectionRange(cursorPosition, cursorPosition);
  }

  printDictationToOutput = (symbol) => {
    let cursorPosition = this.output.selectionStart;
    const left = this.output.value.slice(0, cursorPosition);
    const right = this.output.value.slice(cursorPosition);
    cursorPosition += symbol.length;
    this.output.value = `${left}${symbol || ''}${right} `;
  }
}
