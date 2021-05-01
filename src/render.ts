export { renderSequence, renderTemplate, render };

import { Instance } from "./instance";
import { Template } from "./template";
import { CompiledUpdater } from "./updater";

interface Cache {
  template: Template;
  updaters: Record<number, CompiledUpdater>;
}

interface Sequence {
  start: Comment;
  end: Comment;
}

const rendered = new WeakMap<Element, Sequence>();
const caches = new WeakMap<Comment, Cache>();
const sequences = new WeakMap<Comment, Sequence[]>();

function clearNodes(start: Node, end: Node): void {
  let current = start.nextSibling;

  while (current !== null && current !== end) {
    current.remove();
    current = start.nextSibling;
  }
}

function renderSequence(
  startMarker: Comment,
  endMarker: Comment,
  templates: Template[]
): void {
  const sequence = sequences.get(startMarker);

  if (templates.length === 0) {
    clearNodes(startMarker, endMarker);

    if (typeof sequence !== "undefined") {
      sequence.length = 0;
    }

    return;
  }

  if (typeof sequence === "undefined" || sequence.length === 0) {
    const sequence: Sequence[] = [];

    for (const template of templates) {
      const start = new Comment();
      const end = new Comment();

      endMarker.before(start, end);
      renderTemplate(start, end, template);

      sequence.push({ start, end });
    }

    sequences.set(startMarker, sequence);

    return;
  }

  if (templates.length < sequence.length) {
    const start = sequence[templates.length].start;
    const end = sequence[sequence.length - 1].end;

    clearNodes(start, end);

    start.remove();
    end.remove();

    sequence.length = templates.length;
  }

  while (templates.length > sequence.length) {
    const start = new Comment();
    const end = new Comment();

    endMarker.before(start, end);
    renderTemplate(start, end, templates[sequence.length]);

    sequence.push({ start, end });
  }

  for (let index = 0; index < sequence.length; index++) {
    const { start, end } = sequence[index];

    renderTemplate(start, end, templates[index]);
  }
}

function renderTemplate(
  start: Comment,
  end: Comment,
  template: Template
): void {
  const cache = caches.get(start);

  if (typeof cache === "undefined" || !cache.template.equalStrings(template)) {
    clearNodes(start, end);

    const instance = new Instance(template);

    start.after(instance.fragment);

    for (let index = 0; index < template.values.length; index++) {
      const updater = instance.updaters[index];
      const value = template.values[index];

      updater(value);
    }

    caches.set(start, { template, updaters: instance.updaters });

    return;
  }

  for (let index = 0; index < template.values.length; index++) {
    const oldValue = cache.template.values[index];
    const newValue = template.values[index];

    if (oldValue !== newValue) {
      const updater = cache.updaters[index];

      updater(newValue);
    }
  }

  cache.template = template;
}

function render(target: Element, template: Template): void {
  let result = rendered.get(target);

  if (typeof result === "undefined") {
    const start = new Comment();
    const end = new Comment();

    target.append(start, end);

    result = { start, end };

    rendered.set(target, result);
  }

  renderTemplate(result.start, result.end, template);
}
