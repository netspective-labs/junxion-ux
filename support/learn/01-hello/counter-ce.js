/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
//
// Minimal <counter-ce> using CxAide convenience binds.

import { customElementAide } from "../../../lib/continuux/browser-ua-aide.js";

const tpl = document.createElement("template");
tpl.innerHTML = `
  <style>
    :host{display:block}
    .row{display:flex;gap:.75rem;flex-wrap:wrap;margin-top:.75rem}
    .count{font-size:2.2rem;margin:0}
    .muted{margin-top:1rem;color:var(--pico-muted-color)}
  </style>

  <p style="margin-bottom:.25rem;">Count</p>
  <p class="count"><strong id="count">0</strong></p>

  <div class="row">
    <button id="inc" type="button">Increment</button>
    <button id="reset" type="button" class="secondary">Reset</button>
  </div>

  <div id="status" class="muted"></div>
`;

export class CounterCe extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).append(tpl.content.cloneNode(true));
  }

  connectedCallback() {
    const cx = this.cxAide;
    if (!cx) return;

    cx.unbindLocal(); // in case of re-connect
    cx.bindText("count", "count", (d) => d?.value ?? 0);
    cx.bindText("status", "status", (d) => d?.text ?? "");
    cx.bindAction("inc", "increment");
    cx.bindAction("reset", "reset");

    cx.sseConnect();
  }

  disconnectedCallback() {
    this.cxAide?.sseDisconnect?.();
    this.cxAide?.unbindLocal?.();
  }
}

export const registerCounterCe = () =>
  customElementAide(CounterCe, "counter-ce").register();
