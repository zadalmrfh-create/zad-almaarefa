import {checkPracticeAnswer} from './mistake-review-core.js?v=20261122-step3';

const number = new Intl.NumberFormat('ar-EG');
let nextId = 0;
const mountedReviews = new WeakMap();

function element(tag, content, className) {
  const item = document.createElement(tag);
  if (content) item.textContent = content;
  if (className) item.className = className;
  return item;
}

function button(text) {
  const control = element('button', text);
  control.type = 'button';
  return control;
}

function addStyles() {
  if (document.getElementById('zad-mistake-review-style')) return;
  const css = document.createElement('link');
  css.id = 'zad-mistake-review-style';
  css.rel = 'stylesheet';
  css.href = new URL('./mistake-review.css?v=20261122-step3', import.meta.url).href;
  document.head.append(css);
}

function questionLabel(question) {
  return 'السؤال ' + number.format(question.number) +
    (question.section ? ' · ' + question.section : '') + ' — ' + question.prompt;
}

function renderReview(panel, questions) {
  const list = element('div', '', 'zad-mistake-list');
  for (const question of questions) {
    const item = element('article', '', 'zad-mistake-question');
    item.append(
      element('h4', questionLabel(question)),
      element('p', question.previous ? 'إجابتك: ' + question.previous : 'السؤال متروك بدون إجابة.'),
      element('p', 'الإجابة الصحيحة: ' + question.model, 'zad-mistake-model')
    );
    list.append(item);
  }
  panel.append(list);
}

function renderPractice(panel, questions) {
  const form = element('form', '', 'zad-mistake-list');
  const status = element('p', '', 'zad-mistake-status');
  status.setAttribute('role', 'status');
  const submit = button('صحّح التدريب');
  submit.type = 'submit';
  const retry = button('أعد التدريب');
  retry.hidden = true;
  const feedback = [];

  questions.forEach((question, index) => {
    const name = 'mistake' + index;
    const field = element('fieldset', '', 'zad-mistake-question');
    field.append(element('legend', questionLabel(question)));
    if (question.choices) {
      question.choices.forEach((choice, choiceIndex) => {
        const label = element('label', '', 'zad-mistake-choice');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = name;
        input.value = String(choiceIndex);
        label.append(input, element('span', choice));
        field.append(label);
      });
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.name = name;
      input.autocomplete = 'off';
      input.maxLength = 1000;
      input.setAttribute('aria-label', 'إجابتك عن السؤال ' + number.format(question.number));
      input.placeholder = question.multiple ? 'افصل بين الإجابات بفاصلة' : 'اكتب إجابتك';
      field.append(input);
    }
    const explanation = element('p', '', 'zad-mistake-feedback');
    feedback.push({field, explanation, name, question});
    field.append(explanation);
    form.append(field);
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (submit.disabled) return;
    const values = new FormData(form);
    if (!feedback.some(item => String(values.get(item.name) ?? '').trim())) {
      status.textContent = 'جاوب عن سؤال واحد على الأقل قبل تصحيح التدريب.';
      return;
    }
    let correct = 0;
    for (const {field, explanation, name, question} of feedback) {
      const answer = values.get(name);
      const passed = checkPracticeAnswer(question, answer);
      if (passed) correct++;
      explanation.textContent = passed ? 'إجابة صحيحة' :
        (String(answer ?? '').trim() ? 'إجابة غير صحيحة' : 'بدون إجابة') +
        '. الإجابة الصحيحة: ' + question.model;
      explanation.dataset.correct = String(passed);
      field.disabled = true;
    }
    submit.disabled = true;
    retry.hidden = false;
    status.textContent = 'نتيجة التدريب: ' + number.format(correct) + ' من ' + number.format(questions.length);
  });

  retry.addEventListener('click', () => {
    form.reset();
    for (const {field, explanation} of feedback) {
      field.disabled = false;
      explanation.textContent = '';
      delete explanation.dataset.correct;
    }
    status.textContent = '';
    submit.disabled = false;
    retry.hidden = true;
    form.querySelector('input')?.focus();
  });
  const actions = element('div', '', 'zad-mistake-actions');
  actions.append(submit, retry);
  form.append(actions, status);
  panel.append(form);
}

export function mountMistakeReview(container, review) {
  const signature = JSON.stringify(review);
  const mounted = mountedReviews.get(container);
  if (mounted && mounted.signature === signature && mounted.widget.parentElement === container) return;
  mounted?.widget.remove();
  addStyles();
  const widget = element('section', '', 'zad-mistake-review');
  widget.dir = 'rtl';
  widget.setAttribute('aria-label', 'مراجعة أخطاء الامتحان');
  widget.append(element('h3', 'مراجعة أخطائك'));
  container.append(widget);
  mountedReviews.set(container, {signature, widget});

  if (!review) {
    widget.append(element('p', 'تفاصيل المراجعة غير متاحة لهذه المحاولة.'));
    return;
  }
  const {total, missed} = review;
  widget.append(element('p', 'الأسئلة المتاحة للمراجعة: ' + number.format(total) +
    ' · إجابات صحيحة: ' + number.format(total - missed.length) +
    ' · تحتاج مراجعة: ' + number.format(missed.length)));
  if (!missed.length) return;

  const actions = element('div', '', 'zad-mistake-actions');
  const reviewButton = button('راجع أخطائي');
  const practiceButton = button('اتدرّب على أخطائي');
  practiceButton.classList.add('zad-mistake-primary');
  const panel = element('div', '', 'zad-mistake-panel');
  panel.hidden = true;
  panel.id = 'zad-mistake-panel-' + ++nextId;
  let mode = '';
  for (const [control, selectedMode] of [[reviewButton, 'review'], [practiceButton, 'practice']]) {
    control.setAttribute('aria-controls', panel.id);
    control.setAttribute('aria-expanded', 'false');
    control.addEventListener('click', () => {
      mode = mode === selectedMode ? '' : selectedMode;
      reviewButton.setAttribute('aria-expanded', String(mode === 'review'));
      practiceButton.setAttribute('aria-expanded', String(mode === 'practice'));
      panel.replaceChildren();
      panel.hidden = !mode;
      if (mode === 'review') renderReview(panel, missed);
      if (mode === 'practice') {
        panel.append(element('p', 'درجة التدريب مستقلة عن نتيجة الامتحان.'));
        renderPractice(panel, missed);
      }
    });
  }
  actions.append(reviewButton, practiceButton);
  widget.append(actions, panel);
}
