/**
 * @module omb
 *
 * Object Model Builder (OMB)
 *
 * A small Web Components-driven parser that walks an element’s DOM subtree and
 * constructs a JS object model (“builder tree”) that mirrors the markup.
 *
 * Goals
 * 1) Preserve the physical tag details and raw strings under node[".tag"].
 * 2) Expose typed-ish attribute properties directly on each node using camelCase keys.
 * 3) Allow auto-typing for default attribute getters (numbers/booleans/null) while
 *    preserving raw attribute strings in node[".tag"].attrs.
 * 4) Support “child element as attribute” mode where leaf child elements like
 *    <test-boolean>yes</test-boolean> are treated as attributes on the parent,
 *    not structural children.
 *
 * Node JSON shape (conceptual)
 * {
 *   ".tag": {
 *     "tagName": "nested11",
 *     "tagToken": "nested11",
 *     "attrs": { "integer": "11", "text": "TestText11" }, // raw strings
 *     "content": [],                                       // raw PCDATA segments
 *     "value": "..."                                       // leaf/simple value, if any
 *   },
 *   ".children": [ ... ],
 *   "integer": 11,          // typed getter (default: auto-typed from raw string)
 *   "text": "TestText11"    // typed getter (default: string)
 * }
 *
 * Using in HTML
 * <script type="module">
 *   import { ObjectModelBuilderElement, OmbNode } from "./omb.js";
 *
 *   class MyElement extends ObjectModelBuilderElement {
 *     constructor() {
 *       super({
 *         // optional: custom global typing
 *         typedValue: (raw, tag) => raw.trim().toLowerCase() === "yes" ? true : raw,
 *       });
 *     }
 *   }
 *   customElements.define("my-element", MyElement);
 *
 *   const el = document.querySelector("my-element");
 *   el.addEventListener("omb:built", (e) => {
 *     console.log("model:", e.detail.model);
 *     console.log("json:", JSON.stringify(e.detail.model, null, 2));
 *   });
 * </script>
 */

/**
 * @typedef {Object} OmbTextContext
 * @property {ObjectModelBuilderElement} host
 * @property {Element} domParent
 * @property {OmbNode} modelParent
 * @property {boolean} isRootText
 */

/**
 * A node constructor used by OMB.
 * @typedef {new (tagName: string) => OmbNode} OmbNodeConstructor
 */

/**
 * @typedef {Object} ObjectModelBuilderElementOptions
 * @property {boolean=} ignoreWhitespaceText Defaults to true
 * @property {boolean=} ignoreComments Defaults to true
 * @property {(el: Element) => boolean=} ignoreElement If true, subtree is skipped
 *
 * Called when a new tag class is needed for a DOM element.
 * Return:
 * - false to let OMB generate a class for this tag (default)
 * - a constructor to use that class for this tag
 *
 * @property {(tagName: string, el: Element) => (false | OmbNodeConstructor)=} createElement
 *
 * Called by default attribute getters (unless overridden) to convert raw string
 * values from .tag.attrs[key] into a typed value (number/boolean/null/etc).
 * If not provided, defaultTypedValue() is used.
 *
 * @property {(value: string, tag: OmbTag) => any=} typedValue
 *
 * Decide whether a child element should be treated as an “attribute element” of
 * its parent rather than as a structural child node.
 *
 * If true:
 * - The child is NOT appended to parent[".children"]
 * - The child tag’s token becomes the parent attribute key
 * - The child’s simple value becomes the parent attribute value
 * - Raw is stored in parent[".tag"].attrs[key]
 * - Typed getter exists on parent[key]
 *
 * parents is an array of parent tags from root to the immediate parent (inclusive),
 * useful for context-aware decisions.
 *
 * @property {(childTag: OmbTag, parents: OmbTag[]) => boolean=} isChildElemAttr
 */

/**
 * Convert kebab-case (and namespace-ish names like xdm:include) to camelCase.
 * @param {string} input
 * @returns {string}
 */
export function toCamelCaseIdentifier(input) {
  const normalized = String(input).replace(/[:]/g, "-");
  const parts = normalized.split(/[^A-Za-z0-9]+/g).filter(Boolean);
  if (parts.length === 0) return "x";
  const [first, ...rest] = parts;
  return first.toLowerCase() +
    rest.map((p) => upperFirst(p.toLowerCase())).join("");
}

function upperFirst(s) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Return the tag text as it appears logically in markup:
 * - HTML documents: uses localName (lowercase), not tagName (often uppercase)
 * - Namespaced elements: prefix:localName if prefix exists
 * @param {Element} el
 * @returns {string}
 */
export function domTagText(el) {
  const prefix = el.prefix;
  const local = el.localName ?? el.tagName;
  return prefix ? `${prefix}:${local}` : local;
}

/**
 * Build add<Element>() name for a tag.
 * @param {string} tagName
 * @returns {string}
 */
export function addMethodName(tagName) {
  const token = toCamelCaseIdentifier(tagName);
  return "add" + upperFirst(token);
}

/**
 * Default auto-typing for attribute values.
 * Heuristics (in order):
 * - trimmed empty => "" (keep empty as raw)
 * - "null"/"nil"/"none"/"undefined" => null
 * - boolean-ish: true/false/yes/no/on/off/1/0 => boolean
 * - integer => number (only if safe integer)
 * - float/scientific => number
 * - otherwise => original string
 *
 * @param {string} raw
 * @param {OmbTag} tag
 * @returns {any}
 */
export function defaultTypedValue(raw, _tag) {
  const s = String(raw);
  const t = s.trim();

  if (t.length === 0) return s;

  const lower = t.toLowerCase();
  if (
    lower === "null" || lower === "nil" || lower === "none" ||
    lower === "undefined"
  ) return null;

  if (lower === "true" || lower === "yes" || lower === "on" || lower === "1") {
    return true;
  }
  if (lower === "false" || lower === "no" || lower === "off" || lower === "0") {
    return false;
  }

  if (/^[+-]?\d+$/.test(t)) {
    const n = Number(t);
    return Number.isSafeInteger(n) ? n : t;
  }

  if (/^[+-]?(?:\d+\.\d*|\d*\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }

  return s;
}

/**
 * Default rule for child-element-as-attribute:
 * returns true iff the element is “simple”:
 * - no attributes, and
 * - has some non-whitespace text content, and
 * - has no element children
 *
 * @param {OmbNode} childNode
 * @param {OmbTag[]} parents
 * @returns {boolean}
 */
export function defaultIsChildElemAttr(childNode, _parents) {
  const tag = childNode[".tag"];
  const hasAttrs = Object.keys(tag.attrs).length > 0;
  if (hasAttrs) return false;

  if (childNode[".children"].length > 0) return false;

  const v = tag.value;
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Tag metadata container placed at node[".tag"].
 * Holds ONLY raw physical info, raw attrs, raw content, and simple value.
 */
export class OmbTag {
  /**
   * @param {string} tagName
   */
  constructor(tagName) {
    /** @readonly */ this.tagName = tagName;
    /** @readonly */ this.tagToken = toCamelCaseIdentifier(tagName);

    /** @type {Record<string, string>} */
    this.attrs = Object.create(null);

    /** @type {string[]} */
    this.content = [];

    /**
     * Simple/leaf value if computed (from content).
     * Stored here (not on the node) per spec.
     * @type {string | undefined}
     */
    this.value = undefined;
  }

  /** @returns {any} */
  toJSON() {
    return {
      tagName: this.tagName,
      tagToken: this.tagToken,
      attrs: this.attrs,
      content: this.content,
      value: this.value,
    };
  }
}

/**
 * Model node shape:
 * - node[".tag"] has physical + raw strings
 * - node[".children"] has child nodes
 * - every key in node[".tag"].attrs is also available as a property on the node
 *   (same camelCase key). Default getter auto-types using host typedValue/defaultTypedValue.
 *   Subclasses can override properties for custom typing.
 */
export class OmbNode {
  /**
   * @param {string} tagName
   */
  constructor(tagName) {
    /** @type {OmbTag} */
    this[".tag"] = new OmbTag(tagName);

    /** @type {OmbNode[]} */
    this[".children"] = [];

    /** @type {ObjectModelBuilderElement | undefined} */
    this[".host"] = undefined;
  }

  /**
   * JSON shape:
   * - emits ".tag" and ".children" unless options.withTags === false
   * - emits every attribute key from ".tag.attrs" at the top-level using the node property
   * - emits any other enumerable keys (like per-tag navigation arrays), without overwriting
   * @param {{ withTags?: boolean }=} options
   * @returns {any}
   */
  toJSON(options = { withTags: true }) {
    const withTags = options?.withTags ?? true;

    /** @type {any} */
    const out = withTags
      ? {
        ".tag": this[".tag"].toJSON(),
        ".children": this[".children"].map((c) => c.toJSON(options)),
      }
      : {};

    for (const key of Object.keys(this[".tag"].attrs)) {
      out[key] = this[key];
    }

    for (const key of Object.keys(this)) {
      if (key === ".tag" || key === ".children" || key === ".host") continue;
      if (key in out) continue;
      out[key] = this[key];
    }

    return out;
  }
}

/**
 * Web Component that builds an object-model tree from its own DOM subtree.
 */
export class ObjectModelBuilderElement extends HTMLElement {
  /** @type {OmbNode | undefined} */
  model;

  /** @type {Required<Pick<ObjectModelBuilderElementOptions, "ignoreWhitespaceText"|"ignoreComments">> & Pick<ObjectModelBuilderElementOptions,"ignoreElement"|"createElement"|"typedValue"|"isChildElemAttr">} */
  options;

  /** @type {Map<string, OmbNodeConstructor>} */
  #tagClasses = new Map();

  /**
   * @param {ObjectModelBuilderElementOptions=} options
   */
  constructor(options = {}) {
    super();
    this.options = {
      ignoreWhitespaceText: options.ignoreWhitespaceText ?? true,
      ignoreComments: options.ignoreComments ?? true,
      ignoreElement: options.ignoreElement,
      createElement: options.createElement,
      typedValue: options.typedValue,
      isChildElemAttr: options.isChildElemAttr,
    };
  }

  /**
   * Optional hook: create the root model object.
   * @type {((host: Element) => OmbNode) | undefined}
   */
  createRoot;

  /**
   * Optional hook: receive PCDATA encountered directly under elements.
   * Default behavior stores to node[".tag"].content.
   * @type {((content: string, ctx: OmbTextContext) => void) | undefined}
   */
  collectContent;

  connectedCallback() {
    this.rebuild();
  }

  /**
   * Rebuild the model tree and store in this.model.
   * Dispatches "omb:built" with { model }.
   * @returns {OmbNode}
   */
  rebuild() {
    const root = this.createRoot?.(this) ?? this.#makeNodeForElement(this);

    this.#applyAttributesToNode(this, root);
    this.#walkChildNodes(this, root, true, [root[".tag"]]);
    this.#finalizeLeafValue(root);

    this.model = root;
    this.dispatchEvent(
      new CustomEvent("omb:built", { detail: { model: root } }),
    );
    return root;
  }

  /**
   * @param {Element} domParent
   * @param {OmbNode} modelParent
   * @param {boolean} isRoot
   * @param {OmbTag[]} parents
   */
  #walkChildNodes(domParent, modelParent, isRoot, parents) {
    const childNodes = Array.from(domParent.childNodes);

    for (const node of childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const raw = node.nodeValue ?? "";
        if (this.options.ignoreWhitespaceText && raw.trim().length === 0) {
          continue;
        }

        modelParent[".tag"].content.push(raw);

        this.collectContent?.(raw, {
          host: this,
          domParent,
          modelParent,
          isRootText: isRoot,
        });

        continue;
      }

      if (node.nodeType === Node.COMMENT_NODE) {
        if (this.options.ignoreComments) continue;
        continue;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = /** @type {Element} */ (node);
        if (this.options.ignoreElement?.(el)) continue;

        const childModel = this.#makeNodeForElement(el);
        this.#applyAttributesToNode(el, childModel);

        // walk its content first (so it can compute .tag.value for defaultIsChildElemAttr)
        this.#walkChildNodes(
          el,
          childModel,
          false,
          parents.concat(childModel[".tag"]),
        );
        this.#finalizeLeafValue(childModel);

        const childTag = childModel[".tag"];
        const isAttr = (this.options.isChildElemAttr ?? ((_t, ps) =>
          defaultIsChildElemAttr(childModel, ps)))(childTag, parents);

        if (isAttr) {
          // treat child as attribute on parent using childTag.tagToken
          const key = childTag.tagToken;
          const rawValue = childTag.value ?? "";

          modelParent[".tag"].attrs[key] = rawValue;
          this.#ensureAttrProperty(modelParent, key);

          // set via property to allow typed overrides on parent
          modelParent[key] = rawValue;
          continue;
        }

        // normal structural child
        this.#addExistingChildModel(modelParent, childModel);
      }
    }
  }

  /**
   * Add an already-built child model as a structural child and wire collections/methods.
   * @param {OmbNode} parentModel
   * @param {OmbNode} childModel
   */
  #addExistingChildModel(parentModel, childModel) {
    const tagName = childModel[".tag"].tagName;
    const methodName = addMethodName(tagName);

    /** @type {any} */ const anyParent = parentModel;
    /** @type {((element: Element) => OmbNode) | undefined} */ let adder =
      anyParent[methodName];

    if (typeof adder !== "function") {
      // define a method that would create nodes for that tag in the future
      adder = (element) => this.#makeNodeForElement(element);
      Object.defineProperty(anyParent, methodName, {
        value: adder,
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }

    parentModel[".children"].push(childModel);
    this.#attachToPerTagCollection(parentModel, childModel);
  }

  /**
   * @param {Element} el
   * @returns {OmbNode}
   */
  #makeNodeForElement(el) {
    const tagName = domTagText(el);
    const C = this.#getOrCreateTagClass(tagName, el);
    const node = new C(tagName);
    node[".host"] = this;
    return node;
  }

  /**
   * @param {string} tagName
   * @param {Element} el
   * @returns {OmbNodeConstructor}
   */
  #getOrCreateTagClass(tagName, el) {
    const existing = this.#tagClasses.get(tagName);
    if (existing) return existing;

    /** @type {OmbNodeConstructor | null} */
    let Ctor = null;

    if (typeof this.options.createElement === "function") {
      const result = this.options.createElement(tagName, el);
      if (result && typeof result === "function") {
        Ctor = result;
      }
    }

    if (!Ctor) {
      Ctor = class GeneratedTagNode extends OmbNode {};
    }

    this.#tagClasses.set(tagName, Ctor);
    return Ctor;
  }

  /**
   * Apply DOM attributes:
   * - raw values stored at node[".tag"].attrs[camelAttrName] (always string)
   * - ensures node[camelAttrName] exists as a property:
   *    - default getter returns auto-typed value via typedValue/defaultTypedValue
   *    - default setter stores String(v) to raw .tag.attrs
   *
   * @param {Element} el
   * @param {OmbNode} model
   */
  #applyAttributesToNode(el, model) {
    for (const attr of Array.from(el.attributes)) {
      const key = toCamelCaseIdentifier(attr.name);
      const rawValue = attr.value;

      model[".tag"].attrs[key] = rawValue;
      this.#ensureAttrProperty(model, key);

      model[key] = rawValue;
    }
  }

  /**
   * Default attribute property:
   * - getter: typedValue(raw, tag) if provided, else defaultTypedValue(raw, tag)
   * - setter: stores raw string to .tag.attrs
   * If a subclass defines the property on the prototype, we do NOT override it.
   *
   * @param {OmbNode} model
   * @param {string} key
   */
  #ensureAttrProperty(model, key) {
    if (key in model) return;

    Object.defineProperty(model, key, {
      enumerable: true,
      configurable: true,
      get() {
        const self = /** @type {OmbNode} */ (this);
        const raw = self[".tag"].attrs[key];
        const host = self[".host"];
        const fn = host?.options?.typedValue ?? defaultTypedValue;
        return fn(raw, self[".tag"]);
      },
      set(v) {
        const self = /** @type {OmbNode} */ (this);
        self[".tag"].attrs[key] = String(v);
      },
    });
  }

  /**
   * Attach child into a per-tag array on parent, keyed by child's tagToken.
   * Example: parent.nested11 = [ ... ].
   *
   * @param {OmbNode} parentModel
   * @param {OmbNode} childModel
   */
  #attachToPerTagCollection(parentModel, childModel) {
    const prop = childModel[".tag"].tagToken;
    /** @type {any} */ const anyParent = parentModel;

    if (!Array.isArray(anyParent[prop])) {
      Object.defineProperty(anyParent, prop, {
        value: [],
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    anyParent[prop].push(childModel);
  }

  /**
   * Compute leaf value into node[".tag"].value:
   * - if no element children and has text content, set tag.value
   *
   * @param {OmbNode} node
   */
  #finalizeLeafValue(node) {
    if (node[".children"].length !== 0) return;

    const joined = node[".tag"].content.join("").trim();
    if (joined.length === 0) return;

    node[".tag"].value = joined;
  }
}
