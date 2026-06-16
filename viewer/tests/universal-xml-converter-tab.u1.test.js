import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderUniversalXmlConverterTab } from '../tabs/universal-xml-converter-tab.js';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.File = dom.window.File;
global.Event = dom.window.Event;
global.HTMLAnchorElement = dom.window.HTMLAnchorElement;

function setup() {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.getElementById('root');
  const cleanup = renderUniversalXmlConverterTab(container);
  return { container, cleanup };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function textOf(container) {
  return container.textContent.replace(/\s+/g, ' ').trim();
}

function makeFile(name, text, type) {
  return new File([text], name, { type });
}

async function upload(container, file) {
  const input = container.querySelector('[data-uxml-file-input]');
  expect(input).toBeTruthy();

  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [file],
  });

  input.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
}

describe('Universal XML Converter tab shell smoke', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:uxml-summary');
    global.URL.revokeObjectURL = vi.fn();
    document.body.innerHTML = '';
  });

  it('renders the current CL1-oriented shell', () => {
    const { container } = setup();
    const text = textOf(container);

    expect(text).toContain('Universal XML Converter');
    expect(text).toContain('Route Handoff');
    expect(text).toContain('CL1 Route Package');
    expect(text).toContain('Masters by Target Route');
    expect(text).not.toContain('Masters deferred');
  });

  it('exposes the source type routes used by the shell', () => {
    const { container } = setup();
    const select = container.querySelector('[data-uxml-source-type]');

    expect(select).toBeTruthy();

    const values = Array.from(select.options).map((option) => option.value);
    expect(values).toContain('AUTO');
    expect(values).toContain('EXISTING_XML');
    expect(values).toContain('INPUT_XML');
    expect(values).toContain('UXML');
    expect(values).toContain('PCF');
    expect(values).toContain('PDF_TO_INPUTXML');
    expect(values).toContain('REV_TO_XML');
    expect(values).toContain('JSON_TO_XML');
    expect(values).toContain('TXT_TO_XML');
  });

  it('warns when Detect Profile is clicked before loading source text', () => {
    const { container } = setup();
    const button = container.querySelector('[data-uxml-action="detect-profile"]');

    expect(button).toBeTruthy();
    button.click();

    expect(textOf(container)).toContain('Load a source file before detecting profile.');
  });

  it('loads XML source text and shows detected profile', async () => {
    const { container } = setup();
    await upload(container, makeFile('sample.xml', '<Project><Component /></Project>', 'application/xml'));

    const text = textOf(container);
    expect(text).toContain('Loaded sample.xml');
    expect(text).toContain('Detected source type: EXISTING_XML');
  });

  it('keeps the existing converter action disabled', () => {
    const { container } = setup();
    const button = container.querySelector('[data-uxml-action="run-existing-converter"]');

    expect(button).toBeTruthy();
    expect(button.disabled).toBe(true);
  });

  it('exports summary JSON by creating one download link', async () => {
    const { container } = setup();
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await upload(container, makeFile('sample.pcf', 'PIPELINE-REFERENCE X\\nPIPE\\n    END-POINT 0 0 0 250', 'text/plain'));

    const button = container.querySelector('[data-uxml-action="export-summary"]');
    expect(button).toBeTruthy();

    button.click();

    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalled();
    expect(textOf(container)).toContain('Universal XML Converter summary exported.');
  });
});
