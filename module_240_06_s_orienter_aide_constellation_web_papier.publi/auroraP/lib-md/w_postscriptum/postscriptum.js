/*!
 * @postscriptum.app/core 0.11.5-beta (February 22nd 2022)
 * 
 * 
 * Includes:
 *  - Postcss: http://postcss.org/ (MIT License)
 *  - Hypher: https://github.com/bramstein/hypher (BSD license)
 *  
 * Copyright © 2015 David Rivron
 * Released under the MIT license (https://opensource.org/licenses/mit-license.php))
 */
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.postscriptum = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unbreakableElement = exports.breakTable = exports.unbreak = exports.writeCounters = exports.breakAtPoint = void 0;
const util_1 = require("./util");
const counters = require("./counters");
const css_1 = require("./css");
const REPLACED_ELEMENTS = ['img', 'object', 'video', 'audio', 'canvas', 'iframe', 'textarea', 'input', 'button'];
function breakAtPoint(source, breakPoint, side = 'after') {
    const textBreak = breakPoint.container.nodeType == Node.TEXT_NODE;
    const breaking = textBreak ? breakPoint.container.parentElement : breakPoint.container;
    const breakingOnSource = breaking == source;
    // An attribute is set to find the breaking element after the extraction of contents
    breaking.setAttribute('ps-breaking', '');
    const prevCounters = counters.parseCounters(source, breakPoint);
    const contentsRange = source.ownerDocument.createRange();
    if (side == "before") {
        contentsRange.setStartBefore(source);
        contentsRange.setEnd(breakPoint.container, breakPoint.offset);
    }
    else {
        contentsRange.setStart(breakPoint.container, breakPoint.offset);
        contentsRange.setEndAfter(source);
    }
    const contents = contentsRange.extractContents();
    const dest = contents.firstElementChild;
    let sourceBreaking = breakingOnSource ? source : source.querySelector('[' + 'ps-breaking' + ']');
    let destBreaking = breakingOnSource ? dest : dest.querySelector('[' + 'ps-breaking' + ']');
    sourceBreaking.removeAttribute('ps-breaking');
    destBreaking.removeAttribute('ps-breaking');
    let firstAncestorBox = false;
    while (destBreaking != dest.parentElement) {
        let beforeElt, afterElt;
        if (side == "after") {
            beforeElt = sourceBreaking;
            afterElt = destBreaking;
        }
        else {
            beforeElt = destBreaking;
            afterElt = sourceBreaking;
        }
        beforeElt.setAttribute('ps-breaked-after', '');
        afterElt.setAttribute('ps-breaked-before', '');
        if (prevCounters)
            writeCounters(prevCounters, beforeElt, afterElt);
        if (destBreaking.localName == "ol")
            breakOrderedList(beforeElt, afterElt);
        else if (destBreaking.localName == "table")
            breakTable(beforeElt, afterElt);
        if (textBreak) {
            const textNode = breakPoint.container;
            /* Force an hyphen if the break is on one */
            // TODO check that the 'hyphens' property != none
            if (textNode.nodeValue.endsWith('\u00AD')) {
                const style = getComputedStyle(textNode.parentElement);
                if (style.getPropertyValue('--ps-hyphens').trim() == "auto") {
                    const hyphenChar = style.getPropertyValue("-webkit-hyphenate-character")[1] || '\u2010';
                    textNode.nodeValue = textNode.nodeValue.slice(0, -1) + hyphenChar;
                    textNode.parentElement.setAttribute('ps-hyphen-last', '');
                }
            }
            if (!firstAncestorBox && util_1.walk.displayAsBlock(beforeElt)) {
                beforeElt.style.textAlignLast = beforeElt.style.MozTextAlignLast = getComputedStyle(beforeElt).textAlign;
                firstAncestorBox = true;
            }
        }
        sourceBreaking = sourceBreaking.parentElement;
        destBreaking = destBreaking.parentElement;
    }
    return dest;
}
exports.breakAtPoint = breakAtPoint;
function writeCounters(counters, prevElt, nextElt) {
    let counterReset = '';
    for (const counterName in counters) {
        const counterScopes = counters[counterName];
        for (let i = counterScopes.length - 1; i >= 0; i--) {
            const counterScope = counterScopes[i];
            if (prevElt.parentNode == counterScope.element.parentNode || nextElt.parentNode == counterScope.element.parentNode) {
                counterReset += ' ' + counterName + ' ' + counterScope.value;
                counterScopes.splice(i, 1);
                break;
            }
        }
    }
    if (counterReset) {
        nextElt.setAttribute('ps-counters', '');
        nextElt.style.counterReset = counterReset;
    }
}
exports.writeCounters = writeCounters;
// TODO removeBreakedAttr: keep track of the breaked element before / after in a symbol instead?
function unbreak(before, after, position = 'before') {
    before.removeAttribute('ps-breaked-after');
    after.removeAttribute('ps-breaked-before');
    if (before.localName == "table")
        unbreakTable(before, after);
    else if (before.localName == "ol")
        unbreakOrderedList(before, after);
    if (before.style.textAlignLast)
        before.style.textAlignLast = before.style.MozTextAlignLast = '';
    if (after.hasAttribute('ps-counters')) {
        after.style.counterReset = '';
        after.removeAttribute('ps-counters');
    }
    let childBefore, childAfter;
    if (util_1.walk.isHTMLElement(before.lastChild) && before.lastChild.hasAttribute('ps-breaked-after')) {
        childBefore = before.lastChild;
        childAfter = after.firstChild;
    }
    // Maybe a text break
    if (!childBefore) {
        if (before.hasAttribute('ps-hyphen-last'))
            before.lastChild.nodeValue = before.lastChild.nodeValue.slice(0, -1) + '\u00AD';
    }
    if (position == 'before') {
        if (after.hasAttribute('ps-breaked-after'))
            before.setAttribute('ps-breaked-after', '');
        //for (const attr of after.attributes) if (attr.name != 'style') before.setAttribute(attr.name, attr.value);
        while (after.firstChild)
            before.appendChild(after.firstChild);
        after.remove();
        before.normalize();
    }
    else {
        // Copy of the attributes of the before when the unbreak lands on the after
        if (before.hasAttribute('ps-breaked-before'))
            after.setAttribute('ps-breaked-before', '');
        if (before.hasAttribute('ps-counters')) {
            after.setAttribute('ps-counters', '');
            after.style.counterReset = before.style.counterReset;
        }
        if (before.hasAttribute('start'))
            after.setAttribute('start', before.getAttribute('start'));
        // TODO Should we copy all the attributes ?
        // for (const attr of before.attributes) if (attr.name != 'style') after.setAttribute(attr.name, attr.value);
        while (before.lastChild)
            after.insertBefore(before.lastChild, after.firstChild);
        before.remove();
        after.normalize();
    }
    if (childBefore && childAfter)
        unbreak(childBefore, childAfter, position);
}
exports.unbreak = unbreak;
function breakOrderedList(before, after) {
    const listItems = Array.prototype.filter.call(before.children, (child) => {
        return getComputedStyle(child).display == 'list-item';
    });
    let beforeStart = before.hasAttribute('start') ? parseInt(before.getAttribute('start')) : 1;
    // Substract one if the first child is breaked
    if (after.firstElementChild && after.firstElementChild.hasAttribute('ps-breaked-before'))
        beforeStart--;
    after.setAttribute('start', beforeStart + listItems.length);
}
// The width of the cells when the table is breaking between two containers of differents size is handled by the horizontalSubFragmentor
function breakTable(before, after) {
    const colgroup = before.getElementsByTagName('colgroup').item(0);
    if (colgroup)
        after.insertBefore(colgroup.cloneNode(true), after.firstChild);
    const customStyle = css_1.getCustomStyle(before);
    if (!after.tHead && before.tHead && css_1.getCustomProp(customStyle, 'repeat-thead') != 'no-repeat') {
        after.tHead = before.tHead.cloneNode(true);
        after.tHead.setAttribute('ps-repeated', '');
    }
    /* It is not possible to repeat a footer or the bottom caption:  the elements must be known before a page break can occur. */
}
exports.breakTable = breakTable;
function unbreakOrderedList(before, after) {
    after.removeAttribute('start');
}
function unbreakTable(before, after) {
    const afterColgroups = after.querySelectorAll('colgroup');
    for (let i = 1; i < afterColgroups.length; i++)
        afterColgroups[i].remove();
}
// Only the intrinsic dimension specified in the element's style is taken into account.
function unbreakableElement(element) {
    if (element instanceof SVGElement)
        return 'replacedElement';
    const style = getComputedStyle(element);
    if (style.float != 'none')
        return 'float';
    if (element.style.height || element.style.minHeight)
        return 'intrisicDimension';
    if (REPLACED_ELEMENTS.includes(element.localName) && util_1.walk.displayAsBlock(element))
        return 'replacedElement';
}
exports.unbreakableElement = unbreakableElement;

},{"./counters":3,"./css":4,"./util":19}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.columnsSubProcessor = exports.createColumn = exports.Columnizator = exports.ColumnSpan = exports.Column = void 0;
const layout_1 = require("./layout");
const util_1 = require("./util");
const util_2 = require("./util");
const util_3 = require("./util");
const fragments_1 = require("./fragments");
const breaks_1 = require("./breaks");
const css_1 = require("./css");
const flow_1 = require("./flow");
class Column extends fragments_1.Fragment {
}
exports.Column = Column;
class ColumnSpan extends fragments_1.Fragment {
}
exports.ColumnSpan = ColumnSpan;
class ColumnsGroup {
    constructor() {
        this.sequences = [];
        this.columnParent = null;
        this.span = null;
        this.columnsMut = null;
        this.spanMut = null;
    }
}
class ColumnsLayoutContext extends layout_1.LayoutContext {
    constructor(source, root, areas, parentCtx) {
        super(root, root, areas, parentCtx);
        this.maxHeightChanged = false;
        if (parentCtx)
            parentCtx.on('body-bottom-change', ({ newBottom }) => {
                this.maxHeightChanged = true;
            });
    }
}
class Columnizator extends fragments_1.Fragmentor {
    constructor(source, options) {
        super(source, options);
        this.avoidBreakTypes = ['avoid', 'avoid-column'];
        this.forcedBreakTypes = ['always', 'column', '-ps-column-span'];
        this.columnizationMut = new util_2.Mutations();
        this.breakPoint = null;
        this.logNoValidBreakPoint = false;
        this.addSubProcessor(exports.columnsSubProcessor);
        this._process = this.columnizationProcess();
    }
    /** Returns the max height defined on the element style or Infinity */
    columnsMaxHeight(top) {
        if (!this._maxBottom) {
            const style = getComputedStyle(this.source);
            let maxHeight = css_1.computeMinOrMaxLength(style.maxHeight, this.source.parentElement.clientHeight, Infinity);
            if (isNaN(maxHeight))
                maxHeight = Infinity;
            if (maxHeight == Infinity)
                this._maxBottom = Infinity;
            else {
                const sourceTop = this.source.getBoundingClientRect().top;
                this._maxBottom = sourceTop + maxHeight;
            }
        }
        // -0.001 to avoid some rounding error on Firefox (87)
        return this._maxBottom - top - 0.001;
    }
    *columnizationProcess() {
        // Does a column count exist?
        const customStyle = css_1.getCustomStyle(this.source);
        this.columnCount = this.options.columnCount || parseColumnCount(this.source, customStyle);
        if (!this.columnCount)
            throw new Error("No columns count defined on the source element.");
        // Start of the column processes
        this.columnizationMut.setAttr(this.source, 'ps-process', 'pending');
        if (this.listenerCount('start'))
            yield 'start';
        if (this.listenerCount('columnization-start'))
            yield 'columnization-start';
        this.columnizationMut.setAttr(this.source, 'ps-columns', '');
        // Move of all the contents in an hidden body
        this.sourceBody = document.createElement('ps-column-body');
        util_1.ranges.appendNodeContents(this.source, this.sourceBody);
        this.sourceBody.style.display = 'none';
        this.source.appendChild(this.sourceBody);
        this.columnizationMut.push({
            source: this.source,
            sourceBody: this.sourceBody,
            revert() {
                util_1.ranges.appendNodeContents(this.sourceBody, this.source);
                this.sourceBody.remove();
            }
        });
        // Columns properties
        this.fillProp = css_1.getCustomProp(customStyle, 'column-fill');
        let gapProp = css_1.getCustomProp(customStyle, 'column-gap');
        if (gapProp == 'normal')
            gapProp = '1em';
        this.columnizationMut.setStyle(this.source, { '--ps-gap': gapProp });
        let ruleProp = css_1.getCustomProp(customStyle, 'column-rule');
        if (!ruleProp) {
            const ruleStyle = css_1.getCustomProp(customStyle, 'column-rule-style') || 'none';
            const ruleWidth = css_1.getCustomProp(customStyle, 'column-rule-width') || 'medium';
            const ruleColor = css_1.getCustomProp(customStyle, 'column-rule-color') || getComputedStyle(this.source).color;
            ruleProp = ruleStyle + ' ' + ruleWidth + ' ' + ruleColor;
        }
        // The rule is created if the style is not "none"
        if (!ruleProp.match(/(^|\s)none($|\s)?/))
            this.columnizationMut.setStyle(this.source, { '--ps-rule': ruleProp });
        // Iterate and extract over the group (pair columns + span)
        const flowIterator = new flow_1.FlowIterator(this.sourceBody, this.forcedBreakTypes);
        flowIterator.columnSpanBreak = css_1.getCustomProp(customStyle, 'column-span-break');
        this.isLastGroup = false;
        let flow = flowIterator.next();
        const groups = [];
        let group;
        let maxSequencesReached;
        do {
            group = new ColumnsGroup();
            groups.push(group);
            maxSequencesReached = false;
            do {
                const sequenceMut = new util_2.Mutations();
                const sequence = sequenceMut.breaks(this.sourceBody, {
                    container: flow.range.endContainer,
                    offset: flow.range.endOffset
                }, 'before');
                sequence.setAttribute('ps-column-sequence', '');
                sequence.style.display = '';
                // The span should have an unique element (on box or element break)
                if (flow.breakType == '-ps-column-span') {
                    if (group.span) {
                        breaks_1.unbreak(group.span, sequence, 'before');
                    }
                    else {
                        group.spanMut = new util_2.Mutations();
                        sequenceMut.commit(group.spanMut);
                        group.span = sequence;
                    }
                }
                else {
                    group.columnsMut = new util_2.Mutations();
                    sequenceMut.commit(group.columnsMut);
                    group.sequences.push(sequence);
                }
                this.isLastGroup = flowIterator.remaining.collapsed;
                flow = flowIterator.next();
                // The iteration is stopped if they are more sequences than columns (+1 to include a possible span)
                maxSequencesReached = group.sequences.length >= this.columnCount + 1;
            } while (flow && !maxSequencesReached && (!group.span || flow.breakType == '-ps-column-span'));
            // Process the column group
            // this.breakPoint == false means that no valid break point is found on the last columns or last span.
            yield* this.columnsGroupProcess(group);
        } while (!this.isLastGroup && this.breakPoint === null && !maxSequencesReached);
        let remainingBody;
        const boxes = groups.flatMap((group) => {
            const b = [];
            if (group.columnParent)
                b.push({ element: group.columnParent, mutations: group.columnsMut });
            if (group.span && group.span.isConnected)
                b.push({ element: group.span, mutations: group.spanMut });
            return b;
        });
        // Put back the remaining span and sequences in the source body
        if (group.span && !group.span.isConnected)
            breaks_1.unbreak(group.span, this.sourceBody, 'after');
        for (let i = group.sequences.length - 1; i >= 0; i--) {
            if (!group.sequences[i].isConnected)
                breaks_1.unbreak(group.sequences[i], this.sourceBody, 'after');
        }
        if (this.breakPoint) {
            for (let i = boxes.length - 1; i >= 0; i--)
                boxes[i].mutations.commit(this.columnizationMut);
            remainingBody = breaks_1.breakAtPoint(this.currentFragment.body, this.breakPoint);
            this.breakPoint = util_1.ranges.positionBefore(this.sourceBody);
            breaks_1.unbreak(remainingBody, this.sourceBody, 'before');
            this.columnizationMut.push({
                remainingBody,
                fragmentBody: this.currentFragment.body,
                revert() {
                    breaks_1.unbreak(this.fragmentBody, this.remainingBody, 'before');
                }
            });
        }
        else {
            let lastBoxIdx = boxes.length - 1;
            if (this.breakPoint === false)
                boxes[lastBoxIdx--].mutations.revert();
            let validBoxIdx = -1;
            for (let i = lastBoxIdx; i >= 0; i--) {
                const box = boxes[i];
                if (box.element.getAttribute('ps-break-after') !== 'avoid') {
                    validBoxIdx = i;
                    break;
                }
                else {
                    box.mutations.revert();
                }
            }
            if (validBoxIdx == -1) {
                this.breakPoint = false;
            }
            else {
                for (let i = 0; i <= validBoxIdx; i++)
                    boxes[i].mutations.commit(this.columnizationMut);
                this.breakPoint = this.sourceBody.firstChild ? util_1.ranges.positionBefore(this.sourceBody) : null;
            }
            remainingBody = this.sourceBody;
            remainingBody.remove();
        }
        this.columnizationMut.appendNodeContents(remainingBody, this.source);
        this.columnizationMut.setAttr(this.source, 'ps-process', 'ended');
        if (this.listenerCount('columnization-end'))
            yield 'columnization-end';
        if (this.listenerCount('end'))
            yield 'end';
    }
    /**
     * A the end of this process, the remaining bodies are replaced in the source body
     * @param group
     */
    *columnsGroupProcess(group) {
        if (group.sequences.length) {
            const columns = [];
            // Creation of the columns parent element
            const columnsParent = group.columnParent = this.doc.createElement('ps-columns');
            group.columnsMut.setAttr(columnsParent, 'ps-process', 'pending');
            this.source.insertBefore(columnsParent, this.sourceBody);
            // Creation of the column elements
            for (let i = 0; i < this.columnCount; i++) {
                const column = createColumn(this.doc, i + 1);
                if (i != 0) {
                    const columnGap = document.createElement('ps-column-gap');
                    if (this.source.style.getPropertyValue('--ps-rule'))
                        columnGap.appendChild(document.createElement('ps-column-rule'));
                    columnsParent.appendChild(columnGap);
                }
                columnsParent.appendChild(column.container);
                fragments_1.createAreas(column, css_1.getCustomProp(this.source, 'areas'));
                columns.push(column);
                this.fragments.push(column);
            }
            group.columnsMut.push({
                columnsParent,
                revert() {
                    columnsParent.remove();
                }
            });
            const sourceStyle = getComputedStyle(this.source);
            const lineHeightProp = sourceStyle.lineHeight;
            const lineHeight = lineHeightProp == 'normal' ? parseInt(sourceStyle.fontSize) * 1.15 : parseInt(lineHeightProp);
            let spanFirstPass = group.span != null;
            let recolumnize = false;
            const top = util_1.rects.boundingScrollRect(columnsParent).top;
            let height = this.columnsMaxHeight(top);
            const columnsContentMut = new util_2.Mutations();
            do {
                const firstColumn = columns[0];
                let toBalance = spanFirstPass || this.isLastGroup && (height == Infinity || this.fillProp != 'auto');
                if (toBalance && !recolumnize) {
                    let balancedHeight = lineHeight;
                    for (let i = group.sequences.length - 1; i >= 0; i--) {
                        const columnBody = group.sequences[i];
                        firstColumn.body = firstColumn.container.insertBefore(columnBody, firstColumn.container.firstChild);
                        const columnMinHeight = columnBody.scrollHeight / (this.columnCount - group.sequences.length + 1);
                        if (columnMinHeight > balancedHeight)
                            balancedHeight = columnMinHeight;
                        if (i != 0)
                            columnBody.remove();
                    }
                    if (balancedHeight < height)
                        height = balancedHeight;
                    else
                        toBalance = false;
                }
                else {
                    firstColumn.body = firstColumn.container.insertBefore(group.sequences[0], firstColumn.container.firstChild);
                }
                group.columnsMut.push({
                    firstColumn,
                    revert() {
                        this.firstColumn.body.remove();
                    }
                });
                columnsContentMut.push({
                    columns,
                    group,
                    revert() {
                        for (let i = this.columns.length - 1; i > 0; i--) {
                            const column = columns[i];
                            if (column.body) {
                                if (i > 0 && this.group.sequences.includes(column.body)) {
                                    // The column is a sequence start, presents in group.sequences
                                    column.body.remove();
                                }
                                else {
                                    breaks_1.unbreak(columns[i - 1].body, column.body);
                                }
                                column.body = null;
                            }
                        }
                    }
                });
                // At this point, the content of the first sequence is in the first column
                recolumnize = false;
                let stop = false;
                group.columnsMut.setStyle(columnsParent, { 'height': height + 'px' });
                let currentSequence = 0;
                let currentColumn = 0;
                let column = columns[currentColumn];
                do {
                    this.currentFragment = column;
                    this.breakPoint = null;
                    util_1.logger.addScope(`column ${column.number}`);
                    this.onFragmentStart(column, false);
                    const columnAreas = Object.assign({}, this.options.parentAreas, column.areas);
                    const contentsEvent = yield* this.contentsProcess(column.body, columnAreas, layout_1.isSubFragmentor(this) && this.parentFragmentor.layoutContext);
                    const newMaxHeight = this.columnsMaxHeight(top);
                    if (this.layoutContext.maxHeightChanged && height > newMaxHeight) {
                        // New max height
                        height = newMaxHeight;
                        toBalance = false;
                        recolumnize = true;
                        util_1.logger.removeScope();
                        break;
                    }
                    else if (toBalance) {
                        let increaseHeight = contentsEvent == 'no-break-point';
                        if (!increaseHeight) {
                            const lastColumnBody = columns[columns.length - 1].body;
                            increaseHeight = contentsEvent == "valid-break-point" && lastColumnBody && lastColumnBody.scrollHeight >= lastColumnBody.clientHeight;
                        }
                        if (increaseHeight) {
                            if (height + lineHeight < newMaxHeight) {
                                height += lineHeight;
                                recolumnize = true;
                                util_1.logger.removeScope();
                                break;
                            }
                        }
                        if (contentsEvent == "valid-break-point")
                            this.breakPoint = this.layoutContext.breakPoint;
                    }
                    else {
                        if (contentsEvent == 'no-break-point') {
                            this.layoutContext.mutations.revert();
                            this.fragmentStartMut.revert();
                            columnsContentMut.revert();
                            this.breakPoint = false;
                            util_1.logger.removeScope();
                            break;
                        }
                        else if (contentsEvent == 'valid-break-point') {
                            this.breakPoint = this.layoutContext.breakPoint;
                        }
                    }
                    util_1.logger.removeScope();
                    currentColumn++;
                    // All the column have contents
                    if (currentColumn == columns.length) {
                        stop = true;
                    }
                    else {
                        if (this.breakPoint) {
                            // Not breaked in a mutation, the revert is handled by columnsContentMut
                            const remainingBody = breaks_1.breakAtPoint(column.body, this.breakPoint);
                            this.onFragmentBreak(column);
                            column = columns[currentColumn];
                            column.body = column.container.insertBefore(remainingBody, column.container.firstChild);
                            this.breakPoint = null;
                        }
                        else {
                            currentSequence++;
                            if (currentSequence < group.sequences.length) {
                                column = columns[currentColumn];
                                column.body = column.container.insertBefore(group.sequences[currentSequence], column.container.firstChild);
                            }
                            else {
                                // Forced height is changed to max-height to fit the content while avoiding overflow on the page
                                columnsParent.style.height = '';
                                group.columnsMut.setStyle(columnsParent, { 'max-height': height + 'px' });
                                stop = true;
                            }
                        }
                    }
                } while (!stop);
                if (!recolumnize && spanFirstPass && this.breakPoint === null) {
                    this.fragmentStartMut.commit(columnsContentMut);
                    this.layoutContext.mutations.commit(columnsContentMut);
                    columnsContentMut.commit(group.columnsMut);
                    group.columnsMut.setAttr(columnsParent, 'ps-process', 'ended');
                    const contentsEvent = yield* this.columnSpanProcess(group);
                    if (contentsEvent == 'no-break-point') {
                        // TODO récupérer la liste des floats
                        this.layoutContext.mutations.revert();
                        this.fragmentStartMut.revert();
                        this.breakPoint = false;
                    }
                    else if (contentsEvent == 'valid-break-point') {
                        this.fragmentStartMut.commit(columnsContentMut);
                        this.layoutContext.mutations.commit(group.spanMut);
                        this.breakPoint = this.layoutContext.breakPoint;
                    }
                    spanFirstPass = false;
                }
                else if (recolumnize) {
                    // The content of the columns are merged in the first column
                    this.layoutContext.mutations.revert();
                    this.fragmentStartMut.revert();
                    columnsContentMut.revert();
                    this.breakPoint = null;
                }
                else if (this.breakPoint !== false) {
                    this.fragmentStartMut.commit(columnsContentMut);
                    this.layoutContext.mutations.commit(columnsContentMut);
                }
            } while (recolumnize);
            // TODO Duplicated code when the group has a span
            columnsContentMut.commit(group.columnsMut);
            group.columnsMut.setAttr(columnsParent, 'ps-process', 'ended');
            //if (!this.breakPoint) columnsParent.style.height = '';
        }
        else {
            const contentsEvent = yield* this.columnSpanProcess(group);
            if (contentsEvent == 'no-break-point') {
                this.layoutContext.mutations.revert();
                this.breakPoint = false;
            }
            else if (contentsEvent == 'valid-break-point') {
                this.layoutContext.mutations.commit(group.spanMut);
                this.breakPoint = this.layoutContext.breakPoint;
            }
        }
    }
    *columnSpanProcess(group) {
        util_1.logger.addScope(`column-span`);
        const spanFragment = this.currentFragment = new ColumnSpan();
        spanFragment.body = group.span;
        this.source.insertBefore(spanFragment.body, this.sourceBody);
        const top = util_1.rects.boundingScrollRect(spanFragment.body).top;
        spanFragment.body.style.height = this.columnsMaxHeight(top) + 'px';
        const contentsEvent = yield* this.contentsProcess(spanFragment.body, this.options.parentAreas, layout_1.isSubFragmentor(this) && this.parentFragmentor.layoutContext);
        spanFragment.body.style.height = '';
        // TODO More robust and generic way to support page break rules inside columns
        if (this.parentAvoidBreakTypes) {
            let lastChild = spanFragment.body;
            do {
                if (!util_3.walk.isElement(lastChild))
                    break;
                if (this.parentAvoidBreakTypes.includes(css_1.getCustomProp(lastChild, 'break-after'))) {
                    group.spanMut.setAttr(spanFragment.body, 'ps-break-after', 'avoid');
                    break;
                }
                lastChild = util_3.walk.lastChild(lastChild, util_3.walk.isStaticNode);
            } while (lastChild && util_3.walk.isElement(lastChild));
        }
        util_1.logger.removeScope();
        return contentsEvent;
    }
    createLayoutContext(root, areas, parentCtx) {
        return new ColumnsLayoutContext(this.source, root, areas, parentCtx);
    }
}
exports.Columnizator = Columnizator;
Columnizator.defaultOptions = Object.assign({
    parentAreas: {},
    parentLayoutContext: null,
}, fragments_1.Fragmentor.defaultOptions);
function createColumn(doc, number) {
    const column = new Column;
    column.container = doc.createElement('ps-column');
    column.number = number;
    return column;
}
exports.createColumn = createColumn;
const columnsSubProcessor = function (ctx) {
    // TODO check that the source is not the same as the pagination (conflict on the ps-process attribute)
    const columnCount = parseColumnCount(ctx.currentElement, ctx.currentCustomStyle);
    if (!columnCount)
        return false;
    class SubColumnizator extends Columnizator {
        constructor(parentFragmentor, source, options) {
            super(source, options);
            this.parentFragmentor = parentFragmentor;
            this.gcpmContext = parentFragmentor.gcpmContext;
        }
        /*** Returns the max height constrained by the parent fragment and the element style */
        columnsMaxHeight(top) {
            const bottomOffset = this.parentFragmentor.layoutContext.bottomOffsets.get(this.source).after;
            let fragmentMaxHeight = this.parentFragmentor.layoutContext.bodyBottom - bottomOffset - top;
            if (ctx.currentStyle.boxSizing == 'content-box')
                fragmentMaxHeight = util_1.rects.contentSizingHeight(ctx.currentStyle, fragmentMaxHeight);
            return Math.min(super.columnsMaxHeight(top), fragmentMaxHeight);
        }
        emit(event, target) {
            super.emit(event, target);
            const eventObj = (typeof event == 'string' ? { type: event } : event);
            if (eventObj.type != 'start' && eventObj.type != 'end')
                this.parentFragmentor.emit(event);
        }
    }
    const columnizator = new SubColumnizator(this, ctx.currentElement, Object.assign(Object.create(fragments_1.Fragmentor.defaultOptions), {
        parentAreas: ctx.areas,
        columnCount
    }));
    columnizator.parentAvoidBreakTypes = this.avoidBreakTypes;
    return columnizator.start().ended.then(() => {
        columnizator.columnizationMut.commit(this.layoutContext.mutations);
        if (columnizator.breakPoint)
            return { breakPoint: columnizator.breakPoint };
        else if (columnizator.breakPoint === false)
            return false;
        else
            return;
    });
};
exports.columnsSubProcessor = columnsSubProcessor;
function parseColumnCount(element, customStyle) {
    let count = 0;
    const countProp = css_1.getCustomProp(customStyle, 'column-count');
    if (countProp != "auto")
        count = parseInt(countProp);
    else {
        const widthProp = css_1.getCustomProp(customStyle, 'column-width');
        const elemWidth = element.clientWidth;
        if (widthProp != 'auto') {
            const width = css_1.computeLength(widthProp, elemWidth);
            let gapProp = css_1.getCustomProp(customStyle, 'column-gap');
            if (gapProp == 'normal')
                gapProp = '1em';
            const gap = css_1.computeLength(gapProp, elemWidth);
            count = Math.floor(elemWidth / width);
            if (count > 1)
                while (count > 1 && count * width + (gap * (count - 1)) > elemWidth)
                    count--;
        }
    }
    if (isNaN(count) || count == 1)
        return 0;
    return count;
}

},{"./breaks":1,"./css":4,"./flow":7,"./fragments":8,"./layout":12,"./util":19}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addElementCounters = exports.resetFromCounters = exports.parseCounters = exports.getPageCounterValue = exports.getCounterValue = exports.parseCounterValue = void 0;
const util_1 = require("./util");
const util_2 = require("./util");
const valueParser = require("postcss-value-parser");
function parseCounterValue(value) {
    const counters = {};
    if (value == 'none')
        return counters;
    const vals = valueParser(value);
    const words = vals.nodes.filter((node) => node.type == 'word');
    for (let i = 0; i < words.length; i++) {
        const name = words[i].value;
        const value = parseInt(words[i + 1].value);
        i++;
        counters[name] = value;
    }
    return counters;
}
exports.parseCounterValue = parseCounterValue;
// TODO Possible problem if a counter-reset or counter-increment exists on the documentElement
function getCounterValue(element, counterName) {
    const doc = element.ownerDocument;
    const elements = util_1.walk.createWalker(doc.documentElement, util_1.walk.isElement);
    let counterValue = 0;
    elements.currentNode = element;
    while (elements.currentNode != doc.documentElement) {
        let counterReseted = false;
        const style = getComputedStyle(elements.currentNode);
        if (style.display != 'none') {
            const resets = parseCounterValue(style.counterReset);
            if (counterName in resets) {
                counterValue += resets[counterName];
                counterReseted = true;
            }
            const increments = parseCounterValue(style.counterIncrement);
            if (counterName in increments)
                counterValue += increments[counterName];
            if (counterReseted)
                return counterValue;
        }
        elements.previousNode();
    }
    util_2.logger.warn(`Counter '${counterName}' without a counter-reset.`);
    return counterValue;
}
exports.getCounterValue = getCounterValue;
function getPageCounterValue(pages, element) {
    let pageBox = element;
    while (pageBox && pageBox.localName != 'ps-page')
        pageBox = pageBox.parentElement;
    for (let i = 0; i < pages.length; i++) {
        if (pageBox == pages[i].container)
            return i + 1;
    }
    throw "Page not found";
}
exports.getPageCounterValue = getPageCounterValue;
// TODO When a counter-increment of a counter without scope is set on a pseudo, the counter-reset scope does not include the brothers
function parseCounters(root, stop) {
    const counters = {};
    const stopNode = util_1.ranges.nodeAtPoint(stop);
    const docElem = root.ownerDocument.documentElement;
    // Lookup the start node
    let start = root;
    while (start != docElem && !start.hasAttribute('ps-counters'))
        start = start.parentElement;
    const elements = util_1.walk.createWalker(start, util_1.walk.isElement);
    do {
        if (elements.currentNode == stopNode || elements.currentNode.compareDocumentPosition(stopNode || stop.container) & Node.DOCUMENT_POSITION_PRECEDING)
            break;
        addElementCounters(elements.currentNode, counters, elements.currentNode == root);
        if (!elements.firstChild()) {
            while (!elements.nextSibling() && elements.currentNode != start) {
                if (!elements.currentNode.hasAttribute('ps-breaked-after')) {
                    for (const counterName in counters) {
                        const counter = counters[counterName];
                        if (counter.length && counter[counter.length - 1].element.parentNode == elements.currentNode.parentNode) {
                            counter.pop();
                        }
                    }
                }
                elements.parentNode();
            }
        }
    } while (elements.currentNode != start);
    return counters;
}
exports.parseCounters = parseCounters;
function resetFromCounters(counters) {
    let counterReset = '';
    for (const counterName in counters) {
        const counter = counters[counterName];
        if (counter.length)
            counterReset += ' ' + counterName + ' ' + counter[counter.length - 1].value;
    }
    return counterReset;
}
exports.resetFromCounters = resetFromCounters;
function addElementCounters(element, counters, forceDisplay) {
    const style = getComputedStyle(element);
    if (forceDisplay || style.display != 'none') {
        const resets = parseCounterValue(style.counterReset);
        for (const counterName in resets) {
            let counter = counters[counterName];
            if (!counter)
                counter = counters[counterName] = [];
            // A scope on on following sibling replace the current
            if (counter.length && counter[counter.length - 1].element.parentNode == element.parentNode)
                counter.pop();
            counter.push({
                element: element,
                value: resets[counterName]
            });
        }
        const increments = parseCounterValue(style.counterIncrement);
        for (const counterName in increments) {
            let counter = counters[counterName];
            if (!counter)
                counter = counters[counterName] = [];
            if (!counter.length) {
                counter.push({
                    element: element,
                    value: 0
                });
            }
            counter[counter.length - 1].value += increments[counterName];
        }
    }
}
exports.addElementCounters = addElementCounters;

},{"./util":19,"postcss-value-parser":31}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addStyleImagesToLoad = exports.computeMinOrMaxLength = exports.computeLength = exports.getCustomPluginProp = exports.getCustomProp = exports.getCustomStyle = exports.insertLinkSheet = exports.insertStyleSheet = exports.removeSheets = exports.cssContexts = exports.CssContext = void 0;
const postcss = require("postcss");
const safeParser = require("postcss-safe-parser");
const valueParser = require("postcss-value-parser");
const precss_1 = require("./precss");
const precss_2 = require("./precss");
const util_1 = require("./util");
const core_css_1 = require("./css/core-css");
const default_css_1 = require("./css/default-css");
const hypher_1 = require("./hypher");
class CssContext {
    constructor(doc, options) {
        this.doc = doc;
        this.options = options;
        this.preparedSheets = new Set();
        this.coreSheet = null;
        this.defaultSheet = null;
        this.hyphers = {};
    }
    *process() {
        if (!this.options.authorCSS)
            removeSheets(this.doc);
        const headStart = this.doc.head.firstChild;
        const defaultPageSize = this.options.defaultPageSize || [window.innerWidth + 'px', window.innerHeight + 'px'];
        if (this.options.coreCSS) {
            this.coreSheet = insertStyleSheet(this.doc, core_css_1.default(defaultPageSize), true, 'core-sheet', headStart);
        }
        if (this.options.defaultCSS) {
            this.defaultSheet = insertStyleSheet(this.doc, default_css_1.default(), true, 'default-sheet', headStart);
        }
        const stylesLoaded = [];
        for (const cssPath of this.options.css) {
            stylesLoaded.push(insertLinkSheet(this.doc, new URL(cssPath, this.doc.baseURI)));
        }
        yield (async () => {
            await registerPaintModule('mark', MarkPainter);
            await util_1.dom.docComplete(this.doc);
            await Promise.all(stylesLoaded);
            if (this.options.preprocessCSS)
                await this.prepareSheets({ defaultPageSize, mediaType: this.options.mediaType });
        })();
        // Ensures that the fonts are loaded
        if ('fonts' in this.doc) {
            const fontsLoaded = [];
            for (const font of this.doc.fonts) {
                if (font.status == 'unloaded')
                    fontsLoaded.push(font.load());
                else if (font.status == 'loading')
                    fontsLoaded.push(font.loaded);
            }
            if (fontsLoaded.length)
                yield Promise.all(fontsLoaded).catch((e) => {
                    util_1.logger.warn('A font could not be loaded.');
                    util_1.logger.error(e);
                });
        }
    }
    async prepareSheets(preprocOptions) {
        const preparations = [];
        const sheetsToPrepare = Array.prototype.filter.call(this.doc.styleSheets, (sheet) => {
            const cssNode = sheet.ownerNode;
            return !cssNode.hasAttribute('ps-excluded') && !this.preparedSheets.has(cssNode);
        });
        for (const sheet of sheetsToPrepare) {
            const cssElem = sheet.ownerNode;
            let linkElem;
            let transformation;
            if (cssElem instanceof HTMLLinkElement) {
                linkElem = cssElem.cloneNode(false);
                linkElem.setAttribute('ps-href', cssElem.getAttribute('href'));
                transformation = util_1.io.load(linkElem.href).then((content) => transform(content, cssElem.href, preprocOptions));
            }
            else {
                linkElem = document.createElement('link');
                if (cssElem.id)
                    linkElem.id = cssElem.id;
                if (cssElem.media)
                    linkElem.media = cssElem.media;
                linkElem.type = "text/css";
                linkElem.rel = "stylesheet";
                transformation = transform(cssElem.textContent, this.doc.baseURI, preprocOptions);
            }
            preparations.push(transformation.then((result) => {
                const blob = new Blob([result.css], { type: 'text/css' });
                linkElem.href = URL.createObjectURL(blob);
                if (this.options.mediaType && cssElem.media)
                    linkElem.media = precss_2.replaceMediaType(cssElem.media, this.options.mediaType);
                cssElem.parentNode.replaceChild(linkElem, cssElem);
                this.preparedSheets.add(linkElem);
                return new Promise((resolve) => {
                    linkElem.addEventListener('load', resolve);
                    linkElem.addEventListener('error', (e) => {
                        util_1.logger.warn(e.message || `An error occured while loading '${'href' in cssElem ? cssElem.href : linkElem.href}'`);
                        resolve();
                    });
                });
            }));
        }
        return Promise.all(preparations);
    }
    testHyphens(element, style) {
        if (style.getPropertyValue('--ps-hyphens').trim() != 'auto')
            return false;
        let lang = '';
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            if ((lang = parent.lang))
                break;
        }
        if (!lang)
            return false;
        const locale = new Intl.Locale(lang);
        lang = locale.language;
        if (locale.language == "en") {
            // TODO better selection based on the region "en-IN" => "en-gb" ?
            if (locale.region == "GB")
                lang = "en-gb";
            else
                lang = "en-us";
        }
        const hypher = this.hyphers[lang];
        if (hypher !== undefined)
            return hypher;
        else {
            if (!this.options.hyphUri)
                util_1.logger.warn(`Hyphenation dictionaries URL (hyphUri) not defined.`);
            else
                return util_1.io.load(`${this.options.hyphUri}/${lang}.json`)
                    .then((json) => {
                    const hypher = new hypher_1.Hypher(JSON.parse(json));
                    this.hyphers[lang] = hypher;
                    return hypher;
                })
                    .catch(() => {
                    this.hyphers[lang] = false;
                    util_1.logger.warn(`Failed to load the hyphenation patterns for language ${lang}.`);
                });
        }
    }
    hyphenate(element, hypher) {
        for (const child of element.childNodes) {
            if (util_1.walk.isText(child)) {
                child.nodeValue = hypher.hyphenateText(child.nodeValue);
            }
        }
    }
}
exports.CssContext = CssContext;
exports.cssContexts = new Map();
function transform(cssText, baseURI, preprocOptions) {
    const plugins = preprocOptions ? [precss_1.default(preprocOptions)] : [];
    const options = { from: baseURI, parser: safeParser };
    const processor = postcss().use(precss_1.importUnfold(options));
    for (const plugin of plugins)
        processor.use(plugin);
    if (preprocOptions)
        processor.use(precss_1.importFold);
    return processor.process(cssText, options);
}
function removeSheets(doc) {
    const nodes = doc.querySelectorAll('style,link[rel=stylesheet]');
    for (const node of nodes)
        node.remove();
}
exports.removeSheets = removeSheets;
function insertStyleSheet(doc, sheet, excluded, id, before) {
    const node = doc.createElement('style');
    node.textContent = sheet;
    if (id)
        node.id = id;
    if (excluded)
        node.setAttribute('ps-excluded', '');
    doc.head.insertBefore(node, before);
    return node.sheet;
}
exports.insertStyleSheet = insertStyleSheet;
function insertLinkSheet(doc, url, excluded, id, before) {
    const node = doc.createElement('link');
    node.rel = 'stylesheet';
    node.type = 'text/css';
    node.href = url.toString();
    if (id)
        node.id = id;
    if (excluded)
        node.setAttribute('ps-excluded', '');
    return new Promise((resolve, reject) => {
        node.addEventListener('load', () => {
            resolve(node.sheet);
        });
        node.addEventListener('error', () => {
            reject(node);
        });
        doc.head.insertBefore(node, before);
    });
}
exports.insertLinkSheet = insertLinkSheet;
function getCustomStyle(element, pseudo) {
    return getComputedStyle(element, pseudo ? '::' + pseudo : '::backdrop');
}
exports.getCustomStyle = getCustomStyle;
function getCustomProp(eltOrStyle, propName, pseudo) {
    if (util_1.dom.isElement(eltOrStyle))
        eltOrStyle = getCustomStyle(eltOrStyle, pseudo);
    return eltOrStyle.getPropertyValue(`--ps-${propName}`).trim();
}
exports.getCustomProp = getCustomProp;
function getCustomPluginProp(eltOrStyle, propName, pseudo) {
    if (util_1.dom.isElement(eltOrStyle))
        eltOrStyle = getCustomStyle(eltOrStyle, pseudo);
    return eltOrStyle.getPropertyValue(`--psp-${propName}`).trim();
}
exports.getCustomPluginProp = getCustomPluginProp;
function computeLength(strLength, percentBase) {
    let value = 0;
    try {
        value = parseFloat(strLength);
        if (!value)
            return 0;
        const length = CSSUnitValue.parse(strLength);
        if (length.unit == 'percent') {
            if (typeof percentBase == 'function')
                percentBase = percentBase();
            return percentBase * value / 100;
        }
        else
            return length.to('px').value;
    }
    catch (e) {
        const length = strLength.trim().match(/([\d.]+)(px|cm|mm|in|pt|pc|%)$/);
        if (length) {
            const [, , unit] = length;
            if (unit == '%') {
                if (typeof percentBase == 'function')
                    percentBase = percentBase();
                return percentBase * value / 100;
            }
            else {
                if (unit == 'px')
                    return value;
                else {
                    const inValue = value * 96;
                    switch (unit) {
                        case 'in':
                            return inValue;
                        case 'cm':
                            return inValue / 2.54;
                        case 'mm':
                            return inValue / 25.4;
                        case 'pt':
                            return inValue / 72.0;
                        case 'pc':
                            return inValue / 6;
                    }
                }
            }
        }
        else {
            util_1.logger.warn(`Unable to compute the length '${strLength}'.`);
        }
    }
}
exports.computeLength = computeLength;
function computeMinOrMaxLength(minMaxValue, percentBase, noneValue) {
    if (minMaxValue == 'none')
        return noneValue;
    else if (minMaxValue.match(/^\d/))
        return computeLength(minMaxValue, percentBase);
    else
        return NaN;
}
exports.computeMinOrMaxLength = computeMinOrMaxLength;
function addStyleImagesToLoad(element, set) {
    const bkgImageProp = getComputedStyle(element).backgroundImage;
    if (bkgImageProp != "none") {
        const bkgImageValue = valueParser(bkgImageProp);
        for (const bkgImageFn of bkgImageValue.nodes.filter((node) => node.type == "function")) {
            if (bkgImageFn.value == "url") {
                const bkgImageUrl = bkgImageFn.nodes[0].value;
                set.add(bkgImageUrl);
            }
        }
    }
}
exports.addStyleImagesToLoad = addStyleImagesToLoad;
class MarkPainter {
    static get inputProperties() {
        return ['--ps-bleed-size', '--ps-marks'];
    }
    /* tslint:disable:variable-name */
    paint(ctx, { width, height }, styleMap) {
        const marksProp = styleMap.get('--ps-marks')[0];
        if (!marksProp || marksProp == 'none')
            return;
        const bleedProp = styleMap.get('--ps-bleed-size')[0];
        let bleedLength;
        if ('parse' in CSSUnitValue)
            bleedLength = CSSUnitValue.parse(bleedProp);
        else {
            const length = bleedProp.match(/([\d.]+)(px|cm|mm|in|pt|pc)$/);
            bleedLength = new CSSUnitValue(parseFloat(length[1]), length[2]);
        }
        const bleed = bleedLength.to('px').value;
        ctx.lineWidth = .5;
        const bleed_1_3 = bleed / 3;
        if (marksProp.includes('crop')) {
            const bleed_2_3 = bleed * 2 / 3;
            ctx.beginPath();
            /* top-left crop */
            ctx.moveTo(bleed_1_3, bleed);
            ctx.lineTo(bleed_2_3, bleed);
            ctx.moveTo(bleed, bleed_1_3);
            ctx.lineTo(bleed, bleed_2_3);
            /* top-right crop */
            ctx.moveTo(width - bleed, bleed_1_3);
            ctx.lineTo(width - bleed, bleed_2_3);
            ctx.moveTo(width - bleed_2_3, bleed);
            ctx.lineTo(width - bleed_1_3, bleed);
            /* bottom-right crop */
            ctx.moveTo(width - bleed_1_3, height - bleed);
            ctx.lineTo(width - bleed_2_3, height - bleed);
            ctx.moveTo(width - bleed, height - bleed_1_3);
            ctx.lineTo(width - bleed, height - bleed_2_3);
            /* bottom-left crop */
            ctx.moveTo(bleed, height - bleed_1_3);
            ctx.lineTo(bleed, height - bleed_2_3);
            ctx.moveTo(bleed_1_3, height - bleed);
            ctx.lineTo(bleed_2_3, height - bleed);
            ctx.stroke();
        }
        if (marksProp.includes('cross')) {
            const width_1_2 = width / 2;
            const height_1_2 = height / 2;
            const bleed_1_2 = bleed / 2;
            const bleed_1_6 = bleed / 6;
            /* top circle */
            ctx.beginPath();
            ctx.arc(width_1_2, bleed_1_2, bleed_1_6, 0, Math.PI * 2);
            ctx.stroke();
            /* right circle */
            ctx.beginPath();
            ctx.arc(width - bleed_1_2, height / 2, bleed_1_6, 0, Math.PI * 2);
            ctx.stroke();
            /* bottom circle */
            ctx.beginPath();
            ctx.arc(width / 2, height - bleed_1_2, bleed_1_6, 0, Math.PI * 2);
            ctx.stroke();
            /* left circle */
            ctx.beginPath();
            ctx.arc(bleed_1_2, height / 2, bleed_1_6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            /* top cross lines */
            ctx.moveTo(width_1_2 - bleed_1_3, bleed_1_2);
            ctx.lineTo(width_1_2 + bleed_1_3, bleed_1_2);
            ctx.moveTo(width_1_2, bleed_1_2 - bleed_1_3);
            ctx.lineTo(width_1_2, bleed_1_2 + bleed_1_3);
            /* right cross lines */
            ctx.moveTo(width - bleed_1_2 - bleed_1_3, height_1_2);
            ctx.lineTo(width - bleed_1_2 + bleed_1_3, height_1_2);
            ctx.moveTo(width - bleed_1_2, height_1_2 - bleed_1_3);
            ctx.lineTo(width - bleed_1_2, height_1_2 + bleed_1_3);
            /* bottom cross lines */
            ctx.moveTo(width_1_2 - bleed_1_3, height - bleed_1_2);
            ctx.lineTo(width_1_2 + bleed_1_3, height - bleed_1_2);
            ctx.moveTo(width_1_2, height - bleed_1_2 - bleed_1_3);
            ctx.lineTo(width_1_2, height - bleed_1_2 + bleed_1_3);
            /* left cross lines */
            ctx.moveTo(bleed_1_2 - bleed_1_3, height_1_2);
            ctx.lineTo(bleed_1_2 + bleed_1_3, height_1_2);
            ctx.moveTo(bleed_1_2, height_1_2 - bleed_1_3);
            ctx.lineTo(bleed_1_2, height_1_2 + bleed_1_3);
            ctx.stroke();
        }
    }
}
function registerPaintModule(name, klass) {
    if (!('paintWorklet' in CSS))
        return;
    const module = `registerPaint('${name}', ${klass.toString()})`;
    const blob = new Blob([module], { type: 'application/javascript' });
    return CSS.paintWorklet.addModule(URL.createObjectURL(blob));
}

},{"./css/core-css":5,"./css/default-css":6,"./hypher":10,"./precss":15,"./util":19,"postcss":48,"postcss-safe-parser":29,"postcss-value-parser":31}],5:[function(require,module,exports){
"use strict";
// noinspection CssUnresolvedCustomProperty,CssInvalidFunction,CssInvalidPropertyValue
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (defaultPageSize) => /* language=CSS */ `
	*::backdrop {
		--ps-size: auto;
		--ps-page: auto;
		--ps-break-before: auto;
		--ps-break-after: auto;
		--ps-break-inside: auto;
		--ps-float-display: block;
		--ps-float-policy: auto;
		--ps-bookmark-level: none;
		--ps-bookmark-label: content(text);
		--ps-bookmark-state: open;
		--ps-column-count: auto;
		--ps-column-width: auto;
		--ps-column-gap: normal;
		--ps-column-fill: balance;
		--ps-column-rule-style: none;
		--ps-column-rule-width: medium;
		--ps-column-rule-color: currentcolor;
		--ps-repeat-thead: repeat;
		--ps-box-decoration-break: slice;
		--ps-box-remaining-extent: auto;
		--ps-margin-break: auto;
		--ps-areas: auto;
		--ps-column-span-break: element;
	}

	:root {
		/* Firefox does not support orphans and widows, we use CSS variables for them */
		--ps-orphans: 2;
		--ps-widows: 2;
		/* The defaut hyphen character of Chrome is the hyphen-minus (U+002D). PS uses the hyphen (U+2010) to allow detection. */
		-webkit-hyphenate-character: '\\2010';
		text-rendering: optimizeLegibility;
	}

	ps-page {
		display: block;

		counter-increment: page;
		box-sizing: border-box;
		page-break-before: always;

		position: relative;
		overflow: clip;

		--ps-page-width: ${defaultPageSize[0]};
		--ps-page-height: ${defaultPageSize[1]};
		width: var(--ps-page-width);
		height: var(--ps-page-height);
		
		--ps-bleed: auto;
		--ps-marks: none;
		padding-top: var(--ps-page-margin-top);
		padding-right: var(--ps-page-margin-right);
		padding-bottom: var(--ps-page-margin-bottom);
		padding-left: var(--ps-page-margin-left);
		margin-right: auto;
	}

	ps-page[ps-bleed] {
		border: solid var(--ps-bleed-size, 0) transparent;
		overflow-clip-margin: var(--ps-bleed-size);
		width: calc(var(--ps-page-width) + var(--ps-bleed-size) + var(--ps-bleed-size));
		height: calc(var(--ps-page-height) + var(--ps-bleed-size) + var(--ps-bleed-size));
	}

	ps-page[ps-bleed]:not([ps-bleed="none"])::before {
		content: "";
		position: absolute;
		--ps-bleed-inv: calc(var(--ps-bleed-size) * -1);
		top: var(--ps-bleed-inv);
		right: var(--ps-bleed-inv);
		bottom: var(--ps-bleed-inv);
		left: var(--ps-bleed-inv);

		background-image: paint(mark);
		background-repeat: no-repeat;
	}

	@page {
		margin: 0;
	}

	ps-page:first-of-type {
		page-break-before: auto;
		counter-reset: page 0 footnote 0;
	}

	ps-page-area {
		display: flex;
		flex-direction: column;
		height: 100%;
		box-sizing: border-box;
	}

	ps-area {
		overflow: hidden;
	}

	ps-area[ps-name=footnotes] {
		overflow: visible;
	}

	ps-area:empty {
		display: none;
	}

	[ps-page-body] {
		display: block;
		flex: 1 1 0;
		position: relative;
		/* TODO doubts about this margin, but consistent with PrinceXML */
		margin: 0;
		order: 0;
		min-height: 0;
	}

	ps-page[ps-processing] > ps-margin {
		display: none;
	}

	ps-page[ps-processing] > ps-page-area > [ps-page-body] {
		/*overflow: hidden;*/
	}

	ps-margin {
		display: flex;
		position: absolute;
		z-index: 1;
		box-sizing: border-box;
	}

	ps-margin-box {
		display: flex;
		box-sizing: border-box;
		flex: 1 1 auto;
	}

	ps-margin-box::before {
		display: block;
	}

	ps-margin-box[ps-name=top-left-corner] {
		position: absolute;
		top: 0;
		left: 0;
		width: var(--ps-page-margin-left);
		height: var(--ps-page-margin-top);
		align-items: center;
		justify-content: flex-end;
		text-align: right;
	}

	ps-margin[ps-side=top] {
		top: 0;
		left: var(--ps-page-margin-left);
		right: var(--ps-page-margin-right);
		height: var(--ps-page-margin-top);
	}

	ps-margin-box[ps-name=top-right-corner] {
		position: absolute;
		top: 0;
		right: 0;
		width: var(--ps-page-margin-right);
		height: var(--ps-page-margin-top);
		align-items: center;
		justify-content: flex-start;
		text-align: left;
	}

	ps-margin[ps-side=right] {
		right: 0;
		top: var(--ps-page-margin-top);
		bottom: var(--ps-page-margin-bottom);
		width: var(--ps-page-margin-right);
		flex-direction: column;
	}

	ps-margin-box[ps-name=bottom-right-corner] {
		position: absolute;
		right: 0;
		bottom: 0;
		height: var(--ps-page-margin-bottom);
		width: var(--ps-page-margin-right);
		align-items: center;
		justify-content: flex-start;
		text-align: left;
	}

	ps-margin[ps-side=bottom] {
		bottom: 0;
		right: var(--ps-page-margin-right);
		left: var(--ps-page-margin-left);
		height: var(--ps-page-margin-bottom);
	}

	ps-margin-box[ps-name=bottom-left-corner] {
		position: absolute;
		left: 0;
		bottom: 0;
		height: var(--ps-page-margin-bottom);
		width: var(--ps-page-margin-left);
		align-items: center;
		justify-content: flex-end;
		text-align: right;
	}

	ps-margin[ps-side=left] {
		left: 0;
		top: var(--ps-page-margin-top);
		bottom: var(--ps-page-margin-bottom);
		width: var(--ps-page-margin-left);
		flex-direction: column;
	}

	/* cf. http://www.w3.org/TR/css3-page/#margin-values */
	ps-margin-box[ps-name=top-left],
	ps-margin-box[ps-name=bottom-left] {
		align-items: center;
		justify-content: flex-start;
		text-align: left;
	}

	ps-margin-box[ps-name=top-center],
	ps-margin-box[ps-name=bottom-center] {
		align-items: center;
		justify-content: center;
		text-align: center;
	}

	ps-margin-box[ps-name=top-right],
	ps-margin-box[ps-name=bottom-right] {
		align-items: center;
		justify-content: flex-end;
		text-align: right;
	}

	ps-margin-box[ps-name=right-top],
	ps-margin-box[ps-name=left-top] {
		align-items: flex-start;
		justify-content: center;
		text-align: center;
	}

	ps-margin-box[ps-name=right-middle],
	ps-margin-box[ps-name=left-middle] {
		align-items: center;
		justify-content: center;
		text-align: center;
	}

	ps-margin-box[ps-name=right-bottom],
	ps-margin-box[ps-name=left-bottom] {
		align-items: flex-end;
		justify-content: center;
		text-align: center;
	}

	[ps-float-base] {
		display: none !important;
	}

	[ps-float-call] {
		color: inherit;
		text-decoration: inherit;
		unicode-bidi: isolate;
	}
	
	/* cf https://drafts.csswg.org/css-gcpm/#float-call */
	[ps-float-display='block'] {
		display: list-item;
		list-style-position: inside;
		list-style-type: none;
	}

	/* TODO */
	[ps-float-display='inline'] {
	}

	[ps-float-display='compact'] {
		display: inline-flex;
	}

  [ps-float-call], [ps-float-call]::before {
	  all: unset;
  }

  ps-bookmarks {
		display: none;
	}

	[ps-running] {
		display: none !important;
	}

	[ps-breaked-before] {
		counter-increment: none !important;
		text-indent: 0;
	}

	[ps-breaked-before]:not([ps-box-decoration-break=clone]) {
		padding-top: 0 !important;
		border-top: none !important;
		border-top-left-radius: 0 !important;
		border-top-right-radius: 0 !important;
	}

	[ps-breaked-after]:not([ps-box-decoration-break=clone]) {
		padding-bottom: 0 !important;
		border-bottom: none !important;
		border-bottom-left-radius: 0 !important;
		border-bottom-right-radius: 0 !important;
	}

	[ps-margin-break-before=discard] {
		margin-top: 0 !important;
	}

	[ps-breaked-after]:not([ps-margin-break-after=keep]) {
		margin-bottom: 0 !important;
	}

	/* TODO Is there some case where a counter-reset in not overridden ? */
	/*
	[ps-breaked-before]:not([ps-counters]) {
	  counter-reset: none !important;
	  counter-increment: none !important;
	}
	*/

	li[ps-breaked-before] {
		list-style-type: none !important;
		list-style-image: none !important;
	}

	[ps-breaked-before]::before {
		content: normal !important;
	}

	[ps-breaked-after]::after {
		content: normal !important;
	}

	[ps-row=table-row] > *[ps-breaked-before] {
		vertical-align: top;
	}

	[ps-row=table-row] > *[ps-breaked-after]:not([ps-empty-after]) {
		vertical-align: bottom;
	}

	[ps-row=table-row] > *[ps-breaked-after][ps-breaked-before] {
		vertical-align: middle;
	}

	/*
	table::first-letter {
	  --ps-box-decoration-break: clone;
	}
	td::first-letter, td *::first-letter  {
	  --ps-box-decoration-break: clone;
	  --ps-margin-break: keep;
	}*/

	ps-leader {
		-moz-user-select: none;
		-ms-user-select: none;
		-webkit-user-select: none;
		direction: rtl;
		text-align: right;
		white-space: pre;
		display: inline-block;
		position: relative;
	}

	ps-leader[ps-direction=ltr] {
		direction: ltr;
		text-align: left;
	}

	ps-leader-end {
		visibility: hidden;
	}

	[ps-columns] {
	}

	ps-columns {
		display: flex;
	}

	ps-column {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	ps-column-body {
		display: block;
	}

	ps-column > ps-column-body {
		flex: 1 1 0;
		min-height: 0;
	}

	ps-column-gap {
		margin: 0 calc(var(--ps-gap) / 2);
		position: relative;
	}

	ps-column-rule {
		position: absolute;
		top: 0;
		bottom: 0;
		border-left: var(--ps-rule);
		left: 50%;
		transform: translate(-50%, 0);
	}


	ps-columns[ps-process=ended] > ps-column > ps-column-body {
		min-height: auto;
	}

	/* TODO Chrome bug report? The display property of noscript tags is 'inline' */
	noscript {
		display: none;
	}

	/* Decoration are cloned by default on cells in the case of a repeated thead */
	td::backdrop {
		--ps-box-decoration-break: clone;
	}
`;

},{}],6:[function(require,module,exports){
"use strict";
// noinspection CssUnresolvedCustomProperty,CssInvalidFunction
Object.defineProperty(exports, "__esModule", { value: true });
/*
@page {
    -ps-areas: footnotes;
    margin: 10%;
}

::-ps-call {
    vertical-align: super;
    font-size: 60%;
}

::-ps-call::before {
    content: target-counter(attr(href), -ps-floats);
    content: "";
}

::-ps-marker::before {
   content: counter(-ps-floats) ".\A0";
}

h1 { bookmark-level: 1 }
h2 { bookmark-level: 2 }
h3 { bookmark-level: 3 }
h4 { bookmark-level: 4 }
h5 { bookmark-level: 5 }
h6 { bookmark-level: 6 }

h1, h2, h3, h4, h5, h6 {
    break-after: avoid;
}

body[ps-process] {
    margin: 0;
}

[ps-break-before='avoid'] {
    break-after: avoid;
}

[ps-break-after='avoid'] {
    break-after: avoid;
}

[ps-break-before='always'] {
    break-after: always;
}

[ps-break-after='always'] {
    break-after: always;
}

[ps-break-inside='avoid'] {
    break-inside: avoid;
}
 */
exports.default = () => /* language=CSS */ `
	ps-page {
	  --ps-page-margin-top: calc(var(--ps-page-width) * 10 / 100);
		--ps-page-margin-right: calc(var(--ps-page-width) * 10 / 100);
		--ps-page-margin-bottom: calc(var(--ps-page-width) * 10 / 100);
		--ps-page-margin-left: calc(var(--ps-page-width) * 10 / 100);
	}
	
	ps-page::backdrop {
		--ps-areas: footnotes;
	}

	[ps-float-call][ps-float-area=footnotes] {
		vertical-align: super;
		font-size: 60%;
	}

	[ps-float-call][ps-float-area=footnotes]::before {
		content: var(--ps-before-val-0, "");
		--ps-before-vals: target-counter(attr(href), footnote);
	}

  ps-area[ps-name='footnotes'] > [ps-float] {
  	counter-increment: footnote;
  }
  
  [ps-float=footnotes][ps-float-display=block]::marker, [ps-float=footnotes]:not([ps-float-display=block])::before {
		content: counter(footnote) ".\\A0";
	}

	h1::backdrop { --ps-bookmark-level: 1 }
	h2::backdrop { --ps-bookmark-level: 2 }
	h3::backdrop { --ps-bookmark-level: 3 }
	h4::backdrop { --ps-bookmark-level: 4 }
	h5::backdrop { --ps-bookmark-level: 5 }
	h6::backdrop { --ps-bookmark-level: 6 }

	h1::backdrop, h2::backdrop, h3::backdrop, h4::backdrop, h5::backdrop, h6::backdrop {
		--ps-break-after: avoid }

	body[ps-process] {
		margin: 0;
	}

	[ps-break-before='avoid']::backdrop {
		--ps-break-after: avoid }
		
	[ps-break-after='avoid']::backdrop {
		--ps-break-after: avoid }
		
	[ps-break-before='always']::backdrop {
		--ps-break-after: always }

	[ps-break-after='always']::backdrop {
		--ps-break-after: always }

	[ps-break-inside='avoid'] {
		-ps-break-inside: avoid;
	}
`;

},{}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowIterator = exports.flowPredicate = void 0;
const util_1 = require("./util");
const css_1 = require("./css");
/** Iterate over block elements except inner SVG elements */
exports.flowPredicate = util_1.walk.predicate(util_1.walk.isElement, util_1.walk.isStatic, util_1.walk.displayAsBlock, (node) => {
    return node.ownerSVGElement == null;
});
/**
 * Iterator of continuous flow
 *
 * A continuous flow is a range of contents not interrupted by forced page breaks.
 */
class FlowIterator {
    /**
     * ContinuousFlowIterator constructor
     * @param root              The root element to parse
     * @param forcedBreakTypes  List of values to use as forced break
     * @param maxTextLength
     * @param firstBreakType    Type of the break, usefull on repagination
     */
    constructor(root, forcedBreakTypes, maxTextLength = 0, firstBreakType) {
        this.resetOnNext = false;
        this.columnSpanBreak = 'element';
        this.elements = util_1.walk.createWalker(root, exports.flowPredicate);
        this.remaining = root.ownerDocument.createRange();
        this.forcedBreakTypes = forcedBreakTypes;
        this.nextBreakType = firstBreakType;
        this.nextPageGroupStart = false;
        this.maxTextLength = maxTextLength;
        this.reset();
    }
    // Used by for..of
    [Symbol.iterator]() {
        const self = this;
        return {
            next: function () {
                const flow = self.next();
                return { done: !flow, value: flow };
            }
        };
    }
    reset() {
        this.elements.currentNode = this.elements.root;
        this.elements.nextNode();
        this.remaining.selectNodeContents(this.elements.root);
        this.pageNames = [''];
    }
    /**
     * Iterate to the next page break start
     */
    next() {
        if (this.resetOnNext) {
            this.reset();
            this.resetOnNext = false;
        }
        let textLength = 0;
        if (this.remaining.collapsed)
            return null;
        let forcedBreakAfter = null;
        const flow = {
            range: null,
            pageName: null,
            pageGroupStart: this.nextPageGroupStart,
            breakType: this.nextBreakType,
            maxTextLength: false
        };
        this.nextBreakType = null;
        this.nextPageGroupStart = false;
        const startNode = this.elements.currentNode;
        let boxRoot = startNode;
        let inTable = false;
        while (!flow.range) {
            const currentElement = this.elements.currentNode;
            const customStyle = css_1.getCustomStyle(currentElement);
            const stylePageName = css_1.getCustomProp(customStyle, 'page');
            let newPageName = false;
            let elementPageName = stylePageName;
            if (elementPageName == 'auto')
                elementPageName = this.pageNames[this.pageNames.length - 1];
            else
                newPageName = elementPageName != flow.pageName;
            this.pageNames.push(elementPageName);
            if (currentElement instanceof HTMLTableElement)
                inTable = true;
            const columnSpan = css_1.getCustomProp(customStyle, 'column-span') == 'all';
            const breakBefore = columnSpan ? '-ps-column-span' : css_1.getCustomProp(currentElement, 'break-before');
            if (currentElement == startNode || (boxRoot == startNode && !util_1.walk.previousSibling(currentElement, util_1.walk.isStaticNode))) {
                // First static descendants
                flow.pageName = elementPageName;
                if (breakBefore && this.forcedBreakTypes.includes(breakBefore))
                    flow.breakType = breakBefore;
                if (!flow.pageGroupStart && newPageName && stylePageName != "auto")
                    flow.pageGroupStart = true;
            }
            else {
                const forcedBreakBefore = this.forcedBreakTypes.includes(breakBefore) && breakBefore;
                const breakOnElement = columnSpan && this.columnSpanBreak == 'element';
                if (forcedBreakBefore || forcedBreakAfter || newPageName) {
                    this.nextBreakType = forcedBreakBefore || forcedBreakAfter;
                    this.nextPageGroupStart = newPageName || ((forcedBreakBefore || forcedBreakAfter) && stylePageName != "auto");
                    flow.range = util_1.ranges.breakRangeBefore(this.remaining, breakOnElement ? currentElement : boxRoot);
                    forcedBreakAfter = null;
                    this.pageNames.pop();
                    break;
                }
            }
            if (!this.elements.firstChild()) {
                this.pageNames.pop();
                if (this.maxTextLength && currentElement instanceof HTMLElement) {
                    textLength += currentElement.innerText.length;
                    // Avoid a cut inside a table to preserve his integrity
                    if (textLength > this.maxTextLength && !inTable) {
                        flow.range = util_1.ranges.breakRangeAfter(this.remaining, this.elements.currentNode);
                        flow.maxTextLength = true;
                        this.resetOnNext = true;
                    }
                }
                if (!flow.range) {
                    const breakAfter = this._checkBreakAfter(currentElement, flow, customStyle);
                    if (!flow.range && breakAfter)
                        forcedBreakAfter = breakAfter;
                }
                if (!flow.range)
                    while (!this.elements.nextSibling()) {
                        this.pageNames.pop();
                        if (this.elements.currentNode.parentNode instanceof HTMLTableElement)
                            inTable = false;
                        // parentNode can be null if the root has display: none
                        if (!this.elements.parentNode() || this.elements.currentNode == this.elements.root) {
                            flow.range = util_1.ranges.breakRangeAfter(this.remaining, this.elements.root.lastChild);
                            break;
                        }
                        else if (!forcedBreakAfter) {
                            // Checks the break-after on ancestors
                            const breakAfter = this._checkBreakAfter(this.elements.currentNode, flow);
                            if (flow.range)
                                break;
                            else if (breakAfter)
                                forcedBreakAfter = breakAfter;
                        }
                    }
                boxRoot = this.elements.currentNode;
            }
        }
        return flow;
    }
    _checkBreakAfter(currentElement, flow, customStyle) {
        if (!customStyle)
            customStyle = css_1.getCustomStyle(currentElement);
        const columnSpan = css_1.getCustomProp(customStyle, 'column-span') == 'all';
        const breakAfter = columnSpan ? 'column' : css_1.getCustomProp(customStyle, 'break-after');
        if (this.forcedBreakTypes.includes(breakAfter) || (this.forcedBreakTypes.includes('column') && columnSpan)) {
            // Special case where a forced break-after is followed by an inline
            const nextStatic = util_1.walk.nextSibling(currentElement, util_1.walk.isStaticNode);
            if (nextStatic && !util_1.walk.displayAsBlock(nextStatic)) {
                flow.range = util_1.ranges.breakRangeAfter(this.remaining, currentElement);
                this.resetOnNext = true;
                return null;
            }
            return breakAfter;
        }
        return null;
    }
}
exports.FlowIterator = FlowIterator;

},{"./css":4,"./util":19}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupAreas = exports.createAreas = exports.Fragmentor = exports.Fragment = void 0;
const util_1 = require("./util");
const css_1 = require("./css");
const rows_1 = require("./rows");
const layout_1 = require("./layout");
const util_2 = require("./util");
class Fragment {
}
exports.Fragment = Fragment;
class Fragmentor extends layout_1.LayoutProcessor {
    constructor(source, options) {
        // TODO Typescript
        super(source, options);
        this.fragments = [];
        this.currentFragment = null;
        this.fragmentStartMut = new util_2.Mutations();
        this.imagesToLoad = new Set();
        // TODO Better way to handle this flag
        this.logNoValidBreakPoint = true;
        this.dest = this.options.dest;
        if (!this.dest)
            this.dest = source.parentElement;
        if (this.options.plugins)
            this.options.plugins.forEach((plugin) => this.use(plugin));
        this.addSubProcessor(rows_1.trWithRowSpanSubFragmentor);
        this.addSubProcessor(rows_1.rowSubFragmentor);
    }
    onFragmentStart(fragment, forcedBreak) {
        discardMarginBreakBefore(fragment.body, forcedBreak, this.fragmentStartMut);
        this.addImagesToLoad(fragment);
    }
    onFragmentBreak(fragment) {
        this.setLastBreakedHeight(fragment.body);
    }
    setLastBreakedHeight(container) {
        let lastStatic = container;
        let lastToFill = null;
        const isStaticBreakedAfterHtmlBlock = util_1.walk.predicate(util_1.walk.isHTMLElement, util_1.walk.isStatic, util_1.walk.displayAsBlock, util_1.walk.isBreakedAfter);
        while (lastStatic && lastStatic.hasAttribute('ps-breaked-after')) {
            if (css_1.getCustomProp(lastStatic, 'box-remaining-extent') == 'fill')
                lastToFill = lastStatic;
            // TODO Set the height of the first breaked child of the row
            // TODO The bottomOffset can be null if the cell is empty
            if (util_1.walk.isRow(getComputedStyle(lastStatic))) {
                lastStatic = util_1.walk.firstChild(lastStatic, isStaticBreakedAfterHtmlBlock);
            }
            else {
                lastStatic = util_1.walk.lastChild(lastStatic, util_1.walk.isStaticHtmlBlock);
            }
        }
        if (lastToFill && lastToFill != container) {
            const bottomOffset = this.layoutContext.bottomOffsets.get(lastToFill);
            if (bottomOffset) {
                const maxBreakedBottom = this.layoutContext.bodyBottom - bottomOffset.after - bottomOffset.currentMargin;
                const lastBreakedBottom = util_1.rects.boundingScrollRect(lastToFill).bottom;
                const newHeight = parseFloat(getComputedStyle(lastToFill).height) + (maxBreakedBottom - lastBreakedBottom) + 'px';
                this.layoutContext.mutations.setStyle(lastToFill, { height: newHeight + 'px' });
            }
        }
    }
    addImagesToLoad(fragment) {
        css_1.addStyleImagesToLoad(fragment.container, this.imagesToLoad);
        if (fragment.area)
            css_1.addStyleImagesToLoad(fragment.area, this.imagesToLoad);
        for (const areaName in fragment.areas) {
            css_1.addStyleImagesToLoad(fragment.areas[areaName], this.imagesToLoad);
        }
    }
}
exports.Fragmentor = Fragmentor;
Fragmentor.defaultOptions = Object.assign(Object.create(layout_1.LayoutProcessor.defaultOptions), {
    dest: null,
    authorCSS: true,
    coreCSS: true,
    defaultCSS: true,
    preprocessCSS: true,
    css: [],
    defaultPageSize: ['21cm', '29.7cm'],
    mediaType: 'print'
});
function createAreas(fragment, areasProp) {
    const doc = fragment.container.ownerDocument;
    fragment.areas = {};
    if (!areasProp)
        areasProp = css_1.getCustomProp(fragment.container, 'areas');
    if (areasProp == 'auto')
        return;
    const areaNames = areasProp.split(' ');
    for (const areaName of areaNames) {
        const area = doc.createElement('ps-area');
        area.setAttribute('ps-name', areaName);
        fragment.areas[areaName] = (fragment.area || fragment.container).appendChild(area);
    }
}
exports.createAreas = createAreas;
function cleanupAreas(fragment) {
    for (const areaName in fragment.areas) {
        const area = fragment.areas[areaName];
        if (!area.firstChild)
            area.remove();
    }
}
exports.cleanupAreas = cleanupAreas;
function discardMarginBreakBefore(elem, keepByDefault, mut) {
    const marginBreak = css_1.getCustomProp(elem, 'margin-break');
    if (marginBreak.startsWith('discard') || (marginBreak.startsWith('auto') && !keepByDefault)) {
        mut.setAttr(elem, 'ps-margin-break-before', 'discard');
    }
    const style = getComputedStyle(elem);
    if (parseFloat(style.borderTop) || parseFloat(style.paddingTop))
        return;
    if (util_1.walk.isRow(style)) {
        for (let child = util_1.walk.firstChild(elem, util_1.walk.isStaticHtmlElement); child; child = util_1.walk.nextSibling(child, util_1.walk.isStaticHtmlElement)) {
            discardMarginBreakBefore(child, keepByDefault, mut);
        }
    }
    else {
        const firstStatic = util_1.walk.firstChild(elem, util_1.walk.isStaticNode);
        if (util_1.walk.isHTMLElement(firstStatic))
            discardMarginBreakBefore(firstStatic, keepByDefault, mut);
    }
}

},{"./css":4,"./layout":12,"./rows":17,"./util":19}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFloatCall = exports.setLeaders = exports.setTargetCounters = exports.setPageTargetCounters = exports.setMarginContents = exports.setBookmarkLabels = exports.createBookmarks = exports.parsePseudosVals = exports.prepareGcpm = exports.GCPMContext = exports.PageMarginContent = exports.PSEUDOS = exports.VERTICAL_MARGIN_BOXES = exports.HORIZONTAL_MARGIN_BOXES = exports.CORNERS = exports.SIDES = void 0;
const valueParser = require("postcss-value-parser");
const util_1 = require("./util");
const css_1 = require("./css");
const counters_1 = require("./counters");
exports.SIDES = ['top', 'right', 'bottom', 'left'];
exports.CORNERS = ['top-left-corner', 'top-right-corner', 'bottom-right-corner', 'bottom-left-corner'];
exports.HORIZONTAL_MARGIN_BOXES = ['left', 'center', 'right'];
exports.VERTICAL_MARGIN_BOXES = ['top', 'middle', 'bottom'];
exports.PSEUDOS = ['before', 'after', 'marker'];
class InvalidArgCountError extends TypeError {
    constructor(fnName, args, argsRequired) {
        super(`Failed to parse '${fnName}(${valueParser.stringify(args)}): ${argsRequired} argument${argsRequired > 1 ? 's' : ''} required.`);
    }
}
class PageMarginContent {
    constructor() {
        this.start = {};
        this.first = {};
        this.last = {};
    }
}
exports.PageMarginContent = PageMarginContent;
class GCPMContext {
    constructor() {
        /**
         * Map of floats by float-call
         */
        this.floats = new Map();
        /**
         * Map of floats by float-call
         */
        this.pendingFloats = [];
        /**
         * Map of leaders.
         */
        this.leaders = new Map();
        /**
         * The global string sets of the pagination.
         */
        this.stringSets = {};
        /**
         * The string sets of the current page.
         */
        this.pageStringSets = new PageMarginContent();
        /**
         * The global running elements of the pagination.
         */
        this.runnings = {};
        /**
         * The running elements of the current page.
         */
        this.pageRunnings = new PageMarginContent();
        this.bookmarks = new Set();
        this.targetCounters = {};
    }
}
exports.GCPMContext = GCPMContext;
function prepareGcpm(element, customStyle, ctx) {
    const boxDecorationBreak = css_1.getCustomProp(customStyle, "box-decoration-break");
    if (boxDecorationBreak == 'clone') {
        element.setAttribute('ps-box-decoration-break', 'clone');
    }
    const marginBreak = css_1.getCustomProp(customStyle, "margin-break");
    if (marginBreak.endsWith('keep')) {
        element.setAttribute('ps-margin-break-after', 'keep');
    }
    const bookmarkLevel = css_1.getCustomProp(customStyle, "bookmark-level");
    if (bookmarkLevel != 'none') {
        if (bookmarkLevel)
            ctx.bookmarks.add(element);
    }
    const position = css_1.getCustomProp(customStyle, "position");
    if (position) {
        const positionVal = valueParser(position).nodes[0];
        if (positionVal.type == 'function' && positionVal.value == 'running') {
            element.setAttribute('ps-running', positionVal.nodes[0].value);
        }
    }
    const float = css_1.getCustomProp(customStyle, 'float');
    if (float) {
        const floatVal = valueParser(float).nodes[0];
        if (floatVal.type == 'function' && floatVal.value == "-ps-area") {
            const doc = element.ownerDocument;
            const areaName = floatVal.nodes[0].value;
            const call = doc.createElement('a');
            call.setAttribute('ps-float-call', '');
            const body = element.cloneNode(true);
            body.setAttribute('ps-float', areaName);
            body.setAttribute('ps-float-display', css_1.getCustomProp(customStyle, 'float-display'));
            element.removeAttribute('id');
            element.setAttribute('ps-float-base', '');
            element.parentNode.insertBefore(call, element.nextSibling);
            call.setAttribute('href', '#' + util_1.dom.id(body));
            call.setAttribute('ps-float-area', areaName);
            const placement = (floatVal.nodes.length > 2 ? floatVal.nodes[2].value : "baseline");
            ctx.floats.set(element, {
                base: element,
                body,
                call,
                areaName,
                placement
            });
        }
    }
    for (const pseudo of exports.PSEUDOS)
        parsePseudosVals(element, pseudo, ctx);
}
exports.prepareGcpm = prepareGcpm;
function parsePseudosVals(element, pseudo, ctx) {
    const vals = getComputedStyle(element, '::' + pseudo).getPropertyValue(`--ps-${pseudo}-vals`).trim();
    if (vals) {
        const pseudoValues = valueParser(vals).nodes.filter((val) => val.type == 'function');
        for (let i = 0; i < pseudoValues.length; i++) {
            const varName = `--ps-${pseudo}-val-${i}`;
            // In some case (leaders), the value can be already parsed
            if (!element.style.getPropertyValue(varName)) {
                const vals = [pseudoValues[i]];
                parseContentVals(vals, { element, pseudo, varName, srcElement: element, ctx });
                element.style.setProperty(varName, valueParser.stringify(vals));
            }
        }
    }
}
exports.parsePseudosVals = parsePseudosVals;
function parseContentVals(vals, valFnCtx) {
    valueParser.walk(vals, (val, index, vals) => {
        if (val.type == 'function') {
            let valFn;
            const args = val.nodes.filter((val) => val.type != 'div');
            if (val.value == 'attr')
                valFn = fnAttr;
            else if (val.value == 'url')
                valFn = fnUrl;
            else if (val.value == 'string')
                valFn = fnString;
            else if (val.value == 'element')
                valFn = fnElement;
            else if (val.value == 'leader')
                valFn = fnLeader;
            else if (val.value == 'target-content' || val.value == 'target-text')
                valFn = fnTargetContent;
            else if (val.value == 'target-counter')
                valFn = fnTargetCounter;
            if (valFn) {
                const value = valFn(args, valFnCtx);
                if (typeof value == 'string')
                    vals[index] = { type: 'string', value, quote: '"' };
                else if (Array.isArray(value))
                    vals[index] = { nodes: value };
                else
                    vals[index] = value;
            }
        }
    }, true);
}
function parseStringSetVals(vals, valFnCtx) {
    valueParser.walk(vals, (val, index, vals) => {
        if (val.type == 'function') {
            let valFn;
            const args = val.nodes.filter((val) => val.type != 'div');
            if (val.value == 'attr')
                valFn = fnAttr;
            else if (val.value == 'url')
                valFn = fnUrl;
            else if (val.value == 'counter' || val.value == 'content') {
                val.value = `target-${val.value}`;
                val.nodes.unshift({ type: "string", value: '#' + util_1.dom.id(valFnCtx.element), quote: '"' }, {
                    type: "div",
                    value: ','
                });
            }
            if (valFn) {
                const value = valFn(args, valFnCtx);
                if (typeof value == 'string')
                    vals[index] = { type: 'string', value, quote: '"' };
                else if (Array.isArray(value))
                    vals[index] = { nodes: value };
            }
        }
    }, true);
}
function fnAttr(args, { srcElement }) {
    if (args.length < 1)
        throw new InvalidArgCountError('attr', args, 1);
    const attrName = args[0].value;
    if (!srcElement.hasAttribute(attrName)) {
        util_1.logger.warn(`Invalid attr() content function call : the attribute '${attrName}' does not exist.`);
        return '';
    }
    return srcElement.getAttribute(attrName);
}
function fnUrl(args) {
    if (args.length < 1)
        throw new InvalidArgCountError('url', args, 1);
    return args[0].value;
}
function fnString(args, { srcElement, ctx }) {
    if (args.length < 1)
        throw new InvalidArgCountError('string', args, 1);
    const name = args[0].value;
    const position = args.length > 1 ? args[1].value : 'first';
    let stringContent = '';
    if (position == 'first')
        stringContent = ctx.pageStringSets.first[name] || ctx.stringSets[name] || '';
    else if (position == "start")
        stringContent = ctx.pageStringSets.start[name] || ctx.stringSets[name] || '';
    else if (position == 'last')
        stringContent = ctx.pageStringSets.last[name] || ctx.stringSets[name] || '';
    else if (position == "first-except")
        stringContent = ctx.pageStringSets.first[name] ? '' : ctx.stringSets[name] || '';
    const stringVals = valueParser(stringContent).nodes;
    parseContentVals(stringVals, { element: srcElement, srcElement, ctx });
    return stringVals;
}
function fnElement(args, { srcElement, ctx }) {
    if (args.length < 1)
        throw new InvalidArgCountError('element', args, 1);
    const name = args[0].value;
    const position = args.length > 1 ? args[1].value : 'first';
    let running;
    if (position == 'first')
        running = ctx.pageRunnings.first[name] || ctx.runnings[name];
    else if (position == "start")
        running = ctx.pageRunnings.start[name] || ctx.runnings[name];
    else if (position == 'last')
        running = ctx.pageRunnings.last[name] || ctx.runnings[name];
    else if (position == "first-except")
        running = ctx.pageRunnings.first[name] ? null : ctx.runnings[name];
    if (running) {
        const clone = srcElement.appendChild(running.cloneNode(true));
        clone.removeAttribute('ps-running');
    }
    return '';
}
function fnLeader(args, { element, pseudo, ctx }) {
    if (args.length < 1)
        throw new InvalidArgCountError('leader', args, 1);
    const patternVal = args[0];
    let pattern;
    if (patternVal.type == 'word') {
        if (patternVal.value == 'dotted')
            pattern = '. ';
        else if (patternVal.value == 'solid')
            pattern = '_';
        else if (patternVal.value == 'space')
            pattern = ' ';
    }
    else if (patternVal.type == 'string') {
        pattern = patternVal.value;
    }
    const leader = {
        pseudo,
        pattern,
        element: element.ownerDocument.createElement('ps-leader')
    };
    if (pseudo == 'after')
        element.appendChild(leader.element);
    else
        element.insertBefore(leader.element, element.firstChild);
    leader.element.textContent = leader.pattern;
    leader.element.setAttribute('ps-position', pseudo);
    leader.element.setAttribute('ps-direction', getComputedStyle(element).direction == 'ltr' ? 'rtl' : 'ltr');
    ctx.leaders.set(element, leader);
    return '';
}
function fnTargetCounter(args, { element, srcElement, ctx, varName }) {
    if (args.length < 2)
        throw new InvalidArgCountError('target-counter', args, 2);
    const targetId = checkTarget(args[0].value, false);
    if (!targetId)
        return '';
    const counterName = args[1].value;
    let targetCounters = ctx.targetCounters[targetId];
    if (!targetCounters)
        targetCounters = ctx.targetCounters[targetId] = {};
    // If the parsing comes from a variable  (@see parsePseudosVals), it is used for future replacement
    let targetVarName = varName;
    if (!targetVarName) {
        const style = getComputedStyle(element);
        let i = 0;
        targetVarName = `--ps-target-counter-${i}`;
        while (style.getPropertyValue(targetVarName))
            targetVarName = `--ps-target-counter-${++i}`;
    }
    let targetCounter = targetCounters[counterName];
    if (!targetCounter)
        targetCounter = targetCounters[counterName] = [];
    targetCounter.push({ element, varName: targetVarName });
    return varName ? "000" : valueParser(`var(${targetVarName}, "000")`).nodes[0];
}
// TODO Does not match the spec: pseudo-elements of descendants are not included
function fnTargetContent(args, { srcElement, ctx }) {
    if (args.length < 1)
        throw new InvalidArgCountError('target-content', args, 1);
    const targetId = checkTarget(args[0].value);
    if (!targetId)
        return '';
    const targetElement = srcElement.ownerDocument.getElementById(targetId);
    if (!targetElement)
        return '';
    const type = args.length > 1 ? args[1].value : 'text';
    if (type == 'text') {
        return targetElement.textContent.trim();
    }
    else if (type == "first-letter") {
        // TODO Punctuation (i.e, characters defined in Unicode in the "open" (Ps), "close" (Pe), "initial" (Pi),
        // "final" (Pf) and "other" (Po) punctuation classes),that precedes or follows the first letter should be included.
        return targetElement.textContent.trim().substr(0, 1);
    }
    else if (type == 'before' || type == 'after' || type == 'marker') {
        const pseudoContent = getComputedStyle(targetElement, type).content;
        const vals = valueParser(pseudoContent).nodes;
        parseStringSetVals(vals, { element: targetElement, srcElement: targetElement, ctx });
        parseContentVals(vals, { element: srcElement, srcElement: targetElement, ctx });
        return vals;
    }
}
function createBookmarks(doc, ctx) {
    const root = doc.createElement('ps-bookmarks');
    const rootList = doc.createElement('ol');
    const stack = [rootList];
    for (const target of ctx.bookmarks) {
        const customStyle = css_1.getCustomStyle(target);
        const level = parseInt(css_1.getCustomProp(customStyle, 'bookmark-level'));
        if (!isNaN(level) && util_1.walk.hasSize(target)) {
            const label = css_1.getCustomProp(customStyle, 'bookmark-label');
            const labelVals = valueParser(label).nodes;
            const item = doc.createElement('li');
            const link = item.appendChild(doc.createElement('a'));
            link.href = '#' + util_1.dom.id(target);
            parseStringSetVals(labelVals, { element: target, srcElement: target, ctx });
            parseContentVals(labelVals, { element: link, srcElement: target, ctx });
            const labelValue = valueParser.stringify(labelVals);
            link.style.setProperty('--ps-label', labelValue);
            const list = doc.createElement('ol');
            list.setAttribute('ps-state', css_1.getCustomProp(customStyle, 'bookmark-state'));
            item.appendChild(list);
            let parentList;
            for (let l = 0; l < level; l++) {
                if (stack[l])
                    parentList = stack[l];
                else
                    stack.push(undefined);
            }
            parentList.appendChild(item);
            for (let l = level; l < stack.length; l++) {
                const list = stack[l];
                if (list && !list.firstChild)
                    list.remove();
            }
            stack.length = level;
            stack.push(list);
        }
    }
    for (const list of stack) {
        if (list && !list.firstChild)
            list.remove();
    }
    if (rootList.firstChild)
        root.appendChild(rootList);
    return root;
}
exports.createBookmarks = createBookmarks;
function setBookmarkLabels(bookmarksRoot) {
    const linkIterator = util_1.walk.createIterator(bookmarksRoot, util_1.walk.isConstructedBy(HTMLAnchorElement), util_1.walk.isElement);
    let link;
    while ((link = linkIterator.nextNode())) {
        const labelVals = valueParser(getComputedStyle(link).getPropertyValue('--ps-label')).nodes;
        link.textContent = labelVals.filter((val) => val.type == 'string').map((val) => val.value).join('');
        link.removeAttribute('style');
    }
}
exports.setBookmarkLabels = setBookmarkLabels;
/**
 * Sets the content of the margins of a page
 * @param page
 * @param context
 */
function setMarginContents(page, ctx) {
    const elements = util_1.walk.createWalker(page.body, util_1.walk.isHTMLElement);
    const pageStringSets = new Map();
    const pageRunnings = new Map();
    do {
        const style = css_1.getCustomStyle(elements.currentNode);
        const stringSet = css_1.getCustomProp(style, 'string-set').trim();
        if (stringSet)
            pageStringSets.set(elements.currentNode, stringSet);
        const position = css_1.getCustomProp(style, 'position');
        if (position.startsWith('running('))
            pageRunnings.set(elements.currentNode, position);
    } while (elements.nextNode());
    ctx.pageStringSets = {
        start: {},
        first: {},
        last: {}
    };
    for (const [stringSetElt, stringSetValue] of pageStringSets) {
        const parts = valueParser(stringSetValue).nodes;
        let i = 0;
        while (i < parts.length) {
            const name = parts[i++].value;
            const valStart = i;
            while (i < parts.length && parts[i].type != 'div' && parts[i].value != ',')
                i++;
            const partVals = parts.slice(valStart, i);
            parseStringSetVals(partVals, {
                element: stringSetElt,
                srcElement: stringSetElt,
                ctx
            });
            const value = valueParser.stringify(partVals);
            elements.currentNode = stringSetElt;
            // start: "If the element is the first element on the page, the value of the first assignment is used"
            const previousElt = elements.previousNode();
            if (!previousElt || previousElt == page.body)
                ctx.pageStringSets.start[name] = value;
            if (ctx.pageStringSets.first[name] === undefined)
                ctx.pageStringSets.first[name] = value;
            // last : always rewritten
            ctx.pageStringSets.last[name] = value;
            i++;
        }
    }
    ctx.pageRunnings = {
        start: {},
        first: {},
        last: {}
    };
    // running: same algorithm than the string-set
    for (const [runningElt, runningValue] of pageRunnings) {
        const call = valueParser(runningValue).nodes[0];
        const name = call.nodes[0].value;
        elements.currentNode = runningElt;
        const previousElt = elements.previousNode();
        if (!previousElt || previousElt == page.body)
            ctx.pageRunnings.start[name] = runningElt;
        if (ctx.pageRunnings.first[name] === undefined)
            ctx.pageRunnings.first[name] = runningElt;
        ctx.pageRunnings.last[name] = runningElt;
    }
    const marginsContent = {};
    for (const position in page.marginBoxes) {
        const marginBox = page.marginBoxes[position];
        const content = getComputedStyle(marginBox, '::before').content;
        if (content != "none") {
            parsePseudosVals(marginBox, 'before', ctx);
            marginsContent[position] = true;
        }
    }
    // Keep output values for the next page
    for (const stringName in ctx.pageStringSets.last) {
        ctx.stringSets[stringName] = ctx.pageStringSets.last[stringName];
    }
    for (const runningName in ctx.pageRunnings.last) {
        ctx.runnings[runningName] = ctx.pageRunnings.last[runningName];
    }
    function removeMarginBox(position) {
        page.marginBoxes[position].remove();
        page.marginBoxes[position] = null;
    }
    // Margin sides are removed if empty
    for (let side, i = 0; i < exports.SIDES.length, side = exports.SIDES[i]; i++) {
        if (!marginsContent[exports.CORNERS[i]])
            removeMarginBox(exports.CORNERS[i]);
        if (i % 2 == 0) {
            const leftPos = side + '-left';
            const rightPos = side + '-right';
            if (!marginsContent[leftPos] && !marginsContent[rightPos]) {
                removeMarginBox(leftPos);
                removeMarginBox(rightPos);
            }
        }
        else {
            const topPos = side + '-top';
            const bottomPos = side + '-bottom';
            if (!marginsContent[topPos] && !marginsContent[bottomPos]) {
                removeMarginBox(topPos);
                removeMarginBox(bottomPos);
            }
        }
    }
    // Centered margin are removed if empty
    for (let side, i = 0; i < exports.SIDES.length, side = exports.SIDES[i]; i++) {
        if (i % 2 == 0) {
            const centerPos = side + '-center';
            const leftPos = side + '-left';
            const rightPos = side + '-right';
            if (!marginsContent[centerPos]) {
                removeMarginBox(centerPos);
                if (page.marginBoxes[leftPos] && !marginsContent[leftPos])
                    removeMarginBox(leftPos);
                if (page.marginBoxes[rightPos] && !marginsContent[rightPos])
                    removeMarginBox(rightPos);
            }
        }
        else {
            const middlePos = side + '-middle';
            if (!marginsContent[middlePos]) {
                removeMarginBox(middlePos);
                const topPos = side + '-top';
                const bottomPos = side + '-bottom';
                if (page.marginBoxes[topPos] && !marginsContent[topPos])
                    removeMarginBox(topPos);
                if (page.marginBoxes[bottomPos] && !marginsContent[bottomPos])
                    removeMarginBox(bottomPos);
            }
        }
    }
    // Remove margin if all boxes empty
    for (let side, i = 0; i < exports.SIDES.length, side = exports.SIDES[i]; i++) {
        const marginBoxes = i % 2 == 0 ? exports.HORIZONTAL_MARGIN_BOXES : exports.VERTICAL_MARGIN_BOXES;
        const noMarginBoxes = marginBoxes.every((position) => !page.marginBoxes[side + '-' + position]);
        if (noMarginBoxes)
            page.container.querySelector(`ps-margin[ps-side=${side}]`).remove();
    }
    // Balancing of sided margins
    for (let side, i = 0; i < exports.SIDES.length, side = exports.SIDES[i]; i++) {
        if (i % 2 == 0) {
            const marginCenter = page.marginBoxes[side + '-center'];
            if (marginCenter) {
                const marginLeft = page.marginBoxes[side + '-left'];
                const marginRight = page.marginBoxes[side + '-right'];
                if (marginLeft && marginRight) {
                    const leftWidth = marginLeft.clientWidth;
                    const rightWidth = marginRight.clientWidth;
                    if (leftWidth != rightWidth) {
                        marginCenter.style.maxWidth = marginCenter.clientWidth + 'px';
                        marginLeft.style.flexBasis = marginRight.style.flexBasis = '0';
                    }
                }
            }
        }
        else {
            const marginMiddle = page.marginBoxes[side + '-middle'];
            if (marginMiddle) {
                const marginTop = page.marginBoxes[side + '-top'];
                const marginBottom = page.marginBoxes[side + '-bottom'];
                if (marginTop && marginBottom) {
                    const topHeight = marginTop.clientHeight;
                    const bottomHeight = marginBottom.clientHeight;
                    if (topHeight != bottomHeight) {
                        marginMiddle.style.maxHeight = marginMiddle.clientHeight + 'px';
                        marginTop.style.flexBasis = marginBottom.style.flexBasis = '0';
                    }
                }
            }
        }
    }
}
exports.setMarginContents = setMarginContents;
function setPageTargetCounters(page, dest, ctx) {
    for (const id in ctx.targetCounters) {
        const target = page.body.querySelector('#' + id);
        if (target) {
            const targetCounters = ctx.targetCounters[id];
            for (const counterName in targetCounters) {
                if (counterName == 'page') {
                    const varValue = valueParser.stringify({ type: 'string', value: page.number.toString(), quote: '"' });
                    for (const targetCounter of targetCounters[counterName]) {
                        targetCounter.element.style.setProperty(targetCounter.varName, varValue);
                    }
                    delete targetCounters[counterName];
                }
            }
            if (!Object.keys(targetCounters).length)
                delete ctx.targetCounters[id];
        }
    }
}
exports.setPageTargetCounters = setPageTargetCounters;
function setTargetCounters(pages, ctx) {
    for (const id in ctx.targetCounters) {
        const target = document.getElementById(id);
        const targetCounters = ctx.targetCounters[id];
        for (const counterName in targetCounters) {
            let counterValue;
            if (!target)
                counterValue = '';
            // TODO Add an option for the optimization on page counters value
            else if (counterName == 'pages')
                counterValue = pages.length;
            else if (counterName == 'page')
                counterValue = counters_1.getPageCounterValue(pages, target);
            else
                counterValue = counters_1.getCounterValue(target, counterName);
            const varValue = valueParser.stringify({ type: 'string', value: counterValue.toString(), quote: '"' });
            for (const targetCounter of targetCounters[counterName]) {
                targetCounter.element.style.setProperty(targetCounter.varName, varValue);
            }
        }
    }
}
exports.setTargetCounters = setTargetCounters;
function setLeaders(ctx) {
    if (!ctx.leaders || !ctx.leaders.size)
        return;
    for (const [element, leader] of ctx.leaders.entries()) {
        // If the element is displayed
        if (element.offsetHeight) {
            let block = element;
            let blockStyle = getComputedStyle(block);
            while (!util_1.walk.displayAsBlockStyle(blockStyle)) {
                block = block.parentNode;
                blockStyle = getComputedStyle(block);
            }
            const blockRect = util_1.rects.boundingScrollRect(block);
            // We force an alignement when the text is justified in order to have an available space
            const initialTextAlign = blockStyle.textAlign;
            let textAlign = initialTextAlign;
            if (initialTextAlign == 'justify') {
                block.style.textAlign = 'start';
                textAlign = block.style.textAlign;
            }
            let leaderRect = util_1.rects.boundingScrollRect(leader.element);
            const patternWidth = leaderRect.width;
            leader.element.textContent = '';
            leaderRect = util_1.rects.boundingScrollRect(leader.element);
            const ltr = blockStyle.direction == 'ltr';
            let [start, end] = getLeaderStartEnd(block, blockRect, leader, leaderRect, ltr, textAlign);
            let endWidth = end - parseFloat(ltr ? blockStyle.paddingRight : blockStyle.paddingLeft);
            if (endWidth < 0.1) {
                leader.element.parentNode.insertBefore(document.createElement('br'), leader.element);
                leaderRect = util_1.rects.boundingScrollRect(leader.element);
                const [newStart, newEnd] = getLeaderStartEnd(block, blockRect, leader, leaderRect, ltr, textAlign);
                const newEndWidth = newEnd - parseFloat(ltr ? blockStyle.paddingRight : blockStyle.paddingLeft);
                if (newEndWidth < 0.1) {
                    leader.element.previousElementSibling.remove();
                    leaderRect = util_1.rects.boundingScrollRect(leader.element);
                }
                else {
                    start = newStart;
                    end = newEnd;
                    endWidth = newEndWidth;
                }
            }
            const space = blockRect.width - end - start;
            leader.element.style.width = Math.floor(space * 10) / 10 - 1 + 'px';
            const leaderEnd = leader.element.appendChild(document.createElement('ps-leader-end'));
            if (blockStyle.direction == 'ltr')
                leaderEnd.style.marginRight = -(endWidth) + 'px';
            else
                leaderEnd.style.marginLeft = -(endWidth) + 'px';
            let endText = '';
            let endPatternCount = endWidth / patternWidth;
            if (endPatternCount / Math.floor(endPatternCount) < 1.01)
                endPatternCount--;
            for (let i = 0; i < endPatternCount; i++)
                endText += leader.pattern;
            leaderEnd.textContent = endText;
            let leaderText = '';
            const patternCount = Math.floor(space / patternWidth);
            for (let i = 0; i < patternCount; i++)
                leaderText += leader.pattern;
            leader.element.appendChild(document.createTextNode(leaderText));
            if (leader.element.scrollWidth > leader.element.clientWidth) {
                leader.element.lastChild.nodeValue = leaderText.slice(0, -1);
            }
            // Restoration of the initial alignement
            if (initialTextAlign == 'justify') {
                block.style.textAlign = '';
            }
        }
    }
}
exports.setLeaders = setLeaders;
function getLeaderStartEnd(block, blockRect, leader, leaderRect, ltr, textAlign) {
    const start = ltr ? leaderRect.left - blockRect.left : blockRect.right - leaderRect.right;
    if (textAlign == 'start')
        block.style.textAlign = 'end';
    else if (textAlign == 'end')
        block.style.textAlign = 'start';
    else if (textAlign == 'left')
        block.style.textAlign = 'right';
    else if (textAlign)
        block.style.textAlign = 'left';
    const leaderRectInverse = util_1.rects.boundingScrollRect(leader.element);
    const end = ltr ? blockRect.right - leaderRectInverse.right : leaderRectInverse.left - blockRect.left;
    block.style.textAlign = textAlign;
    return [start, end];
}
function checkTarget(hrefAttr, mustExists = true) {
    const targetId = hrefAttr[0] == '#' && hrefAttr.substr(1);
    if (!targetId) {
        util_1.logger.warn(`Invalid target-counter() content function call : the url fragment is empty.`);
        return null;
    }
    if (mustExists && !document.getElementById(targetId)) {
        util_1.logger.warn(`Invalid target-counter() content function call : the target does not exist.`);
        return null;
    }
    return targetId;
}
function isFloatCall(elem) {
    return elem.localName == 'a' && elem.hasAttribute('ps-float-call');
}
exports.isFloatCall = isFloatCall;

},{"./counters":3,"./css":4,"./util":19,"postcss-value-parser":31}],10:[function(require,module,exports){
"use strict";
/**
* @file This file is an Typescript adaptation of the Hypher library
* @see {@link https://github.com/bramstein/hypher|Hypher GitHub project page}
* @license
* Copyright (c) 2011, Bram Stein
* All rights reserved.

 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:

 *  1. Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *  2. Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *  3. The name of the author may not be used to endorse or promote products
 *     derived from this software without specific prior written permission.

 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR "AS IS" AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
 * EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Hypher = void 0;
// eslint-disable-next-line no-misleading-character-class
const wordSplitRE = /([a-zA-Z0-9_\u0027\u00AD\u00DF-\u00EA\u00EB\u00EC-\u00EF\u00F1-\u00F6\u00F8-\u00FD\u0101\u0103\u0105\u0107\u0109\u010D\u010F\u0111\u0113\u0117\u0119\u011B\u011D\u011F\u0123\u0125\u012B\u012F\u0131\u0135\u0137\u013C\u013E\u0142\u0144\u0146\u0148\u0151\u0153\u0155\u0159\u015B\u015D\u015F\u0161\u0165\u016B\u016D\u016F\u0171\u0173\u017A\u017C\u017E\u017F\u0219\u021B\u02BC\u0390\u03AC-\u03CE\u03F2\u0401\u0410-\u044F\u0451\u0454\u0456\u0457\u045E\u0491\u0531-\u0556\u0561-\u0587\u0902\u0903\u0905-\u090B\u090E-\u0910\u0912\u0914-\u0928\u092A-\u0939\u093E-\u0943\u0946-\u0948\u094A-\u094D\u0982\u0983\u0985-\u098B\u098F\u0990\u0994-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BE-\u09C3\u09C7\u09C8\u09CB-\u09CD\u09D7\u0A02\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A14-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A82\u0A83\u0A85-\u0A8B\u0A8F\u0A90\u0A94-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABE-\u0AC3\u0AC7\u0AC8\u0ACB-\u0ACD\u0B02\u0B03\u0B05-\u0B0B\u0B0F\u0B10\u0B14-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3E-\u0B43\u0B47\u0B48\u0B4B-\u0B4D\u0B57\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB5\u0BB7-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C02\u0C03\u0C05-\u0C0B\u0C0E-\u0C10\u0C12\u0C14-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3E-\u0C43\u0C46-\u0C48\u0C4A-\u0C4D\u0C82\u0C83\u0C85-\u0C8B\u0C8E-\u0C90\u0C92\u0C94-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBE-\u0CC3\u0CC6-\u0CC8\u0CCA-\u0CCD\u0D02\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D28\u0D2A-\u0D39\u0D3E-\u0D43\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D60\u0D61\u0D7A-\u0D7F\u1F00-\u1F07\u1F10-\u1F15\u1F20-\u1F27\u1F30-\u1F37\u1F40-\u1F45\u1F50-\u1F57\u1F60-\u1F67\u1F70-\u1F7D\u1F80-\u1F87\u1F90-\u1F97\u1FA0-\u1FA7\u1FB2-\u1FB4\u1FB6\u1FB7\u1FBD\u1FBF\u1FC2-\u1FC4\u1FC6\u1FC7\u1FD2\u1FD3\u1FD6\u1FD7\u1FE2-\u1FE7\u1FF2-\u1FF4\u1FF6\u1FF7\u200D\u2019]+)/gi;
const slashSpaceRE = /\s+\/|\/\s+/;
/**
 * @constructor
 * @param {!{patterns: !Object, leftmin: !number, rightmin: !number}} language The language pattern file. Compatible with Hyphenator.js.
 */
class Hypher {
    constructor(language) {
        this.exceptions = {};
        this.trie = this._createTrie(language.patterns);
        this.leftMin = language.leftmin;
        this.rightMin = language.rightmin;
        if (language.exceptions) {
            const exceptions = language.exceptions.split(/,\s?/g);
            for (const except of exceptions) {
                this.exceptions[except.replace(/\u2027/g, '').toLowerCase()] = new RegExp('(' + except.split('\u2027').join(')(') + ')', 'i');
            }
        }
    }
    /**
     * Creates a trie from a language pattern.
     * @private
     * @param patternObject An object with language patterns.
     * @return An object trie.
     */
    _createTrie(patternObject) {
        const tree = {};
        for (const size in patternObject) {
            if (patternObject.hasOwnProperty(size)) {
                const patterns = patternObject[size].match(new RegExp('.{1,' + (+size) + '}', 'g'));
                for (const pattern of patterns) {
                    const chars = pattern.replace(/[0-9]/g, '').split('');
                    const points = pattern.split(/\D/);
                    let t = tree;
                    for (const c of chars) {
                        const codePoint = c.charCodeAt(0);
                        if (!t[codePoint]) {
                            t[codePoint] = {};
                        }
                        t = t[codePoint];
                    }
                    t._points = [];
                    for (let p = 0; p < points.length; p++) {
                        t._points[p] = parseInt(points[p]) || 0;
                    }
                }
            }
        }
        return tree;
    }
    /**
     * Hyphenates a text.
     *
     * @param str The text to hyphenate.
     * @param minLength Minimum length of the text to hyphenate
     * @return The same text with soft hyphens inserted in the right positions.
     */
    hyphenateText(str, minLength = 4) {
        // Regexp("\b", "g") splits on word boundaries,
        // compound separators and ZWNJ so we don't need
        // any special cases for those characters. Unfortunately
        // it does not support unicode word boundaries, so
        // we implement it manually.
        const words = str.split(wordSplitRE);
        for (let i = 0; i < words.length; i++) {
            if (words[i].includes('/')) {
                // Don't insert a zero width space if the slash is at the beginning or end
                // of the text, or right after or before a space.
                if (i !== 0 && i !== words.length - 1 && !(slashSpaceRE.test(words[i]))) {
                    words[i] += '\u200B';
                }
            }
            else if (words[i].length > minLength) {
                words[i] = this.hyphenate(words[i]).join('\u00AD');
            }
        }
        return words.join('');
    }
    /**
     * Hyphenates a word.
     *
     * @param word The word to hyphenate
     * @return An array of word fragments indicating valid hyphenation points.
     */
    hyphenate(word) {
        const lowerCaseWord = word.toLowerCase();
        if (this.exceptions.hasOwnProperty(lowerCaseWord)) {
            return word.match(this.exceptions[lowerCaseWord]).slice(1);
        }
        if (word.includes('\u00AD')) {
            return [word];
        }
        word = '_' + word + '_';
        const characters = word.toLowerCase().split('');
        const originalCharacters = word.split('');
        const wordLength = characters.length;
        const points = [];
        const characterPoints = [];
        for (let i = 0; i < wordLength; i++) {
            points[i] = 0;
            characterPoints[i] = characters[i].charCodeAt(0);
        }
        for (let i = 0; i < wordLength; i++) {
            let node = this.trie;
            for (let j = i; j < wordLength; j++) {
                node = node[characterPoints[j]];
                if (node) {
                    const nodePoints = node._points;
                    if (nodePoints) {
                        for (let k = 0, nodePointsLength = nodePoints.length; k < nodePointsLength; k++) {
                            points[i + k] = Math.max(points[i + k], nodePoints[k]);
                        }
                    }
                }
                else {
                    break;
                }
            }
        }
        const result = [''];
        for (let i = 1; i < wordLength - 1; i++) {
            if (i > this.leftMin && i < (wordLength - this.rightMin) && points[i] % 2) {
                result.push(originalCharacters[i]);
            }
            else {
                result[result.length - 1] += originalCharacters[i];
            }
        }
        return result;
    }
}
exports.Hypher = Hypher;

},{}],11:[function(require,module,exports){
//eslint-disable-next-line
module.exports = require("./postscriptum").default;
},{"./postscriptum":14}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSubFragmentor = exports.removeFloats = exports.moveFloat = exports.testAvoidBreakInside = exports.testLinesOverflow = exports.testInlineOverflow = exports.testBoxOverflow = exports.updateBottomOffsets = exports.LayoutProcessor = exports.LayoutContext = exports.Box = void 0;
const gcpm_1 = require("./gcpm");
const process_1 = require("./process");
const util_1 = require("./util");
const breaks_1 = require("./breaks");
const shim_1 = require("./shim");
const css_1 = require("./css");
const valueParser = require("postcss-value-parser");
class Box {
    constructor() {
        this.range = new Range();
        this.avoidBreakBefore = false;
        this.avoidBreakAfter = false;
        this.hasInlineBlocks = false;
    }
}
exports.Box = Box;
class LayoutContext extends util_1.events.EventEmitter {
    constructor(root, body, areas, parentCtx) {
        super();
        this.boxes = [];
        this.floats = [];
        this.overflowPoint = null;
        this.overflowBox = null;
        this.mutations = new util_1.Mutations();
        this.root = root;
        this.body = body;
        this.areas = areas;
        this.parentCtx = parentCtx;
        this.bottomOffsets = this.parentCtx ? this.parentCtx.bottomOffsets : new Map();
    }
    get bodyBottom() {
        if (!this._bodyBottom)
            this._bodyBottom = util_1.rects.boundingScrollRect(this.body).bottom;
        return this._bodyBottom;
    }
    set bodyBottom(val) {
        if (val != this._bodyBottom) {
            const oldBottom = this._bodyBottom;
            this._bodyBottom = val;
            this.emit({ type: "body-bottom-change", oldBottom, newBottom: this._bodyBottom });
        }
    }
}
exports.LayoutContext = LayoutContext;
class LayoutProcessor extends process_1.Processor {
    constructor(source, options) {
        super(options);
        this.subProcessors = [];
        this.gcpmContext = new gcpm_1.GCPMContext();
        this.layoutContext = null;
        this.avoidBreakTypes = ['avoid'];
        this.logNoValidBreakPoint = false;
        this.source = source;
        this.doc = this.source.ownerDocument;
        shim_1.default(this.source.ownerDocument.defaultView);
    }
    get mutations() {
        util_1.logger.debug("LayoutProcessor.mutations deprecated. Please use LayoutContext.mutations");
        return this.layoutContext && this.layoutContext.mutations;
    }
    addSubProcessor(subProcessor) {
        this.subProcessors.push(subProcessor);
        return this;
    }
    *contentsProcess(root, areas, parentCtx) {
        if (this.listenerCount('contents-start'))
            yield { type: 'contents-start' };
        let step = 'detect-overflow';
        let event, defaultNextStep;
        let ctx = null;
        do {
            if (step == 'detect-overflow') {
                ctx = this.layoutContext = this.createLayoutContext(root, areas, parentCtx);
                if (this.gcpmContext.pendingFloats.length) {
                    const pendingFloats = this.gcpmContext.pendingFloats.splice(0);
                    for (const float of pendingFloats)
                        moveFloat(float, this.layoutContext, this.gcpmContext);
                }
                yield* this.boxesProcess(root);
                // A subfragmentor (ie columns) can return a break point at this stage
                if ('breakPoint' in ctx) {
                    event = 'valid-break-point';
                    defaultNextStep = 'break-point-found';
                }
                else {
                    if (ctx.overflowPoint) {
                        ctx.breakPoint = util_1.ranges.clonePoint(ctx.overflowPoint);
                        ctx.breakedBox = ctx.overflowBox;
                        defaultNextStep = 'validate-break-point';
                        event = 'overflow-detected';
                    }
                    else {
                        ctx.breakPoint = util_1.ranges.positionAfter(root.lastChild);
                        ctx.breakedBox = null;
                        event = 'no-overflow';
                        defaultNextStep = 'break-point-found';
                    }
                }
            }
            else if (step == 'validate-break-point') {
                const future = validBreakPoint(ctx, this.avoidBreakTypes);
                if (typeof future != 'boolean' && util_1.ranges.pointEquals(future.breakPoint, ctx.breakPoint))
                    throw new Error("Loop on break point validation");
                if (!future) {
                    defaultNextStep = 'no-break-point';
                    event = 'no-break-point';
                    const lastBox = ctx.boxes[ctx.boxes.length - 1];
                    const firstBoxIdx = ctx.boxes.findIndex((box) => !box.isRepeated);
                    if (ctx.boxes.length - 1 > firstBoxIdx) {
                        ctx.breakPoint = util_1.ranges.rangeStart(lastBox.range);
                        ctx.breakedBox = lastBox;
                    }
                    else {
                        ctx.breakPoint = util_1.ranges.rangeEnd(lastBox.range);
                        ctx.breakedBox = null;
                    }
                }
                else if (future === true) {
                    defaultNextStep = 'break-point-found';
                    event = 'valid-break-point';
                }
                else {
                    ctx.breakPoint = future.breakPoint;
                    ctx.breakedBox = future.breakedBox;
                    removeFloats(ctx.floats, ctx.breakPoint);
                    event = 'new-break-point-to-valid';
                    defaultNextStep = 'validate-break-point';
                }
            }
            else if (step == 'no-break-point') {
                if (this.logNoValidBreakPoint)
                    util_1.logger.warn('No valid break point found.');
                defaultNextStep = 'break-point-found';
            }
            step = event && this.listenerCount(event) ? yield { type: event, layoutContext: ctx } : null;
            if (!step)
                step = defaultNextStep;
        } while (step != 'break-point-found');
        if (this.listenerCount('contents-end'))
            yield { type: 'contents-end' };
        return event;
    }
    *boxesProcess(root) {
        const doc = root.ownerDocument;
        const ctx = this.layoutContext;
        const bottomOffsetsStack = ctx.bottomOffsets.has(root.parentElement) ? [ctx.bottomOffsets.get(root.parentElement)] : [];
        const bottomOffset = updateBottomOffsets(bottomOffsetsStack, getComputedStyle(root), css_1.getCustomStyle(root));
        ctx.bottomOffsets.set(root, bottomOffset);
        // TODO DisplayedOrderTreeWalker to handle flex box and table captions?
        const nodes = util_1.walk.createWalker(root, util_1.walk.isStaticNode);
        nodes.nextNode();
        let box = new Box();
        box.range.setStartBefore(root.firstChild);
        const filledAreas = new Set();
        const subFragmentorCtx = {
            layoutContext: ctx,
            nodes,
            areas: ctx.areas,
            currentElement: null,
            currentCustomStyle: null,
            currentStyle: null,
            currentBox: box
        };
        const onBoxEnd = (box, isBlock) => {
            ctx.boxes.push(box);
            box.bottomOffset = isBlock ? bottomOffsetsStack.pop() : bottomOffsetsStack[bottomOffsetsStack.length - 1];
            ctx.overflowPoint = testBoxOverflow(box, ctx.bodyBottom);
            if (box.floats && box.floats.length) {
                for (const float of box.floats) {
                    if (float && !filledAreas.has(float.areaName)) {
                        const filled = !moveFloat(float, ctx, this.gcpmContext, box);
                        if (filled)
                            filledAreas.add(float.areaName);
                    }
                }
            }
            if (ctx.overflowPoint)
                ctx.overflowBox = box;
            return ctx.overflowPoint;
        };
        function newBox(nextIsBlock) {
            box = new Box();
            subFragmentorCtx.currentBox = box;
            box.range.setStartBefore(nodes.currentNode);
            if (nextIsBlock)
                box.startBlock = nodes.currentNode;
        }
        while (true) {
            let isBlock = false;
            if (nodes.currentNode.nodeType == Node.ELEMENT_NODE) {
                let currentElt = nodes.currentNode;
                subFragmentorCtx.currentElement = currentElt;
                if (currentElt.localName == 'ps-debugger')
                    debugger;
                if (gcpm_1.isFloatCall(currentElt)) {
                    const float = this.gcpmContext.floats.get(currentElt.previousElementSibling);
                    if (!box.floats)
                        box.floats = [];
                    box.floats.push(float);
                    ctx.floats.push(float);
                }
                let style = subFragmentorCtx.currentStyle = getComputedStyle(currentElt);
                let customStyle = subFragmentorCtx.currentCustomStyle = css_1.getCustomStyle(currentElt);
                isBlock = util_1.walk.displayAsBlockStyle(style);
                if (isBlock) {
                    if (!box.startBlock)
                        box.startBlock = currentElt;
                    box.endBlock = currentElt;
                    box.mainBlock = currentElt;
                    const bottomOffset = updateBottomOffsets(bottomOffsetsStack, style, customStyle);
                    ctx.bottomOffsets.set(currentElt, bottomOffset);
                    if (!box.avoidBreakBefore)
                        box.avoidBreakBefore = this.avoidBreakTypes.includes(css_1.getCustomProp(customStyle, 'break-before'));
                    if (!box.unbreakable)
                        box.unbreakable = breaks_1.unbreakableElement(currentElt);
                    if (!box.isRepeated)
                        box.isRepeated = currentElt.hasAttribute('ps-repeated');
                    if (!this.avoidBreakTypes.includes(css_1.getCustomProp(customStyle, 'break-inside')))
                        this.fixWidth(currentElt, style, ctx);
                    for (const subFragmentor of this.subProcessors) {
                        let subResult = subFragmentor.call(this, subFragmentorCtx);
                        if (subResult) {
                            if (subResult instanceof Promise)
                                subResult = yield subResult;
                            box.unbreakable = 'subFragmentor';
                            if (subResult) {
                                // TODO The last box can be invalid due to the interruption
                                if (subResult.breakPoint) {
                                    ctx.breakPoint = subResult.breakPoint;
                                    ctx.breakedBox = box;
                                    return ctx;
                                }
                                else {
                                    if (subResult.floats)
                                        ctx.floats.push(...subResult.floats);
                                    if (subResult.overflowPoint) {
                                        ctx.overflowPoint = subResult.overflowPoint;
                                        ctx.overflowBox = box;
                                        return ctx;
                                    }
                                }
                            }
                            else {
                                break;
                            }
                        }
                    }
                    const newCurrentElt = nodes.currentNode;
                    if (newCurrentElt != currentElt) {
                        currentElt = newCurrentElt;
                        customStyle = css_1.getCustomStyle(currentElt);
                        style = getComputedStyle(currentElt);
                        isBlock = util_1.walk.displayAsBlockStyle(style);
                        if (isBlock)
                            box.endBlock = currentElt;
                    }
                    if (!box.avoidBreakAfter)
                        box.avoidBreakAfter = box.isRepeated || this.avoidBreakTypes.includes(css_1.getCustomProp(customStyle, 'break-after'));
                }
            }
            let isInlineBlock = false;
            if (!isBlock) {
                // Not a block : creation of the inline range
                if (!box.inlinesRange) {
                    box.inlinesRange = doc.createRange();
                    box.inlinesRange.setStartBefore(nodes.currentNode);
                    box.inlinesStartBoundary = true;
                }
                // The inline end boundary is updated at each node
                box.inlinesRange.setEndAfter(nodes.currentNode);
                if (util_1.walk.isInlineBlockElement(nodes.currentNode)) {
                    isInlineBlock = true;
                    box.hasInlineBlocks = true;
                }
            }
            const replaced = box.unbreakable == 'replacedElement' || box.unbreakable == 'subFragmentor';
            if (replaced || isInlineBlock || !nodes.firstChild()) {
                while (!nodes.nextSibling()) {
                    const parentElement = nodes.parentNode();
                    isBlock = !parentElement || util_1.walk.displayAsBlock(parentElement);
                    if (parentElement && !box.avoidBreakAfter)
                        box.avoidBreakAfter = this.avoidBreakTypes.includes(css_1.getCustomProp(parentElement, 'break-after'));
                    if (nodes.currentNode == root) {
                        box.range.setEndAfter(root.lastChild);
                        onBoxEnd(box, isBlock);
                        return ctx;
                    }
                    else {
                        box.endBlock = parentElement;
                    }
                }
                if (box.inlinesRange)
                    box.inlinesStartBoundary = false;
                const nextIsBlock = util_1.walk.displayAsBlock(nodes.currentNode);
                if (!isBlock && nextIsBlock) {
                    box.mainBlock = null;
                }
                if (isBlock || nextIsBlock) {
                    box.range.setEndBefore(nodes.currentNode);
                    if (onBoxEnd(box, isBlock))
                        return ctx;
                    newBox(nextIsBlock);
                }
            }
            else if (!isBlock && !box.inlinesStartBoundary && util_1.walk.displayAsBlock(nodes.currentNode)) {
                // Case where the first descendant of an inline is a block
                box.mainBlock = box.endBlock = null;
                box.range.setEndBefore(nodes.currentNode);
                box.inlinesRange.setEndBefore(nodes.currentNode);
                if (onBoxEnd(box, isBlock))
                    return ctx;
                newBox(true);
            }
        }
        return ctx;
    }
    createLayoutContext(root, areas, parentCtx) {
        return new LayoutContext(root, root, areas, parentCtx);
    }
    fixWidth(elem, style, ctx) {
        if (elem.hasAttribute('ps-fixed-width'))
            return;
        let fixed = false;
        // On tables, the width is fixed by setting the colgroup/col widths and and a min width
        if (elem instanceof HTMLTableElement) {
            const caption = elem.caption == elem.firstElementChild && elem.caption;
            let colgroup = caption ? caption.nextElementSibling : elem.firstElementChild;
            const firstRowCells = Array.from(elem.rows[0].cells);
            const colCount = firstRowCells.reduce((count, cell) => count + cell.colSpan, 0);
            const widths = new Map();
            if (colgroup.localName == 'colgroup') {
                if (colCount != colgroup.children.length) {
                    util_1.logger.warn("Invalid colgroup/col count. The width of the table cannot be fixed.");
                    return;
                }
                for (let i = 0; i < colCount; i++) {
                    const col = colgroup.children.item(i);
                    const width = col.style.width;
                    if (!width || width.endsWith('%'))
                        widths.set(i, -1);
                }
            }
            else {
                // Creation of the colgroup if he does not exist
                colgroup = this.doc.createElement('colgroup');
                elem.insertBefore(colgroup, caption.nextElementSibling || elem.firstElementChild);
                for (let i = 0; i < colCount; i++) {
                    colgroup.appendChild(this.doc.createElement('col'));
                    widths.set(i, -1);
                }
                ctx.mutations.push({
                    colgroup,
                    revert() {
                        this.colgroup.remove();
                    }
                });
            }
            let widthCount = widths.size;
            if (widthCount) {
                for (const row of elem.rows) {
                    for (let i = 0, iCol = 0; i < row.cells.length && widthCount; i++) {
                        const cell = row.cells[i];
                        if (cell.colSpan == 1 && widths.get(iCol) == -1) {
                            widths.set(iCol, cell.getBoundingClientRect().width);
                            widthCount--;
                        }
                        iCol += cell.colSpan;
                    }
                    if (!widthCount)
                        break;
                }
                for (let i = 0; i < colCount; i++) {
                    const width = widths.get(i);
                    if (width != -1) {
                        const col = colgroup.children.item(i);
                        ctx.mutations.setStyle(col, { width: width + 'px' });
                    }
                }
            }
            this.mutations.setStyle(elem, { 'min-width': style.width });
            fixed = true;
        }
        else if (elem.localName != 'tr' && util_1.walk.isRow(style)) {
            const widths = new Map();
            for (const cell of elem.children) {
                if (util_1.walk.isStatic(cell))
                    widths.set(cell, getComputedStyle(cell).width);
            }
            for (const [cell, width] of widths)
                ctx.mutations.setStyle(cell, { width });
            fixed = true;
        }
        if (fixed)
            ctx.mutations.setAttr(elem, 'ps-fixed-width');
    }
}
exports.LayoutProcessor = LayoutProcessor;
LayoutProcessor.defaultOptions = process_1.Processor.defaultOptions;
function updateBottomOffsets(bottomOffsets, style, customStyle) {
    const lastBottomOffset = bottomOffsets[bottomOffsets.length - 1];
    const boxDecorationBreak = css_1.getCustomProp(customStyle, 'box-decoration-break');
    const { inside: lastInside, currentMargin: lastCurrentMargin } = lastBottomOffset || { inside: 0, currentMargin: 0 };
    let bottomOffset = {
        after: lastInside,
        inside: lastInside,
        currentMargin: 0
    };
    const marginBreak = css_1.getCustomProp(customStyle, 'margin-break');
    if (marginBreak == 'keep')
        bottomOffset.currentMargin = Math.max(parseFloat(style.marginBottom), lastCurrentMargin);
    let decoration = 0;
    if (boxDecorationBreak == 'clone') {
        decoration += parseFloat(style.paddingBottom);
        if (style.borderBottomStyle != 'none') {
            decoration += parseFloat(style.borderBottomWidth);
            if (style.display == 'table' && style.borderCollapse == 'separate') {
                const spacing = parseFloat(style.borderSpacing.split(' ')[1]);
                if (spacing)
                    decoration += spacing;
            }
        }
    }
    if (decoration) {
        bottomOffset.after += bottomOffset.currentMargin;
        bottomOffset.inside += decoration + bottomOffset.currentMargin;
        bottomOffset.currentMargin = 0;
    }
    if (lastBottomOffset && Object.keys(bottomOffset).every((key) => bottomOffset[key] == lastBottomOffset[key]))
        bottomOffset = lastBottomOffset;
    else
        Object.freeze(bottomOffset);
    bottomOffsets.push(bottomOffset);
    return bottomOffset;
}
exports.updateBottomOffsets = updateBottomOffsets;
// TODO Should we handle by custom prop les orphans/widows? Some special values (inherit, initial, unset) are not computable and the native values can be useful for native columns.
// TODO Do not cut between an element and a preceding float
function validBreakPoint(ctx, avoidBreakValues) {
    const doc = ctx.body.ownerDocument;
    const view = ctx.body.ownerDocument.defaultView;
    const boxIndex = util_1.ranges.findPointInRanges(ctx.boxes.map((box) => box.range), ctx.breakPoint, true);
    if (boxIndex == -1)
        throw new Error("Box of the break point not found.");
    let box = ctx.boxes[boxIndex];
    function boxStartBreak(box) {
        return { breakPoint: util_1.ranges.rangeStart(box.range), breakedBox: box };
    }
    // Test of the break-inside
    const avoidedBreakInside = testAvoidBreakInside(ctx.breakPoint.container, ctx, avoidBreakValues, ctx.breakPoint);
    if (avoidedBreakInside) {
        const beforeAvoidBreakInside = util_1.ranges.positionBefore(avoidedBreakInside);
        const rootPoint = util_1.ranges.positionBefore(ctx.root);
        if (util_1.ranges.pointEquals(beforeAvoidBreakInside, rootPoint) || util_1.ranges.isPrecedingPoint(rootPoint, beforeAvoidBreakInside))
            return false;
        const avoidedBreakBoxIndex = util_1.ranges.findPointInRanges(ctx.boxes.map((box) => box.range), beforeAvoidBreakInside, true);
        return boxStartBreak(ctx.boxes[avoidedBreakBoxIndex]);
    }
    // Point at the beginning of the box: we test the pages-break-before / avoid of the previous one
    if (ctx.breakPoint.container == box.range.startContainer && ctx.breakPoint.offset == box.range.startOffset) {
        const previousBox = boxIndex > 0 && ctx.boxes[boxIndex - 1];
        if (!previousBox)
            return false;
        if (box.avoidBreakBefore || previousBox.avoidBreakAfter) {
            // If the previous box has an inline we continue the treatment on this box
            if (previousBox.inlinesRange) {
                box = previousBox;
                ctx.breakPoint = util_1.ranges.rangeEnd(previousBox.inlinesRange);
            }
            else {
                return boxStartBreak(previousBox);
            }
        }
        else {
            return true;
        }
    }
    if (box.unbreakable)
        return boxStartBreak(box);
    const textBreak = box.inlinesRange && box.inlinesRange.isPointInRange(ctx.breakPoint.container, ctx.breakPoint.offset);
    if (textBreak) {
        if (ctx.breakPoint.offset == 0 && util_1.walk.firstChild(box.inlinesRange.startContainer, util_1.walk.isStaticNode) == ctx.breakPoint.container)
            return boxStartBreak(box);
        // Break in a text node
        const startRange = doc.createRange();
        startRange.setStart(box.inlinesRange.startContainer, box.inlinesRange.startOffset);
        startRange.setEnd(ctx.breakPoint.container, ctx.breakPoint.offset);
        const style = getComputedStyle(box.inlinesRange.commonAncestorContainer);
        const startLines = util_1.rects.rectsLines(startRange.getClientRects(), view);
        if (!startLines.length)
            return boxStartBreak(box);
        // Firefox does not support orphans and widows, we use CSS variables for them
        const orphans = parseInt(style.getPropertyValue('--ps-orphans'));
        if (startLines.length < orphans)
            return boxStartBreak(box);
        const widows = parseInt(style.getPropertyValue('--ps-widows'));
        if (widows > 0) {
            const endRange = doc.createRange();
            endRange.setStart(ctx.breakPoint.container, ctx.breakPoint.offset);
            endRange.setEnd(box.inlinesRange.endContainer, box.inlinesRange.endOffset);
            const endLines = util_1.rects.rectsLines(endRange.getClientRects(), view);
            // TODO If there is a pseudo-element immediately before the break point and on the same line, startLines incorrectly includes this line.
            // TODO So, we cannot use startLines to identify the missing line for widows: we works on all the lines of the inlines range.: we works on all the lines of the inlines range.
            const lines = util_1.rects.rectsLines(box.inlinesRange.getClientRects(), view);
            const missingLineCount = widows - endLines.length;
            if (missingLineCount > 0) {
                const missingLineIndex = lines.length - endLines.length - missingLineCount;
                if (missingLineIndex < orphans)
                    return boxStartBreak(box);
                else {
                    const line = lines[missingLineIndex - 1];
                    const direction = getComputedStyle(box.mainBlock || util_1.walk.ancestorOrSelf(box.range.commonAncestorContainer, util_1.walk.isElement)).direction;
                    box.inlineStart = direction == 'ltr' ? Math.ceil(line.left) : Math.floor(line.right);
                    const linePoint = testLinesOverflow(box, startLines, Math.ceil(line.bottom));
                    return { breakPoint: linePoint, breakedBox: box };
                }
            }
        }
    }
    else {
        // TODO Should not happen, warning?
        return boxStartBreak(box);
    }
    return true;
}
// TODO Should we handle the textPosition in unbreakable inline elements?
function testBoxOverflow(box, bodyBottom) {
    if (box.mainBlock || !box.inlinesRange) {
        const startBlockRect = util_1.rects.boundingScrollRect(box.startBlock);
        box.top = startBlockRect.top;
        if (box.startBlock == box.endBlock)
            box.bottom = startBlockRect.bottom;
        else {
            box.bottom = util_1.rects.boundingScrollRect(box.endBlock).bottom;
            // In some case (negative margins), the start block bottom can be bigger than the end block bottom
            // TODO The intermediate block bottoms between the end and the start are not handled
            if (box.endBlock.contains(box.startBlock) && startBlockRect.bottom > box.bottom)
                box.bottom = startBlockRect.bottom;
        }
    }
    else {
        box.inlinesRangeRect = util_1.rects.boundingScrollRect(box.inlinesRange);
        box.bottom = box.inlinesRangeRect.bottom;
        box.top = box.inlinesRangeRect.top;
    }
    const maxBottom = bodyBottom - box.bottomOffset.after - box.bottomOffset.currentMargin;
    if (box.bottom > maxBottom) {
        let overflowPoint = util_1.ranges.rangeStart(box.range);
        // In some case (arabic with ltr direction...), the text position may be invalid if the top of the box is too close to the bottom of the body.
        // Inlines are not tested if there is less than 4px between the top of the box and the maxBottom
        // TODO Arbitrary, 1px is not enough, should be based on the fontSize but avoided for performances (getComputedStyle)
        if (!box.unbreakable && box.inlinesRange && maxBottom - box.top >= 4)
            overflowPoint = testInlineOverflow(box, maxBottom);
        return overflowPoint;
    }
    return null;
}
exports.testBoxOverflow = testBoxOverflow;
function testInlineOverflow(box, bodyBottom, maxBottom) {
    if (!maxBottom)
        maxBottom = bodyBottom - box.bottomOffset.inside - box.bottomOffset.currentMargin;
    if (!box.inlinesRangeRect)
        box.inlinesRangeRect = util_1.rects.boundingScrollRect(box.inlinesRange);
    // The maxBottom can occur between the box bottom and the inline range even if there is no padding
    if (box.inlinesRangeRect.bottom < maxBottom)
        return util_1.ranges.rangeEnd(box.inlinesRange);
    if (!box.inlineStart) {
        const direction = getComputedStyle(box.mainBlock || util_1.walk.ancestorOrSelf(box.range.commonAncestorContainer, util_1.walk.isElement)).direction;
        box.inlineStart = direction == 'ltr' ? Math.ceil(box.inlinesRangeRect.left) : Math.floor(box.inlinesRangeRect.right);
    }
    /*
     * TODO Chrome 97 returns the start of the text node if the test is done for the integer matching line.top.
     * In other words, it rounds up the start of the line.top and fail to return the previous line if less than that round.
     * Therefore, we are obliged to run through all the line to not fail in this case.
     */
    const lines = util_1.rects.rectsLines(box.inlinesRange.getClientRects(), box.inlinesRange.startContainer.ownerDocument.defaultView);
    if (lines.length <= 1)
        return util_1.ranges.rangeStart(box.range);
    return testLinesOverflow(box, lines, maxBottom);
}
exports.testInlineOverflow = testInlineOverflow;
function testLinesOverflow(box, lines, maxBottom) {
    const doc = box.range.commonAncestorContainer.ownerDocument;
    /*
     * TODO Chrome 97 returns the start of the text node if the test is done for the integer matching line.top.
     * In other words, it rounds up the start of the line.top and fail to return the previous line if less than that round.
     * Therefore, we are obliged to run through all the line to not fail in this case.
     */
    for (let i = 0; i <= lines.length; i++) {
        const line = lines[i];
        let overflowLine;
        // Overflow between the last line and the end of the box
        if (i == lines.length)
            overflowLine = lines[i - 1];
        else if (line.bottom > Math.ceil(maxBottom)) {
            if (i === lines.length - 1 || lines[i + 1].top > Math.ceil(maxBottom))
                overflowLine = line;
        }
        if (overflowLine) {
            let overflowPoint = util_1.ranges.textPositionFromPoint(doc, box.inlineStart, Math.ceil(overflowLine.top) + 2);
            if (!overflowPoint)
                return util_1.ranges.rangeStart(box.range);
            else if (!util_1.ranges.containsPoint(box.inlinesRange, overflowPoint)) {
                overflowPoint = util_1.ranges.textPositionFromPoint(doc, box.inlineStart, Math.ceil(overflowLine.top));
            }
            if (!util_1.ranges.containsPoint(box.inlinesRange, overflowPoint)) {
                util_1.logger.warn("Overflowing text position outside of the box inline range.");
                return util_1.ranges.rangeStart(box.range);
            }
            else {
                // Case of a break at the beginning of an inline
                if (overflowPoint.container.nodeType == Node.TEXT_NODE && overflowPoint.offset == 0)
                    overflowPoint = util_1.ranges.positionBefore(overflowPoint.container);
                const nodeAtPoint = util_1.ranges.nodeAtPoint(overflowPoint) || overflowPoint.container;
                if (util_1.walk.isElement(nodeAtPoint) && gcpm_1.isFloatCall(nodeAtPoint))
                    overflowPoint = util_1.ranges.positionBefore(nodeAtPoint.previousElementSibling);
                if (box.hasInlineBlocks) {
                    let parent = nodeAtPoint;
                    while (parent != (box.mainBlock || box.range.commonAncestorContainer)) {
                        if (util_1.walk.displayAsInlineBlock(parent)) {
                            overflowPoint = util_1.ranges.positionBefore(parent);
                            break;
                        }
                        parent = parent.parentElement;
                    }
                }
                return overflowPoint;
            }
        }
    }
}
exports.testLinesOverflow = testLinesOverflow;
function testAvoidBreakInside(fromNode, ctx, avoidBreakValues, breakPoint, heightAtBreakElem = false) {
    let parent = fromNode.nodeType == Node.TEXT_NODE ? fromNode.parentElement : fromNode;
    let rootBodyHeight;
    function getRootBodyHeight() {
        if (!rootBodyHeight) {
            let rootCtx = ctx;
            while (rootCtx.parentCtx)
                rootCtx = rootCtx.parentCtx;
            rootBodyHeight = rootCtx.body.getBoundingClientRect().height;
        }
        return rootBodyHeight;
    }
    while (parent && parent != ctx.body.parentNode) {
        if (util_1.walk.displayAsBlock(parent)) {
            const breakInside = css_1.getCustomProp(parent, 'break-inside');
            if (breakInside != "auto") {
                let avoidInside = avoidBreakValues.includes(breakInside) && !parent.hasAttribute("ps-breaked-before");
                if (!avoidInside) {
                    const firstVal = valueParser(breakInside).nodes[0];
                    if (firstVal.type == 'function' && firstVal.value == '-ps-avoid-if-below') {
                        const elemThreshold = css_1.computeLength(firstVal.nodes[0].value, getRootBodyHeight());
                        if (elemThreshold) {
                            if (parent.scrollHeight - 1 < elemThreshold)
                                avoidInside = true;
                        }
                        if (!avoidInside && breakPoint && firstVal.nodes.length > 2) {
                            const beforeBreakThreshold = css_1.computeLength(firstVal.nodes[2].value, parent.getBoundingClientRect().height);
                            if (beforeBreakThreshold) {
                                if (heightAtBreakElem) {
                                    const breakElem = util_1.ranges.nodeAtPoint(breakPoint);
                                    const height = breakElem.getBoundingClientRect().top - parent.getBoundingClientRect().top;
                                    if (height - 1 < beforeBreakThreshold)
                                        avoidInside = true;
                                    heightAtBreakElem = false;
                                }
                                else {
                                    const range = document.createRange();
                                    range.setStartBefore(parent);
                                    range.setEnd(breakPoint.container, breakPoint.offset);
                                    if (range.getBoundingClientRect().height - 1 < beforeBreakThreshold)
                                        avoidInside = true;
                                }
                            }
                        }
                    }
                }
                if (avoidInside)
                    return parent;
            }
        }
        parent = parent.parentElement;
    }
    return false;
}
exports.testAvoidBreakInside = testAvoidBreakInside;
// TODO Find a better way to modify/return the overflowPoint and rootBottom
function moveFloat(float, ctx, gcpmContext, box) {
    if (ctx.overflowPoint && util_1.ranges.isPrecedingPoint(util_1.ranges.positionBefore(float.call), ctx.overflowPoint))
        return false;
    let floatCallRect = util_1.rects.boundingScrollRect(float.call);
    if (floatCallRect.bottom >= ctx.bodyBottom)
        return false;
    const area = ctx.areas[float.areaName];
    if (!area) {
        gcpmContext.pendingFloats.push(float);
        return false;
    }
    const areaCtx = layoutCtxFromArea(ctx, area);
    if (area.lastChild && area.lastChild.nodeType != Node.TEXT_NODE)
        area.appendChild(document.createTextNode(' '));
    area.appendChild(float.body);
    const areaRect = util_1.rects.boundingScrollRect(area);
    const areaBody = areaCtx.body;
    const areaBodyRect = util_1.rects.boundingScrollRect(areaBody);
    if (!float.placement || float.placement == 'baseline') {
        // TODO Mutation to revert the marginTop ?
        float.body.style.marginTop = '';
        floatCallRect = util_1.rects.boundingScrollRect(float.call);
        let floatBodyRect = util_1.rects.boundingScrollRect(float.body);
        const verticalArea = (areaRect.left < areaBodyRect.left && areaRect.right <= areaBodyRect.left)
            || (areaRect.right > areaBodyRect.right && areaRect.left >= areaBodyRect.right);
        if (verticalArea && floatBodyRect.top < floatCallRect.top) {
            float.body.style.marginTop = Math.max(floatCallRect.top - floatBodyRect.top, 0) + 'px';
            floatBodyRect = util_1.rects.boundingScrollRect(float.body);
        }
        if (!util_1.rects.includesRect(areaRect, floatBodyRect)) {
            gcpmContext.pendingFloats.push(float);
            float.body.remove();
            return false;
        }
    }
    else if (float.placement == 'fill') {
        // TODO Check if the container has dimensions?
        float.body.style.width = '100%';
        float.body.style.height = '100%';
    }
    else {
        throw new Error("Not implemented");
    }
    const newAreaBodyRect = util_1.rects.boundingScrollRect(areaBody);
    const eventResult = ctx.emit({ type: "float-move", float, area, areaBody, areaBodyRect, newAreaBodyRect });
    if (eventResult == 'pending')
        gcpmContext.pendingFloats.push(float);
    if (eventResult === false || eventResult == 'pending') {
        float.body.remove();
        return false;
    }
    if (box) {
        if (floatCallRect.bottom >= newAreaBodyRect.bottom) {
            float.body.remove();
            ctx.overflowPoint = testInlineOverflow(box, newAreaBodyRect.bottom, floatCallRect.top);
            return false;
        }
    }
    else if (!newAreaBodyRect.height || !newAreaBodyRect.width) {
        float.body.remove();
        return false;
    }
    /*
    let currentCtx = ctx;
    while (currentCtx.body != areaCtx.body) {
        const bodyMaxBottom = newAreaBodyRect.bottom - (currentCtx.bottomOffsets.get(areaBody).after - currentCtx.bottomOffsets.get(currentCtx.body).after);
        if (currentCtx.bodyBottom > bodyMaxBottom) currentCtx.bodyBottom = bodyMaxBottom;
        currentCtx = currentCtx.parentCtx;
    }
    */
    if (areaCtx.bodyBottom != newAreaBodyRect.bottom)
        areaCtx.bodyBottom = newAreaBodyRect.bottom;
    if (box)
        ctx.overflowPoint = testBoxOverflow(box, ctx.bodyBottom);
    ctx.mutations.push({
        floatBody: float.body,
        revert() {
            this.floatBody.remove();
        }
    });
    return true;
}
exports.moveFloat = moveFloat;
function removeFloats(floats, stopPoint) {
    for (let i = floats.length - 1; i >= 0; i--) {
        const float = floats[i];
        if (!stopPoint || util_1.ranges.isPrecedingPoint(util_1.ranges.positionBefore(float.call), stopPoint)) {
            float.body.remove();
            floats.pop();
        }
        else
            break;
    }
}
exports.removeFloats = removeFloats;
function layoutCtxFromArea(ctx, area) {
    let areaCtx = ctx;
    while (areaCtx.body.parentElement != area.parentElement)
        areaCtx = areaCtx.parentCtx;
    return areaCtx;
}
function isSubFragmentor(object) {
    return 'parentFragmentor' in object;
}
exports.isSubFragmentor = isSubFragmentor;

},{"./breaks":1,"./css":4,"./gcpm":9,"./process":16,"./shim":18,"./util":19,"postcss-value-parser":31}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPage = exports.Paginator = exports.Page = exports.Sequence = void 0;
const fragments_1 = require("./fragments");
const util_1 = require("./util");
const flow_1 = require("./flow");
const columns_1 = require("./columns");
const gcpm_1 = require("./gcpm");
const breaks_1 = require("./breaks");
const css_1 = require("./css");
const css_2 = require("./css");
/**
 * Sequence of pages
 *
 * A sequence is a set of page without a forced page break.
 */
class Sequence {
    /**
     * Sequence constructor
     *
     * @param continuousFlow  The range returned by ContinuousFlowIterator.
     */
    constructor(continuousFlow) {
        this.startPageIndex = -1;
        this.endPageIndex = -1;
        this.range = continuousFlow.range.startContainer.ownerDocument.createRange();
        this.pageName = continuousFlow.pageName;
        this.pageGroupStart = continuousFlow.pageGroupStart;
        this.breakType = continuousFlow.breakType;
        this.breakPoint = {
            container: continuousFlow.range.endContainer,
            offset: continuousFlow.range.endOffset
        };
    }
}
exports.Sequence = Sequence;
class Page extends fragments_1.Fragment {
}
exports.Page = Page;
class Paginator extends fragments_1.Fragmentor {
    constructor(options) {
        super(options && options.source || document.body, options);
        this.sequences = [];
        this.avoidBreakTypes = ['avoid', 'avoid-page'];
        this.forcedBreakTypes = ['always', 'page', 'left', 'right', 'recto', 'verso'];
        this.addSubProcessor(columns_1.columnsSubProcessor);
        this._process = this.paginationProcess();
    }
    get pages() {
        return this.fragments;
    }
    get currentPage() {
        return this.currentFragment;
    }
    set currentPage(page) {
        this.currentFragment = page;
    }
    /**
     * The main generator function of the pagination process.
     */
    *paginationProcess() {
        if (!this.source)
            throw new Error("The pagination source is undefined");
        const pendingSource = this.source.closest('[ps-process=pending]');
        if (pendingSource)
            throw new Error("Fragmentation already underway on this source.");
        if (this.source == this.source.ownerDocument.documentElement)
            throw new Error("Pagination source cannot be the document element");
        this.dest.setAttribute('ps-process', 'pending');
        if (this.listenerCount('start'))
            yield 'start';
        if (!util_1.walk.firstChild(this.source, util_1.walk.isStaticNode))
            throw new Error("The pagination source has no static child");
        const initialScroll = [window.scrollX, window.scrollY];
        // We make sure that the destination to an id
        util_1.dom.id(this.dest);
        let cssContext = css_1.cssContexts.get(this.doc);
        if (!cssContext) {
            cssContext = new css_1.CssContext(this.doc, this.options);
            css_1.cssContexts.set(this.doc, cssContext);
            yield* cssContext.process();
        }
        if (this.listenerCount('preparation-start'))
            this.emit('preparation-start');
        const nodes = util_1.walk.createIterator(this.source);
        let currentNode;
        while ((currentNode = nodes.nextNode())) {
            if (this.listenerCount('prepare'))
                this.emit({ type: 'prepare', node: currentNode });
            if (util_1.walk.isHTMLElement(currentNode)) {
                const style = getComputedStyle(currentNode);
                if (style.display != 'none') {
                    // Move the caption on tables with `caption-side: bottom` at the end of the table
                    // TODO test the property display 'table-caption' and 'table' of the currentNode and the parent instead of the prototype (perf ?)
                    if (currentNode instanceof HTMLTableElement && currentNode.caption) {
                        if (style.captionSide == "bottom")
                            currentNode.appendChild(currentNode.caption);
                    }
                    const customStyle = css_1.getCustomStyle(currentNode);
                    gcpm_1.prepareGcpm(currentNode, customStyle, this.gcpmContext);
                    let hypher = cssContext.testHyphens(currentNode, style);
                    if (hypher) {
                        if (hypher instanceof Promise)
                            hypher = yield hypher;
                        if (hypher)
                            cssContext.hyphenate(currentNode, hypher);
                    }
                }
            }
        }
        if (this.listenerCount('preparation-end'))
            this.emit('preparation-end');
        this.source.style.display = 'none';
        if (this.listenerCount('pagination-start'))
            yield 'pagination-start';
        this.flowIterator = new flow_1.FlowIterator(this.source, this.forcedBreakTypes, this.options.maxFragmentTextLength);
        let remaining;
        while ((remaining = this.flowIterator.next())) {
            if (!this.firstPageSide)
                this.firstPageSide = remaining.breakType == 'left' ? 'left' : 'right';
            yield* this.sequenceProcess(remaining);
        }
        this.onPageEnd(this.currentPage, true);
        // Writing the global page counter
        const destCounterReset = getComputedStyle(this.dest).counterReset;
        this.dest.style.counterReset = (destCounterReset == 'none' ? '' : destCounterReset) + " pages " + this.pages.length;
        let bookmarksRoot = null;
        if (this.options.bookmarks) {
            bookmarksRoot = gcpm_1.createBookmarks(this.doc, this.gcpmContext);
            this.dest.insertBefore(bookmarksRoot, this.pages[0].container);
        }
        gcpm_1.setTargetCounters(this.pages, this.gcpmContext);
        if (bookmarksRoot) {
            gcpm_1.setBookmarkLabels(bookmarksRoot);
        }
        gcpm_1.setLeaders(this.gcpmContext);
        yield Promise.all(Array.from(this.imagesToLoad, (url) => new Promise((resolve) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = resolve;
            img.src = url;
        })));
        this.source.remove();
        this.dest.setAttribute('ps-process', 'ended');
        if (this.listenerCount('pagination-end'))
            yield 'pagination-end';
        window.scrollTo(...initialScroll);
        if (this.listenerCount('end'))
            yield 'end';
    }
    /**
     * The generator function of the processing of a sequence.
     *
     * @param {Range} flow - A range returned by ContinuousFlowIterator
     * @param {module:layout~Sequence} nextSequence - The following sequence
     * @memberof module:postscriptum~Processor
     */
    *sequenceProcess(flow) {
        this.previousSequence = this.currentSequence;
        const sequence = this.currentSequence = new Sequence(flow);
        this.sequences.push(sequence);
        if (this.listenerCount('sequence-start'))
            yield { type: 'sequence-start', sequence };
        // Creation of a blank page if needed
        if (this.pages.length) {
            // Ascertains the side of the next page according to the side of the first
            const nextPageSide = (this.pages.length + (this.firstPageSide == 'left' ? 1 : 0)) % 2 ? 'left' : 'right';
            const needBlankPage = (sequence.breakType == 'left' && nextPageSide == 'right')
                || (sequence.breakType == 'right' && nextPageSide == 'left')
                || (sequence.breakType == 'verso' && nextPageSide == this.firstPageSide)
                || (sequence.breakType == 'recto' && nextPageSide != this.firstPageSide);
            if (needBlankPage) {
                yield* this.pageProcess(true);
            }
        }
        // The start of the sequence is initialized to the root's start to includes the ancestors
        flow.range.setStartBefore(this.source.firstChild);
        while (!flow.range.collapsed) {
            yield* this.pageProcess(false, flow.maxTextLength);
            if (this.layoutContext) {
                // The layoutContext is null if the page processing has been aborted by underflow when flow.maxTextLength is true
                flow.range.setStart(this.layoutContext.breakPoint.container, this.layoutContext.breakPoint.offset);
                flow.range.setEndAfter(this.currentPage.body.lastChild);
            }
            if (flow.maxTextLength && (!this.layoutContext || flow.range.collapsed)) {
                if (this.layoutContext)
                    util_1.logger.debug("Max flow text length reached (after contents processing).");
                else
                    util_1.logger.debug("Max flow text length reached (before contents processing).");
                const body = this.currentPage.body;
                if (this.layoutContext)
                    this.layoutContext.mutations.revert();
                this.fragmentStartMut.revert();
                breaks_1.unbreak(body, this.source, 'after');
                flow = this.flowIterator.next();
                yield* this.continuePageProcess(this.currentPage, flow);
                flow.range.setStart(this.layoutContext.breakPoint.container, this.layoutContext.breakPoint.offset);
                flow.range.setEndAfter(this.currentPage.body.lastChild);
            }
            this.fragmentStartMut.commit();
            this.layoutContext.mutations.commit();
            if (this.listenerCount('page-end'))
                yield { type: 'page-end', page: this.currentPage };
        }
        this.currentPage.container.removeAttribute('ps-processing');
        if (this.listenerCount('sequence-end'))
            yield { type: 'sequence-end', sequence };
    }
    /**
     * The generator function of the processing of a page.
     *
     * @param {boolean} blank - Signals if the page to process is blank
     */
    *pageProcess(blank, abortIfUnderflow = false) {
        const previousPage = this.currentPage;
        if (previousPage)
            util_1.logger.removeScope();
        const pageSide = (this.pages.length + (this.firstPageSide == 'right' ? 0 : 1)) % 2 ? 'left' : 'right';
        const pageSequence = blank ? this.previousSequence || this.currentSequence : this.currentSequence;
        const page = this.currentPage = createPage(this.doc, pageSequence, pageSequence.pageName, pageSide, this.pages.length + 1, blank);
        this.pages.push(page);
        util_1.logger.addScope(`page ${page.number}`);
        if (this.currentSequence.startPageIndex == -1 && !blank)
            this.currentSequence.startPageIndex = this.pages.length - 1;
        this.currentSequence.endPageIndex = this.pages.length - 1;
        this.dest.appendChild(page.container);
        if (this.listenerCount('page-start'))
            yield { type: 'page-start', page };
        this.setBleedAndMarks(page);
        if (blank) {
            page.body = page.area.appendChild(previousPage.body.cloneNode(false));
            this.onPageEnd(previousPage);
            if (this.listenerCount('page-end'))
                yield { type: 'page-end', page };
            util_1.logger.removeScope();
            return;
        }
        const firstSequencePage = this.pages[this.currentSequence.startPageIndex];
        let body;
        if (page == firstSequencePage) {
            body = breaks_1.breakAtPoint(this.source, this.currentSequence.breakPoint, 'before');
        }
        else {
            body = breaks_1.breakAtPoint(previousPage.body, this.layoutContext.breakPoint);
            this.onFragmentBreak(previousPage);
        }
        this.layoutContext = null;
        body.style.display = '';
        body.setAttribute('ps-page-body', '');
        page.body = page.area.appendChild(body);
        fragments_1.createAreas(page);
        page.container.setAttribute('ps-processing', '');
        if (previousPage) {
            previousPage.container.removeAttribute('ps-processing');
            // The definition of the margins of the previous page must be done after the cut, so that the last string-set is correctly identified
            this.onPageEnd(previousPage);
        }
        this.onFragmentStart(page, page == firstSequencePage);
        if (abortIfUnderflow && body.scrollHeight <= body.clientHeight)
            return;
        yield* this.contentsProcess(page.body, page.areas);
        /**
         * Dispatched when the pagination process starts.
         *
         * The attribute `ps-process` is set to `pending` right before this event.
         * At this stage, the stylesheets are not parsed and the source is not hidden.
         * @event start
         */
        /**
         * Dispatched when the pagination starts.
         *
         * At this stage, the stylesheets parsed and the source is hidden.
         * @event pagination-start
         */
        /**
         * Dispatched when the pagination ends.
         *
         * At this stage, the stylesheets parsed and the source is hidden.
         * @event pagination-end
         */
        /**
         * Dispatched when the pagination process ends.
         *
         * The attribute `ps-process` is set to `ended` right before this event.
         * @event end
         */
    }
    *continuePageProcess(page, flow) {
        const body = breaks_1.breakAtPoint(this.source, {
            container: flow.range.endContainer,
            offset: flow.range.endOffset
        }, 'before');
        body.style.display = '';
        body.setAttribute('ps-page-body', '');
        page.body = page.area.insertBefore(body, page.area.firstChild);
        this.onFragmentStart(page, false);
        yield* this.contentsProcess(page.body, page.areas);
    }
    addImagesToLoad(page) {
        super.addImagesToLoad(page);
        for (const marginName in page.marginBoxes) {
            css_1.addStyleImagesToLoad(page.marginBoxes[marginName], this.imagesToLoad);
        }
    }
    // TODO onFragmentEnd ?
    onPageEnd(page, last = false) {
        gcpm_1.setMarginContents(page, this.gcpmContext);
        // TODO Add an option for the optimization on page counters value
        gcpm_1.setPageTargetCounters(page, this.dest, this.gcpmContext);
        // TODO Better way to remove this attribute: move the hidden source in the last page instead of breaking it ?
        if (last)
            page.body.removeAttribute('ps-breaked-after');
    }
    setBleedAndMarks(page) {
        const style = getComputedStyle(page.container);
        const bleed = css_2.getCustomProp(style, 'bleed');
        let bleedSize = css_2.getCustomProp(style, 'bleed-size');
        const marks = css_2.getCustomProp(style, 'marks');
        if (bleed == 'auto' && marks.includes('crop')) {
            bleedSize = '6pt';
            page.container.style.setProperty('--ps-bleed-size', bleedSize);
        }
        if (parseFloat(bleedSize))
            page.container.setAttribute('ps-bleed', marks);
    }
}
exports.Paginator = Paginator;
Paginator.defaultOptions = Object.assign(Object.create(fragments_1.Fragmentor.defaultOptions), {
    source: null,
    bookmarks: true,
    debug: false,
    /* slightly faster than 5K or 20K */
    maxFragmentTextLength: 10000
});
/**
 * Create a page
 *
 * @param doc {Document}
 * @param name {string}
 * @param number {integer}
 * @param pseudos {string[]}
 */
function createPage(doc, sequence, name, side, number, blank) {
    const page = new Page();
    page.container = doc.createElement('ps-page');
    page.parentSequence = sequence;
    page.side = side;
    page.number = number;
    page.blank = blank;
    if (name)
        page.container.setAttribute('ps-name', name);
    let pseudos = side;
    if (number == 1)
        pseudos += ' first';
    if (blank)
        pseudos += ' blank';
    else {
        if (sequence.pageGroupStart) {
            pseudos += ' first-of-group';
            sequence.pageGroupStart = false;
        }
    }
    page.container.setAttribute('ps-pseudos', pseudos);
    page.marginBoxes = {};
    for (let i = 0; i < gcpm_1.SIDES.length; i++) {
        const corner = doc.createElement('ps-margin-box');
        corner.setAttribute('ps-name', gcpm_1.CORNERS[i]);
        page.marginBoxes[gcpm_1.CORNERS[i]] = corner;
        page.container.appendChild(corner);
        const margin = doc.createElement('ps-margin');
        margin.setAttribute('ps-side', gcpm_1.SIDES[i]);
        const boxNames = i % 2 == 0 ? gcpm_1.HORIZONTAL_MARGIN_BOXES : gcpm_1.VERTICAL_MARGIN_BOXES;
        for (const boxName of boxNames) {
            const marginBox = doc.createElement('ps-margin-box');
            const marginName = gcpm_1.SIDES[i] + '-' + boxName;
            marginBox.setAttribute('ps-name', marginName);
            margin.appendChild(marginBox);
            page.marginBoxes[marginName] = marginBox;
        }
        page.container.appendChild(margin);
    }
    page.area = doc.createElement('ps-page-area');
    page.container.appendChild(page.area);
    return page;
}
exports.createPage = createPage;

},{"./breaks":1,"./columns":2,"./css":4,"./flow":7,"./fragments":8,"./gcpm":9,"./util":19}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * The entry point of postscriptum.
 */
const breaks = require("./breaks");
const columns = require("./columns");
const counters = require("./counters");
const css = require("./css");
const flow = require("./flow");
const fragments = require("./fragments");
const gcpm = require("./gcpm");
const layout = require("./layout");
const pages = require("./pages");
const precss = require("./precss");
const process = require("./process");
const rows = require("./rows");
const shim = require("./shim");
const util = require("./util");
const util_1 = require("./util");
const pages_1 = require("./pages");
const columns_1 = require("./columns");
const currentScript = document.currentScript;
const PAGINATE_ATTR = 'ps-paginate';
/**
 * Global postscriptum object.
 */
const postscriptum = {
    pagination: function (options) {
        debugger;
        if (options && options.logLevel)
            util_1.logger.setLevel(options.logLevel);
        const processor = new pages_1.Paginator(options);
        return processor;
    },
    columnization: function (element, options) {
        if (options && options.logLevel)
            util_1.logger.setLevel(options.logLevel);
        const processor = new columns_1.Columnizator(element, options);
        return processor;
    },
    plugin: function (name, initializer, defaultOptions = null, script = document.currentScript) {
        if (!initializer) {
            if (name in process.pluginRegistry)
                return process.pluginRegistry[name].initializer;
            return null;
        }
        process.pluginRegistry[name] = {
            initializer,
            defaultOptions,
            scriptOptions: script && util_1.io.parseOptionsFromElement(script, defaultOptions)
        };
    },
    getOptions: function () {
        let configElement;
        if (currentScript && currentScript.hasAttribute(PAGINATE_ATTR)) {
            configElement = currentScript;
        }
        else if (document.documentElement.hasAttribute(PAGINATE_ATTR)) {
            configElement = document.documentElement;
        }
        if (configElement) {
            const options = util_1.io.parseOptionsFromElement(configElement, pages_1.Paginator.defaultOptions);
            if (!options.hyphUri && currentScript && !currentScript.src.startsWith('blob:'))
                options.hyphUri = new URL('hyph', currentScript.src).toString();
            return options;
        }
        return null;
    },
    breaks,
    columns,
    counters,
    css,
    flow,
    fragments,
    gcpm,
    layout,
    pages,
    precss,
    process,
    rows,
    shim,
    util
};
exports.default = postscriptum;
/**
 * Starts the pagination process if options are defined in the HTML.
 */
(async () => {
    await util_1.dom.docInteractive();
    if (!('postscriptumPreload' in window)) {
        const options = postscriptum.getOptions();
        if (options) {
            const process = postscriptum.pagination(options);
            try {
                await process.start().ended;
                return options;
            }
            catch (e) {
                try {
                    postscriptum.util.logger.error(e);
                }
                catch (e) {
                    console.error(e);
                }
            }
        }
    }
})();

},{"./breaks":1,"./columns":2,"./counters":3,"./css":4,"./flow":7,"./fragments":8,"./gcpm":9,"./layout":12,"./pages":13,"./precss":15,"./process":16,"./rows":17,"./shim":18,"./util":19}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importFold = exports.importUnfold = exports.replaceMediaType = void 0;
const postcss = require("postcss");
const valueParser = require("postcss-value-parser");
const util_1 = require("./util");
const GCPM_CONTENT_FUNCS = ['target-text', 'target-content', 'target-counter', 'target-counters', 'leader', 'element', 'string'];
const SIDES = ['top', 'right', 'bottom', 'left'];
const AREA_CSS_PROPS = ['margin', 'padding', 'border', 'outline', 'grid', 'display'];
const CONTENT_PSEUDOS_RE = /::(before|after|marker)\s?/;
const SINGLE_COLON_PSEUDO_RE = /(^|[^:]):(before|after|first-letter|first-line)/g;
const PROPS_TO_PREFIX_RE = /^(?:size|page|break-.+|page-break-.+|orphans|widows|bookmark-.+|string-set|position|float|footnote-.+|margin-break|box-decoration-break|bleed|marks|columns|column-.+|hyphens|-ps-.+|-psp-.+)$/;
const PAGE_BREAKS = ['auto', 'avoid', 'always', 'page', 'left', 'right', 'recto', 'verso'];
/** @see https://developer.mozilla.org/en-US/docs/Web/CSS/url() for the list of properties */
const URI_PROPS_RE = /^(--.+|.+-image|background|list-style|cursor|content|border|border-image-source|mask|-webkit-mask|src|symbols)$/;
const PSEUDO_TO_ATTR_RE = /:-(ps-breaked-(before|after))/g;
const FLOAT_PSEUDO_RE = /^(.*)::(-ps-float|footnote)-(marker|call)$/;
const COLUMNS_PSEUDO_RE = /^(.*)::-ps-columns(\b.+)?$/;
const NOT_VAL_NODE = { type: "word", value: "not" };
const SPACE_VAL_NODE = { type: "space", value: " " };
const COMMA_VAL_NODE = { type: "div", value: "," };
const HREF_VAL_NODE = { type: "word", value: "href" };
// TODO CSS source maps
exports.default = postcss.plugin('ps-precss', (options) => {
    return (root) => {
        if (options.mediaType)
            selectMediaType(root, options);
        css3Pseudos(root);
        replaceAtPageRules(root, options);
        prefixProps(root);
        replacePseudos(root);
        replaceContent(root);
        return root;
    };
});
function selectMediaType(root, options) {
    root.walkAtRules(/^media|import\b/, (atRule) => {
        atRule.params = replaceMediaType(atRule.params, options.mediaType);
    });
}
function replaceMediaType(mediaQuery, mediaType) {
    const queryList = valueParser(mediaQuery);
    const replacedVals = [];
    for (let i = 0; i < queryList.nodes.length; i++) {
        const val = queryList.nodes[i];
        if (val.type == "word" && val.value != "and") {
            if (val.value == "not") {
                const nextWord = queryList.nodes[i + 2];
                // Replace "not <mediaType>" by "not all"
                if (nextWord.value == mediaType || nextWord.value == "all")
                    replacedVals.push(val, SPACE_VAL_NODE);
                nextWord.value = "all";
                replacedVals.push(nextWord);
                i += 2;
            }
            else if (val.value != "only") {
                if (val.value != mediaType && val.value != "all")
                    replacedVals.push(NOT_VAL_NODE, SPACE_VAL_NODE);
                val.value = "all";
                replacedVals.push(val);
            }
        }
        else {
            replacedVals.push(val);
        }
    }
    return valueParser.stringify(replacedVals);
}
exports.replaceMediaType = replaceMediaType;
function css3Pseudos(root) {
    root.walkRules((rule) => {
        rule.selector = rule.selector.replace(SINGLE_COLON_PSEUDO_RE, '$1::$2');
    });
}
function replaceAtPageRules(root, options) {
    const pageSizes = new Set();
    root.walkAtRules(/^page\b/, (atPageRule) => {
        // Transformation of "@page <name> :<pseudo>" to "ps-page[ps-name=<name>][ps-pseudos~=<pseudo>]"
        // TODO It's not clear if the pseudo needs to have a space before or not
        // TODO According to example 7 from https://www.w3.org/TR/css-page-3/#page-selectors, both are accepted
        const atPageSelectors = postcss.list.comma(atPageRule.name.substr(4) + atPageRule.params);
        const parent = atPageRule.parent;
        for (const atPageSelector of atPageSelectors) {
            let pageSelector = 'ps-page';
            const parts = atPageSelector.replace(/:/g, ' :').split(' ');
            let name = null;
            for (const part of parts) {
                if (part) {
                    if (part[0] == ':') {
                        if (part.startsWith(':nth(')) {
                            pageSelector += ':nth-of-type' + part.substr(4);
                        }
                        else if (part.startsWith(':first')) {
                            // Additionnal attribute selector to give more specificity to the :first selectors
                            // While :nth-child(n of [ps-name=]) is not implemented, A special pseudo is used for the first page of a group
                            if (name)
                                pageSelector += `[ps-pseudos~=first-of-group][ps-pseudos]`;
                            else
                                pageSelector += `[ps-pseudos~=${part.substr(1)}][ps-pseudos]`;
                        }
                        else {
                            pageSelector += `[ps-pseudos~=${part.substr(1)}]`;
                        }
                    }
                    else {
                        name = part;
                        pageSelector += `[ps-name=${name}]`;
                    }
                }
            }
            /*
             const comment = postcss.comment({ text: atPageRule.toString() });
             comment.source = atPageRule.source;
             parent.insertBefore(atPageRule, comment);*/
            const pageRule = postcss.rule({ selector: pageSelector });
            pageRule.source = atPageRule.source;
            const pageAreaRule = postcss.rule({ selector: pageSelector + ' > ' + 'ps-page-area' });
            pageAreaRule.source = atPageRule.source;
            for (const node of atPageRule.nodes) {
                if (node.type == 'decl') {
                    const decl = node;
                    if (decl.prop == 'size') {
                        // Transforms the size property to --ps-page-width and --ps-page-height
                        const size = getPageSize(decl.value, options.defaultPageSize);
                        pageSizes.add(size.join(' '));
                        const widthVar = postcss.decl({ prop: '--ps-page-width', value: size[0].toString() });
                        const heightVar = postcss.decl({ prop: '--ps-page-height', value: size[1].toString() });
                        heightVar.source = node.source;
                        pageRule.append(widthVar);
                        pageRule.append(heightVar);
                        // The size property is cloned to be prefixed
                        pageRule.append(node.clone());
                    }
                    else if (AREA_CSS_PROPS.some((areaProp) => decl.prop.startsWith(areaProp))) {
                        if (decl.prop == 'margin') {
                            const sides = expandSideDecl(node);
                            for (const [key, side] of SIDES.entries()) {
                                pageRule.append(node.clone({
                                    prop: `--ps-page-margin-${side}`,
                                    value: pageMarginValue(sides[key], side)
                                }));
                            }
                        }
                        else if (decl.prop.startsWith('margin-')) {
                            const side = decl.prop.substr(7);
                            pageRule.append(node.clone({
                                prop: `--ps-page-margin-${side}`,
                                value: pageMarginValue(decl.value, side)
                            }));
                        }
                        else if (decl.prop == 'padding') {
                            // The padding is moved on the area
                            const sides = expandSideDecl(node);
                            for (const [key, side] of SIDES.entries()) {
                                pageAreaRule.append(node.clone({
                                    prop: decl.prop + '-' + side,
                                    value: pageMarginValue(sides[key], side)
                                }));
                            }
                        }
                        else if (decl.prop.startsWith('padding-')) {
                            const side = decl.prop.substr(7);
                            pageAreaRule.append(node.clone({
                                prop: decl.prop,
                                value: pageMarginValue(decl.value, side)
                            }));
                        }
                        else
                            pageAreaRule.append(node.clone());
                    }
                    else if (decl.prop != 'width' && decl.prop != 'height') {
                        // Other properties are copied to the new rules
                        // The width and height property must be ignored (cf test css3-page/page-properties-000.xht)
                        pageRule.append(node.clone());
                    }
                }
            }
            if (pageRule.nodes.length)
                parent.insertBefore(atPageRule, pageRule);
            if (pageAreaRule.nodes.length)
                parent.insertBefore(atPageRule, pageAreaRule);
            // Transformation des atRule de marges et de footnote
            for (const node of atPageRule.nodes) {
                if (node.type == 'atrule') {
                    const atRule = node;
                    const footnotesRule = atRule.name.startsWith('footnote');
                    if (atRule.name == '-ps-body') {
                        const bodyRule = postcss.rule({ selector: `${pageSelector} > ps-page-area > [ps-page-body]` });
                        while (atRule.first)
                            bodyRule.append(atRule.first);
                        bodyRule.append(postcss.decl({ prop: 'grid-area', value: '-ps-body' }));
                        parent.insertBefore(atPageRule, bodyRule);
                    }
                    else if (atRule.name == '-ps-area' || footnotesRule) {
                        // We supports the atRule @footnote as specified by css-gcpm-3 and the @footnotes which is more
                        // coherent with our naming convention (PrinceXML use @footnotes too).
                        if (footnotesRule)
                            atRule.params = atRule.name + atRule.params;
                        const paramsMatches = atRule.params.match(/^(.+?)\b(.*)$/);
                        let areaName = paramsMatches[1];
                        if (areaName == 'footnote')
                            areaName = 'footnotes';
                        const areaRule = postcss.rule({ selector: `${pageSelector} > ps-page-area > ps-area[ps-name=${areaName}]${paramsMatches[2].trim()}` });
                        while (atRule.first)
                            areaRule.append(atRule.first);
                        areaRule.append(postcss.decl({ prop: 'grid-area', value: areaName }));
                        parent.insertBefore(atPageRule, areaRule);
                    }
                    else if (atRule.name.startsWith('-ps-')) {
                        const atRuleType = atRule.name.substr(4);
                        if (SIDES.includes(atRuleType)) {
                            const marginRule = postcss.rule({ selector: `${pageSelector} > ps-margin[ps-side=${atRuleType}]` });
                            while (atRule.first)
                                marginRule.append(atRule.first);
                            parent.insertBefore(atPageRule, marginRule);
                        }
                    }
                    else {
                        const marginSide = atRule.name.substr(0, atRule.name.indexOf('-'));
                        const marginBoxSelector = atRule.name.endsWith('-corner')
                            ? `${pageSelector} > ps-margin-box[ps-name=${atRule.name}]`
                            : `${pageSelector} > ps-margin[ps-side=${marginSide}] > ps-margin-box[ps-name=${atRule.name}]`;
                        const marginBoxRule = postcss.rule({ selector: marginBoxSelector });
                        marginBoxRule.source = atRule.source;
                        while (atRule.first)
                            marginBoxRule.append(atRule.first);
                        // The content of the margin is moved to the margin before pseudo
                        for (const decl of marginBoxRule.nodes) {
                            if (decl.prop == 'content') {
                                const contentRule = postcss.rule({ selector: marginBoxSelector + '::before' });
                                contentRule.append(decl);
                                parent.insertBefore(atPageRule, contentRule);
                                break;
                            }
                        }
                        if (marginBoxRule.nodes.length)
                            parent.insertBefore(atPageRule, marginBoxRule);
                    }
                }
            }
        }
        atPageRule.remove();
    });
    // TODO Incorrect print page size when enabled
    /*if (pageSizes.size == 1) {
        const pageSize = pageSizes.values().next().value;
        const printPageAtRule = postcss.atRule({name: 'page'});
        printPageAtRule.append(postcss.decl({prop: 'size', value: pageSize}));
        root.append(printPageAtRule);
    }*/
}
function expandSideDecl(decl) {
    const valueParts = postcss.list.space(decl.value);
    let sides = new Array(4);
    switch (valueParts.length) {
        case 1:
            for (let i = 0; i < 4; i++)
                sides[i] = valueParts[0];
            break;
        case 2:
            sides[0] = sides[2] = valueParts[0];
            sides[1] = sides[3] = valueParts[1];
            break;
        case 3:
            sides[0] = valueParts[0];
            sides[1] = sides[3] = valueParts[1];
            sides[2] = valueParts[2];
            break;
        case 4:
            sides = valueParts;
            break;
    }
    return sides;
}
function pageMarginValue(value, side) {
    const base = side == 'top' || side == 'bottom' ? 'height' : 'width';
    if (value.endsWith('%')) {
        return `calc(var(--ps-page-${base}) * ${parseFloat(value)} / 100)`;
    }
    return value;
}
function getPageSize(value, defaultSize) {
    let size = null;
    const valueParts = postcss.list.space(value);
    const lastPart = valueParts[valueParts.length - 1];
    const landscape = lastPart == "landscape";
    if (lastPart == "portrait" || landscape) {
        valueParts.pop();
        if (!valueParts.length)
            valueParts.push("auto");
    }
    if (valueParts.length && valueParts[0].match(/^[a-z]/i)) {
        /* Specified by https://www.w3.org/TR/css-page-3/#typedef-page-size-page-size */
        switch (valueParts[0].toLowerCase()) {
            case 'a5':
                size = ['148mm', '210mm'];
                break;
            case 'a4':
                size = ['210mm', '297mm'];
                break;
            case 'a3':
                size = ['297mm', '420mm'];
                break;
            case 'b5':
                size = ['176mm', '250mm'];
                break;
            case 'b4':
                size = ['250mm', '353mm'];
                break;
            case 'jis-b5':
                size = ['182mm', '257mm'];
                break;
            case 'jis-b4':
                size = ['257mm', '364mm'];
                break;
            case 'letter':
                size = ['8.5in', '11in'];
                break;
            case 'legal':
                size = ['8.5in', '14in'];
                break;
            case 'ledger':
                size = ['11in', '17in'];
                break;
            case 'auto':
                size = defaultSize;
                break;
            /* Other sizes of A series format */
            case 'a6':
                size = ['105mm', '148mm'];
                break;
            case 'a7':
                size = ['74mm', ' 105mm'];
                break;
            case 'a8':
                size = ['52mm', '74mm'];
                break;
            case 'a9':
                size = ['37mm', '52mm'];
                break;
            case 'a10':
                size = ['26mm', '37mm'];
                break;
        }
    }
    if (!size) {
        if (valueParts.length >= 2)
            size = [valueParts[0], valueParts[1]];
        else
            size = [valueParts[0], valueParts[0]];
    }
    if (landscape) {
        size = [size[1], size[0]];
    }
    return size;
}
function prefixProps(root) {
    root.walkRules((rule) => {
        rule.selector = rule.selector.replace(PSEUDO_TO_ATTR_RE, '[$1]');
        let customRule = null;
        rule.walkDecls(PROPS_TO_PREFIX_RE, (decl) => {
            let custom;
            let resetCustom = false;
            let customDecl;
            if (decl.prop.startsWith('page-break-')) {
                if (PAGE_BREAKS.includes(decl.value)) {
                    customDecl = decl.clone();
                    customDecl.prop = decl.prop.replace(/^page-break-/, '--ps-break-');
                    if (decl.value == 'always')
                        customDecl.value = 'page';
                    else if (decl.value == 'avoid')
                        customDecl.value = 'avoid-page';
                    custom = true;
                }
                else {
                    decl.remove();
                }
            }
            else if (decl.prop == 'position') {
                custom = decl.value.match(/^running\(/);
                if (!custom)
                    resetCustom = true;
            }
            else if (decl.prop == 'float') {
                if (decl.value == 'footnote') {
                    decl.value = '-ps-area(footnotes)';
                    custom = true;
                }
                else {
                    custom = decl.value.match(/^-ps-area\(/);
                }
                if (!custom)
                    resetCustom = true;
            }
            else if (decl.prop.startsWith('footnote-')) {
                decl.prop = decl.prop.replace('footnote-', '-ps-float-');
                custom = true;
            }
            else if (decl.prop == 'orphans' || decl.prop == 'widows') {
                // The properties 'orphans' and 'widows' are inherited, we do not hide them in a pseudo
                // Only positive integers are allowed as values of orphans and widows. Negative values and zero are invalid and must cause the declaration to be ignored.
                // https://drafts.csswg.org/css-break-3/#widows-orphans
                if (decl.value.match(/^\d+$/) && parseInt(decl.value) > 0)
                    decl.prop = '--ps-' + decl.prop;
                else
                    decl.remove();
            }
            else if (decl.prop == 'columns' || decl.prop == '-ps-columns') {
                const widthDecl = decl.cloneAfter();
                widthDecl.prop = '-ps-column-width';
                const values = valueParser(decl.value).nodes.filter((n) => n.type == "word").map((n) => n.value);
                if (values[0].match(/^\d+$/)) {
                    decl.value = values[0];
                    widthDecl.value = values[1] || "auto";
                }
                else if (values.length > 1 && values[1].match(/^\d+$/)) {
                    decl.value = values[1];
                    widthDecl.value = values[0] || "auto";
                }
                else {
                    decl.value = "auto";
                    widthDecl.value = values[0] == "auto" ? (values[1] || "auto") : values[0];
                }
                decl.prop = '-ps-column-count';
                custom = true;
            }
            else if (decl.prop == 'hyphens') {
                // The property 'hyphen' are inherited, we do not hide it in a pseudo
                if (decl.value == "auto") {
                    decl.cloneBefore({ value: "manual" });
                    decl.prop = '--ps-' + decl.prop;
                }
            }
            else if (decl.prop == '-ps-hyphens') {
                // The property 'hyphen' are inherited, we do not hide it in a pseudo
                if (decl.value == "auto") {
                    decl.cloneBefore({ prop: 'hyphens', value: "manual" });
                    decl.prop = '-' + decl.prop;
                }
            }
            else if (decl.prop == 'bleed') {
                decl.prop = '--ps-bleed';
                decl.cloneBefore({ prop: '--ps-bleed-size', value: decl.value == "auto" ? "0px" : decl.value });
            }
            else if (decl.prop == 'marks') {
                decl.prop = '--ps-' + decl.prop;
            }
            else {
                custom = true;
            }
            if (custom || resetCustom) {
                if (!customRule) {
                    customRule = postcss.rule();
                    customRule.selectors = rule.selectors.map((selector) => selector + '::backdrop');
                    rule.parent.insertBefore(rule, customRule);
                }
                if (!customDecl) {
                    customDecl = decl.clone();
                    if (decl.prop.startsWith('-ps-'))
                        customDecl.prop = '-' + decl.prop;
                    else if (decl.prop.startsWith('-psp-'))
                        customDecl.prop = '-' + decl.prop;
                    else
                        customDecl.prop = '--ps-' + decl.prop;
                    if (resetCustom)
                        customDecl.value = '';
                }
                customRule.append(customDecl);
                if (!resetCustom)
                    decl.remove();
                if (!rule.nodes.length)
                    rule.remove();
            }
        });
    });
}
function replacePseudos(root) {
    root.walkRules((rule) => {
        const selectors = rule.selectors.slice();
        for (let i = 0; i < selectors.length; i++) {
            // Floats
            const floatMatch = selectors[i].match(FLOAT_PSEUDO_RE);
            if (floatMatch) {
                const [, baseSelector, selKind, pseudoKind] = floatMatch;
                // Support of ::footnote-call
                if (pseudoKind == "call") {
                    let floatSel = pseudoKind == 'call' ? `[ps-float-${pseudoKind}]` : `ps-float-${pseudoKind}`;
                    if (baseSelector)
                        floatSel = baseSelector + ' + ' + floatSel;
                    // Support of ::footnote-call and ::footnote-marker specified by css-gcpm-3
                    if (selKind == 'footnote')
                        floatSel += '[ps-float-area="footnotes"]';
                    selectors[i] = floatSel;
                    const floatContentRule = rule.clone({ selector: floatSel + '::before', nodes: [] });
                    rule.walkDecls('content', (decl) => {
                        // Replace counter call by target-counter
                        const value = valueParser(decl.value);
                        for (const node of value.nodes) {
                            if (node.type == 'function' && node.value == "counter") {
                                node.value = "target-counter";
                                node.nodes.unshift({
                                    type: "function",
                                    "value": "attr",
                                    nodes: [HREF_VAL_NODE]
                                }, COMMA_VAL_NODE);
                            }
                        }
                        decl.value = value.toString();
                        if (i == selectors.length - 1)
                            floatContentRule.append(decl);
                        else
                            floatContentRule.append(decl.clone());
                    });
                    if (floatContentRule.nodes.length)
                        rule.parent.insertBefore(rule, floatContentRule);
                }
                else {
                    // Support of ::footnote-marker
                    // Use of marker for float-display: block, ::before otherwise
                    selectors[i] = `${baseSelector}[ps-float-display=block]::marker`;
                    selectors.push(`${baseSelector}[ps-float]:not([ps-float-display=block])::before`);
                }
            }
            // Columns
            const columnsMatch = selectors[i].match(COLUMNS_PSEUDO_RE);
            if (columnsMatch) {
                const [, preSelector, postSelector] = columnsMatch;
                const columnBodyRule = rule.cloneAfter();
                columnBodyRule.selectors = [`${preSelector} > ps-columns > ps-column > ps-column-body${postSelector}`, `${preSelector} > ps-column-body${postSelector}`];
            }
        }
        rule.selectors = selectors;
    });
}
function replaceContent(root) {
    root.walkRules(CONTENT_PSEUDOS_RE, (rule) => {
        let contentDecl = null;
        let hasGcpm = false;
        rule.walkDecls('content', (decl) => {
            contentDecl = decl;
            const value = valueParser(decl.value);
            for (const node of value.nodes) {
                if (node.type == 'function') {
                    if (GCPM_CONTENT_FUNCS.includes(node.value)) {
                        hasGcpm = true;
                        break;
                    }
                }
            }
        });
        if (!contentDecl)
            return;
        // We write one rule for each pseudo of the original rule
        const ruleByPseudo = {};
        const selectors = rule.selectors.slice();
        for (const selector of selectors) {
            const selectorMatches = selector.match(CONTENT_PSEUDOS_RE);
            const pseudo = selectorMatches ? selectorMatches[1] : '';
            let currentRule = ruleByPseudo[pseudo];
            if (!currentRule) {
                // Cloned before to avoid double parsing
                currentRule = ruleByPseudo[pseudo] = Object.keys(ruleByPseudo).length ? rule.cloneBefore() : rule;
                currentRule.selector = '';
            }
            else {
                currentRule.selector += ', ';
            }
            currentRule.selector += selector;
        }
        for (const pseudo in ruleByPseudo) {
            if (pseudo) {
                const rule = ruleByPseudo[pseudo];
                if (hasGcpm) {
                    rule.walkDecls('content', (decl) => {
                        const value = valueParser(decl.value);
                        const leaderIndex = value.nodes.findIndex((node) => node.type == 'function' && node.value == 'leader');
                        // If the content has a leader, the values before and after are moved on pseudo element of a 'ps-leader' element
                        if (leaderIndex != -1)
                            replaceLeader(rule, decl, value, pseudo, leaderIndex);
                        const vals = [];
                        value.walk((node, index, nodes) => {
                            if (node.type == 'function' && GCPM_CONTENT_FUNCS.includes(node.value)) {
                                nodes[index] = valueParser(`var(--ps-${pseudo}-val-${vals.length}, "")`).nodes[0];
                                vals.push(node);
                                return false;
                            }
                        });
                        decl.value = value.toString();
                        rule.insertAfter(decl, decl.clone({
                            prop: `--ps-${pseudo}-vals`,
                            value: vals.map((val) => valueParser.stringify(val)).join(' ')
                        }));
                    });
                }
                else {
                    rule.append(contentDecl.clone({
                        prop: `--ps-${pseudo}-vals`,
                        value: "none"
                    }));
                }
            }
        }
    });
}
function replaceLeader(rule, decl, value, pseudo, leaderIndex) {
    const leaderSelector = rule.selectors.map((sel) => {
        const selWithoutPseudo = sel.substring(0, sel.indexOf('::' + pseudo));
        return `${selWithoutPseudo} > ps-leader[ps-position=${pseudo}]`;
    }).join(', ');
    const leaderRule = rule.cloneAfter({ selector: leaderSelector });
    leaderRule.walkDecls('content', (decl) => decl.remove());
}
exports.importUnfold = postcss.plugin('ps-import-unfold', (options) => {
    return (root) => {
        const imports = [];
        root.walkAtRules('import', (atImportRule) => {
            const params = valueParser(atImportRule.params).nodes;
            const urlFn = params[0];
            if (urlFn.type == 'function' && urlFn.value == 'url' && urlFn.nodes.length) {
                const url = new URL(urlFn.nodes[0].value, options.from);
                const importOptions = Object.create(options);
                importOptions.from = url.href;
                const transformation = load(url.href).then((response) => {
                    const processor = postcss().use(exports.importUnfold(importOptions));
                    return processor.process(response, importOptions);
                }).then((result) => {
                    atImportRule.append(result.root.nodes);
                }).catch((error) => {
                    util_1.logger.warn(error);
                });
                imports.push(transformation);
            }
        });
        root.walkDecls(URI_PROPS_RE, (decl) => {
            const value = valueParser(decl.value);
            value.walk((node) => {
                if (node.type == 'function' && node.value == 'url') {
                    const firstParam = node.nodes[0];
                    const url = new URL(firstParam.value, options.from);
                    firstParam.value = url.href;
                }
            });
            decl.value = value.toString();
        });
        return Promise.all(imports);
    };
});
exports.importFold = postcss.plugin('ps-import-fold', () => {
    function walkAtImportRule(node) {
        node.walkAtRules('import', (atImportRule) => {
            if (atImportRule.nodes) {
                walkAtImportRule(atImportRule);
                const params = postcss.list.space(atImportRule.params);
                const importContent = postcss.root();
                importContent.nodes = atImportRule.nodes;
                delete atImportRule.nodes;
                const blob = new Blob([importContent.toString()], { type: 'text/css' });
                params[0] = `url(${URL.createObjectURL(blob)})`;
                atImportRule.params = params.join(' ');
            }
        });
    }
    return walkAtImportRule;
});
function load(url) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('GET', url);
        request.onload = () => resolve(request.responseText);
        request.onerror = () => reject(new Error(`Unable to fetch '${url}'`));
        request.send();
    });
}

},{"./util":19,"postcss":48,"postcss-value-parser":31}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluginRegistry = exports.Processor = void 0;
const util_1 = require("./util");
class Processor extends util_1.events.EventEmitter {
    constructor(options) {
        super();
        // TODO Typescript
        const defaultOptions = this.constructor.defaultOptions;
        this.options = Object.assign(Object.create(defaultOptions), options);
    }
    get ended() {
        return this._ended;
    }
    use(pluginNames, useOptions) {
        if (!Array.isArray(pluginNames))
            pluginNames = [pluginNames];
        pluginNames.forEach((pluginName) => {
            const plugin = exports.pluginRegistry[pluginName];
            if (!plugin)
                throw new Error("Plugin '" + pluginName + "' not found");
            const options = Object.create(plugin.defaultOptions || {});
            if (plugin.scriptOptions)
                Object.assign(options, plugin.scriptOptions);
            if (useOptions)
                Object.assign(options, useOptions);
            plugin.initializer(this, options);
        });
        return this;
    }
    start() {
        this._ended = this._start();
        return this;
    }
    emitError(error) {
        if (!this.emit({ type: 'error', error }))
            throw error;
    }
    async _start() {
        try {
            let tick = this._process.next();
            while (!tick.done) {
                let result;
                if (tick.value instanceof Promise) {
                    // Promise yielded
                    result = await tick.value;
                }
                else {
                    // Event
                    const eventObj = (typeof tick.value == 'string' ? { type: tick.value } : tick.value);
                    result = this.emit(eventObj, this);
                    // Promised returned by event listener
                    if (result instanceof Promise)
                        result = await result;
                }
                tick = this._process.next(result);
            }
        }
        catch (error) {
            this.emitError(error);
        }
    }
}
exports.Processor = Processor;
Processor.defaultOptions = {
    plugins: [],
    logLevel: 'warn'
};
exports.pluginRegistry = {};

},{"./util":19}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trWithRowSpanSubFragmentor = exports.rowSubFragmentor = void 0;
const util_1 = require("./util");
const util_2 = require("./util");
const layout_1 = require("./layout");
const layout_2 = require("./layout");
class CellLayoutProcessor extends layout_1.LayoutProcessor {
    constructor(source, parentFragmentor) {
        super(source);
        this.parentFragmentor = parentFragmentor;
        this.gcpmContext = parentFragmentor.gcpmContext;
        this.avoidBreakTypes = parentFragmentor.avoidBreakTypes;
        this._process = this.cellProcess();
    }
    *cellProcess() {
        if (this.listenerCount('start'))
            yield 'start';
        util_1.logger.addScope(() => {
            const row = this.source.parentElement;
            const cellIndex = Array.prototype.indexOf.call(row.children, this.source);
            const rowIndex = Array.prototype.indexOf.call(row.parentNode.children, row);
            return `row ${rowIndex + 1}, cell ${cellIndex + 1}`;
        });
        const parentCtx = this.parentFragmentor.layoutContext;
        this.lastEvent = yield* this.contentsProcess(this.source, parentCtx.areas, parentCtx);
        if (this.limitedFloats)
            util_1.logger.info(`Some floats was deported.`);
        util_1.logger.removeScope();
        if (this.listenerCount('end'))
            yield 'end';
    }
    createLayoutContext(root, areas, parentCtx) {
        class CellLayoutContext extends layout_2.LayoutContext {
            get bodyBottom() {
                return parentCtx.bodyBottom;
            }
            set bodyBottom(val) {
                parentCtx.bodyBottom = val;
            }
        }
        const ctx = new CellLayoutContext(root, parentCtx.body, areas, parentCtx);
        const floatBottomLimit = Math.min(this.source.getBoundingClientRect().bottom + ctx.bottomOffsets.get(this.source.parentElement).inside, parentCtx.bodyBottom);
        ctx.on("float-move", ({ newAreaBodyRect }) => {
            if (newAreaBodyRect.bottom <= floatBottomLimit) {
                this.limitedFloats = true;
                return 'pending';
            }
        });
        return ctx;
    }
    emit(event, target) {
        super.emit(event, target);
        const eventObj = (typeof event == 'string' ? { type: event } : event);
        if (eventObj.type != 'start' && eventObj.type != 'end')
            this.parentFragmentor.emit(event, target);
    }
}
const rowSubFragmentor = function (ctx) {
    const rowType = util_1.walk.isRow(ctx.currentStyle);
    if (!rowType)
        return false;
    return (async () => {
        const row = ctx.currentElement;
        const cells = [];
        for (const cell of row.children) {
            if (util_1.walk.isStatic(cell)) {
                // Test the avoidBreakInside of each cells
                if (layout_1.testAvoidBreakInside(row, ctx.layoutContext, this.avoidBreakTypes, util_1.ranges.positionAfter(row)))
                    return false;
                cells.push(cell);
            }
        }
        // Style modification
        ctx.layoutContext.mutations.setAttr(row, 'ps-row', rowType);
        const verticalStyleMut = new util_2.Mutations();
        for (const cell of cells) {
            const props = {};
            if (rowType == 'flex-row')
                props['align-items'] = 'flex-start';
            else
                props['vertical-align'] = 'top';
            verticalStyleMut.setStyle(cell, props);
        }
        const fragmentors = new Map();
        let invalid = false;
        let overflow = false;
        for (const cell of cells) {
            if (util_1.walk.firstChild(cell, util_1.walk.isStaticNode)) {
                const fragmentor = new CellLayoutProcessor(cell, this);
                fragmentors.set(cell, fragmentor);
                await fragmentor.start().ended;
                if (fragmentor.lastEvent == 'no-break-point') {
                    invalid = true;
                    break;
                }
                else if (fragmentor.lastEvent != 'no-overflow') {
                    overflow = true;
                }
            }
        }
        verticalStyleMut.revert();
        if (invalid) {
            for (const cell of cells)
                if (fragmentors.has(cell))
                    fragmentors.get(cell).layoutContext.mutations.revert();
            return false;
        }
        else if (overflow) {
            const destRow = row.cloneNode(false);
            row.setAttribute('ps-breaked-after', '');
            this.layoutContext.mutations.setAttr(destRow, 'ps-breaked-before');
            this.layoutContext.mutations.insertNode(row.parentElement, destRow, row.nextSibling);
            for (const cell of cells) {
                const fragmentor = fragmentors.get(cell);
                const breakPoint = fragmentor ? fragmentor.layoutContext.breakPoint : util_1.ranges.positionAtStart(cell);
                const cellAfter = this.layoutContext.mutations.breaks(cell, breakPoint);
                destRow.appendChild(cellAfter);
                if (!util_1.walk.firstChild(cellAfter, util_1.walk.isStaticNode))
                    this.layoutContext.mutations.setAttr(cell, 'ps-empty-after');
            }
            return { breakPoint: util_1.ranges.positionBefore(destRow) };
        }
    })();
};
exports.rowSubFragmentor = rowSubFragmentor;
function isCellRef(object) {
    return 'cell' in object;
}
function getCell(cell) {
    return isCellRef(cell) ? cell.cell : cell;
}
const trWithRowSpanSubFragmentor = function (ctx) {
    const trWithRowSpan = ctx.currentStyle.display == 'table-row'
        && ctx.currentElement instanceof HTMLTableRowElement
        && Array.prototype.some.call(ctx.currentElement.cells, (cell) => cell.rowSpan > 1);
    if (!trWithRowSpan)
        return false;
    return (async () => {
        ctx.currentElement.setAttribute('ps-row', ctx.currentStyle.display);
        ctx.currentBox.mainBlock = null;
        const rows = [];
        let currentTR = ctx.currentElement;
        const columnCount = Array.prototype.reduce.call(currentTR.cells, (value, cell) => value + cell.colSpan, 0);
        const rowSpans = new Map();
        const trByRow = new Map();
        const staticTr = util_1.walk.predicate(util_1.walk.isConstructedBy(HTMLTableRowElement), util_1.walk.isStatic);
        do {
            let iCell = 0;
            const row = [];
            for (let iCol = 0; iCol < columnCount; iCol++) {
                const precCell = iCol > 0 && row[iCol - 1];
                if (rowSpans.has(iCol)) {
                    const cellRef = Object.create(rowSpans.get(iCol));
                    cellRef.rowSpan--;
                    row.push(cellRef);
                    if (cellRef.rowSpan == 1)
                        rowSpans.delete(iCol);
                    else
                        rowSpans.set(iCol, cellRef);
                }
                else if (precCell && precCell.colSpan > 1) {
                    const cellRef = { cell: getCell(precCell), rowSpan: precCell.rowSpan, colSpan: precCell.colSpan - 1 };
                    row.push(cellRef);
                    if (precCell.rowSpan > 1)
                        rowSpans.set(iCol, cellRef);
                }
                else {
                    const cell = currentTR.cells[iCell];
                    if (util_1.walk.isStatic(cell)) {
                        row.push(cell);
                        if (cell.rowSpan > 1)
                            rowSpans.set(iCol, { cell: cell, rowSpan: cell.rowSpan, colSpan: cell.colSpan });
                        iCell++;
                    }
                }
            }
            // Copy of the bottomOffset for the following lines
            if (rows.length)
                ctx.layoutContext.bottomOffsets.set(currentTR, ctx.layoutContext.bottomOffsets.get(ctx.currentElement));
            rows.push(row);
            trByRow.set(row, currentTR);
            currentTR = util_1.walk.nextSibling(currentTR, staticTr);
        } while (currentTR && rowSpans.size);
        const lastRow = trByRow.get(rows[rows.length - 1]);
        if (layout_1.testAvoidBreakInside(lastRow.parentElement, ctx.layoutContext, this.avoidBreakTypes, util_1.ranges.positionAfter(lastRow))) {
            ctx.nodes.currentNode = lastRow;
            return false;
        }
        let precRow = null;
        const pendingSpans = [];
        const fragmentors = new Map();
        for (let iRow = 0; iRow < rows.length; iRow++) {
            const row = rows[iRow];
            const tr = trByRow.get(row);
            const verticalStyleMut = new util_2.Mutations();
            for (const cell of row)
                if (!isCellRef(cell))
                    verticalStyleMut.setStyle(cell, { 'vertical-align': 'top' });
            let invalid = false;
            for (const cell of row) {
                if (!isCellRef(cell) && util_1.walk.firstChild(cell, util_1.walk.isStaticNode)) {
                    const fragmentor = new CellLayoutProcessor(cell, this);
                    fragmentors.set(cell, fragmentor);
                    await fragmentor.start().ended;
                    if (fragmentor.lastEvent == 'no-break-point') {
                        invalid = true;
                        break;
                    }
                }
            }
            verticalStyleMut.revert();
            if (invalid) {
                for (const cell of row)
                    if (!isCellRef(cell) && fragmentors.has(cell))
                        fragmentors.get(cell).layoutContext.mutations.revert();
                if (precRow) {
                    // Tests the break inside before the invalid row. Implies to revert all the rows in this case.
                    if (layout_1.testAvoidBreakInside(tr.parentElement, ctx.layoutContext, this.avoidBreakTypes, util_1.ranges.positionBefore(tr), true)) {
                        for (let i = iRow - 1; i >= 0; i--) {
                            const rowToRevert = rows[i];
                            for (const cell of rowToRevert)
                                if (!isCellRef(cell) && fragmentors.has(cell))
                                    fragmentors.get(cell).layoutContext.mutations.revert();
                        }
                        ctx.nodes.currentNode = lastRow;
                        return false;
                    }
                    else {
                        insertRowSpans.call(this, row, tr, fragmentors);
                        if (pendingSpans.length) {
                            return { breakPoint: util_1.ranges.positionBefore(tr) };
                        }
                        else {
                            ctx.nodes.currentNode = tr;
                        }
                    }
                }
                else {
                    ctx.nodes.currentNode = trByRow.get(rows[rows.length - 1]);
                }
                return false;
            }
            else {
                let overflow = false;
                for (const cell of row) {
                    if (cell.rowSpan > 1)
                        pendingSpans.push(getCell(cell));
                    else {
                        const fragmentor = fragmentors.get(getCell(cell));
                        if (fragmentor && fragmentor.lastEvent != 'no-overflow') {
                            overflow = true;
                            pendingSpans.length = 0;
                            break;
                        }
                    }
                }
                // TODO Use breakAtPoint to duplicate for the row ?
                if (overflow && !pendingSpans.length) {
                    const destRow = tr.cloneNode(false);
                    tr.setAttribute('ps-breaked-after', '');
                    this.layoutContext.mutations.setAttr(destRow, 'ps-breaked-before');
                    this.layoutContext.mutations.insertNode(tr.parentElement, destRow, tr.nextSibling);
                    tr.parentNode.insertBefore(destRow, tr.nextSibling);
                    for (const cell of row) {
                        const baseCell = getCell(cell);
                        const fragmentor = fragmentors.get(baseCell);
                        const breakPoint = fragmentor ? fragmentor.layoutContext.breakPoint : util_1.ranges.positionAtStart(baseCell);
                        const cellAfter = this.layoutContext.mutations.breaks(baseCell, breakPoint);
                        this.layoutContext.mutations.setProp(cellAfter, 'rowSpan', cell.rowSpan);
                        cell.rowSpan = 1;
                        destRow.appendChild(cellAfter);
                        if (!util_1.walk.firstChild(cellAfter, util_1.walk.isStaticNode))
                            this.layoutContext.mutations.setAttr(baseCell, 'ps-empty-after');
                    }
                    return { breakPoint: util_1.ranges.positionBefore(destRow) };
                }
            }
            precRow = row;
            ctx.nodes.currentNode = trByRow.get(row);
        }
    })();
};
exports.trWithRowSpanSubFragmentor = trWithRowSpanSubFragmentor;
function insertRowSpans(row, tr, fragmentors) {
    let insertRef = null;
    for (let iCell = row.length - 1; iCell >= 0; iCell--) {
        let cell = row[iCell];
        if (isCellRef(cell)) {
            if (cell.cell.rowSpan > 1) {
                // In the case of a cellRef with a colspan, we iterate to the first cellRef of this cell
                let precCell = iCell > 0 && row[iCell - 1];
                while (precCell && isCellRef(precCell) && precCell.cell == cell.cell) {
                    iCell--;
                    cell = precCell;
                    precCell = iCell > 0 && row[iCell - 1];
                }
                const fragmentor = fragmentors && fragmentors.get(cell.cell);
                const breakPoint = fragmentor ? fragmentor.layoutContext.breakPoint : util_1.ranges.positionAtEnd(cell.cell);
                const cellAfter = this.layoutContext.mutations.breaks(cell.cell, breakPoint);
                this.layoutContext.mutations.setProp(cellAfter, 'rowSpan', cell.cell.rowSpan - cell.rowSpan);
                cellAfter.rowSpan = cell.rowSpan;
                tr.insertBefore(cellAfter, insertRef);
                if (!util_1.walk.firstChild(cellAfter, util_1.walk.isStaticNode))
                    this.layoutContext.mutations.setAttr(cell.cell, 'ps-empty-after');
                insertRef = cellAfter;
            }
            else {
                insertRef = cell.cell;
            }
        }
        else {
            insertRef = cell;
        }
    }
}

},{"./layout":12,"./util":19}],18:[function(require,module,exports){
"use strict";
/**
 * Minimal shim for css selection and ranges manipulation.
 *
 * @param window  The context window to shim
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.browser = void 0;
function default_1(window) {
    //cssTypedOm(window);
    // Element.prototype.matches is not supported by Edge
    if (!window.Element.prototype.matches && window.Element.prototype.msMatchesSelector) {
        window.Element.prototype.matches = window.Element.prototype.msMatchesSelector;
    }
    // Range.prototype.isPointInRange and Range.prototype.intersectsNode are not supported by Edgezim
    if (!window.Range.prototype.isPointInRange) {
        window.Range.prototype.isPointInRange = function (referenceNode, offset) {
            const pointRange = document.createRange();
            pointRange.setStart(referenceNode, offset);
            return pointRange.compareBoundaryPoints(Range.START_TO_START, this) >= 0 && pointRange.compareBoundaryPoints(Range.END_TO_END, this) <= 0;
        };
    }
    if (!window.Range.prototype.intersectsNode) {
        window.Range.prototype.intersectsNode = function (referenceNode) {
            const range = document.createRange();
            range.selectNode(referenceNode);
            return range.compareBoundaryPoints(Range.START_TO_END, this) >= 0 || range.compareBoundaryPoints(Range.END_TO_END, this) <= 0;
        };
    }
    // Document.prototype.caretRangeFromPoint is not supported by Firefox (which use caretPositionFromPoint)
    if (!window.Document.prototype.caretRangeFromPoint && window.Document.prototype.caretPositionFromPoint) {
        Document.prototype.caretRangeFromPoint = function (x, y) {
            const point = document.caretPositionFromPoint(x, y);
            if (!point)
                return null;
            const range = document.createRange();
            range.setStart(point.offsetNode, point.offset);
            return range;
        };
    }
}
exports.default = default_1;
const uas = navigator.userAgent.match(/\b\w+\/[\d.]+\b/g).map((ua) => ua.split('/'));
const versions = uas.reduce((o, [name, value]) => {
    o[name] = parseInt(value);
    return o;
}, {});
const browserNamePriority = ['Edge', 'Chrome', 'Firefox', 'Safari'];
let browser;
exports.browser = browser;
for (const name of browserNamePriority) {
    if (name in versions) {
        exports.browser = browser = { name, version: versions[name] };
        break;
    }
}
if (!browser)
    exports.browser = browser = { name: 'Unknow', version: NaN };
if (!('exports' in window))
    window.exports = {};

},{}],19:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mutations = exports.walk = exports.ranges = exports.rects = exports.events = exports.debug = exports.io = exports.dom = exports.logger = exports.log = void 0;
const ranges_1 = require("./util/ranges");
const rects_1 = require("./util/rects");
var log;
(function (log_1) {
    let LogLevel;
    (function (LogLevel) {
        LogLevel[LogLevel["error"] = 0] = "error";
        LogLevel[LogLevel["warn"] = 1] = "warn";
        LogLevel[LogLevel["info"] = 2] = "info";
        LogLevel[LogLevel["debug"] = 3] = "debug";
    })(LogLevel = log_1.LogLevel || (log_1.LogLevel = {}));
    class Logger {
        constructor() {
            this._scopes = [];
            this._level = LogLevel.warn;
        }
        debug(message, scope) {
            this.log(LogLevel.debug, message, scope);
        }
        info(message, scope) {
            this.log(LogLevel.info, message, scope);
        }
        warn(message, scope) {
            this.log(LogLevel.warn, message, scope);
        }
        error(message, scope) {
            this.log(LogLevel.error, message, scope);
        }
        levelFromString(level) {
            if (level == "error")
                return 0;
            if (level == "warn")
                return 1;
            else if (level == "info")
                return 2;
            else if (level == "debug")
                return 3;
        }
        setLevel(level) {
            if (typeof level == 'string')
                this._level = this.levelFromString(level);
            else
                this._level = level;
        }
        setReporter(reporter) {
            this._reporter = reporter;
        }
        addScope(scope) {
            this._scopes.push(scope);
        }
        removeScope(count = 1) {
            for (let i = 0; i < count; i++)
                this._scopes.pop();
        }
        log(level, message, scope) {
            if (level > this._level || !this._reporter)
                return;
            const log = { level, message: typeof message == 'function' ? message() : message };
            if (scope)
                this._scopes.push(scope);
            if (this._scopes.length)
                log.scopes = this._scopes.map((scope) => typeof scope == 'string' ? scope : scope());
            this._reporter.log(log);
            if (scope)
                this._scopes.pop();
        }
    }
    log_1.Logger = Logger;
    log_1.defaultReporter = {
        log: function (log) {
            let message = log.message; //`[${Math.floor(performance.now()) / 1000}] ${log.message}`;
            if (log.scopes)
                message += ` (${log.scopes.join(', ')})`;
            if (log.level == LogLevel.error)
                console.error(message);
            else if (log.level == LogLevel.warn)
                console.warn(message);
            else if (log.level == LogLevel.info)
                console.info(message);
            else if (log.level == LogLevel.debug)
                console.debug(message);
        }
    };
})(log = exports.log || (exports.log = {}));
exports.logger = new log.Logger();
exports.logger.setReporter(log.defaultReporter);
var dom;
(function (dom) {
    let idCounter = 0;
    function id(element) {
        if (!element)
            return 'ps-' + idCounter++;
        return element.id || (element.id = 'ps-' + idCounter++);
    }
    dom.id = id;
    function docInteractive(doc = document) {
        return new Promise((resolve, reject) => {
            if (doc.readyState != 'loading')
                resolve();
            else
                doc.addEventListener('DOMContentLoaded', () => resolve());
        });
    }
    dom.docInteractive = docInteractive;
    function docComplete(doc = document) {
        return new Promise((resolve, reject) => {
            if (doc.readyState == 'complete')
                resolve();
            else {
                doc.defaultView.addEventListener('load', () => resolve());
                doc.defaultView.addEventListener('error', reject);
            }
        });
    }
    dom.docComplete = docComplete;
    function isElement(object) {
        return object && object.nodeType == Node.ELEMENT_NODE;
    }
    dom.isElement = isElement;
})(dom = exports.dom || (exports.dom = {}));
function decamelizeMatch(match) {
    return '-' + match.toLowerCase();
}
function decamelize(string) {
    return string.replace(/[A-Z]/g, decamelizeMatch);
}
var io;
(function (io) {
    function parseOptionsFromElement(element, defaultOptions) {
        const options = {};
        if (element.hasAttribute('ps-options'))
            Object.assign(options, JSON.parse(element.getAttribute('ps-options')));
        for (const key in defaultOptions) {
            const type = Array.isArray(defaultOptions[key]) ? 'array' : typeof defaultOptions[key];
            const attr = element.getAttribute('ps-' + decamelize(key));
            if (attr !== null) {
                if (type == 'boolean')
                    options[key] = attr == 'true';
                else if (type == 'array')
                    options[key] = attr.length ? attr.trim().split(' ') : null;
                else if (type == 'object')
                    options[key] = JSON.parse(attr);
                else if (type == 'string')
                    options[key] = attr;
                else if (type == 'number')
                    options[key] = parseFloat(attr);
            }
        }
        return options;
    }
    io.parseOptionsFromElement = parseOptionsFromElement;
    // The fetch API is not used because it does not support the file protocol
    // TODO Error status code ?
    function load(url) {
        return new Promise((resolve, reject) => {
            const request = new XMLHttpRequest();
            request.open('GET', url);
            request.onload = () => resolve(request.responseText);
            request.onerror = () => reject(new Error("Unable to fetch '" + url + "'"));
            request.send();
        });
    }
    io.load = load;
    // Usefull for plugins
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.addEventListener('error', () => {
                reject(new Error(`Unable to load the script '${url}'.`));
            });
            script.addEventListener('load', resolve);
            document.head.appendChild(script);
        });
    }
    io.loadScript = loadScript;
})(io = exports.io || (exports.io = {}));
var debug;
(function (debug) {
    function drawClientRects(rects, doc = document) {
        for (let i = 0; i != rects.length; i++) {
            const rect = rects[i];
            drawClientRect(rect, doc);
        }
    }
    debug.drawClientRects = drawClientRects;
    function drawClientRect(rect, doc = document) {
        const view = doc.defaultView;
        drawScrollRect({
            top: rect.top + view.scrollY,
            bottom: rect.bottom + view.scrollY,
            left: rect.left + view.scrollX,
            right: rect.right + view.scrollX
        }, doc);
    }
    debug.drawClientRect = drawClientRect;
    function drawScrollRect(rect, doc = document) {
        const rectDiv = document.createElement('div');
        rectDiv.style.position = 'absolute';
        rectDiv.style.border = '1px solid red';
        rectDiv.style.margin = rectDiv.style.padding = '0';
        rectDiv.style.top = rect.top + 'px';
        rectDiv.style.left = rect.left + 'px';
        rectDiv.style.width = (rect.right - rect.left - 2) + 'px';
        rectDiv.style.height = (rect.bottom - rect.top - 2) + 'px';
        doc.documentElement.appendChild(rectDiv);
    }
    debug.drawScrollRect = drawScrollRect;
    function drawPoint(point) {
        const view = point.container.ownerDocument.defaultView;
        let y;
        if (dom.isElement(point.container)) {
            const node = ranges_1.default.nodeAtPoint(point);
            if (!node)
                y = rects_1.default.boundingScrollRect(point.container).bottom;
            else if (dom.isElement(node))
                y = rects_1.default.boundingScrollRect(node).top;
            else {
                const range = document.createRange();
                range.selectNode(node);
                y = rects_1.default.scrollRect(range.getBoundingClientRect(), view).top;
            }
        }
        else {
            const range = document.createRange();
            range.setStartBefore(point.container);
            range.setEnd(point.container, point.offset);
            y = rects_1.default.scrollRect(range.getBoundingClientRect(), view).bottom;
        }
        const lineDiv = document.createElement('div');
        lineDiv.style.position = 'absolute';
        lineDiv.style.background = 'red';
        lineDiv.style.height = '1px';
        lineDiv.style.left = '0';
        lineDiv.style.width = '100%';
        lineDiv.style.top = y + 'px';
        document.documentElement.appendChild(lineDiv);
    }
    debug.drawPoint = drawPoint;
    function logCaretPositionOnClick(doc) {
        if (!doc)
            doc = document;
        doc.addEventListener('click', (event) => {
            const range = doc.caretRangeFromPoint(event.clientX, event.y);
            console.log(range.startContainer, range.startOffset);
        });
    }
    debug.logCaretPositionOnClick = logCaretPositionOnClick;
})(debug = exports.debug || (exports.debug = {}));
var events;
(function (events) {
    class EventEmitter {
        constructor() {
            this.on = this.addListener;
        }
        addListener(eventType, listener) {
            if (!this.listeners)
                this.listeners = Object.create(null);
            let lstns = this.listeners[eventType];
            if (!lstns) {
                lstns = [];
                this.listeners[eventType] = lstns;
            }
            lstns.push(listener);
            return this;
        }
        removeListener(eventType, callback) {
            const lstns = this.listeners && this.listeners[eventType];
            if (lstns)
                lstns.splice(lstns.indexOf(callback), 1);
            return this;
        }
        listenerCount(event) {
            const lstns = this.listeners && this.listeners[event];
            return lstns ? lstns.length : 0;
        }
        emit(event, target) {
            const eventObj = (typeof event == 'string' ? { type: event } : event);
            const lstns = this.listeners && this.listeners[eventObj.type];
            if (!lstns || !lstns.length)
                return;
            for (const listener of lstns) {
                const result = listener.call(this, eventObj, target);
                if (result !== undefined)
                    return result;
            }
        }
    }
    events.EventEmitter = EventEmitter;
})(events = exports.events || (exports.events = {}));
var rects_2 = require("./util/rects");
Object.defineProperty(exports, "rects", { enumerable: true, get: function () { return rects_2.default; } });
var ranges_2 = require("./util/ranges");
Object.defineProperty(exports, "ranges", { enumerable: true, get: function () { return ranges_2.default; } });
var walk_1 = require("./util/walk");
Object.defineProperty(exports, "walk", { enumerable: true, get: function () { return walk_1.default; } });
var mutations_1 = require("./util/mutations");
Object.defineProperty(exports, "Mutations", { enumerable: true, get: function () { return mutations_1.default; } });

},{"./util/mutations":20,"./util/ranges":21,"./util/rects":22,"./util/walk":23}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mutations = void 0;
const ranges_1 = require("./ranges");
const breaks_1 = require("../breaks");
const breaks_2 = require("../breaks");
class Mutations {
    constructor() {
        this._entries = [];
    }
    push(...entry) {
        this._entries.push(...entry);
    }
    revert() {
        let entry;
        while ((entry = this._entries.pop()))
            entry.revert();
    }
    commit(target) {
        if (target)
            target.push(...this._entries);
        this._entries.length = 0;
    }
    setProp(obj, propName, propValue) {
        const prevValue = obj[propName];
        obj[propName] = propValue;
        this.push({
            obj,
            propName,
            prevValue,
            revert() {
                this.obj[propName] = propValue;
            }
        });
    }
    setAttr(elem, attrName, attrValue) {
        const prevValue = elem.getAttribute(attrName);
        elem.setAttribute(attrName, attrValue === undefined ? '' : attrValue);
        this.push({
            elem,
            attrName,
            prevValue,
            revert() {
                if (this.prevValue === null)
                    this.elem.removeAttribute(this.attrName);
                else
                    this.elem.setAttribute(this.attrName, this.prevValue);
            }
        });
    }
    setStyle(elem, props) {
        const beforeProps = {};
        for (const propName in props) {
            beforeProps[propName] = elem.style.getPropertyValue(propName);
            elem.style.setProperty(propName, props[propName]);
            if (!elem.getAttribute('style'))
                elem.removeAttribute('style');
        }
        this.push({
            elem,
            beforeProps,
            revert() {
                for (const propName in this.beforeProps)
                    this.elem.style.setProperty(propName, this.beforeProps[propName]);
                if (!this.elem.getAttribute('style'))
                    this.elem.removeAttribute('style');
            }
        });
    }
    breaks(source, breakPoint, position) {
        const dest = breaks_1.breakAtPoint(source, breakPoint, position);
        this.push({
            before: position == "before" ? dest : source,
            after: position == "before" ? source : dest,
            position,
            revert() {
                breaks_2.unbreak(this.before, this.after, this.position == "before" ? "after" : "before");
            }
        });
        return dest;
    }
    insertNode(parent, newChild, refChild) {
        parent.insertBefore(newChild, refChild);
        this.push({
            node: newChild,
            revert() {
                this.node.remove();
            }
        });
    }
    appendNodeContents(srcNode, dstNode) {
        const lastDstChild = dstNode.lastChild;
        ranges_1.default.appendNodeContents(srcNode, dstNode);
        this.push({
            srcNode,
            dstNode,
            lastDstChild,
            revert() {
                const range = document.createRange();
                range.selectNodeContents(this.dstNode);
                if (this.lastDstChild)
                    range.setStartAfter(this.lastDstChild);
                this.srcNode.appendChild(range.extractContents());
            }
        });
    }
}
exports.Mutations = Mutations;
exports.default = Mutations;

},{"../breaks":1,"./ranges":21}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const walk_1 = require("./walk");
var ranges;
(function (ranges) {
    function isRange(object) {
        return object && object.constructor == Range;
    }
    ranges.isRange = isRange;
    function isPoint(object) {
        return object && 'container' in object && 'offset' in object;
    }
    ranges.isPoint = isPoint;
    function clonePoint(point) {
        return {
            container: point.container,
            offset: point.offset
        };
    }
    ranges.clonePoint = clonePoint;
    function pointEquals(point1, point2) {
        return point1.container == point2.container && point1.offset == point2.offset;
    }
    ranges.pointEquals = pointEquals;
    function breakRangeBefore(range, node) {
        const breaked = node.ownerDocument.createRange();
        breaked.setStart(range.startContainer, range.startOffset);
        breaked.setEndBefore(node);
        range.setStartBefore(node);
        return breaked;
    }
    ranges.breakRangeBefore = breakRangeBefore;
    function breakRangeAfter(range, node) {
        const breaked = node.ownerDocument.createRange();
        breaked.setStart(range.startContainer, range.startOffset);
        breaked.setEndAfter(node);
        range.setStartAfter(node);
        return breaked;
    }
    ranges.breakRangeAfter = breakRangeAfter;
    function positionBefore(node) {
        const range = node.ownerDocument.createRange();
        range.setStartBefore(node);
        return rangeStart(range);
    }
    ranges.positionBefore = positionBefore;
    function positionAfter(node) {
        const range = node.ownerDocument.createRange();
        range.setEndAfter(node);
        return rangeEnd(range);
    }
    ranges.positionAfter = positionAfter;
    function positionAtStart(node) {
        return { container: node, offset: 0 };
    }
    ranges.positionAtStart = positionAtStart;
    function positionAtEnd(node) {
        return { container: node, offset: node.childNodes.length };
    }
    ranges.positionAtEnd = positionAtEnd;
    function rangeStart(range) {
        return {
            container: range.startContainer,
            offset: range.startOffset
        };
    }
    ranges.rangeStart = rangeStart;
    function rangeEnd(range) {
        return {
            container: range.endContainer,
            offset: range.endOffset
        };
    }
    ranges.rangeEnd = rangeEnd;
    function startNode(range) {
        return range.startContainer.nodeType == Node.ELEMENT_NODE ? range.startContainer.childNodes[range.startOffset] : null;
    }
    ranges.startNode = startNode;
    function endNode(range) {
        return range.endContainer.nodeType == Node.ELEMENT_NODE ? range.endContainer.childNodes[range.endOffset - 1] : null;
    }
    ranges.endNode = endNode;
    function staticStartNode(range) {
        const start = startNode(range);
        if (walk_1.default.isStaticNode(start))
            return start;
        else
            return walk_1.default.next(start, walk_1.default.isStaticNode);
    }
    ranges.staticStartNode = staticStartNode;
    function staticEndNode(range) {
        const end = endNode(range);
        if (walk_1.default.isStaticNode(end))
            return end;
        else
            return walk_1.default.previous(end, walk_1.default.isStaticNode);
    }
    ranges.staticEndNode = staticEndNode;
    function nodeAtPoint(point) {
        return point.container.nodeType == Node.TEXT_NODE ? point.container : point.container.childNodes.item(point.offset);
    }
    ranges.nodeAtPoint = nodeAtPoint;
    // Difference with Range.isPointInRange: the endPoint is exclusive
    function containsPoint(range, point) {
        if (range.endContainer == point.container && range.endOffset == point.offset)
            return false;
        else
            return range.isPointInRange(point.container, point.offset);
    }
    ranges.containsPoint = containsPoint;
    function isPrecedingPoint(refPoint, testPoint) {
        if (testPoint.container == refPoint.container) {
            return testPoint.offset < refPoint.offset;
        }
        else {
            const range = new Range();
            range.setStart(testPoint.container, testPoint.offset);
            range.setEnd(refPoint.container, refPoint.offset);
            return !range.collapsed;
        }
    }
    ranges.isPrecedingPoint = isPrecedingPoint;
    function textPositionFromPoint(doc, x, y) {
        doc.defaultView.scrollTo(x, y);
        const range = doc.caretRangeFromPoint(x - doc.defaultView.scrollX, y - doc.defaultView.scrollY);
        return range ? {
            container: range.startContainer,
            offset: range.startOffset
        } : null;
    }
    ranges.textPositionFromPoint = textPositionFromPoint;
    function findPointInRanges(rangesList, point, reverse = false) {
        let range;
        if (reverse) {
            for (let rangeIndex = rangesList.length - 1; rangeIndex >= 0; rangeIndex--) {
                range = rangesList[rangeIndex];
                if (ranges.containsPoint(range, point))
                    return rangeIndex;
            }
        }
        else {
            for (let rangeIndex = 0; rangeIndex < rangesList.length; rangeIndex++) {
                range = rangesList[rangeIndex];
                if (ranges.containsPoint(range, point))
                    return rangeIndex;
            }
        }
        return -1;
    }
    ranges.findPointInRanges = findPointInRanges;
    function extractNodeContents(node) {
        const range = node.ownerDocument.createRange();
        range.selectNodeContents(node);
        return range.extractContents();
    }
    ranges.extractNodeContents = extractNodeContents;
    function appendNodeContents(srcNode, dstNode) {
        dstNode.appendChild(extractNodeContents(srcNode));
    }
    ranges.appendNodeContents = appendNodeContents;
})(ranges || (ranges = {}));
exports.default = ranges;

},{"./walk":23}],22:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ranges_1 = require("./ranges");
var rects;
(function (rects_1) {
    function boundingScrollRect(object) {
        if (ranges_1.default.isRange(object))
            return scrollRect(object.getBoundingClientRect(), object.commonAncestorContainer.ownerDocument.defaultView);
        else
            return scrollRect(object.getBoundingClientRect(), object.ownerDocument.defaultView);
    }
    rects_1.boundingScrollRect = boundingScrollRect;
    function scrollRect(clientRect, view) {
        return {
            top: clientRect.top + view.scrollY,
            bottom: clientRect.bottom + view.scrollY,
            left: clientRect.left + view.scrollX,
            right: clientRect.right + view.scrollX,
            width: clientRect.width,
            height: clientRect.height
        };
    }
    rects_1.scrollRect = scrollRect;
    function rectsLines(rects, view) {
        const lines = [];
        let lastLine = null;
        for (const rect of rects) {
            if (rect.left != rect.right) {
                if (!lastLine || (rect.bottom > lastLine.bottom && rect.top > lastLine.top && rect.left <= lastLine.left)) {
                    lastLine = {
                        left: rect.left,
                        bottom: rect.bottom,
                        right: rect.right,
                        top: rect.top
                    };
                    lines.push(lastLine);
                }
                else {
                    if (rect.top < lastLine.top)
                        lastLine.top = rect.top;
                    if (rect.bottom > lastLine.bottom)
                        lastLine.bottom = rect.bottom;
                    if (rect.right > lastLine.right)
                        lastLine.right = rect.right;
                }
            }
        }
        for (const line of lines) {
            line.top += view.scrollY;
            line.bottom += view.scrollY;
            line.left += view.scrollX;
            line.right += view.scrollX;
        }
        return lines;
    }
    rects_1.rectsLines = rectsLines;
    function equalRects(rect1, rect2) {
        return rect1.top != rect2.top || rect1.right != rect2.right || rect1.bottom != rect2.bottom || rect1.left != rect2.left;
    }
    rects_1.equalRects = equalRects;
    function includesRect(parentRect, rect) {
        return rect.top >= parentRect.top && rect.bottom <= parentRect.bottom && rect.left >= parentRect.left && rect.right <= parentRect.right;
    }
    rects_1.includesRect = includesRect;
    function bottomWithoutPadding(element, rect) {
        if (!rect)
            rect = boundingScrollRect(element);
        const paddingBottom = parseFloat(getComputedStyle(element).paddingBottom);
        return Math.floor(rect.bottom - paddingBottom);
    }
    rects_1.bottomWithoutPadding = bottomWithoutPadding;
    function contentSizingHeight(style, baseHeight) {
        return baseHeight - parseFloat(style.paddingTop)
            - parseFloat(style.paddingBottom)
            - parseFloat(style.borderTopWidth)
            - parseFloat(style.borderBottomWidth);
    }
    rects_1.contentSizingHeight = contentSizingHeight;
})(rects || (rects = {}));
exports.default = rects;

},{"./ranges":21}],23:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var walk;
(function (walk) {
    function createWalker(root, accept, skip) {
        return root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ALL, {
            acceptNode(node) {
                if (!accept || accept(node))
                    return NodeFilter.FILTER_ACCEPT;
                else if (skip && skip(node))
                    return NodeFilter.FILTER_SKIP;
                return NodeFilter.FILTER_REJECT;
            }
        });
    }
    walk.createWalker = createWalker;
    function createIterator(root, accept, skip) {
        return root.ownerDocument.createNodeIterator(root, NodeFilter.SHOW_ALL, {
            acceptNode(node) {
                if (!accept || accept(node))
                    return NodeFilter.FILTER_ACCEPT;
                else if (skip && skip(node))
                    return NodeFilter.FILTER_SKIP;
                return NodeFilter.FILTER_REJECT;
            }
        });
    }
    walk.createIterator = createIterator;
    function firstChild(from, predicate) {
        let node = from ? from.firstChild : null;
        while (node) {
            if (predicate(node))
                return node;
            node = node.nextSibling;
        }
        return null;
    }
    walk.firstChild = firstChild;
    function lastChild(from, predicate) {
        let node = from ? from.lastChild : null;
        while (node) {
            if (predicate(node))
                return node;
            node = node.previousSibling;
        }
        return null;
    }
    walk.lastChild = lastChild;
    function nextSibling(from, predicate) {
        let node = from ? from.nextSibling : null;
        while (node) {
            if (predicate(node))
                return node;
            node = node.nextSibling;
        }
        return null;
    }
    walk.nextSibling = nextSibling;
    function previousSibling(from, predicate) {
        let node = from ? from.previousSibling : null;
        while (node) {
            if (predicate(node))
                return node;
            node = node.previousSibling;
        }
        return null;
    }
    walk.previousSibling = previousSibling;
    function ancestor(from, predicate, root) {
        let node = from.parentNode;
        while (node && node !== root) {
            if (predicate(node))
                return node;
            node = node.parentNode;
        }
        return null;
    }
    walk.ancestor = ancestor;
    function ancestorOrSelf(from, predicate, root) {
        let node = from;
        while (node && node !== root) {
            if (predicate(node))
                return node;
            node = node.parentNode;
        }
        return null;
    }
    walk.ancestorOrSelf = ancestorOrSelf;
    function next(from, predicate, root) {
        let node = from.firstChild;
        if (node)
            return predicate(node) ? node : next(node, predicate, root);
        if (from === root)
            return null;
        while (!(node = from.nextSibling)) {
            from = from.parentNode;
            if (from === root)
                return null;
        }
        return predicate(node) ? node : next(node, predicate, root);
    }
    walk.next = next;
    function previous(from, predicate, root) {
        if (from === root)
            return null;
        let node = from.previousSibling;
        if (node) {
            let child = node.lastChild;
            while (child) {
                node = child;
                child = child.lastChild;
            }
            return predicate(node) ? node : previous(node, predicate, root);
        }
        node = from.parentNode;
        return node === root ? null : predicate(node) ? node : previous(node, predicate, root);
    }
    walk.previous = previous;
    function all(axis, from, predicate, root) {
        const nodes = [];
        let node = from;
        while ((node = axis(node, predicate, root)))
            nodes.push(node);
        return nodes;
    }
    walk.all = all;
    function isNode(node) {
        return true;
    }
    walk.isNode = isNode;
    function isElement(node) {
        return node && node.nodeType == Node.ELEMENT_NODE;
    }
    walk.isElement = isElement;
    function isHTMLElement(node) {
        return isElement(node) && 'innerText' in node;
    }
    walk.isHTMLElement = isHTMLElement;
    function isText(node) {
        return node && node.nodeType == Node.TEXT_NODE;
    }
    walk.isText = isText;
    function isConstructedBy(constructor) {
        return function (node) {
            return node.constructor == constructor;
        };
    }
    walk.isConstructedBy = isConstructedBy;
    function isInstanceOf(constructor) {
        return function (node) {
            return node instanceof constructor;
        };
    }
    walk.isInstanceOf = isInstanceOf;
    /*
     * Fonction de parcours de l'arbre static
     */
    function isStaticStyle(style) {
        return style.display != 'none' && style.display != 'table-column-group' && (style.position == 'static' || style.position == 'relative');
    }
    walk.isStaticStyle = isStaticStyle;
    function isStatic(node) {
        if (isText(node))
            return node.nodeValue.trim().length != 0;
        else if (isElement(node))
            return isStaticStyle(getComputedStyle(node));
        return false;
    }
    walk.isStatic = isStatic;
    function isRow(style) {
        if (style.display == 'table-row')
            return 'table-row';
        else if (style.display == 'flex' && style.flexDirection.startsWith('row'))
            return 'flex-row';
        return false;
    }
    walk.isRow = isRow;
    function predicate(typeGuard, ...predicates) {
        return ((node) => {
            if (typeGuard && !typeGuard(node))
                return false;
            return predicates.every((predicate) => predicate(node));
        });
    }
    walk.predicate = predicate;
    function displayAsBlockStyle(style) {
        return style.float != 'none' || !(style.display.startsWith('inline') || style.display.startsWith('ruby') || style.display.startsWith('table-column'));
    }
    walk.displayAsBlockStyle = displayAsBlockStyle;
    function displayAsBlock(node) {
        if (isText(node))
            return false;
        else if (isElement(node))
            return displayAsBlockStyle(getComputedStyle(node));
    }
    walk.displayAsBlock = displayAsBlock;
    function displayAsInlineBlock(node) {
        if (isText(node))
            return false;
        else if (isElement(node)) {
            const style = getComputedStyle(node);
            return style.display.startsWith("inline-") || (style.display == "inline" && node instanceof SVGElement);
        }
    }
    walk.displayAsInlineBlock = displayAsInlineBlock;
    function isDisplayed(element) {
        const style = getComputedStyle(element);
        return style.display != 'none';
    }
    walk.isDisplayed = isDisplayed;
    function hasSize(element) {
        return element.clientWidth != 0 || element.clientHeight != 0;
    }
    walk.hasSize = hasSize;
    function isBreakedAfter(elem) {
        return elem.hasAttribute('ps-breaked-after');
    }
    walk.isBreakedAfter = isBreakedAfter;
    walk.isStaticNode = isStatic;
    walk.isStaticElement = walk.predicate(walk.isElement, walk.isStatic);
    walk.isStaticHtmlElement = walk.predicate(walk.isHTMLElement, walk.isStatic);
    walk.isStaticHtmlBlock = walk.predicate(walk.isHTMLElement, walk.isStatic, walk.displayAsBlock);
    walk.isBlockElement = walk.predicate(walk.isElement, walk.displayAsBlock);
    walk.isInlineBlockElement = walk.predicate(walk.isElement, walk.displayAsInlineBlock);
})(walk || (walk = {}));
exports.default = walk;

},{}],24:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],25:[function(require,module,exports){

},{}],26:[function(require,module,exports){
(function (Buffer){(function (){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this)}).call(this,require("buffer").Buffer)

},{"base64-js":24,"buffer":26,"ieee754":27}],27:[function(require,module,exports){
/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],28:[function(require,module,exports){
(function (process){(function (){
// 'path' module extracted from Node.js v8.11.1 (only the posix part)
// transplited with Babel

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

function assertPath(path) {
  if (typeof path !== 'string') {
    throw new TypeError('Path must be a string. Received ' + JSON.stringify(path));
  }
}

// Resolves . and .. elements in a path with directory names
function normalizeStringPosix(path, allowAboveRoot) {
  var res = '';
  var lastSegmentLength = 0;
  var lastSlash = -1;
  var dots = 0;
  var code;
  for (var i = 0; i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (code === 47 /*/*/)
      break;
    else
      code = 47 /*/*/;
    if (code === 47 /*/*/) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 /*.*/ || res.charCodeAt(res.length - 2) !== 46 /*.*/) {
          if (res.length > 2) {
            var lastSlashIndex = res.lastIndexOf('/');
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1) {
                res = '';
                lastSegmentLength = 0;
              } else {
                res = res.slice(0, lastSlashIndex);
                lastSegmentLength = res.length - 1 - res.lastIndexOf('/');
              }
              lastSlash = i;
              dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = '';
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0)
            res += '/..';
          else
            res = '..';
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0)
          res += '/' + path.slice(lastSlash + 1, i);
        else
          res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === 46 /*.*/ && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}

function _format(sep, pathObject) {
  var dir = pathObject.dir || pathObject.root;
  var base = pathObject.base || (pathObject.name || '') + (pathObject.ext || '');
  if (!dir) {
    return base;
  }
  if (dir === pathObject.root) {
    return dir + base;
  }
  return dir + sep + base;
}

var posix = {
  // path.resolve([from ...], to)
  resolve: function resolve() {
    var resolvedPath = '';
    var resolvedAbsolute = false;
    var cwd;

    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path;
      if (i >= 0)
        path = arguments[i];
      else {
        if (cwd === undefined)
          cwd = process.cwd();
        path = cwd;
      }

      assertPath(path);

      // Skip empty entries
      if (path.length === 0) {
        continue;
      }

      resolvedPath = path + '/' + resolvedPath;
      resolvedAbsolute = path.charCodeAt(0) === 47 /*/*/;
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute);

    if (resolvedAbsolute) {
      if (resolvedPath.length > 0)
        return '/' + resolvedPath;
      else
        return '/';
    } else if (resolvedPath.length > 0) {
      return resolvedPath;
    } else {
      return '.';
    }
  },

  normalize: function normalize(path) {
    assertPath(path);

    if (path.length === 0) return '.';

    var isAbsolute = path.charCodeAt(0) === 47 /*/*/;
    var trailingSeparator = path.charCodeAt(path.length - 1) === 47 /*/*/;

    // Normalize the path
    path = normalizeStringPosix(path, !isAbsolute);

    if (path.length === 0 && !isAbsolute) path = '.';
    if (path.length > 0 && trailingSeparator) path += '/';

    if (isAbsolute) return '/' + path;
    return path;
  },

  isAbsolute: function isAbsolute(path) {
    assertPath(path);
    return path.length > 0 && path.charCodeAt(0) === 47 /*/*/;
  },

  join: function join() {
    if (arguments.length === 0)
      return '.';
    var joined;
    for (var i = 0; i < arguments.length; ++i) {
      var arg = arguments[i];
      assertPath(arg);
      if (arg.length > 0) {
        if (joined === undefined)
          joined = arg;
        else
          joined += '/' + arg;
      }
    }
    if (joined === undefined)
      return '.';
    return posix.normalize(joined);
  },

  relative: function relative(from, to) {
    assertPath(from);
    assertPath(to);

    if (from === to) return '';

    from = posix.resolve(from);
    to = posix.resolve(to);

    if (from === to) return '';

    // Trim any leading backslashes
    var fromStart = 1;
    for (; fromStart < from.length; ++fromStart) {
      if (from.charCodeAt(fromStart) !== 47 /*/*/)
        break;
    }
    var fromEnd = from.length;
    var fromLen = fromEnd - fromStart;

    // Trim any leading backslashes
    var toStart = 1;
    for (; toStart < to.length; ++toStart) {
      if (to.charCodeAt(toStart) !== 47 /*/*/)
        break;
    }
    var toEnd = to.length;
    var toLen = toEnd - toStart;

    // Compare paths to find the longest common path from root
    var length = fromLen < toLen ? fromLen : toLen;
    var lastCommonSep = -1;
    var i = 0;
    for (; i <= length; ++i) {
      if (i === length) {
        if (toLen > length) {
          if (to.charCodeAt(toStart + i) === 47 /*/*/) {
            // We get here if `from` is the exact base path for `to`.
            // For example: from='/foo/bar'; to='/foo/bar/baz'
            return to.slice(toStart + i + 1);
          } else if (i === 0) {
            // We get here if `from` is the root
            // For example: from='/'; to='/foo'
            return to.slice(toStart + i);
          }
        } else if (fromLen > length) {
          if (from.charCodeAt(fromStart + i) === 47 /*/*/) {
            // We get here if `to` is the exact base path for `from`.
            // For example: from='/foo/bar/baz'; to='/foo/bar'
            lastCommonSep = i;
          } else if (i === 0) {
            // We get here if `to` is the root.
            // For example: from='/foo'; to='/'
            lastCommonSep = 0;
          }
        }
        break;
      }
      var fromCode = from.charCodeAt(fromStart + i);
      var toCode = to.charCodeAt(toStart + i);
      if (fromCode !== toCode)
        break;
      else if (fromCode === 47 /*/*/)
        lastCommonSep = i;
    }

    var out = '';
    // Generate the relative path based on the path difference between `to`
    // and `from`
    for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
      if (i === fromEnd || from.charCodeAt(i) === 47 /*/*/) {
        if (out.length === 0)
          out += '..';
        else
          out += '/..';
      }
    }

    // Lastly, append the rest of the destination (`to`) path that comes after
    // the common path parts
    if (out.length > 0)
      return out + to.slice(toStart + lastCommonSep);
    else {
      toStart += lastCommonSep;
      if (to.charCodeAt(toStart) === 47 /*/*/)
        ++toStart;
      return to.slice(toStart);
    }
  },

  _makeLong: function _makeLong(path) {
    return path;
  },

  dirname: function dirname(path) {
    assertPath(path);
    if (path.length === 0) return '.';
    var code = path.charCodeAt(0);
    var hasRoot = code === 47 /*/*/;
    var end = -1;
    var matchedSlash = true;
    for (var i = path.length - 1; i >= 1; --i) {
      code = path.charCodeAt(i);
      if (code === 47 /*/*/) {
          if (!matchedSlash) {
            end = i;
            break;
          }
        } else {
        // We saw the first non-path separator
        matchedSlash = false;
      }
    }

    if (end === -1) return hasRoot ? '/' : '.';
    if (hasRoot && end === 1) return '//';
    return path.slice(0, end);
  },

  basename: function basename(path, ext) {
    if (ext !== undefined && typeof ext !== 'string') throw new TypeError('"ext" argument must be a string');
    assertPath(path);

    var start = 0;
    var end = -1;
    var matchedSlash = true;
    var i;

    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
      if (ext.length === path.length && ext === path) return '';
      var extIdx = ext.length - 1;
      var firstNonSlashEnd = -1;
      for (i = path.length - 1; i >= 0; --i) {
        var code = path.charCodeAt(i);
        if (code === 47 /*/*/) {
            // If we reached a path separator that was not part of a set of path
            // separators at the end of the string, stop now
            if (!matchedSlash) {
              start = i + 1;
              break;
            }
          } else {
          if (firstNonSlashEnd === -1) {
            // We saw the first non-path separator, remember this index in case
            // we need it if the extension ends up not matching
            matchedSlash = false;
            firstNonSlashEnd = i + 1;
          }
          if (extIdx >= 0) {
            // Try to match the explicit extension
            if (code === ext.charCodeAt(extIdx)) {
              if (--extIdx === -1) {
                // We matched the extension, so mark this as the end of our path
                // component
                end = i;
              }
            } else {
              // Extension does not match, so our result is the entire path
              // component
              extIdx = -1;
              end = firstNonSlashEnd;
            }
          }
        }
      }

      if (start === end) end = firstNonSlashEnd;else if (end === -1) end = path.length;
      return path.slice(start, end);
    } else {
      for (i = path.length - 1; i >= 0; --i) {
        if (path.charCodeAt(i) === 47 /*/*/) {
            // If we reached a path separator that was not part of a set of path
            // separators at the end of the string, stop now
            if (!matchedSlash) {
              start = i + 1;
              break;
            }
          } else if (end === -1) {
          // We saw the first non-path separator, mark this as the end of our
          // path component
          matchedSlash = false;
          end = i + 1;
        }
      }

      if (end === -1) return '';
      return path.slice(start, end);
    }
  },

  extname: function extname(path) {
    assertPath(path);
    var startDot = -1;
    var startPart = 0;
    var end = -1;
    var matchedSlash = true;
    // Track the state of characters (if any) we see before our first dot and
    // after any path separator we find
    var preDotState = 0;
    for (var i = path.length - 1; i >= 0; --i) {
      var code = path.charCodeAt(i);
      if (code === 47 /*/*/) {
          // If we reached a path separator that was not part of a set of path
          // separators at the end of the string, stop now
          if (!matchedSlash) {
            startPart = i + 1;
            break;
          }
          continue;
        }
      if (end === -1) {
        // We saw the first non-path separator, mark this as the end of our
        // extension
        matchedSlash = false;
        end = i + 1;
      }
      if (code === 46 /*.*/) {
          // If this is our first dot, mark it as the start of our extension
          if (startDot === -1)
            startDot = i;
          else if (preDotState !== 1)
            preDotState = 1;
      } else if (startDot !== -1) {
        // We saw a non-dot and non-path separator before our dot, so we should
        // have a good chance at having a non-empty extension
        preDotState = -1;
      }
    }

    if (startDot === -1 || end === -1 ||
        // We saw a non-dot character immediately before the dot
        preDotState === 0 ||
        // The (right-most) trimmed path component is exactly '..'
        preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
      return '';
    }
    return path.slice(startDot, end);
  },

  format: function format(pathObject) {
    if (pathObject === null || typeof pathObject !== 'object') {
      throw new TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof pathObject);
    }
    return _format('/', pathObject);
  },

  parse: function parse(path) {
    assertPath(path);

    var ret = { root: '', dir: '', base: '', ext: '', name: '' };
    if (path.length === 0) return ret;
    var code = path.charCodeAt(0);
    var isAbsolute = code === 47 /*/*/;
    var start;
    if (isAbsolute) {
      ret.root = '/';
      start = 1;
    } else {
      start = 0;
    }
    var startDot = -1;
    var startPart = 0;
    var end = -1;
    var matchedSlash = true;
    var i = path.length - 1;

    // Track the state of characters (if any) we see before our first dot and
    // after any path separator we find
    var preDotState = 0;

    // Get non-dir info
    for (; i >= start; --i) {
      code = path.charCodeAt(i);
      if (code === 47 /*/*/) {
          // If we reached a path separator that was not part of a set of path
          // separators at the end of the string, stop now
          if (!matchedSlash) {
            startPart = i + 1;
            break;
          }
          continue;
        }
      if (end === -1) {
        // We saw the first non-path separator, mark this as the end of our
        // extension
        matchedSlash = false;
        end = i + 1;
      }
      if (code === 46 /*.*/) {
          // If this is our first dot, mark it as the start of our extension
          if (startDot === -1) startDot = i;else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
        // We saw a non-dot and non-path separator before our dot, so we should
        // have a good chance at having a non-empty extension
        preDotState = -1;
      }
    }

    if (startDot === -1 || end === -1 ||
    // We saw a non-dot character immediately before the dot
    preDotState === 0 ||
    // The (right-most) trimmed path component is exactly '..'
    preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
      if (end !== -1) {
        if (startPart === 0 && isAbsolute) ret.base = ret.name = path.slice(1, end);else ret.base = ret.name = path.slice(startPart, end);
      }
    } else {
      if (startPart === 0 && isAbsolute) {
        ret.name = path.slice(1, startDot);
        ret.base = path.slice(1, end);
      } else {
        ret.name = path.slice(startPart, startDot);
        ret.base = path.slice(startPart, end);
      }
      ret.ext = path.slice(startDot, end);
    }

    if (startPart > 0) ret.dir = path.slice(0, startPart - 1);else if (isAbsolute) ret.dir = '/';

    return ret;
  },

  sep: '/',
  delimiter: ':',
  win32: null,
  posix: null
};

posix.posix = posix;

module.exports = posix;

}).call(this)}).call(this,require('_process'))

},{"_process":71}],29:[function(require,module,exports){
"use strict";

var Input = require('postcss/lib/input');

var SafeParser = require('./safe-parser');

module.exports = function safeParse(css, opts) {
  var input = new Input(css, opts);
  var parser = new SafeParser(input);
  parser.parse();
  return parser.root;
};


},{"./safe-parser":30,"postcss/lib/input":41}],30:[function(require,module,exports){
"use strict";

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

var tokenizer = require('postcss/lib/tokenize');

var Comment = require('postcss/lib/comment');

var Parser = require('postcss/lib/parser');

var SafeParser =
/*#__PURE__*/
function (_Parser) {
  _inheritsLoose(SafeParser, _Parser);

  function SafeParser() {
    return _Parser.apply(this, arguments) || this;
  }

  var _proto = SafeParser.prototype;

  _proto.createTokenizer = function createTokenizer() {
    this.tokenizer = tokenizer(this.input, {
      ignoreErrors: true
    });
  };

  _proto.comment = function comment(token) {
    var node = new Comment();
    this.init(node, token[2], token[3]);
    node.source.end = {
      line: token[4],
      column: token[5]
    };
    var text = token[1].slice(2);
    if (text.slice(-2) === '*/') text = text.slice(0, -2);

    if (/^\s*$/.test(text)) {
      node.text = '';
      node.raws.left = text;
      node.raws.right = '';
    } else {
      var match = text.match(/^(\s*)([^]*\S)(\s*)$/);
      node.text = match[2];
      node.raws.left = match[1];
      node.raws.right = match[3];
    }
  };

  _proto.decl = function decl(tokens) {
    if (tokens.length > 1 && tokens.some(function (i) {
      return i[0] === 'word';
    })) {
      _Parser.prototype.decl.call(this, tokens);
    }
  };

  _proto.unclosedBracket = function unclosedBracket() {};

  _proto.unknownWord = function unknownWord(tokens) {
    this.spaces += tokens.map(function (i) {
      return i[1];
    }).join('');
  };

  _proto.unexpectedClose = function unexpectedClose() {
    this.current.raws.after += '}';
  };

  _proto.doubleColon = function doubleColon() {};

  _proto.unnamedAtrule = function unnamedAtrule(node) {
    node.name = '';
  };

  _proto.precheckMissedSemicolon = function precheckMissedSemicolon(tokens) {
    var colon = this.colon(tokens);
    if (colon === false) return;
    var split;

    for (split = colon - 1; split >= 0; split--) {
      if (tokens[split][0] === 'word') break;
    }

    for (split -= 1; split >= 0; split--) {
      if (tokens[split][0] !== 'space') {
        split += 1;
        break;
      }
    }

    var other = tokens.splice(split, tokens.length - split);
    this.decl(other);
  };

  _proto.checkMissedSemicolon = function checkMissedSemicolon() {};

  _proto.endFile = function endFile() {
    if (this.current.nodes && this.current.nodes.length) {
      this.current.raws.semicolon = this.semicolon;
    }

    this.current.raws.after = (this.current.raws.after || '') + this.spaces;

    while (this.current.parent) {
      this.current = this.current.parent;
      this.current.raws.after = '';
    }
  };

  return SafeParser;
}(Parser);

module.exports = SafeParser;


},{"postcss/lib/comment":37,"postcss/lib/parser":47,"postcss/lib/tokenize":56}],31:[function(require,module,exports){
var parse = require("./parse");
var walk = require("./walk");
var stringify = require("./stringify");

function ValueParser(value) {
  if (this instanceof ValueParser) {
    this.nodes = parse(value);
    return this;
  }
  return new ValueParser(value);
}

ValueParser.prototype.toString = function() {
  return Array.isArray(this.nodes) ? stringify(this.nodes) : "";
};

ValueParser.prototype.walk = function(cb, bubble) {
  walk(this.nodes, cb, bubble);
  return this;
};

ValueParser.unit = require("./unit");

ValueParser.walk = walk;

ValueParser.stringify = stringify;

module.exports = ValueParser;

},{"./parse":32,"./stringify":33,"./unit":34,"./walk":35}],32:[function(require,module,exports){
var openParentheses = "(".charCodeAt(0);
var closeParentheses = ")".charCodeAt(0);
var singleQuote = "'".charCodeAt(0);
var doubleQuote = '"'.charCodeAt(0);
var backslash = "\\".charCodeAt(0);
var slash = "/".charCodeAt(0);
var comma = ",".charCodeAt(0);
var colon = ":".charCodeAt(0);
var star = "*".charCodeAt(0);
var uLower = "u".charCodeAt(0);
var uUpper = "U".charCodeAt(0);
var plus = "+".charCodeAt(0);
var isUnicodeRange = /^[a-f0-9?-]+$/i;

module.exports = function(input) {
  var tokens = [];
  var value = input;

  var next,
    quote,
    prev,
    token,
    escape,
    escapePos,
    whitespacePos,
    parenthesesOpenPos;
  var pos = 0;
  var code = value.charCodeAt(pos);
  var max = value.length;
  var stack = [{ nodes: tokens }];
  var balanced = 0;
  var parent;

  var name = "";
  var before = "";
  var after = "";

  while (pos < max) {
    // Whitespaces
    if (code <= 32) {
      next = pos;
      do {
        next += 1;
        code = value.charCodeAt(next);
      } while (code <= 32);
      token = value.slice(pos, next);

      prev = tokens[tokens.length - 1];
      if (code === closeParentheses && balanced) {
        after = token;
      } else if (prev && prev.type === "div") {
        prev.after = token;
      } else if (
        code === comma ||
        code === colon ||
        (code === slash &&
          value.charCodeAt(next + 1) !== star &&
          (!parent ||
            (parent && parent.type === "function" && parent.value !== "calc")))
      ) {
        before = token;
      } else {
        tokens.push({
          type: "space",
          sourceIndex: pos,
          value: token
        });
      }

      pos = next;

      // Quotes
    } else if (code === singleQuote || code === doubleQuote) {
      next = pos;
      quote = code === singleQuote ? "'" : '"';
      token = {
        type: "string",
        sourceIndex: pos,
        quote: quote
      };
      do {
        escape = false;
        next = value.indexOf(quote, next + 1);
        if (~next) {
          escapePos = next;
          while (value.charCodeAt(escapePos - 1) === backslash) {
            escapePos -= 1;
            escape = !escape;
          }
        } else {
          value += quote;
          next = value.length - 1;
          token.unclosed = true;
        }
      } while (escape);
      token.value = value.slice(pos + 1, next);

      tokens.push(token);
      pos = next + 1;
      code = value.charCodeAt(pos);

      // Comments
    } else if (code === slash && value.charCodeAt(pos + 1) === star) {
      token = {
        type: "comment",
        sourceIndex: pos
      };

      next = value.indexOf("*/", pos);
      if (next === -1) {
        token.unclosed = true;
        next = value.length;
      }

      token.value = value.slice(pos + 2, next);
      tokens.push(token);

      pos = next + 2;
      code = value.charCodeAt(pos);

      // Operation within calc
    } else if (
      (code === slash || code === star) &&
      parent &&
      parent.type === "function" &&
      parent.value === "calc"
    ) {
      token = value[pos];
      tokens.push({
        type: "word",
        sourceIndex: pos - before.length,
        value: token
      });
      pos += 1;
      code = value.charCodeAt(pos);

      // Dividers
    } else if (code === slash || code === comma || code === colon) {
      token = value[pos];

      tokens.push({
        type: "div",
        sourceIndex: pos - before.length,
        value: token,
        before: before,
        after: ""
      });
      before = "";

      pos += 1;
      code = value.charCodeAt(pos);

      // Open parentheses
    } else if (openParentheses === code) {
      // Whitespaces after open parentheses
      next = pos;
      do {
        next += 1;
        code = value.charCodeAt(next);
      } while (code <= 32);
      parenthesesOpenPos = pos;
      token = {
        type: "function",
        sourceIndex: pos - name.length,
        value: name,
        before: value.slice(parenthesesOpenPos + 1, next)
      };
      pos = next;

      if (name === "url" && code !== singleQuote && code !== doubleQuote) {
        next -= 1;
        do {
          escape = false;
          next = value.indexOf(")", next + 1);
          if (~next) {
            escapePos = next;
            while (value.charCodeAt(escapePos - 1) === backslash) {
              escapePos -= 1;
              escape = !escape;
            }
          } else {
            value += ")";
            next = value.length - 1;
            token.unclosed = true;
          }
        } while (escape);
        // Whitespaces before closed
        whitespacePos = next;
        do {
          whitespacePos -= 1;
          code = value.charCodeAt(whitespacePos);
        } while (code <= 32);
        if (parenthesesOpenPos < whitespacePos) {
          if (pos !== whitespacePos + 1) {
            token.nodes = [
              {
                type: "word",
                sourceIndex: pos,
                value: value.slice(pos, whitespacePos + 1)
              }
            ];
          } else {
            token.nodes = [];
          }
          if (token.unclosed && whitespacePos + 1 !== next) {
            token.after = "";
            token.nodes.push({
              type: "space",
              sourceIndex: whitespacePos + 1,
              value: value.slice(whitespacePos + 1, next)
            });
          } else {
            token.after = value.slice(whitespacePos + 1, next);
          }
        } else {
          token.after = "";
          token.nodes = [];
        }
        pos = next + 1;
        code = value.charCodeAt(pos);
        tokens.push(token);
      } else {
        balanced += 1;
        token.after = "";
        tokens.push(token);
        stack.push(token);
        tokens = token.nodes = [];
        parent = token;
      }
      name = "";

      // Close parentheses
    } else if (closeParentheses === code && balanced) {
      pos += 1;
      code = value.charCodeAt(pos);

      parent.after = after;
      after = "";
      balanced -= 1;
      stack.pop();
      parent = stack[balanced];
      tokens = parent.nodes;

      // Words
    } else {
      next = pos;
      do {
        if (code === backslash) {
          next += 1;
        }
        next += 1;
        code = value.charCodeAt(next);
      } while (
        next < max &&
        !(
          code <= 32 ||
          code === singleQuote ||
          code === doubleQuote ||
          code === comma ||
          code === colon ||
          code === slash ||
          code === openParentheses ||
          (code === star &&
            parent &&
            parent.type === "function" &&
            parent.value === "calc") ||
          (code === slash &&
            parent.type === "function" &&
            parent.value === "calc") ||
          (code === closeParentheses && balanced)
        )
      );
      token = value.slice(pos, next);

      if (openParentheses === code) {
        name = token;
      } else if (
        (uLower === token.charCodeAt(0) || uUpper === token.charCodeAt(0)) &&
        plus === token.charCodeAt(1) &&
        isUnicodeRange.test(token.slice(2))
      ) {
        tokens.push({
          type: "unicode-range",
          sourceIndex: pos,
          value: token
        });
      } else {
        tokens.push({
          type: "word",
          sourceIndex: pos,
          value: token
        });
      }

      pos = next;
    }
  }

  for (pos = stack.length - 1; pos; pos -= 1) {
    stack[pos].unclosed = true;
  }

  return stack[0].nodes;
};

},{}],33:[function(require,module,exports){
function stringifyNode(node, custom) {
  var type = node.type;
  var value = node.value;
  var buf;
  var customResult;

  if (custom && (customResult = custom(node)) !== undefined) {
    return customResult;
  } else if (type === "word" || type === "space") {
    return value;
  } else if (type === "string") {
    buf = node.quote || "";
    return buf + value + (node.unclosed ? "" : buf);
  } else if (type === "comment") {
    return "/*" + value + (node.unclosed ? "" : "*/");
  } else if (type === "div") {
    return (node.before || "") + value + (node.after || "");
  } else if (Array.isArray(node.nodes)) {
    buf = stringify(node.nodes, custom);
    if (type !== "function") {
      return buf;
    }
    return (
      value +
      "(" +
      (node.before || "") +
      buf +
      (node.after || "") +
      (node.unclosed ? "" : ")")
    );
  }
  return value;
}

function stringify(nodes, custom) {
  var result, i;

  if (Array.isArray(nodes)) {
    result = "";
    for (i = nodes.length - 1; ~i; i -= 1) {
      result = stringifyNode(nodes[i], custom) + result;
    }
    return result;
  }
  return stringifyNode(nodes, custom);
}

module.exports = stringify;

},{}],34:[function(require,module,exports){
var minus = "-".charCodeAt(0);
var plus = "+".charCodeAt(0);
var dot = ".".charCodeAt(0);
var exp = "e".charCodeAt(0);
var EXP = "E".charCodeAt(0);

// Check if three code points would start a number
// https://www.w3.org/TR/css-syntax-3/#starts-with-a-number
function likeNumber(value) {
  var code = value.charCodeAt(0);
  var nextCode;

  if (code === plus || code === minus) {
    nextCode = value.charCodeAt(1);

    if (nextCode >= 48 && nextCode <= 57) {
      return true;
    }

    var nextNextCode = value.charCodeAt(2);

    if (nextCode === dot && nextNextCode >= 48 && nextNextCode <= 57) {
      return true;
    }

    return false;
  }

  if (code === dot) {
    nextCode = value.charCodeAt(1);

    if (nextCode >= 48 && nextCode <= 57) {
      return true;
    }

    return false;
  }

  if (code >= 48 && code <= 57) {
    return true;
  }

  return false;
}

// Consume a number
// https://www.w3.org/TR/css-syntax-3/#consume-number
module.exports = function(value) {
  var pos = 0;
  var length = value.length;
  var code;
  var nextCode;
  var nextNextCode;

  if (length === 0 || !likeNumber(value)) {
    return false;
  }

  code = value.charCodeAt(pos);

  if (code === plus || code === minus) {
    pos++;
  }

  while (pos < length) {
    code = value.charCodeAt(pos);

    if (code < 48 || code > 57) {
      break;
    }

    pos += 1;
  }

  code = value.charCodeAt(pos);
  nextCode = value.charCodeAt(pos + 1);

  if (code === dot && nextCode >= 48 && nextCode <= 57) {
    pos += 2;

    while (pos < length) {
      code = value.charCodeAt(pos);

      if (code < 48 || code > 57) {
        break;
      }

      pos += 1;
    }
  }

  code = value.charCodeAt(pos);
  nextCode = value.charCodeAt(pos + 1);
  nextNextCode = value.charCodeAt(pos + 2);

  if (
    (code === exp || code === EXP) &&
    ((nextCode >= 48 && nextCode <= 57) ||
      ((nextCode === plus || nextCode === minus) &&
        nextNextCode >= 48 &&
        nextNextCode <= 57))
  ) {
    pos += nextCode === plus || nextCode === minus ? 3 : 2;

    while (pos < length) {
      code = value.charCodeAt(pos);

      if (code < 48 || code > 57) {
        break;
      }

      pos += 1;
    }
  }

  return {
    number: value.slice(0, pos),
    unit: value.slice(pos)
  };
};

},{}],35:[function(require,module,exports){
module.exports = function walk(nodes, cb, bubble) {
  var i, max, node, result;

  for (i = 0, max = nodes.length; i < max; i += 1) {
    node = nodes[i];
    if (!bubble) {
      result = cb(node, i, nodes);
    }

    if (
      result !== false &&
      node.type === "function" &&
      Array.isArray(node.nodes)
    ) {
      walk(node.nodes, cb, bubble);
    }

    if (bubble) {
      cb(node, i, nodes);
    }
  }
};

},{}],36:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _container = _interopRequireDefault(require("./container"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

/**
 * Represents an at-rule.
 *
 * If it’s followed in the CSS by a {} block, this node will have
 * a nodes property representing its children.
 *
 * @extends Container
 *
 * @example
 * const root = postcss.parse('@charset "UTF-8"; @media print {}')
 *
 * const charset = root.first
 * charset.type  //=> 'atrule'
 * charset.nodes //=> undefined
 *
 * const media = root.last
 * media.nodes   //=> []
 */
var AtRule = /*#__PURE__*/function (_Container) {
  _inheritsLoose(AtRule, _Container);

  function AtRule(defaults) {
    var _this;

    _this = _Container.call(this, defaults) || this;
    _this.type = 'atrule';
    return _this;
  }

  var _proto = AtRule.prototype;

  _proto.append = function append() {
    var _Container$prototype$;

    if (!this.nodes) this.nodes = [];

    for (var _len = arguments.length, children = new Array(_len), _key = 0; _key < _len; _key++) {
      children[_key] = arguments[_key];
    }

    return (_Container$prototype$ = _Container.prototype.append).call.apply(_Container$prototype$, [this].concat(children));
  };

  _proto.prepend = function prepend() {
    var _Container$prototype$2;

    if (!this.nodes) this.nodes = [];

    for (var _len2 = arguments.length, children = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      children[_key2] = arguments[_key2];
    }

    return (_Container$prototype$2 = _Container.prototype.prepend).call.apply(_Container$prototype$2, [this].concat(children));
  }
  /**
   * @memberof AtRule#
   * @member {string} name The at-rule’s name immediately follows the `@`.
   *
   * @example
   * const root  = postcss.parse('@media print {}')
   * media.name //=> 'media'
   * const media = root.first
   */

  /**
   * @memberof AtRule#
   * @member {string} params The at-rule’s parameters, the values
   *                         that follow the at-rule’s name but precede
   *                         any {} block.
   *
   * @example
   * const root  = postcss.parse('@media print, screen {}')
   * const media = root.first
   * media.params //=> 'print, screen'
   */

  /**
   * @memberof AtRule#
   * @member {object} raws Information to generate byte-to-byte equal
   *                        node string as it was in the origin input.
   *
   * Every parser saves its own properties,
   * but the default CSS parser uses:
   *
   * * `before`: the space symbols before the node. It also stores `*`
   *   and `_` symbols before the declaration (IE hack).
   * * `after`: the space symbols after the last child of the node
   *   to the end of the node.
   * * `between`: the symbols between the property and value
   *   for declarations, selector and `{` for rules, or last parameter
   *   and `{` for at-rules.
   * * `semicolon`: contains true if the last child has
   *   an (optional) semicolon.
   * * `afterName`: the space between the at-rule name and its parameters.
   *
   * PostCSS cleans at-rule parameters from comments and extra spaces,
   * but it stores origin content in raws properties.
   * As such, if you don’t change a declaration’s value,
   * PostCSS will use the raw value with comments.
   *
   * @example
   * const root = postcss.parse('  @media\nprint {\n}')
   * root.first.first.raws //=> { before: '  ',
   *                       //     between: ' ',
   *                       //     afterName: '\n',
   *                       //     after: '\n' }
   */
  ;

  return AtRule;
}(_container.default);

var _default = AtRule;
exports.default = _default;
module.exports = exports.default;


},{"./container":38}],37:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _node = _interopRequireDefault(require("./node"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

/**
 * Represents a comment between declarations or statements (rule and at-rules).
 *
 * Comments inside selectors, at-rule parameters, or declaration values
 * will be stored in the `raws` properties explained above.
 *
 * @extends Node
 */
var Comment = /*#__PURE__*/function (_Node) {
  _inheritsLoose(Comment, _Node);

  function Comment(defaults) {
    var _this;

    _this = _Node.call(this, defaults) || this;
    _this.type = 'comment';
    return _this;
  }
  /**
   * @memberof Comment#
   * @member {string} text The comment’s text.
   */

  /**
   * @memberof Comment#
   * @member {object} raws Information to generate byte-to-byte equal
   *                       node string as it was in the origin input.
   *
   * Every parser saves its own properties,
   * but the default CSS parser uses:
   *
   * * `before`: the space symbols before the node.
   * * `left`: the space symbols between `/*` and the comment’s text.
   * * `right`: the space symbols between the comment’s text.
   */


  return Comment;
}(_node.default);

var _default = Comment;
exports.default = _default;
module.exports = exports.default;


},{"./node":45}],38:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _declaration = _interopRequireDefault(require("./declaration"));

var _comment = _interopRequireDefault(require("./comment"));

var _node = _interopRequireDefault(require("./node"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _createForOfIteratorHelperLoose(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; return function () { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } it = o[Symbol.iterator](); return it.next.bind(it); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

function cleanSource(nodes) {
  return nodes.map(function (i) {
    if (i.nodes) i.nodes = cleanSource(i.nodes);
    delete i.source;
    return i;
  });
}
/**
 * The {@link Root}, {@link AtRule}, and {@link Rule} container nodes
 * inherit some common methods to help work with their children.
 *
 * Note that all containers can store any content. If you write a rule inside
 * a rule, PostCSS will parse it.
 *
 * @extends Node
 * @abstract
 */


var Container = /*#__PURE__*/function (_Node) {
  _inheritsLoose(Container, _Node);

  function Container() {
    return _Node.apply(this, arguments) || this;
  }

  var _proto = Container.prototype;

  _proto.push = function push(child) {
    child.parent = this;
    this.nodes.push(child);
    return this;
  }
  /**
   * Iterates through the container’s immediate children,
   * calling `callback` for each child.
   *
   * Returning `false` in the callback will break iteration.
   *
   * This method only iterates through the container’s immediate children.
   * If you need to recursively iterate through all the container’s descendant
   * nodes, use {@link Container#walk}.
   *
   * Unlike the for `{}`-cycle or `Array#forEach` this iterator is safe
   * if you are mutating the array of child nodes during iteration.
   * PostCSS will adjust the current index to match the mutations.
   *
   * @param {childIterator} callback Iterator receives each node and index.
   *
   * @return {false|undefined} Returns `false` if iteration was broke.
   *
   * @example
   * const root = postcss.parse('a { color: black; z-index: 1 }')
   * const rule = root.first
   *
   * for (const decl of rule.nodes) {
   *   decl.cloneBefore({ prop: '-webkit-' + decl.prop })
   *   // Cycle will be infinite, because cloneBefore moves the current node
   *   // to the next index
   * }
   *
   * rule.each(decl => {
   *   decl.cloneBefore({ prop: '-webkit-' + decl.prop })
   *   // Will be executed only for color and z-index
   * })
   */
  ;

  _proto.each = function each(callback) {
    if (!this.lastEach) this.lastEach = 0;
    if (!this.indexes) this.indexes = {};
    this.lastEach += 1;
    var id = this.lastEach;
    this.indexes[id] = 0;
    if (!this.nodes) return undefined;
    var index, result;

    while (this.indexes[id] < this.nodes.length) {
      index = this.indexes[id];
      result = callback(this.nodes[index], index);
      if (result === false) break;
      this.indexes[id] += 1;
    }

    delete this.indexes[id];
    return result;
  }
  /**
   * Traverses the container’s descendant nodes, calling callback
   * for each node.
   *
   * Like container.each(), this method is safe to use
   * if you are mutating arrays during iteration.
   *
   * If you only need to iterate through the container’s immediate children,
   * use {@link Container#each}.
   *
   * @param {childIterator} callback Iterator receives each node and index.
   *
   * @return {false|undefined} Returns `false` if iteration was broke.
   *
   * @example
   * root.walk(node => {
   *   // Traverses all descendant nodes.
   * })
   */
  ;

  _proto.walk = function walk(callback) {
    return this.each(function (child, i) {
      var result;

      try {
        result = callback(child, i);
      } catch (e) {
        e.postcssNode = child;

        if (e.stack && child.source && /\n\s{4}at /.test(e.stack)) {
          var s = child.source;
          e.stack = e.stack.replace(/\n\s{4}at /, "$&" + s.input.from + ":" + s.start.line + ":" + s.start.column + "$&");
        }

        throw e;
      }

      if (result !== false && child.walk) {
        result = child.walk(callback);
      }

      return result;
    });
  }
  /**
   * Traverses the container’s descendant nodes, calling callback
   * for each declaration node.
   *
   * If you pass a filter, iteration will only happen over declarations
   * with matching properties.
   *
   * Like {@link Container#each}, this method is safe
   * to use if you are mutating arrays during iteration.
   *
   * @param {string|RegExp} [prop]   String or regular expression
   *                                 to filter declarations by property name.
   * @param {childIterator} callback Iterator receives each node and index.
   *
   * @return {false|undefined} Returns `false` if iteration was broke.
   *
   * @example
   * root.walkDecls(decl => {
   *   checkPropertySupport(decl.prop)
   * })
   *
   * root.walkDecls('border-radius', decl => {
   *   decl.remove()
   * })
   *
   * root.walkDecls(/^background/, decl => {
   *   decl.value = takeFirstColorFromGradient(decl.value)
   * })
   */
  ;

  _proto.walkDecls = function walkDecls(prop, callback) {
    if (!callback) {
      callback = prop;
      return this.walk(function (child, i) {
        if (child.type === 'decl') {
          return callback(child, i);
        }
      });
    }

    if (prop instanceof RegExp) {
      return this.walk(function (child, i) {
        if (child.type === 'decl' && prop.test(child.prop)) {
          return callback(child, i);
        }
      });
    }

    return this.walk(function (child, i) {
      if (child.type === 'decl' && child.prop === prop) {
        return callback(child, i);
      }
    });
  }
  /**
   * Traverses the container’s descendant nodes, calling callback
   * for each rule node.
   *
   * If you pass a filter, iteration will only happen over rules
   * with matching selectors.
   *
   * Like {@link Container#each}, this method is safe
   * to use if you are mutating arrays during iteration.
   *
   * @param {string|RegExp} [selector] String or regular expression
   *                                   to filter rules by selector.
   * @param {childIterator} callback   Iterator receives each node and index.
   *
   * @return {false|undefined} returns `false` if iteration was broke.
   *
   * @example
   * const selectors = []
   * root.walkRules(rule => {
   *   selectors.push(rule.selector)
   * })
   * console.log(`Your CSS uses ${ selectors.length } selectors`)
   */
  ;

  _proto.walkRules = function walkRules(selector, callback) {
    if (!callback) {
      callback = selector;
      return this.walk(function (child, i) {
        if (child.type === 'rule') {
          return callback(child, i);
        }
      });
    }

    if (selector instanceof RegExp) {
      return this.walk(function (child, i) {
        if (child.type === 'rule' && selector.test(child.selector)) {
          return callback(child, i);
        }
      });
    }

    return this.walk(function (child, i) {
      if (child.type === 'rule' && child.selector === selector) {
        return callback(child, i);
      }
    });
  }
  /**
   * Traverses the container’s descendant nodes, calling callback
   * for each at-rule node.
   *
   * If you pass a filter, iteration will only happen over at-rules
   * that have matching names.
   *
   * Like {@link Container#each}, this method is safe
   * to use if you are mutating arrays during iteration.
   *
   * @param {string|RegExp} [name]   String or regular expression
   *                                 to filter at-rules by name.
   * @param {childIterator} callback Iterator receives each node and index.
   *
   * @return {false|undefined} Returns `false` if iteration was broke.
   *
   * @example
   * root.walkAtRules(rule => {
   *   if (isOld(rule.name)) rule.remove()
   * })
   *
   * let first = false
   * root.walkAtRules('charset', rule => {
   *   if (!first) {
   *     first = true
   *   } else {
   *     rule.remove()
   *   }
   * })
   */
  ;

  _proto.walkAtRules = function walkAtRules(name, callback) {
    if (!callback) {
      callback = name;
      return this.walk(function (child, i) {
        if (child.type === 'atrule') {
          return callback(child, i);
        }
      });
    }

    if (name instanceof RegExp) {
      return this.walk(function (child, i) {
        if (child.type === 'atrule' && name.test(child.name)) {
          return callback(child, i);
        }
      });
    }

    return this.walk(function (child, i) {
      if (child.type === 'atrule' && child.name === name) {
        return callback(child, i);
      }
    });
  }
  /**
   * Traverses the container’s descendant nodes, calling callback
   * for each comment node.
   *
   * Like {@link Container#each}, this method is safe
   * to use if you are mutating arrays during iteration.
   *
   * @param {childIterator} callback Iterator receives each node and index.
   *
   * @return {false|undefined} Returns `false` if iteration was broke.
   *
   * @example
   * root.walkComments(comment => {
   *   comment.remove()
   * })
   */
  ;

  _proto.walkComments = function walkComments(callback) {
    return this.walk(function (child, i) {
      if (child.type === 'comment') {
        return callback(child, i);
      }
    });
  }
  /**
   * Inserts new nodes to the end of the container.
   *
   * @param {...(Node|object|string|Node[])} children New nodes.
   *
   * @return {Node} This node for methods chain.
   *
   * @example
   * const decl1 = postcss.decl({ prop: 'color', value: 'black' })
   * const decl2 = postcss.decl({ prop: 'background-color', value: 'white' })
   * rule.append(decl1, decl2)
   *
   * root.append({ name: 'charset', params: '"UTF-8"' })  // at-rule
   * root.append({ selector: 'a' })                       // rule
   * rule.append({ prop: 'color', value: 'black' })       // declaration
   * rule.append({ text: 'Comment' })                     // comment
   *
   * root.append('a {}')
   * root.first.append('color: black; z-index: 1')
   */
  ;

  _proto.append = function append() {
    for (var _len = arguments.length, children = new Array(_len), _key = 0; _key < _len; _key++) {
      children[_key] = arguments[_key];
    }

    for (var _i = 0, _children = children; _i < _children.length; _i++) {
      var child = _children[_i];
      var nodes = this.normalize(child, this.last);

      for (var _iterator = _createForOfIteratorHelperLoose(nodes), _step; !(_step = _iterator()).done;) {
        var node = _step.value;
        this.nodes.push(node);
      }
    }

    return this;
  }
  /**
   * Inserts new nodes to the start of the container.
   *
   * @param {...(Node|object|string|Node[])} children New nodes.
   *
   * @return {Node} This node for methods chain.
   *
   * @example
   * const decl1 = postcss.decl({ prop: 'color', value: 'black' })
   * const decl2 = postcss.decl({ prop: 'background-color', value: 'white' })
   * rule.prepend(decl1, decl2)
   *
   * root.append({ name: 'charset', params: '"UTF-8"' })  // at-rule
   * root.append({ selector: 'a' })                       // rule
   * rule.append({ prop: 'color', value: 'black' })       // declaration
   * rule.append({ text: 'Comment' })                     // comment
   *
   * root.append('a {}')
   * root.first.append('color: black; z-index: 1')
   */
  ;

  _proto.prepend = function prepend() {
    for (var _len2 = arguments.length, children = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      children[_key2] = arguments[_key2];
    }

    children = children.reverse();

    for (var _iterator2 = _createForOfIteratorHelperLoose(children), _step2; !(_step2 = _iterator2()).done;) {
      var child = _step2.value;
      var nodes = this.normalize(child, this.first, 'prepend').reverse();

      for (var _iterator3 = _createForOfIteratorHelperLoose(nodes), _step3; !(_step3 = _iterator3()).done;) {
        var node = _step3.value;
        this.nodes.unshift(node);
      }

      for (var id in this.indexes) {
        this.indexes[id] = this.indexes[id] + nodes.length;
      }
    }

    return this;
  };

  _proto.cleanRaws = function cleanRaws(keepBetween) {
    _Node.prototype.cleanRaws.call(this, keepBetween);

    if (this.nodes) {
      for (var _iterator4 = _createForOfIteratorHelperLoose(this.nodes), _step4; !(_step4 = _iterator4()).done;) {
        var node = _step4.value;
        node.cleanRaws(keepBetween);
      }
    }
  }
  /**
   * Insert new node before old node within the container.
   *
   * @param {Node|number} exist             Child or child’s index.
   * @param {Node|object|string|Node[]} add New node.
   *
   * @return {Node} This node for methods chain.
   *
   * @example
   * rule.insertBefore(decl, decl.clone({ prop: '-webkit-' + decl.prop }))
   */
  ;

  _proto.insertBefore = function insertBefore(exist, add) {
    exist = this.index(exist);
    var type = exist === 0 ? 'prepend' : false;
    var nodes = this.normalize(add, this.nodes[exist], type).reverse();

    for (var _iterator5 = _createForOfIteratorHelperLoose(nodes), _step5; !(_step5 = _iterator5()).done;) {
      var node = _step5.value;
      this.nodes.splice(exist, 0, node);
    }

    var index;

    for (var id in this.indexes) {
      index = this.indexes[id];

      if (exist <= index) {
        this.indexes[id] = index + nodes.length;
      }
    }

    return this;
  }
  /**
   * Insert new node after old node within the container.
   *
   * @param {Node|number} exist             Child or child’s index.
   * @param {Node|object|string|Node[]} add New node.
   *
   * @return {Node} This node for methods chain.
   */
  ;

  _proto.insertAfter = function insertAfter(exist, add) {
    exist = this.index(exist);
    var nodes = this.normalize(add, this.nodes[exist]).reverse();

    for (var _iterator6 = _createForOfIteratorHelperLoose(nodes), _step6; !(_step6 = _iterator6()).done;) {
      var node = _step6.value;
      this.nodes.splice(exist + 1, 0, node);
    }

    var index;

    for (var id in this.indexes) {
      index = this.indexes[id];

      if (exist < index) {
        this.indexes[id] = index + nodes.length;
      }
    }

    return this;
  }
  /**
   * Removes node from the container and cleans the parent properties
   * from the node and its children.
   *
   * @param {Node|number} child Child or child’s index.
   *
   * @return {Node} This node for methods chain
   *
   * @example
   * rule.nodes.length  //=> 5
   * rule.removeChild(decl)
   * rule.nodes.length  //=> 4
   * decl.parent        //=> undefined
   */
  ;

  _proto.removeChild = function removeChild(child) {
    child = this.index(child);
    this.nodes[child].parent = undefined;
    this.nodes.splice(child, 1);
    var index;

    for (var id in this.indexes) {
      index = this.indexes[id];

      if (index >= child) {
        this.indexes[id] = index - 1;
      }
    }

    return this;
  }
  /**
   * Removes all children from the container
   * and cleans their parent properties.
   *
   * @return {Node} This node for methods chain.
   *
   * @example
   * rule.removeAll()
   * rule.nodes.length //=> 0
   */
  ;

  _proto.removeAll = function removeAll() {
    for (var _iterator7 = _createForOfIteratorHelperLoose(this.nodes), _step7; !(_step7 = _iterator7()).done;) {
      var node = _step7.value;
      node.parent = undefined;
    }

    this.nodes = [];
    return this;
  }
  /**
   * Passes all declaration values within the container that match pattern
   * through callback, replacing those values with the returned result
   * of callback.
   *
   * This method is useful if you are using a custom unit or function
   * and need to iterate through all values.
   *
   * @param {string|RegExp} pattern      Replace pattern.
   * @param {object} opts                Options to speed up the search.
   * @param {string|string[]} opts.props An array of property names.
   * @param {string} opts.fast           String that’s used to narrow down
   *                                     values and speed up the regexp search.
   * @param {function|string} callback   String to replace pattern or callback
   *                                     that returns a new value. The callback
   *                                     will receive the same arguments
   *                                     as those passed to a function parameter
   *                                     of `String#replace`.
   *
   * @return {Node} This node for methods chain.
   *
   * @example
   * root.replaceValues(/\d+rem/, { fast: 'rem' }, string => {
   *   return 15 * parseInt(string) + 'px'
   * })
   */
  ;

  _proto.replaceValues = function replaceValues(pattern, opts, callback) {
    if (!callback) {
      callback = opts;
      opts = {};
    }

    this.walkDecls(function (decl) {
      if (opts.props && opts.props.indexOf(decl.prop) === -1) return;
      if (opts.fast && decl.value.indexOf(opts.fast) === -1) return;
      decl.value = decl.value.replace(pattern, callback);
    });
    return this;
  }
  /**
   * Returns `true` if callback returns `true`
   * for all of the container’s children.
   *
   * @param {childCondition} condition Iterator returns true or false.
   *
   * @return {boolean} Is every child pass condition.
   *
   * @example
   * const noPrefixes = rule.every(i => i.prop[0] !== '-')
   */
  ;

  _proto.every = function every(condition) {
    return this.nodes.every(condition);
  }
  /**
   * Returns `true` if callback returns `true` for (at least) one
   * of the container’s children.
   *
   * @param {childCondition} condition Iterator returns true or false.
   *
   * @return {boolean} Is some child pass condition.
   *
   * @example
   * const hasPrefix = rule.some(i => i.prop[0] === '-')
   */
  ;

  _proto.some = function some(condition) {
    return this.nodes.some(condition);
  }
  /**
   * Returns a `child`’s index within the {@link Container#nodes} array.
   *
   * @param {Node} child Child of the current container.
   *
   * @return {number} Child index.
   *
   * @example
   * rule.index( rule.nodes[2] ) //=> 2
   */
  ;

  _proto.index = function index(child) {
    if (typeof child === 'number') {
      return child;
    }

    return this.nodes.indexOf(child);
  }
  /**
   * The container’s first child.
   *
   * @type {Node}
   *
   * @example
   * rule.first === rules.nodes[0]
   */
  ;

  _proto.normalize = function normalize(nodes, sample) {
    var _this = this;

    if (typeof nodes === 'string') {
      var parse = require('./parse');

      nodes = cleanSource(parse(nodes).nodes);
    } else if (Array.isArray(nodes)) {
      nodes = nodes.slice(0);

      for (var _iterator8 = _createForOfIteratorHelperLoose(nodes), _step8; !(_step8 = _iterator8()).done;) {
        var i = _step8.value;
        if (i.parent) i.parent.removeChild(i, 'ignore');
      }
    } else if (nodes.type === 'root') {
      nodes = nodes.nodes.slice(0);

      for (var _iterator9 = _createForOfIteratorHelperLoose(nodes), _step9; !(_step9 = _iterator9()).done;) {
        var _i2 = _step9.value;
        if (_i2.parent) _i2.parent.removeChild(_i2, 'ignore');
      }
    } else if (nodes.type) {
      nodes = [nodes];
    } else if (nodes.prop) {
      if (typeof nodes.value === 'undefined') {
        throw new Error('Value field is missed in node creation');
      } else if (typeof nodes.value !== 'string') {
        nodes.value = String(nodes.value);
      }

      nodes = [new _declaration.default(nodes)];
    } else if (nodes.selector) {
      var Rule = require('./rule');

      nodes = [new Rule(nodes)];
    } else if (nodes.name) {
      var AtRule = require('./at-rule');

      nodes = [new AtRule(nodes)];
    } else if (nodes.text) {
      nodes = [new _comment.default(nodes)];
    } else {
      throw new Error('Unknown node type in node creation');
    }

    var processed = nodes.map(function (i) {
      if (i.parent) i.parent.removeChild(i);

      if (typeof i.raws.before === 'undefined') {
        if (sample && typeof sample.raws.before !== 'undefined') {
          i.raws.before = sample.raws.before.replace(/[^\s]/g, '');
        }
      }

      i.parent = _this;
      return i;
    });
    return processed;
  }
  /**
   * @memberof Container#
   * @member {Node[]} nodes An array containing the container’s children.
   *
   * @example
   * const root = postcss.parse('a { color: black }')
   * root.nodes.length           //=> 1
   * root.nodes[0].selector      //=> 'a'
   * root.nodes[0].nodes[0].prop //=> 'color'
   */
  ;

  _createClass(Container, [{
    key: "first",
    get: function get() {
      if (!this.nodes) return undefined;
      return this.nodes[0];
    }
    /**
     * The container’s last child.
     *
     * @type {Node}
     *
     * @example
     * rule.last === rule.nodes[rule.nodes.length - 1]
     */

  }, {
    key: "last",
    get: function get() {
      if (!this.nodes) return undefined;
      return this.nodes[this.nodes.length - 1];
    }
  }]);

  return Container;
}(_node.default);

var _default = Container;
/**
 * @callback childCondition
 * @param {Node} node    Container child.
 * @param {number} index Child index.
 * @param {Node[]} nodes All container children.
 * @return {boolean}
 */

/**
 * @callback childIterator
 * @param {Node} node    Container child.
 * @param {number} index Child index.
 * @return {false|undefined} Returning `false` will break iteration.
 */

exports.default = _default;
module.exports = exports.default;


},{"./at-rule":36,"./comment":37,"./declaration":40,"./node":45,"./parse":46,"./rule":53}],39:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _supportsColor = _interopRequireDefault(require("supports-color"));

var _chalk = _interopRequireDefault(require("chalk"));

var _terminalHighlight = _interopRequireDefault(require("./terminal-highlight"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

function _wrapNativeSuper(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct(Class, arguments, _getPrototypeOf(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf(Wrapper, Class); }; return _wrapNativeSuper(Class); }

function _construct(Parent, args, Class) { if (_isNativeReflectConstruct()) { _construct = Reflect.construct; } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _isNativeFunction(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

/**
 * The CSS parser throws this error for broken CSS.
 *
 * Custom parsers can throw this error for broken custom syntax using
 * the {@link Node#error} method.
 *
 * PostCSS will use the input source map to detect the original error location.
 * If you wrote a Sass file, compiled it to CSS and then parsed it with PostCSS,
 * PostCSS will show the original position in the Sass file.
 *
 * If you need the position in the PostCSS input
 * (e.g., to debug the previous compiler), use `error.input.file`.
 *
 * @example
 * // Catching and checking syntax error
 * try {
 *   postcss.parse('a{')
 * } catch (error) {
 *   if (error.name === 'CssSyntaxError') {
 *     error //=> CssSyntaxError
 *   }
 * }
 *
 * @example
 * // Raising error from plugin
 * throw node.error('Unknown variable', { plugin: 'postcss-vars' })
 */
var CssSyntaxError = /*#__PURE__*/function (_Error) {
  _inheritsLoose(CssSyntaxError, _Error);

  /**
   * @param {string} message  Error message.
   * @param {number} [line]   Source line of the error.
   * @param {number} [column] Source column of the error.
   * @param {string} [source] Source code of the broken file.
   * @param {string} [file]   Absolute path to the broken file.
   * @param {string} [plugin] PostCSS plugin name, if error came from plugin.
   */
  function CssSyntaxError(message, line, column, source, file, plugin) {
    var _this;

    _this = _Error.call(this, message) || this;
    /**
     * Always equal to `'CssSyntaxError'`. You should always check error type
     * by `error.name === 'CssSyntaxError'`
     * instead of `error instanceof CssSyntaxError`,
     * because npm could have several PostCSS versions.
     *
     * @type {string}
     *
     * @example
     * if (error.name === 'CssSyntaxError') {
     *   error //=> CssSyntaxError
     * }
     */

    _this.name = 'CssSyntaxError';
    /**
     * Error message.
     *
     * @type {string}
     *
     * @example
     * error.message //=> 'Unclosed block'
     */

    _this.reason = message;

    if (file) {
      /**
       * Absolute path to the broken file.
       *
       * @type {string}
       *
       * @example
       * error.file       //=> 'a.sass'
       * error.input.file //=> 'a.css'
       */
      _this.file = file;
    }

    if (source) {
      /**
       * Source code of the broken file.
       *
       * @type {string}
       *
       * @example
       * error.source       //=> 'a { b {} }'
       * error.input.column //=> 'a b { }'
       */
      _this.source = source;
    }

    if (plugin) {
      /**
       * Plugin name, if error came from plugin.
       *
       * @type {string}
       *
       * @example
       * error.plugin //=> 'postcss-vars'
       */
      _this.plugin = plugin;
    }

    if (typeof line !== 'undefined' && typeof column !== 'undefined') {
      /**
       * Source line of the error.
       *
       * @type {number}
       *
       * @example
       * error.line       //=> 2
       * error.input.line //=> 4
       */
      _this.line = line;
      /**
       * Source column of the error.
       *
       * @type {number}
       *
       * @example
       * error.column       //=> 1
       * error.input.column //=> 4
       */

      _this.column = column;
    }

    _this.setMessage();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(_assertThisInitialized(_this), CssSyntaxError);
    }

    return _this;
  }

  var _proto = CssSyntaxError.prototype;

  _proto.setMessage = function setMessage() {
    /**
     * Full error text in the GNU error format
     * with plugin, file, line and column.
     *
     * @type {string}
     *
     * @example
     * error.message //=> 'a.css:1:1: Unclosed block'
     */
    this.message = this.plugin ? this.plugin + ': ' : '';
    this.message += this.file ? this.file : '<css input>';

    if (typeof this.line !== 'undefined') {
      this.message += ':' + this.line + ':' + this.column;
    }

    this.message += ': ' + this.reason;
  }
  /**
   * Returns a few lines of CSS source that caused the error.
   *
   * If the CSS has an input source map without `sourceContent`,
   * this method will return an empty string.
   *
   * @param {boolean} [color] Whether arrow will be colored red by terminal
   *                          color codes. By default, PostCSS will detect
   *                          color support by `process.stdout.isTTY`
   *                          and `process.env.NODE_DISABLE_COLORS`.
   *
   * @example
   * error.showSourceCode() //=> "  4 | }
   *                        //      5 | a {
   *                        //    > 6 |   bad
   *                        //        |   ^
   *                        //      7 | }
   *                        //      8 | b {"
   *
   * @return {string} Few lines of CSS source that caused the error.
   */
  ;

  _proto.showSourceCode = function showSourceCode(color) {
    var _this2 = this;

    if (!this.source) return '';
    var css = this.source;

    if (_terminalHighlight.default) {
      if (typeof color === 'undefined') color = _supportsColor.default.stdout;
      if (color) css = (0, _terminalHighlight.default)(css);
    }

    var lines = css.split(/\r?\n/);
    var start = Math.max(this.line - 3, 0);
    var end = Math.min(this.line + 2, lines.length);
    var maxWidth = String(end).length;

    function mark(text) {
      if (color && _chalk.default.red) {
        return _chalk.default.red.bold(text);
      }

      return text;
    }

    function aside(text) {
      if (color && _chalk.default.gray) {
        return _chalk.default.gray(text);
      }

      return text;
    }

    return lines.slice(start, end).map(function (line, index) {
      var number = start + 1 + index;
      var gutter = ' ' + (' ' + number).slice(-maxWidth) + ' | ';

      if (number === _this2.line) {
        var spacing = aside(gutter.replace(/\d/g, ' ')) + line.slice(0, _this2.column - 1).replace(/[^\t]/g, ' ');
        return mark('>') + aside(gutter) + line + '\n ' + spacing + mark('^');
      }

      return ' ' + aside(gutter) + line;
    }).join('\n');
  }
  /**
   * Returns error position, message and source code of the broken part.
   *
   * @example
   * error.toString() //=> "CssSyntaxError: app.css:1:1: Unclosed block
   *                  //    > 1 | a {
   *                  //        | ^"
   *
   * @return {string} Error position, message and source code.
   */
  ;

  _proto.toString = function toString() {
    var code = this.showSourceCode();

    if (code) {
      code = '\n\n' + code + '\n';
    }

    return this.name + ': ' + this.message + code;
  }
  /**
   * @memberof CssSyntaxError#
   * @member {Input} input Input object with PostCSS internal information
   *                       about input file. If input has source map
   *                       from previous tool, PostCSS will use origin
   *                       (for example, Sass) source. You can use this
   *                       object to get PostCSS input source.
   *
   * @example
   * error.input.file //=> 'a.css'
   * error.file       //=> 'a.sass'
   */
  ;

  return CssSyntaxError;
}( /*#__PURE__*/_wrapNativeSuper(Error));

var _default = CssSyntaxError;
exports.default = _default;
module.exports = exports.default;


},{"./terminal-highlight":25,"chalk":25,"supports-color":25}],40:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _node = _interopRequireDefault(require("./node"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

/**
 * Represents a CSS declaration.
 *
 * @extends Node
 *
 * @example
 * const root = postcss.parse('a { color: black }')
 * const decl = root.first.first
 * decl.type       //=> 'decl'
 * decl.toString() //=> ' color: black'
 */
var Declaration = /*#__PURE__*/function (_Node) {
  _inheritsLoose(Declaration, _Node);

  function Declaration(defaults) {
    var _this;

    _this = _Node.call(this, defaults) || this;
    _this.type = 'decl';
    return _this;
  }
  /**
   * @memberof Declaration#
   * @member {string} prop The declaration’s property name.
   *
   * @example
   * const root = postcss.parse('a { color: black }')
   * const decl = root.first.first
   * decl.prop //=> 'color'
   */

  /**
   * @memberof Declaration#
   * @member {string} value The declaration’s value.
   *
   * @example
   * const root = postcss.parse('a { color: black }')
   * const decl = root.first.first
   * decl.value //=> 'black'
   */

  /**
   * @memberof Declaration#
   * @member {boolean} important `true` if the declaration
   *                             has an !important annotation.
   *
   * @example
   * const root = postcss.parse('a { color: black !important; color: red }')
   * root.first.first.important //=> true
   * root.first.last.important  //=> undefined
   */

  /**
   * @memberof Declaration#
   * @member {object} raws Information to generate byte-to-byte equal
   *                       node string as it was in the origin input.
   *
   * Every parser saves its own properties,
   * but the default CSS parser uses:
   *
   * * `before`: the space symbols before the node. It also stores `*`
   *   and `_` symbols before the declaration (IE hack).
   * * `between`: the symbols between the property and value
   *   for declarations.
   * * `important`: the content of the important statement,
   *   if it is not just `!important`.
   *
   * PostCSS cleans declaration from comments and extra spaces,
   * but it stores origin content in raws properties.
   * As such, if you don’t change a declaration’s value,
   * PostCSS will use the raw value with comments.
   *
   * @example
   * const root = postcss.parse('a {\n  color:black\n}')
   * root.first.first.raws //=> { before: '\n  ', between: ':' }
   */


  return Declaration;
}(_node.default);

var _default = Declaration;
exports.default = _default;
module.exports = exports.default;


},{"./node":45}],41:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _path = _interopRequireDefault(require("path"));

var _cssSyntaxError = _interopRequireDefault(require("./css-syntax-error"));

var _previousMap = _interopRequireDefault(require("./previous-map"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var sequence = 0;
/**
 * Represents the source CSS.
 *
 * @example
 * const root  = postcss.parse(css, { from: file })
 * const input = root.source.input
 */

var Input = /*#__PURE__*/function () {
  /**
   * @param {string} css    Input CSS source.
   * @param {object} [opts] {@link Processor#process} options.
   */
  function Input(css, opts) {
    if (opts === void 0) {
      opts = {};
    }

    if (css === null || typeof css === 'undefined' || typeof css === 'object' && !css.toString) {
      throw new Error("PostCSS received " + css + " instead of CSS string");
    }
    /**
     * Input CSS source
     *
     * @type {string}
     *
     * @example
     * const input = postcss.parse('a{}', { from: file }).input
     * input.css //=> "a{}"
     */


    this.css = css.toString();

    if (this.css[0] === "\uFEFF" || this.css[0] === "\uFFFE") {
      this.hasBOM = true;
      this.css = this.css.slice(1);
    } else {
      this.hasBOM = false;
    }

    if (opts.from) {
      if (/^\w+:\/\//.test(opts.from) || _path.default.isAbsolute(opts.from)) {
        /**
         * The absolute path to the CSS source file defined
         * with the `from` option.
         *
         * @type {string}
         *
         * @example
         * const root = postcss.parse(css, { from: 'a.css' })
         * root.source.input.file //=> '/home/ai/a.css'
         */
        this.file = opts.from;
      } else {
        this.file = _path.default.resolve(opts.from);
      }
    }

    var map = new _previousMap.default(this.css, opts);

    if (map.text) {
      /**
       * The input source map passed from a compilation step before PostCSS
       * (for example, from Sass compiler).
       *
       * @type {PreviousMap}
       *
       * @example
       * root.source.input.map.consumer().sources //=> ['a.sass']
       */
      this.map = map;
      var file = map.consumer().file;
      if (!this.file && file) this.file = this.mapResolve(file);
    }

    if (!this.file) {
      sequence += 1;
      /**
       * The unique ID of the CSS source. It will be created if `from` option
       * is not provided (because PostCSS does not know the file path).
       *
       * @type {string}
       *
       * @example
       * const root = postcss.parse(css)
       * root.source.input.file //=> undefined
       * root.source.input.id   //=> "<input css 1>"
       */

      this.id = '<input css ' + sequence + '>';
    }

    if (this.map) this.map.file = this.from;
  }

  var _proto = Input.prototype;

  _proto.error = function error(message, line, column, opts) {
    if (opts === void 0) {
      opts = {};
    }

    var result;
    var origin = this.origin(line, column);

    if (origin) {
      result = new _cssSyntaxError.default(message, origin.line, origin.column, origin.source, origin.file, opts.plugin);
    } else {
      result = new _cssSyntaxError.default(message, line, column, this.css, this.file, opts.plugin);
    }

    result.input = {
      line: line,
      column: column,
      source: this.css
    };
    if (this.file) result.input.file = this.file;
    return result;
  }
  /**
   * Reads the input source map and returns a symbol position
   * in the input source (e.g., in a Sass file that was compiled
   * to CSS before being passed to PostCSS).
   *
   * @param {number} line   Line in input CSS.
   * @param {number} column Column in input CSS.
   *
   * @return {filePosition} Position in input source.
   *
   * @example
   * root.source.input.origin(1, 1) //=> { file: 'a.css', line: 3, column: 1 }
   */
  ;

  _proto.origin = function origin(line, column) {
    if (!this.map) return false;
    var consumer = this.map.consumer();
    var from = consumer.originalPositionFor({
      line: line,
      column: column
    });
    if (!from.source) return false;
    var result = {
      file: this.mapResolve(from.source),
      line: from.line,
      column: from.column
    };
    var source = consumer.sourceContentFor(from.source);
    if (source) result.source = source;
    return result;
  };

  _proto.mapResolve = function mapResolve(file) {
    if (/^\w+:\/\//.test(file)) {
      return file;
    }

    return _path.default.resolve(this.map.consumer().sourceRoot || '.', file);
  }
  /**
   * The CSS source identifier. Contains {@link Input#file} if the user
   * set the `from` option, or {@link Input#id} if they did not.
   *
   * @type {string}
   *
   * @example
   * const root = postcss.parse(css, { from: 'a.css' })
   * root.source.input.from //=> "/home/ai/a.css"
   *
   * const root = postcss.parse(css)
   * root.source.input.from //=> "<input css 1>"
   */
  ;

  _createClass(Input, [{
    key: "from",
    get: function get() {
      return this.file || this.id;
    }
  }]);

  return Input;
}();

var _default = Input;
/**
 * @typedef  {object} filePosition
 * @property {string} file   Path to file.
 * @property {number} line   Source line in file.
 * @property {number} column Source column in file.
 */

exports.default = _default;
module.exports = exports.default;


},{"./css-syntax-error":39,"./previous-map":49,"path":28}],42:[function(require,module,exports){
(function (process){(function (){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _mapGenerator = _interopRequireDefault(require("./map-generator"));

var _stringify2 = _interopRequireDefault(require("./stringify"));

var _warnOnce = _interopRequireDefault(require("./warn-once"));

var _result = _interopRequireDefault(require("./result"));

var _parse = _interopRequireDefault(require("./parse"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _createForOfIteratorHelperLoose(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; return function () { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } it = o[Symbol.iterator](); return it.next.bind(it); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function isPromise(obj) {
  return typeof obj === 'object' && typeof obj.then === 'function';
}
/**
 * A Promise proxy for the result of PostCSS transformations.
 *
 * A `LazyResult` instance is returned by {@link Processor#process}.
 *
 * @example
 * const lazy = postcss([autoprefixer]).process(css)
 */


var LazyResult = /*#__PURE__*/function () {
  function LazyResult(processor, css, opts) {
    this.stringified = false;
    this.processed = false;
    var root;

    if (typeof css === 'object' && css !== null && css.type === 'root') {
      root = css;
    } else if (css instanceof LazyResult || css instanceof _result.default) {
      root = css.root;

      if (css.map) {
        if (typeof opts.map === 'undefined') opts.map = {};
        if (!opts.map.inline) opts.map.inline = false;
        opts.map.prev = css.map;
      }
    } else {
      var parser = _parse.default;
      if (opts.syntax) parser = opts.syntax.parse;
      if (opts.parser) parser = opts.parser;
      if (parser.parse) parser = parser.parse;

      try {
        root = parser(css, opts);
      } catch (error) {
        this.error = error;
      }
    }

    this.result = new _result.default(processor, root, opts);
  }
  /**
   * Returns a {@link Processor} instance, which will be used
   * for CSS transformations.
   *
   * @type {Processor}
   */


  var _proto = LazyResult.prototype;

  /**
   * Processes input CSS through synchronous plugins
   * and calls {@link Result#warnings()}.
   *
   * @return {Warning[]} Warnings from plugins.
   */
  _proto.warnings = function warnings() {
    return this.sync().warnings();
  }
  /**
   * Alias for the {@link LazyResult#css} property.
   *
   * @example
   * lazy + '' === lazy.css
   *
   * @return {string} Output CSS.
   */
  ;

  _proto.toString = function toString() {
    return this.css;
  }
  /**
   * Processes input CSS through synchronous and asynchronous plugins
   * and calls `onFulfilled` with a Result instance. If a plugin throws
   * an error, the `onRejected` callback will be executed.
   *
   * It implements standard Promise API.
   *
   * @param {onFulfilled} onFulfilled Callback will be executed
   *                                  when all plugins will finish work.
   * @param {onRejected}  onRejected  Callback will be executed on any error.
   *
   * @return {Promise} Promise API to make queue.
   *
   * @example
   * postcss([autoprefixer]).process(css, { from: cssPath }).then(result => {
   *   console.log(result.css)
   * })
   */
  ;

  _proto.then = function then(onFulfilled, onRejected) {
    if (process.env.NODE_ENV !== 'production') {
      if (!('from' in this.opts)) {
        (0, _warnOnce.default)('Without `from` option PostCSS could generate wrong source map ' + 'and will not find Browserslist config. Set it to CSS file path ' + 'or to `undefined` to prevent this warning.');
      }
    }

    return this.async().then(onFulfilled, onRejected);
  }
  /**
   * Processes input CSS through synchronous and asynchronous plugins
   * and calls onRejected for each error thrown in any plugin.
   *
   * It implements standard Promise API.
   *
   * @param {onRejected} onRejected Callback will be executed on any error.
   *
   * @return {Promise} Promise API to make queue.
   *
   * @example
   * postcss([autoprefixer]).process(css).then(result => {
   *   console.log(result.css)
   * }).catch(error => {
   *   console.error(error)
   * })
   */
  ;

  _proto.catch = function _catch(onRejected) {
    return this.async().catch(onRejected);
  }
  /**
   * Processes input CSS through synchronous and asynchronous plugins
   * and calls onFinally on any error or when all plugins will finish work.
   *
   * It implements standard Promise API.
   *
   * @param {onFinally} onFinally Callback will be executed on any error or
   *                              when all plugins will finish work.
   *
   * @return {Promise} Promise API to make queue.
   *
   * @example
   * postcss([autoprefixer]).process(css).finally(() => {
   *   console.log('processing ended')
   * })
   */
  ;

  _proto.finally = function _finally(onFinally) {
    return this.async().then(onFinally, onFinally);
  };

  _proto.handleError = function handleError(error, plugin) {
    try {
      this.error = error;

      if (error.name === 'CssSyntaxError' && !error.plugin) {
        error.plugin = plugin.postcssPlugin;
        error.setMessage();
      } else if (plugin.postcssVersion) {
        if (process.env.NODE_ENV !== 'production') {
          var pluginName = plugin.postcssPlugin;
          var pluginVer = plugin.postcssVersion;
          var runtimeVer = this.result.processor.version;
          var a = pluginVer.split('.');
          var b = runtimeVer.split('.');

          if (a[0] !== b[0] || parseInt(a[1]) > parseInt(b[1])) {
            console.error('Unknown error from PostCSS plugin. Your current PostCSS ' + 'version is ' + runtimeVer + ', but ' + pluginName + ' uses ' + pluginVer + '. Perhaps this is the source of the error below.');
          }
        }
      }
    } catch (err) {
      if (console && console.error) console.error(err);
    }
  };

  _proto.asyncTick = function asyncTick(resolve, reject) {
    var _this = this;

    if (this.plugin >= this.processor.plugins.length) {
      this.processed = true;
      return resolve();
    }

    try {
      var plugin = this.processor.plugins[this.plugin];
      var promise = this.run(plugin);
      this.plugin += 1;

      if (isPromise(promise)) {
        promise.then(function () {
          _this.asyncTick(resolve, reject);
        }).catch(function (error) {
          _this.handleError(error, plugin);

          _this.processed = true;
          reject(error);
        });
      } else {
        this.asyncTick(resolve, reject);
      }
    } catch (error) {
      this.processed = true;
      reject(error);
    }
  };

  _proto.async = function async() {
    var _this2 = this;

    if (this.processed) {
      return new Promise(function (resolve, reject) {
        if (_this2.error) {
          reject(_this2.error);
        } else {
          resolve(_this2.stringify());
        }
      });
    }

    if (this.processing) {
      return this.processing;
    }

    this.processing = new Promise(function (resolve, reject) {
      if (_this2.error) return reject(_this2.error);
      _this2.plugin = 0;

      _this2.asyncTick(resolve, reject);
    }).then(function () {
      _this2.processed = true;
      return _this2.stringify();
    });
    return this.processing;
  };

  _proto.sync = function sync() {
    if (this.processed) return this.result;
    this.processed = true;

    if (this.processing) {
      throw new Error('Use process(css).then(cb) to work with async plugins');
    }

    if (this.error) throw this.error;

    for (var _iterator = _createForOfIteratorHelperLoose(this.result.processor.plugins), _step; !(_step = _iterator()).done;) {
      var plugin = _step.value;
      var promise = this.run(plugin);

      if (isPromise(promise)) {
        throw new Error('Use process(css).then(cb) to work with async plugins');
      }
    }

    return this.result;
  };

  _proto.run = function run(plugin) {
    this.result.lastPlugin = plugin;

    try {
      return plugin(this.result.root, this.result);
    } catch (error) {
      this.handleError(error, plugin);
      throw error;
    }
  };

  _proto.stringify = function stringify() {
    if (this.stringified) return this.result;
    this.stringified = true;
    this.sync();
    var opts = this.result.opts;
    var str = _stringify2.default;
    if (opts.syntax) str = opts.syntax.stringify;
    if (opts.stringifier) str = opts.stringifier;
    if (str.stringify) str = str.stringify;
    var map = new _mapGenerator.default(str, this.result.root, this.result.opts);
    var data = map.generate();
    this.result.css = data[0];
    this.result.map = data[1];
    return this.result;
  };

  _createClass(LazyResult, [{
    key: "processor",
    get: function get() {
      return this.result.processor;
    }
    /**
     * Options from the {@link Processor#process} call.
     *
     * @type {processOptions}
     */

  }, {
    key: "opts",
    get: function get() {
      return this.result.opts;
    }
    /**
     * Processes input CSS through synchronous plugins, converts `Root`
     * to a CSS string and returns {@link Result#css}.
     *
     * This property will only work with synchronous plugins.
     * If the processor contains any asynchronous plugins
     * it will throw an error. This is why this method is only
     * for debug purpose, you should always use {@link LazyResult#then}.
     *
     * @type {string}
     * @see Result#css
     */

  }, {
    key: "css",
    get: function get() {
      return this.stringify().css;
    }
    /**
     * An alias for the `css` property. Use it with syntaxes
     * that generate non-CSS output.
     *
     * This property will only work with synchronous plugins.
     * If the processor contains any asynchronous plugins
     * it will throw an error. This is why this method is only
     * for debug purpose, you should always use {@link LazyResult#then}.
     *
     * @type {string}
     * @see Result#content
     */

  }, {
    key: "content",
    get: function get() {
      return this.stringify().content;
    }
    /**
     * Processes input CSS through synchronous plugins
     * and returns {@link Result#map}.
     *
     * This property will only work with synchronous plugins.
     * If the processor contains any asynchronous plugins
     * it will throw an error. This is why this method is only
     * for debug purpose, you should always use {@link LazyResult#then}.
     *
     * @type {SourceMapGenerator}
     * @see Result#map
     */

  }, {
    key: "map",
    get: function get() {
      return this.stringify().map;
    }
    /**
     * Processes input CSS through synchronous plugins
     * and returns {@link Result#root}.
     *
     * This property will only work with synchronous plugins. If the processor
     * contains any asynchronous plugins it will throw an error.
     *
     * This is why this method is only for debug purpose,
     * you should always use {@link LazyResult#then}.
     *
     * @type {Root}
     * @see Result#root
     */

  }, {
    key: "root",
    get: function get() {
      return this.sync().root;
    }
    /**
     * Processes input CSS through synchronous plugins
     * and returns {@link Result#messages}.
     *
     * This property will only work with synchronous plugins. If the processor
     * contains any asynchronous plugins it will throw an error.
     *
     * This is why this method is only for debug purpose,
     * you should always use {@link LazyResult#then}.
     *
     * @type {Message[]}
     * @see Result#messages
     */

  }, {
    key: "messages",
    get: function get() {
      return this.sync().messages;
    }
  }]);

  return LazyResult;
}();

var _default = LazyResult;
/**
 * @callback onFulfilled
 * @param {Result} result
 */

/**
 * @callback onRejected
 * @param {Error} error
 */

exports.default = _default;
module.exports = exports.default;


}).call(this)}).call(this,require('_process'))

},{"./map-generator":44,"./parse":46,"./result":51,"./stringify":55,"./warn-once":58,"_process":71}],43:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;

/**
 * Contains helpers for safely splitting lists of CSS values,
 * preserving parentheses and quotes.
 *
 * @example
 * const list = postcss.list
 *
 * @namespace list
 */
var list = {
  split: function split(string, separators, last) {
    var array = [];
    var current = '';
    var split = false;
    var func = 0;
    var quote = false;
    var escape = false;

    for (var i = 0; i < string.length; i++) {
      var letter = string[i];

      if (quote) {
        if (escape) {
          escape = false;
        } else if (letter === '\\') {
          escape = true;
        } else if (letter === quote) {
          quote = false;
        }
      } else if (letter === '"' || letter === '\'') {
        quote = letter;
      } else if (letter === '(') {
        func += 1;
      } else if (letter === ')') {
        if (func > 0) func -= 1;
      } else if (func === 0) {
        if (separators.indexOf(letter) !== -1) split = true;
      }

      if (split) {
        if (current !== '') array.push(current.trim());
        current = '';
        split = false;
      } else {
        current += letter;
      }
    }

    if (last || current !== '') array.push(current.trim());
    return array;
  },

  /**
   * Safely splits space-separated values (such as those for `background`,
   * `border-radius`, and other shorthand properties).
   *
   * @param {string} string Space-separated values.
   *
   * @return {string[]} Split values.
   *
   * @example
   * postcss.list.space('1px calc(10% + 1px)') //=> ['1px', 'calc(10% + 1px)']
   */
  space: function space(string) {
    var spaces = [' ', '\n', '\t'];
    return list.split(string, spaces);
  },

  /**
   * Safely splits comma-separated values (such as those for `transition-*`
   * and `background` properties).
   *
   * @param {string} string Comma-separated values.
   *
   * @return {string[]} Split values.
   *
   * @example
   * postcss.list.comma('black, linear-gradient(white, black)')
   * //=> ['black', 'linear-gradient(white, black)']
   */
  comma: function comma(string) {
    return list.split(string, [','], true);
  }
};
var _default = list;
exports.default = _default;
module.exports = exports.default;


},{}],44:[function(require,module,exports){
(function (Buffer){(function (){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _sourceMap = _interopRequireDefault(require("source-map"));

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _createForOfIteratorHelperLoose(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; return function () { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } it = o[Symbol.iterator](); return it.next.bind(it); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

var MapGenerator = /*#__PURE__*/function () {
  function MapGenerator(stringify, root, opts) {
    this.stringify = stringify;
    this.mapOpts = opts.map || {};
    this.root = root;
    this.opts = opts;
  }

  var _proto = MapGenerator.prototype;

  _proto.isMap = function isMap() {
    if (typeof this.opts.map !== 'undefined') {
      return !!this.opts.map;
    }

    return this.previous().length > 0;
  };

  _proto.previous = function previous() {
    var _this = this;

    if (!this.previousMaps) {
      this.previousMaps = [];
      this.root.walk(function (node) {
        if (node.source && node.source.input.map) {
          var map = node.source.input.map;

          if (_this.previousMaps.indexOf(map) === -1) {
            _this.previousMaps.push(map);
          }
        }
      });
    }

    return this.previousMaps;
  };

  _proto.isInline = function isInline() {
    if (typeof this.mapOpts.inline !== 'undefined') {
      return this.mapOpts.inline;
    }

    var annotation = this.mapOpts.annotation;

    if (typeof annotation !== 'undefined' && annotation !== true) {
      return false;
    }

    if (this.previous().length) {
      return this.previous().some(function (i) {
        return i.inline;
      });
    }

    return true;
  };

  _proto.isSourcesContent = function isSourcesContent() {
    if (typeof this.mapOpts.sourcesContent !== 'undefined') {
      return this.mapOpts.sourcesContent;
    }

    if (this.previous().length) {
      return this.previous().some(function (i) {
        return i.withContent();
      });
    }

    return true;
  };

  _proto.clearAnnotation = function clearAnnotation() {
    if (this.mapOpts.annotation === false) return;
    var node;

    for (var i = this.root.nodes.length - 1; i >= 0; i--) {
      node = this.root.nodes[i];
      if (node.type !== 'comment') continue;

      if (node.text.indexOf('# sourceMappingURL=') === 0) {
        this.root.removeChild(i);
      }
    }
  };

  _proto.setSourcesContent = function setSourcesContent() {
    var _this2 = this;

    var already = {};
    this.root.walk(function (node) {
      if (node.source) {
        var from = node.source.input.from;

        if (from && !already[from]) {
          already[from] = true;

          var relative = _this2.relative(from);

          _this2.map.setSourceContent(relative, node.source.input.css);
        }
      }
    });
  };

  _proto.applyPrevMaps = function applyPrevMaps() {
    for (var _iterator = _createForOfIteratorHelperLoose(this.previous()), _step; !(_step = _iterator()).done;) {
      var prev = _step.value;
      var from = this.relative(prev.file);

      var root = prev.root || _path.default.dirname(prev.file);

      var map = void 0;

      if (this.mapOpts.sourcesContent === false) {
        map = new _sourceMap.default.SourceMapConsumer(prev.text);

        if (map.sourcesContent) {
          map.sourcesContent = map.sourcesContent.map(function () {
            return null;
          });
        }
      } else {
        map = prev.consumer();
      }

      this.map.applySourceMap(map, from, this.relative(root));
    }
  };

  _proto.isAnnotation = function isAnnotation() {
    if (this.isInline()) {
      return true;
    }

    if (typeof this.mapOpts.annotation !== 'undefined') {
      return this.mapOpts.annotation;
    }

    if (this.previous().length) {
      return this.previous().some(function (i) {
        return i.annotation;
      });
    }

    return true;
  };

  _proto.toBase64 = function toBase64(str) {
    if (Buffer) {
      return Buffer.from(str).toString('base64');
    }

    return window.btoa(unescape(encodeURIComponent(str)));
  };

  _proto.addAnnotation = function addAnnotation() {
    var content;

    if (this.isInline()) {
      content = 'data:application/json;base64,' + this.toBase64(this.map.toString());
    } else if (typeof this.mapOpts.annotation === 'string') {
      content = this.mapOpts.annotation;
    } else {
      content = this.outputFile() + '.map';
    }

    var eol = '\n';
    if (this.css.indexOf('\r\n') !== -1) eol = '\r\n';
    this.css += eol + '/*# sourceMappingURL=' + content + ' */';
  };

  _proto.outputFile = function outputFile() {
    if (this.opts.to) {
      return this.relative(this.opts.to);
    }

    if (this.opts.from) {
      return this.relative(this.opts.from);
    }

    return 'to.css';
  };

  _proto.generateMap = function generateMap() {
    this.generateString();
    if (this.isSourcesContent()) this.setSourcesContent();
    if (this.previous().length > 0) this.applyPrevMaps();
    if (this.isAnnotation()) this.addAnnotation();

    if (this.isInline()) {
      return [this.css];
    }

    return [this.css, this.map];
  };

  _proto.relative = function relative(file) {
    if (file.indexOf('<') === 0) return file;
    if (/^\w+:\/\//.test(file)) return file;
    var from = this.opts.to ? _path.default.dirname(this.opts.to) : '.';

    if (typeof this.mapOpts.annotation === 'string') {
      from = _path.default.dirname(_path.default.resolve(from, this.mapOpts.annotation));
    }

    file = _path.default.relative(from, file);

    if (_path.default.sep === '\\') {
      return file.replace(/\\/g, '/');
    }

    return file;
  };

  _proto.sourcePath = function sourcePath(node) {
    if (this.mapOpts.from) {
      return this.mapOpts.from;
    }

    return this.relative(node.source.input.from);
  };

  _proto.generateString = function generateString() {
    var _this3 = this;

    this.css = '';
    this.map = new _sourceMap.default.SourceMapGenerator({
      file: this.outputFile()
    });
    var line = 1;
    var column = 1;
    var lines, last;
    this.stringify(this.root, function (str, node, type) {
      _this3.css += str;

      if (node && type !== 'end') {
        if (node.source && node.source.start) {
          _this3.map.addMapping({
            source: _this3.sourcePath(node),
            generated: {
              line: line,
              column: column - 1
            },
            original: {
              line: node.source.start.line,
              column: node.source.start.column - 1
            }
          });
        } else {
          _this3.map.addMapping({
            source: '<no source>',
            original: {
              line: 1,
              column: 0
            },
            generated: {
              line: line,
              column: column - 1
            }
          });
        }
      }

      lines = str.match(/\n/g);

      if (lines) {
        line += lines.length;
        last = str.lastIndexOf('\n');
        column = str.length - last;
      } else {
        column += str.length;
      }

      if (node && type !== 'start') {
        var p = node.parent || {
          raws: {}
        };

        if (node.type !== 'decl' || node !== p.last || p.raws.semicolon) {
          if (node.source && node.source.end) {
            _this3.map.addMapping({
              source: _this3.sourcePath(node),
              generated: {
                line: line,
                column: column - 2
              },
              original: {
                line: node.source.end.line,
                column: node.source.end.column - 1
              }
            });
          } else {
            _this3.map.addMapping({
              source: '<no source>',
              original: {
                line: 1,
                column: 0
              },
              generated: {
                line: line,
                column: column - 1
              }
            });
          }
        }
      }
    });
  };

  _proto.generate = function generate() {
    this.clearAnnotation();

    if (this.isMap()) {
      return this.generateMap();
    }

    var result = '';
    this.stringify(this.root, function (i) {
      result += i;
    });
    return [result];
  };

  return MapGenerator;
}();

var _default = MapGenerator;
exports.default = _default;
module.exports = exports.default;


}).call(this)}).call(this,require("buffer").Buffer)

},{"buffer":26,"path":28,"source-map":70}],45:[function(require,module,exports){
(function (process){(function (){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _cssSyntaxError = _interopRequireDefault(require("./css-syntax-error"));

var _stringifier = _interopRequireDefault(require("./stringifier"));

var _stringify = _interopRequireDefault(require("./stringify"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function cloneNode(obj, parent) {
  var cloned = new obj.constructor();

  for (var i in obj) {
    if (!obj.hasOwnProperty(i)) continue;
    var value = obj[i];
    var type = typeof value;

    if (i === 'parent' && type === 'object') {
      if (parent) cloned[i] = parent;
    } else if (i === 'source') {
      cloned[i] = value;
    } else if (value instanceof Array) {
      cloned[i] = value.map(function (j) {
        return cloneNode(j, cloned);
      });
    } else {
      if (type === 'object' && value !== null) value = cloneNode(value);
      cloned[i] = value;
    }
  }

  return cloned;
}
/**
 * All node classes inherit the following common methods.
 *
 * @abstract
 */


var Node = /*#__PURE__*/function () {
  /**
   * @param {object} [defaults] Value for node properties.
   */
  function Node(defaults) {
    if (defaults === void 0) {
      defaults = {};
    }

    this.raws = {};

    if (process.env.NODE_ENV !== 'production') {
      if (typeof defaults !== 'object' && typeof defaults !== 'undefined') {
        throw new Error('PostCSS nodes constructor accepts object, not ' + JSON.stringify(defaults));
      }
    }

    for (var name in defaults) {
      this[name] = defaults[name];
    }
  }
  /**
   * Returns a `CssSyntaxError` instance containing the original position
   * of the node in the source, showing line and column numbers and also
   * a small excerpt to facilitate debugging.
   *
   * If present, an input source map will be used to get the original position
   * of the source, even from a previous compilation step
   * (e.g., from Sass compilation).
   *
   * This method produces very useful error messages.
   *
   * @param {string} message     Error description.
   * @param {object} [opts]      Options.
   * @param {string} opts.plugin Plugin name that created this error.
   *                             PostCSS will set it automatically.
   * @param {string} opts.word   A word inside a node’s string that should
   *                             be highlighted as the source of the error.
   * @param {number} opts.index  An index inside a node’s string that should
   *                             be highlighted as the source of the error.
   *
   * @return {CssSyntaxError} Error object to throw it.
   *
   * @example
   * if (!variables[name]) {
   *   throw decl.error('Unknown variable ' + name, { word: name })
   *   // CssSyntaxError: postcss-vars:a.sass:4:3: Unknown variable $black
   *   //   color: $black
   *   // a
   *   //          ^
   *   //   background: white
   * }
   */


  var _proto = Node.prototype;

  _proto.error = function error(message, opts) {
    if (opts === void 0) {
      opts = {};
    }

    if (this.source) {
      var pos = this.positionBy(opts);
      return this.source.input.error(message, pos.line, pos.column, opts);
    }

    return new _cssSyntaxError.default(message);
  }
  /**
   * This method is provided as a convenience wrapper for {@link Result#warn}.
   *
   * @param {Result} result      The {@link Result} instance
   *                             that will receive the warning.
   * @param {string} text        Warning message.
   * @param {object} [opts]      Options
   * @param {string} opts.plugin Plugin name that created this warning.
   *                             PostCSS will set it automatically.
   * @param {string} opts.word   A word inside a node’s string that should
   *                             be highlighted as the source of the warning.
   * @param {number} opts.index  An index inside a node’s string that should
   *                             be highlighted as the source of the warning.
   *
   * @return {Warning} Created warning object.
   *
   * @example
   * const plugin = postcss.plugin('postcss-deprecated', () => {
   *   return (root, result) => {
   *     root.walkDecls('bad', decl => {
   *       decl.warn(result, 'Deprecated property bad')
   *     })
   *   }
   * })
   */
  ;

  _proto.warn = function warn(result, text, opts) {
    var data = {
      node: this
    };

    for (var i in opts) {
      data[i] = opts[i];
    }

    return result.warn(text, data);
  }
  /**
   * Removes the node from its parent and cleans the parent properties
   * from the node and its children.
   *
   * @example
   * if (decl.prop.match(/^-webkit-/)) {
   *   decl.remove()
   * }
   *
   * @return {Node} Node to make calls chain.
   */
  ;

  _proto.remove = function remove() {
    if (this.parent) {
      this.parent.removeChild(this);
    }

    this.parent = undefined;
    return this;
  }
  /**
   * Returns a CSS string representing the node.
   *
   * @param {stringifier|syntax} [stringifier] A syntax to use
   *                                           in string generation.
   *
   * @return {string} CSS string of this node.
   *
   * @example
   * postcss.rule({ selector: 'a' }).toString() //=> "a {}"
   */
  ;

  _proto.toString = function toString(stringifier) {
    if (stringifier === void 0) {
      stringifier = _stringify.default;
    }

    if (stringifier.stringify) stringifier = stringifier.stringify;
    var result = '';
    stringifier(this, function (i) {
      result += i;
    });
    return result;
  }
  /**
   * Returns an exact clone of the node.
   *
   * The resulting cloned node and its (cloned) children will retain
   * code style properties.
   *
   * @param {object} [overrides] New properties to override in the clone.
   *
   * @example
   * decl.raws.before    //=> "\n  "
   * const cloned = decl.clone({ prop: '-moz-' + decl.prop })
   * cloned.raws.before  //=> "\n  "
   * cloned.toString()   //=> -moz-transform: scale(0)
   *
   * @return {Node} Clone of the node.
   */
  ;

  _proto.clone = function clone(overrides) {
    if (overrides === void 0) {
      overrides = {};
    }

    var cloned = cloneNode(this);

    for (var name in overrides) {
      cloned[name] = overrides[name];
    }

    return cloned;
  }
  /**
   * Shortcut to clone the node and insert the resulting cloned node
   * before the current node.
   *
   * @param {object} [overrides] Mew properties to override in the clone.
   *
   * @example
   * decl.cloneBefore({ prop: '-moz-' + decl.prop })
   *
   * @return {Node} New node
   */
  ;

  _proto.cloneBefore = function cloneBefore(overrides) {
    if (overrides === void 0) {
      overrides = {};
    }

    var cloned = this.clone(overrides);
    this.parent.insertBefore(this, cloned);
    return cloned;
  }
  /**
   * Shortcut to clone the node and insert the resulting cloned node
   * after the current node.
   *
   * @param {object} [overrides] New properties to override in the clone.
   *
   * @return {Node} New node.
   */
  ;

  _proto.cloneAfter = function cloneAfter(overrides) {
    if (overrides === void 0) {
      overrides = {};
    }

    var cloned = this.clone(overrides);
    this.parent.insertAfter(this, cloned);
    return cloned;
  }
  /**
   * Inserts node(s) before the current node and removes the current node.
   *
   * @param {...Node} nodes Mode(s) to replace current one.
   *
   * @example
   * if (atrule.name === 'mixin') {
   *   atrule.replaceWith(mixinRules[atrule.params])
   * }
   *
   * @return {Node} Current node to methods chain.
   */
  ;

  _proto.replaceWith = function replaceWith() {
    if (this.parent) {
      for (var _len = arguments.length, nodes = new Array(_len), _key = 0; _key < _len; _key++) {
        nodes[_key] = arguments[_key];
      }

      for (var _i = 0, _nodes = nodes; _i < _nodes.length; _i++) {
        var node = _nodes[_i];
        this.parent.insertBefore(this, node);
      }

      this.remove();
    }

    return this;
  }
  /**
   * Returns the next child of the node’s parent.
   * Returns `undefined` if the current node is the last child.
   *
   * @return {Node|undefined} Next node.
   *
   * @example
   * if (comment.text === 'delete next') {
   *   const next = comment.next()
   *   if (next) {
   *     next.remove()
   *   }
   * }
   */
  ;

  _proto.next = function next() {
    if (!this.parent) return undefined;
    var index = this.parent.index(this);
    return this.parent.nodes[index + 1];
  }
  /**
   * Returns the previous child of the node’s parent.
   * Returns `undefined` if the current node is the first child.
   *
   * @return {Node|undefined} Previous node.
   *
   * @example
   * const annotation = decl.prev()
   * if (annotation.type === 'comment') {
   *   readAnnotation(annotation.text)
   * }
   */
  ;

  _proto.prev = function prev() {
    if (!this.parent) return undefined;
    var index = this.parent.index(this);
    return this.parent.nodes[index - 1];
  }
  /**
   * Insert new node before current node to current node’s parent.
   *
   * Just alias for `node.parent.insertBefore(node, add)`.
   *
   * @param {Node|object|string|Node[]} add New node.
   *
   * @return {Node} This node for methods chain.
   *
   * @example
   * decl.before('content: ""')
   */
  ;

  _proto.before = function before(add) {
    this.parent.insertBefore(this, add);
    return this;
  }
  /**
   * Insert new node after current node to current node’s parent.
   *
   * Just alias for `node.parent.insertAfter(node, add)`.
   *
   * @param {Node|object|string|Node[]} add New node.
   *
   * @return {Node} This node for methods chain.
   *
   * @example
   * decl.after('color: black')
   */
  ;

  _proto.after = function after(add) {
    this.parent.insertAfter(this, add);
    return this;
  };

  _proto.toJSON = function toJSON() {
    var fixed = {};

    for (var name in this) {
      if (!this.hasOwnProperty(name)) continue;
      if (name === 'parent') continue;
      var value = this[name];

      if (value instanceof Array) {
        fixed[name] = value.map(function (i) {
          if (typeof i === 'object' && i.toJSON) {
            return i.toJSON();
          } else {
            return i;
          }
        });
      } else if (typeof value === 'object' && value.toJSON) {
        fixed[name] = value.toJSON();
      } else {
        fixed[name] = value;
      }
    }

    return fixed;
  }
  /**
   * Returns a {@link Node#raws} value. If the node is missing
   * the code style property (because the node was manually built or cloned),
   * PostCSS will try to autodetect the code style property by looking
   * at other nodes in the tree.
   *
   * @param {string} prop          Name of code style property.
   * @param {string} [defaultType] Name of default value, it can be missed
   *                               if the value is the same as prop.
   *
   * @example
   * const root = postcss.parse('a { background: white }')
   * root.nodes[0].append({ prop: 'color', value: 'black' })
   * root.nodes[0].nodes[1].raws.before   //=> undefined
   * root.nodes[0].nodes[1].raw('before') //=> ' '
   *
   * @return {string} Code style value.
   */
  ;

  _proto.raw = function raw(prop, defaultType) {
    var str = new _stringifier.default();
    return str.raw(this, prop, defaultType);
  }
  /**
   * Finds the Root instance of the node’s tree.
   *
   * @example
   * root.nodes[0].nodes[0].root() === root
   *
   * @return {Root} Root parent.
   */
  ;

  _proto.root = function root() {
    var result = this;

    while (result.parent) {
      result = result.parent;
    }

    return result;
  }
  /**
   * Clear the code style properties for the node and its children.
   *
   * @param {boolean} [keepBetween] Keep the raws.between symbols.
   *
   * @return {undefined}
   *
   * @example
   * node.raws.before  //=> ' '
   * node.cleanRaws()
   * node.raws.before  //=> undefined
   */
  ;

  _proto.cleanRaws = function cleanRaws(keepBetween) {
    delete this.raws.before;
    delete this.raws.after;
    if (!keepBetween) delete this.raws.between;
  };

  _proto.positionInside = function positionInside(index) {
    var string = this.toString();
    var column = this.source.start.column;
    var line = this.source.start.line;

    for (var i = 0; i < index; i++) {
      if (string[i] === '\n') {
        column = 1;
        line += 1;
      } else {
        column += 1;
      }
    }

    return {
      line: line,
      column: column
    };
  };

  _proto.positionBy = function positionBy(opts) {
    var pos = this.source.start;

    if (opts.index) {
      pos = this.positionInside(opts.index);
    } else if (opts.word) {
      var index = this.toString().indexOf(opts.word);
      if (index !== -1) pos = this.positionInside(index);
    }

    return pos;
  }
  /**
   * @memberof Node#
   * @member {string} type String representing the node’s type.
   *                       Possible values are `root`, `atrule`, `rule`,
   *                       `decl`, or `comment`.
   *
   * @example
   * postcss.decl({ prop: 'color', value: 'black' }).type //=> 'decl'
   */

  /**
   * @memberof Node#
   * @member {Container} parent The node’s parent node.
   *
   * @example
   * root.nodes[0].parent === root
   */

  /**
   * @memberof Node#
   * @member {source} source The input source of the node.
   *
   * The property is used in source map generation.
   *
   * If you create a node manually (e.g., with `postcss.decl()`),
   * that node will not have a `source` property and will be absent
   * from the source map. For this reason, the plugin developer should
   * consider cloning nodes to create new ones (in which case the new node’s
   * source will reference the original, cloned node) or setting
   * the `source` property manually.
   *
   * ```js
   * // Bad
   * const prefixed = postcss.decl({
   *   prop: '-moz-' + decl.prop,
   *   value: decl.value
   * })
   *
   * // Good
   * const prefixed = decl.clone({ prop: '-moz-' + decl.prop })
   * ```
   *
   * ```js
   * if (atrule.name === 'add-link') {
   *   const rule = postcss.rule({ selector: 'a', source: atrule.source })
   *   atrule.parent.insertBefore(atrule, rule)
   * }
   * ```
   *
   * @example
   * decl.source.input.from //=> '/home/ai/a.sass'
   * decl.source.start      //=> { line: 10, column: 2 }
   * decl.source.end        //=> { line: 10, column: 12 }
   */

  /**
   * @memberof Node#
   * @member {object} raws Information to generate byte-to-byte equal
   *                       node string as it was in the origin input.
   *
   * Every parser saves its own properties,
   * but the default CSS parser uses:
   *
   * * `before`: the space symbols before the node. It also stores `*`
   *   and `_` symbols before the declaration (IE hack).
   * * `after`: the space symbols after the last child of the node
   *   to the end of the node.
   * * `between`: the symbols between the property and value
   *   for declarations, selector and `{` for rules, or last parameter
   *   and `{` for at-rules.
   * * `semicolon`: contains true if the last child has
   *   an (optional) semicolon.
   * * `afterName`: the space between the at-rule name and its parameters.
   * * `left`: the space symbols between `/*` and the comment’s text.
   * * `right`: the space symbols between the comment’s text
   *   and <code>*&#47;</code>.
   * * `important`: the content of the important statement,
   *   if it is not just `!important`.
   *
   * PostCSS cleans selectors, declaration values and at-rule parameters
   * from comments and extra spaces, but it stores origin content in raws
   * properties. As such, if you don’t change a declaration’s value,
   * PostCSS will use the raw value with comments.
   *
   * @example
   * const root = postcss.parse('a {\n  color:black\n}')
   * root.first.first.raws //=> { before: '\n  ', between: ':' }
   */
  ;

  return Node;
}();

var _default = Node;
/**
 * @typedef {object} position
 * @property {number} line   Source line in file.
 * @property {number} column Source column in file.
 */

/**
 * @typedef {object} source
 * @property {Input} input    {@link Input} with input file
 * @property {position} start The starting position of the node’s source.
 * @property {position} end   The ending position of the node’s source.
 */

exports.default = _default;
module.exports = exports.default;


}).call(this)}).call(this,require('_process'))

},{"./css-syntax-error":39,"./stringifier":54,"./stringify":55,"_process":71}],46:[function(require,module,exports){
(function (process){(function (){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _parser = _interopRequireDefault(require("./parser"));

var _input = _interopRequireDefault(require("./input"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function parse(css, opts) {
  var input = new _input.default(css, opts);
  var parser = new _parser.default(input);

  try {
    parser.parse();
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      if (e.name === 'CssSyntaxError' && opts && opts.from) {
        if (/\.scss$/i.test(opts.from)) {
          e.message += '\nYou tried to parse SCSS with ' + 'the standard CSS parser; ' + 'try again with the postcss-scss parser';
        } else if (/\.sass/i.test(opts.from)) {
          e.message += '\nYou tried to parse Sass with ' + 'the standard CSS parser; ' + 'try again with the postcss-sass parser';
        } else if (/\.less$/i.test(opts.from)) {
          e.message += '\nYou tried to parse Less with ' + 'the standard CSS parser; ' + 'try again with the postcss-less parser';
        }
      }
    }

    throw e;
  }

  return parser.root;
}

var _default = parse;
exports.default = _default;
module.exports = exports.default;


}).call(this)}).call(this,require('_process'))

},{"./input":41,"./parser":47,"_process":71}],47:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _declaration = _interopRequireDefault(require("./declaration"));

var _tokenize = _interopRequireDefault(require("./tokenize"));

var _comment = _interopRequireDefault(require("./comment"));

var _atRule = _interopRequireDefault(require("./at-rule"));

var _root = _interopRequireDefault(require("./root"));

var _rule = _interopRequireDefault(require("./rule"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Parser = /*#__PURE__*/function () {
  function Parser(input) {
    this.input = input;
    this.root = new _root.default();
    this.current = this.root;
    this.spaces = '';
    this.semicolon = false;
    this.createTokenizer();
    this.root.source = {
      input: input,
      start: {
        line: 1,
        column: 1
      }
    };
  }

  var _proto = Parser.prototype;

  _proto.createTokenizer = function createTokenizer() {
    this.tokenizer = (0, _tokenize.default)(this.input);
  };

  _proto.parse = function parse() {
    var token;

    while (!this.tokenizer.endOfFile()) {
      token = this.tokenizer.nextToken();

      switch (token[0]) {
        case 'space':
          this.spaces += token[1];
          break;

        case ';':
          this.freeSemicolon(token);
          break;

        case '}':
          this.end(token);
          break;

        case 'comment':
          this.comment(token);
          break;

        case 'at-word':
          this.atrule(token);
          break;

        case '{':
          this.emptyRule(token);
          break;

        default:
          this.other(token);
          break;
      }
    }

    this.endFile();
  };

  _proto.comment = function comment(token) {
    var node = new _comment.default();
    this.init(node, token[2], token[3]);
    node.source.end = {
      line: token[4],
      column: token[5]
    };
    var text = token[1].slice(2, -2);

    if (/^\s*$/.test(text)) {
      node.text = '';
      node.raws.left = text;
      node.raws.right = '';
    } else {
      var match = text.match(/^(\s*)([^]*[^\s])(\s*)$/);
      node.text = match[2];
      node.raws.left = match[1];
      node.raws.right = match[3];
    }
  };

  _proto.emptyRule = function emptyRule(token) {
    var node = new _rule.default();
    this.init(node, token[2], token[3]);
    node.selector = '';
    node.raws.between = '';
    this.current = node;
  };

  _proto.other = function other(start) {
    var end = false;
    var type = null;
    var colon = false;
    var bracket = null;
    var brackets = [];
    var tokens = [];
    var token = start;

    while (token) {
      type = token[0];
      tokens.push(token);

      if (type === '(' || type === '[') {
        if (!bracket) bracket = token;
        brackets.push(type === '(' ? ')' : ']');
      } else if (brackets.length === 0) {
        if (type === ';') {
          if (colon) {
            this.decl(tokens);
            return;
          } else {
            break;
          }
        } else if (type === '{') {
          this.rule(tokens);
          return;
        } else if (type === '}') {
          this.tokenizer.back(tokens.pop());
          end = true;
          break;
        } else if (type === ':') {
          colon = true;
        }
      } else if (type === brackets[brackets.length - 1]) {
        brackets.pop();
        if (brackets.length === 0) bracket = null;
      }

      token = this.tokenizer.nextToken();
    }

    if (this.tokenizer.endOfFile()) end = true;
    if (brackets.length > 0) this.unclosedBracket(bracket);

    if (end && colon) {
      while (tokens.length) {
        token = tokens[tokens.length - 1][0];
        if (token !== 'space' && token !== 'comment') break;
        this.tokenizer.back(tokens.pop());
      }

      this.decl(tokens);
    } else {
      this.unknownWord(tokens);
    }
  };

  _proto.rule = function rule(tokens) {
    tokens.pop();
    var node = new _rule.default();
    this.init(node, tokens[0][2], tokens[0][3]);
    node.raws.between = this.spacesAndCommentsFromEnd(tokens);
    this.raw(node, 'selector', tokens);
    this.current = node;
  };

  _proto.decl = function decl(tokens) {
    var node = new _declaration.default();
    this.init(node);
    var last = tokens[tokens.length - 1];

    if (last[0] === ';') {
      this.semicolon = true;
      tokens.pop();
    }

    if (last[4]) {
      node.source.end = {
        line: last[4],
        column: last[5]
      };
    } else {
      node.source.end = {
        line: last[2],
        column: last[3]
      };
    }

    while (tokens[0][0] !== 'word') {
      if (tokens.length === 1) this.unknownWord(tokens);
      node.raws.before += tokens.shift()[1];
    }

    node.source.start = {
      line: tokens[0][2],
      column: tokens[0][3]
    };
    node.prop = '';

    while (tokens.length) {
      var type = tokens[0][0];

      if (type === ':' || type === 'space' || type === 'comment') {
        break;
      }

      node.prop += tokens.shift()[1];
    }

    node.raws.between = '';
    var token;

    while (tokens.length) {
      token = tokens.shift();

      if (token[0] === ':') {
        node.raws.between += token[1];
        break;
      } else {
        if (token[0] === 'word' && /\w/.test(token[1])) {
          this.unknownWord([token]);
        }

        node.raws.between += token[1];
      }
    }

    if (node.prop[0] === '_' || node.prop[0] === '*') {
      node.raws.before += node.prop[0];
      node.prop = node.prop.slice(1);
    }

    node.raws.between += this.spacesAndCommentsFromStart(tokens);
    this.precheckMissedSemicolon(tokens);

    for (var i = tokens.length - 1; i > 0; i--) {
      token = tokens[i];

      if (token[1].toLowerCase() === '!important') {
        node.important = true;
        var string = this.stringFrom(tokens, i);
        string = this.spacesFromEnd(tokens) + string;
        if (string !== ' !important') node.raws.important = string;
        break;
      } else if (token[1].toLowerCase() === 'important') {
        var cache = tokens.slice(0);
        var str = '';

        for (var j = i; j > 0; j--) {
          var _type = cache[j][0];

          if (str.trim().indexOf('!') === 0 && _type !== 'space') {
            break;
          }

          str = cache.pop()[1] + str;
        }

        if (str.trim().indexOf('!') === 0) {
          node.important = true;
          node.raws.important = str;
          tokens = cache;
        }
      }

      if (token[0] !== 'space' && token[0] !== 'comment') {
        break;
      }
    }

    this.raw(node, 'value', tokens);
    if (node.value.indexOf(':') !== -1) this.checkMissedSemicolon(tokens);
  };

  _proto.atrule = function atrule(token) {
    var node = new _atRule.default();
    node.name = token[1].slice(1);

    if (node.name === '') {
      this.unnamedAtrule(node, token);
    }

    this.init(node, token[2], token[3]);
    var prev;
    var shift;
    var last = false;
    var open = false;
    var params = [];

    while (!this.tokenizer.endOfFile()) {
      token = this.tokenizer.nextToken();

      if (token[0] === ';') {
        node.source.end = {
          line: token[2],
          column: token[3]
        };
        this.semicolon = true;
        break;
      } else if (token[0] === '{') {
        open = true;
        break;
      } else if (token[0] === '}') {
        if (params.length > 0) {
          shift = params.length - 1;
          prev = params[shift];

          while (prev && prev[0] === 'space') {
            prev = params[--shift];
          }

          if (prev) {
            node.source.end = {
              line: prev[4],
              column: prev[5]
            };
          }
        }

        this.end(token);
        break;
      } else {
        params.push(token);
      }

      if (this.tokenizer.endOfFile()) {
        last = true;
        break;
      }
    }

    node.raws.between = this.spacesAndCommentsFromEnd(params);

    if (params.length) {
      node.raws.afterName = this.spacesAndCommentsFromStart(params);
      this.raw(node, 'params', params);

      if (last) {
        token = params[params.length - 1];
        node.source.end = {
          line: token[4],
          column: token[5]
        };
        this.spaces = node.raws.between;
        node.raws.between = '';
      }
    } else {
      node.raws.afterName = '';
      node.params = '';
    }

    if (open) {
      node.nodes = [];
      this.current = node;
    }
  };

  _proto.end = function end(token) {
    if (this.current.nodes && this.current.nodes.length) {
      this.current.raws.semicolon = this.semicolon;
    }

    this.semicolon = false;
    this.current.raws.after = (this.current.raws.after || '') + this.spaces;
    this.spaces = '';

    if (this.current.parent) {
      this.current.source.end = {
        line: token[2],
        column: token[3]
      };
      this.current = this.current.parent;
    } else {
      this.unexpectedClose(token);
    }
  };

  _proto.endFile = function endFile() {
    if (this.current.parent) this.unclosedBlock();

    if (this.current.nodes && this.current.nodes.length) {
      this.current.raws.semicolon = this.semicolon;
    }

    this.current.raws.after = (this.current.raws.after || '') + this.spaces;
  };

  _proto.freeSemicolon = function freeSemicolon(token) {
    this.spaces += token[1];

    if (this.current.nodes) {
      var prev = this.current.nodes[this.current.nodes.length - 1];

      if (prev && prev.type === 'rule' && !prev.raws.ownSemicolon) {
        prev.raws.ownSemicolon = this.spaces;
        this.spaces = '';
      }
    }
  } // Helpers
  ;

  _proto.init = function init(node, line, column) {
    this.current.push(node);
    node.source = {
      start: {
        line: line,
        column: column
      },
      input: this.input
    };
    node.raws.before = this.spaces;
    this.spaces = '';
    if (node.type !== 'comment') this.semicolon = false;
  };

  _proto.raw = function raw(node, prop, tokens) {
    var token, type;
    var length = tokens.length;
    var value = '';
    var clean = true;
    var next, prev;
    var pattern = /^([.|#])?([\w])+/i;

    for (var i = 0; i < length; i += 1) {
      token = tokens[i];
      type = token[0];

      if (type === 'comment' && node.type === 'rule') {
        prev = tokens[i - 1];
        next = tokens[i + 1];

        if (prev[0] !== 'space' && next[0] !== 'space' && pattern.test(prev[1]) && pattern.test(next[1])) {
          value += token[1];
        } else {
          clean = false;
        }

        continue;
      }

      if (type === 'comment' || type === 'space' && i === length - 1) {
        clean = false;
      } else {
        value += token[1];
      }
    }

    if (!clean) {
      var raw = tokens.reduce(function (all, i) {
        return all + i[1];
      }, '');
      node.raws[prop] = {
        value: value,
        raw: raw
      };
    }

    node[prop] = value;
  };

  _proto.spacesAndCommentsFromEnd = function spacesAndCommentsFromEnd(tokens) {
    var lastTokenType;
    var spaces = '';

    while (tokens.length) {
      lastTokenType = tokens[tokens.length - 1][0];
      if (lastTokenType !== 'space' && lastTokenType !== 'comment') break;
      spaces = tokens.pop()[1] + spaces;
    }

    return spaces;
  };

  _proto.spacesAndCommentsFromStart = function spacesAndCommentsFromStart(tokens) {
    var next;
    var spaces = '';

    while (tokens.length) {
      next = tokens[0][0];
      if (next !== 'space' && next !== 'comment') break;
      spaces += tokens.shift()[1];
    }

    return spaces;
  };

  _proto.spacesFromEnd = function spacesFromEnd(tokens) {
    var lastTokenType;
    var spaces = '';

    while (tokens.length) {
      lastTokenType = tokens[tokens.length - 1][0];
      if (lastTokenType !== 'space') break;
      spaces = tokens.pop()[1] + spaces;
    }

    return spaces;
  };

  _proto.stringFrom = function stringFrom(tokens, from) {
    var result = '';

    for (var i = from; i < tokens.length; i++) {
      result += tokens[i][1];
    }

    tokens.splice(from, tokens.length - from);
    return result;
  };

  _proto.colon = function colon(tokens) {
    var brackets = 0;
    var token, type, prev;

    for (var i = 0; i < tokens.length; i++) {
      token = tokens[i];
      type = token[0];

      if (type === '(') {
        brackets += 1;
      }

      if (type === ')') {
        brackets -= 1;
      }

      if (brackets === 0 && type === ':') {
        if (!prev) {
          this.doubleColon(token);
        } else if (prev[0] === 'word' && prev[1] === 'progid') {
          continue;
        } else {
          return i;
        }
      }

      prev = token;
    }

    return false;
  } // Errors
  ;

  _proto.unclosedBracket = function unclosedBracket(bracket) {
    throw this.input.error('Unclosed bracket', bracket[2], bracket[3]);
  };

  _proto.unknownWord = function unknownWord(tokens) {
    throw this.input.error('Unknown word', tokens[0][2], tokens[0][3]);
  };

  _proto.unexpectedClose = function unexpectedClose(token) {
    throw this.input.error('Unexpected }', token[2], token[3]);
  };

  _proto.unclosedBlock = function unclosedBlock() {
    var pos = this.current.source.start;
    throw this.input.error('Unclosed block', pos.line, pos.column);
  };

  _proto.doubleColon = function doubleColon(token) {
    throw this.input.error('Double colon', token[2], token[3]);
  };

  _proto.unnamedAtrule = function unnamedAtrule(node, token) {
    throw this.input.error('At-rule without name', token[2], token[3]);
  };

  _proto.precheckMissedSemicolon = function precheckMissedSemicolon()
  /* tokens */
  {// Hook for Safe Parser
  };

  _proto.checkMissedSemicolon = function checkMissedSemicolon(tokens) {
    var colon = this.colon(tokens);
    if (colon === false) return;
    var founded = 0;
    var token;

    for (var j = colon - 1; j >= 0; j--) {
      token = tokens[j];

      if (token[0] !== 'space') {
        founded += 1;
        if (founded === 2) break;
      }
    }

    throw this.input.error('Missed semicolon', token[2], token[3]);
  };

  return Parser;
}();

exports.default = Parser;
module.exports = exports.default;


},{"./at-rule":36,"./comment":37,"./declaration":40,"./root":52,"./rule":53,"./tokenize":56}],48:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _declaration = _interopRequireDefault(require("./declaration"));

var _processor = _interopRequireDefault(require("./processor"));

var _stringify = _interopRequireDefault(require("./stringify"));

var _comment = _interopRequireDefault(require("./comment"));

var _atRule = _interopRequireDefault(require("./at-rule"));

var _vendor = _interopRequireDefault(require("./vendor"));

var _parse = _interopRequireDefault(require("./parse"));

var _list = _interopRequireDefault(require("./list"));

var _rule = _interopRequireDefault(require("./rule"));

var _root = _interopRequireDefault(require("./root"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Create a new {@link Processor} instance that will apply `plugins`
 * as CSS processors.
 *
 * @param {Array.<Plugin|pluginFunction>|Processor} plugins PostCSS plugins.
 *        See {@link Processor#use} for plugin format.
 *
 * @return {Processor} Processor to process multiple CSS.
 *
 * @example
 * import postcss from 'postcss'
 *
 * postcss(plugins).process(css, { from, to }).then(result => {
 *   console.log(result.css)
 * })
 *
 * @namespace postcss
 */
function postcss() {
  for (var _len = arguments.length, plugins = new Array(_len), _key = 0; _key < _len; _key++) {
    plugins[_key] = arguments[_key];
  }

  if (plugins.length === 1 && Array.isArray(plugins[0])) {
    plugins = plugins[0];
  }

  return new _processor.default(plugins);
}
/**
 * Creates a PostCSS plugin with a standard API.
 *
 * The newly-wrapped function will provide both the name and PostCSS
 * version of the plugin.
 *
 * ```js
 * const processor = postcss([replace])
 * processor.plugins[0].postcssPlugin  //=> 'postcss-replace'
 * processor.plugins[0].postcssVersion //=> '6.0.0'
 * ```
 *
 * The plugin function receives 2 arguments: {@link Root}
 * and {@link Result} instance. The function should mutate the provided
 * `Root` node. Alternatively, you can create a new `Root` node
 * and override the `result.root` property.
 *
 * ```js
 * const cleaner = postcss.plugin('postcss-cleaner', () => {
 *   return (root, result) => {
 *     result.root = postcss.root()
 *   }
 * })
 * ```
 *
 * As a convenience, plugins also expose a `process` method so that you can use
 * them as standalone tools.
 *
 * ```js
 * cleaner.process(css, processOpts, pluginOpts)
 * // This is equivalent to:
 * postcss([ cleaner(pluginOpts) ]).process(css, processOpts)
 * ```
 *
 * Asynchronous plugins should return a `Promise` instance.
 *
 * ```js
 * postcss.plugin('postcss-import', () => {
 *   return (root, result) => {
 *     return new Promise( (resolve, reject) => {
 *       fs.readFile('base.css', (base) => {
 *         root.prepend(base)
 *         resolve()
 *       })
 *     })
 *   }
 * })
 * ```
 *
 * Add warnings using the {@link Node#warn} method.
 * Send data to other plugins using the {@link Result#messages} array.
 *
 * ```js
 * postcss.plugin('postcss-caniuse-test', () => {
 *   return (root, result) => {
 *     root.walkDecls(decl => {
 *       if (!caniuse.support(decl.prop)) {
 *         decl.warn(result, 'Some browsers do not support ' + decl.prop)
 *       }
 *     })
 *   }
 * })
 * ```
 *
 * @param {string} name          PostCSS plugin name. Same as in `name`
 *                               property in `package.json`. It will be saved
 *                               in `plugin.postcssPlugin` property.
 * @param {function} initializer Will receive plugin options
 *                               and should return {@link pluginFunction}
 *
 * @return {Plugin} PostCSS plugin.
 */


postcss.plugin = function plugin(name, initializer) {
  function creator() {
    var transformer = initializer.apply(void 0, arguments);
    transformer.postcssPlugin = name;
    transformer.postcssVersion = new _processor.default().version;
    return transformer;
  }

  var cache;
  Object.defineProperty(creator, 'postcss', {
    get: function get() {
      if (!cache) cache = creator();
      return cache;
    }
  });

  creator.process = function (css, processOpts, pluginOpts) {
    return postcss([creator(pluginOpts)]).process(css, processOpts);
  };

  return creator;
};
/**
 * Default function to convert a node tree into a CSS string.
 *
 * @param {Node} node       Start node for stringifing. Usually {@link Root}.
 * @param {builder} builder Function to concatenate CSS from node’s parts
 *                          or generate string and source map.
 *
 * @return {void}
 *
 * @function
 */


postcss.stringify = _stringify.default;
/**
 * Parses source css and returns a new {@link Root} node,
 * which contains the source CSS nodes.
 *
 * @param {string|toString} css   String with input CSS or any object
 *                                with toString() method, like a Buffer
 * @param {processOptions} [opts] Options with only `from` and `map` keys.
 *
 * @return {Root} PostCSS AST.
 *
 * @example
 * // Simple CSS concatenation with source map support
 * const root1 = postcss.parse(css1, { from: file1 })
 * const root2 = postcss.parse(css2, { from: file2 })
 * root1.append(root2).toResult().css
 *
 * @function
 */

postcss.parse = _parse.default;
/**
 * Contains the {@link vendor} module.
 *
 * @type {vendor}
 *
 * @example
 * postcss.vendor.unprefixed('-moz-tab') //=> ['tab']
 */

postcss.vendor = _vendor.default;
/**
 * Contains the {@link list} module.
 *
 * @member {list}
 *
 * @example
 * postcss.list.space('5px calc(10% + 5px)') //=> ['5px', 'calc(10% + 5px)']
 */

postcss.list = _list.default;
/**
 * Creates a new {@link Comment} node.
 *
 * @param {object} [defaults] Properties for the new node.
 *
 * @return {Comment} New comment node
 *
 * @example
 * postcss.comment({ text: 'test' })
 */

postcss.comment = function (defaults) {
  return new _comment.default(defaults);
};
/**
 * Creates a new {@link AtRule} node.
 *
 * @param {object} [defaults] Properties for the new node.
 *
 * @return {AtRule} new at-rule node
 *
 * @example
 * postcss.atRule({ name: 'charset' }).toString() //=> "@charset"
 */


postcss.atRule = function (defaults) {
  return new _atRule.default(defaults);
};
/**
 * Creates a new {@link Declaration} node.
 *
 * @param {object} [defaults] Properties for the new node.
 *
 * @return {Declaration} new declaration node
 *
 * @example
 * postcss.decl({ prop: 'color', value: 'red' }).toString() //=> "color: red"
 */


postcss.decl = function (defaults) {
  return new _declaration.default(defaults);
};
/**
 * Creates a new {@link Rule} node.
 *
 * @param {object} [defaults] Properties for the new node.
 *
 * @return {Rule} new rule node
 *
 * @example
 * postcss.rule({ selector: 'a' }).toString() //=> "a {\n}"
 */


postcss.rule = function (defaults) {
  return new _rule.default(defaults);
};
/**
 * Creates a new {@link Root} node.
 *
 * @param {object} [defaults] Properties for the new node.
 *
 * @return {Root} new root node.
 *
 * @example
 * postcss.root({ after: '\n' }).toString() //=> "\n"
 */


postcss.root = function (defaults) {
  return new _root.default(defaults);
};

var _default = postcss;
exports.default = _default;
module.exports = exports.default;


},{"./at-rule":36,"./comment":37,"./declaration":40,"./list":43,"./parse":46,"./processor":50,"./root":52,"./rule":53,"./stringify":55,"./vendor":57}],49:[function(require,module,exports){
(function (Buffer){(function (){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _sourceMap = _interopRequireDefault(require("source-map"));

var _path = _interopRequireDefault(require("path"));

var _fs = _interopRequireDefault(require("fs"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function fromBase64(str) {
  if (Buffer) {
    return Buffer.from(str, 'base64').toString();
  } else {
    return window.atob(str);
  }
}
/**
 * Source map information from input CSS.
 * For example, source map after Sass compiler.
 *
 * This class will automatically find source map in input CSS or in file system
 * near input file (according `from` option).
 *
 * @example
 * const root = postcss.parse(css, { from: 'a.sass.css' })
 * root.input.map //=> PreviousMap
 */


var PreviousMap = /*#__PURE__*/function () {
  /**
   * @param {string}         css    Input CSS source.
   * @param {processOptions} [opts] {@link Processor#process} options.
   */
  function PreviousMap(css, opts) {
    this.loadAnnotation(css);
    /**
     * Was source map inlined by data-uri to input CSS.
     *
     * @type {boolean}
     */

    this.inline = this.startWith(this.annotation, 'data:');
    var prev = opts.map ? opts.map.prev : undefined;
    var text = this.loadMap(opts.from, prev);
    if (text) this.text = text;
  }
  /**
   * Create a instance of `SourceMapGenerator` class
   * from the `source-map` library to work with source map information.
   *
   * It is lazy method, so it will create object only on first call
   * and then it will use cache.
   *
   * @return {SourceMapGenerator} Object with source map information.
   */


  var _proto = PreviousMap.prototype;

  _proto.consumer = function consumer() {
    if (!this.consumerCache) {
      this.consumerCache = new _sourceMap.default.SourceMapConsumer(this.text);
    }

    return this.consumerCache;
  }
  /**
   * Does source map contains `sourcesContent` with input source text.
   *
   * @return {boolean} Is `sourcesContent` present.
   */
  ;

  _proto.withContent = function withContent() {
    return !!(this.consumer().sourcesContent && this.consumer().sourcesContent.length > 0);
  };

  _proto.startWith = function startWith(string, start) {
    if (!string) return false;
    return string.substr(0, start.length) === start;
  };

  _proto.getAnnotationURL = function getAnnotationURL(sourceMapString) {
    return sourceMapString.match(/\/\*\s*# sourceMappingURL=((?:(?!sourceMappingURL=).)*)\*\//)[1].trim();
  };

  _proto.loadAnnotation = function loadAnnotation(css) {
    var annotations = css.match(/\/\*\s*# sourceMappingURL=(?:(?!sourceMappingURL=).)*\*\//gm);

    if (annotations && annotations.length > 0) {
      // Locate the last sourceMappingURL to avoid picking up
      // sourceMappingURLs from comments, strings, etc.
      var lastAnnotation = annotations[annotations.length - 1];

      if (lastAnnotation) {
        this.annotation = this.getAnnotationURL(lastAnnotation);
      }
    }
  };

  _proto.decodeInline = function decodeInline(text) {
    var baseCharsetUri = /^data:application\/json;charset=utf-?8;base64,/;
    var baseUri = /^data:application\/json;base64,/;
    var uri = 'data:application/json,';

    if (this.startWith(text, uri)) {
      return decodeURIComponent(text.substr(uri.length));
    }

    if (baseCharsetUri.test(text) || baseUri.test(text)) {
      return fromBase64(text.substr(RegExp.lastMatch.length));
    }

    var encoding = text.match(/data:application\/json;([^,]+),/)[1];
    throw new Error('Unsupported source map encoding ' + encoding);
  };

  _proto.loadMap = function loadMap(file, prev) {
    if (prev === false) return false;

    if (prev) {
      if (typeof prev === 'string') {
        return prev;
      } else if (typeof prev === 'function') {
        var prevPath = prev(file);

        if (prevPath && _fs.default.existsSync && _fs.default.existsSync(prevPath)) {
          return _fs.default.readFileSync(prevPath, 'utf-8').toString().trim();
        } else {
          throw new Error('Unable to load previous source map: ' + prevPath.toString());
        }
      } else if (prev instanceof _sourceMap.default.SourceMapConsumer) {
        return _sourceMap.default.SourceMapGenerator.fromSourceMap(prev).toString();
      } else if (prev instanceof _sourceMap.default.SourceMapGenerator) {
        return prev.toString();
      } else if (this.isMap(prev)) {
        return JSON.stringify(prev);
      } else {
        throw new Error('Unsupported previous source map format: ' + prev.toString());
      }
    } else if (this.inline) {
      return this.decodeInline(this.annotation);
    } else if (this.annotation) {
      var map = this.annotation;
      if (file) map = _path.default.join(_path.default.dirname(file), map);
      this.root = _path.default.dirname(map);

      if (_fs.default.existsSync && _fs.default.existsSync(map)) {
        return _fs.default.readFileSync(map, 'utf-8').toString().trim();
      } else {
        return false;
      }
    }
  };

  _proto.isMap = function isMap(map) {
    if (typeof map !== 'object') return false;
    return typeof map.mappings === 'string' || typeof map._mappings === 'string';
  };

  return PreviousMap;
}();

var _default = PreviousMap;
exports.default = _default;
module.exports = exports.default;


}).call(this)}).call(this,require("buffer").Buffer)

},{"buffer":26,"fs":25,"path":28,"source-map":70}],50:[function(require,module,exports){
(function (process){(function (){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _lazyResult = _interopRequireDefault(require("./lazy-result"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _createForOfIteratorHelperLoose(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; return function () { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } it = o[Symbol.iterator](); return it.next.bind(it); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

/**
 * Contains plugins to process CSS. Create one `Processor` instance,
 * initialize its plugins, and then use that instance on numerous CSS files.
 *
 * @example
 * const processor = postcss([autoprefixer, precss])
 * processor.process(css1).then(result => console.log(result.css))
 * processor.process(css2).then(result => console.log(result.css))
 */
var Processor = /*#__PURE__*/function () {
  /**
   * @param {Array.<Plugin|pluginFunction>|Processor} plugins PostCSS plugins.
   *        See {@link Processor#use} for plugin format.
   */
  function Processor(plugins) {
    if (plugins === void 0) {
      plugins = [];
    }

    /**
     * Current PostCSS version.
     *
     * @type {string}
     *
     * @example
     * if (result.processor.version.split('.')[0] !== '6') {
     *   throw new Error('This plugin works only with PostCSS 6')
     * }
     */
    this.version = '7.0.36';
    /**
     * Plugins added to this processor.
     *
     * @type {pluginFunction[]}
     *
     * @example
     * const processor = postcss([autoprefixer, precss])
     * processor.plugins.length //=> 2
     */

    this.plugins = this.normalize(plugins);
  }
  /**
   * Adds a plugin to be used as a CSS processor.
   *
   * PostCSS plugin can be in 4 formats:
   * * A plugin created by {@link postcss.plugin} method.
   * * A function. PostCSS will pass the function a @{link Root}
   *   as the first argument and current {@link Result} instance
   *   as the second.
   * * An object with a `postcss` method. PostCSS will use that method
   *   as described in #2.
   * * Another {@link Processor} instance. PostCSS will copy plugins
   *   from that instance into this one.
   *
   * Plugins can also be added by passing them as arguments when creating
   * a `postcss` instance (see [`postcss(plugins)`]).
   *
   * Asynchronous plugins should return a `Promise` instance.
   *
   * @param {Plugin|pluginFunction|Processor} plugin PostCSS plugin
   *                                                 or {@link Processor}
   *                                                 with plugins.
   *
   * @example
   * const processor = postcss()
   *   .use(autoprefixer)
   *   .use(precss)
   *
   * @return {Processes} Current processor to make methods chain.
   */


  var _proto = Processor.prototype;

  _proto.use = function use(plugin) {
    this.plugins = this.plugins.concat(this.normalize([plugin]));
    return this;
  }
  /**
   * Parses source CSS and returns a {@link LazyResult} Promise proxy.
   * Because some plugins can be asynchronous it doesn’t make
   * any transformations. Transformations will be applied
   * in the {@link LazyResult} methods.
   *
   * @param {string|toString|Result} css String with input CSS or any object
   *                                     with a `toString()` method,
   *                                     like a Buffer. Optionally, send
   *                                     a {@link Result} instance
   *                                     and the processor will take
   *                                     the {@link Root} from it.
   * @param {processOptions} [opts]      Options.
   *
   * @return {LazyResult} Promise proxy.
   *
   * @example
   * processor.process(css, { from: 'a.css', to: 'a.out.css' })
   *   .then(result => {
   *      console.log(result.css)
   *   })
   */
  ;

  _proto.process = function (_process) {
    function process(_x) {
      return _process.apply(this, arguments);
    }

    process.toString = function () {
      return _process.toString();
    };

    return process;
  }(function (css, opts) {
    if (opts === void 0) {
      opts = {};
    }

    if (this.plugins.length === 0 && opts.parser === opts.stringifier) {
      if (process.env.NODE_ENV !== 'production') {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('You did not set any plugins, parser, or stringifier. ' + 'Right now, PostCSS does nothing. Pick plugins for your case ' + 'on https://www.postcss.parts/ and use them in postcss.config.js.');
        }
      }
    }

    return new _lazyResult.default(this, css, opts);
  });

  _proto.normalize = function normalize(plugins) {
    var normalized = [];

    for (var _iterator = _createForOfIteratorHelperLoose(plugins), _step; !(_step = _iterator()).done;) {
      var i = _step.value;

      if (i.postcss === true) {
        var plugin = i();
        throw new Error('PostCSS plugin ' + plugin.postcssPlugin + ' requires PostCSS 8.\n' + 'Migration guide for end-users:\n' + 'https://github.com/postcss/postcss/wiki/PostCSS-8-for-end-users');
      }

      if (i.postcss) i = i.postcss;

      if (typeof i === 'object' && Array.isArray(i.plugins)) {
        normalized = normalized.concat(i.plugins);
      } else if (typeof i === 'function') {
        normalized.push(i);
      } else if (typeof i === 'object' && (i.parse || i.stringify)) {
        if (process.env.NODE_ENV !== 'production') {
          throw new Error('PostCSS syntaxes cannot be used as plugins. Instead, please use ' + 'one of the syntax/parser/stringifier options as outlined ' + 'in your PostCSS runner documentation.');
        }
      } else if (typeof i === 'object' && i.postcssPlugin) {
        throw new Error('PostCSS plugin ' + i.postcssPlugin + ' requires PostCSS 8.\n' + 'Migration guide for end-users:\n' + 'https://github.com/postcss/postcss/wiki/PostCSS-8-for-end-users');
      } else {
        throw new Error(i + ' is not a PostCSS plugin');
      }
    }

    return normalized;
  };

  return Processor;
}();

var _default = Processor;
/**
 * @callback builder
 * @param {string} part          Part of generated CSS connected to this node.
 * @param {Node}   node          AST node.
 * @param {"start"|"end"} [type] Node’s part type.
 */

/**
 * @callback parser
 *
 * @param {string|toString} css   String with input CSS or any object
 *                                with toString() method, like a Buffer.
 * @param {processOptions} [opts] Options with only `from` and `map` keys.
 *
 * @return {Root} PostCSS AST
 */

/**
 * @callback stringifier
 *
 * @param {Node} node       Start node for stringifing. Usually {@link Root}.
 * @param {builder} builder Function to concatenate CSS from node’s parts
 *                          or generate string and source map.
 *
 * @return {void}
 */

/**
 * @typedef {object} syntax
 * @property {parser} parse          Function to generate AST by string.
 * @property {stringifier} stringify Function to generate string by AST.
 */

/**
 * @typedef {object} toString
 * @property {function} toString
 */

/**
 * @callback pluginFunction
 * @param {Root} root     Parsed input CSS.
 * @param {Result} result Result to set warnings or check other plugins.
 */

/**
 * @typedef {object} Plugin
 * @property {function} postcss PostCSS plugin function.
 */

/**
 * @typedef {object} processOptions
 * @property {string} from             The path of the CSS source file.
 *                                     You should always set `from`,
 *                                     because it is used in source map
 *                                     generation and syntax error messages.
 * @property {string} to               The path where you’ll put the output
 *                                     CSS file. You should always set `to`
 *                                     to generate correct source maps.
 * @property {parser} parser           Function to generate AST by string.
 * @property {stringifier} stringifier Class to generate string by AST.
 * @property {syntax} syntax           Object with `parse` and `stringify`.
 * @property {object} map              Source map options.
 * @property {boolean} map.inline                    Does source map should
 *                                                   be embedded in the output
 *                                                   CSS as a base64-encoded
 *                                                   comment.
 * @property {string|object|false|function} map.prev Source map content
 *                                                   from a previous
 *                                                   processing step
 *                                                   (for example, Sass).
 *                                                   PostCSS will try to find
 *                                                   previous map automatically,
 *                                                   so you could disable it by
 *                                                   `false` value.
 * @property {boolean} map.sourcesContent            Does PostCSS should set
 *                                                   the origin content to map.
 * @property {string|false} map.annotation           Does PostCSS should set
 *                                                   annotation comment to map.
 * @property {string} map.from                       Override `from` in map’s
 *                                                   sources`.
 */

exports.default = _default;
module.exports = exports.default;


}).call(this)}).call(this,require('_process'))

},{"./lazy-result":42,"_process":71}],51:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _warning = _interopRequireDefault(require("./warning"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

/**
 * Provides the result of the PostCSS transformations.
 *
 * A Result instance is returned by {@link LazyResult#then}
 * or {@link Root#toResult} methods.
 *
 * @example
 * postcss([autoprefixer]).process(css).then(result => {
 *  console.log(result.css)
 * })
 *
 * @example
 * const result2 = postcss.parse(css).toResult()
 */
var Result = /*#__PURE__*/function () {
  /**
   * @param {Processor} processor Processor used for this transformation.
   * @param {Root}      root      Root node after all transformations.
   * @param {processOptions} opts Options from the {@link Processor#process}
   *                              or {@link Root#toResult}.
   */
  function Result(processor, root, opts) {
    /**
     * The Processor instance used for this transformation.
     *
     * @type {Processor}
     *
     * @example
     * for (const plugin of result.processor.plugins) {
     *   if (plugin.postcssPlugin === 'postcss-bad') {
     *     throw 'postcss-good is incompatible with postcss-bad'
     *   }
     * })
     */
    this.processor = processor;
    /**
     * Contains messages from plugins (e.g., warnings or custom messages).
     * Each message should have type and plugin properties.
     *
     * @type {Message[]}
     *
     * @example
     * postcss.plugin('postcss-min-browser', () => {
     *   return (root, result) => {
     *     const browsers = detectMinBrowsersByCanIUse(root)
     *     result.messages.push({
     *       type: 'min-browser',
     *       plugin: 'postcss-min-browser',
     *       browsers
     *     })
     *   }
     * })
     */

    this.messages = [];
    /**
     * Root node after all transformations.
     *
     * @type {Root}
     *
     * @example
     * root.toResult().root === root
     */

    this.root = root;
    /**
     * Options from the {@link Processor#process} or {@link Root#toResult} call
     * that produced this Result instance.
     *
     * @type {processOptions}
     *
     * @example
     * root.toResult(opts).opts === opts
     */

    this.opts = opts;
    /**
     * A CSS string representing of {@link Result#root}.
     *
     * @type {string}
     *
     * @example
     * postcss.parse('a{}').toResult().css //=> "a{}"
     */

    this.css = undefined;
    /**
     * An instance of `SourceMapGenerator` class from the `source-map` library,
     * representing changes to the {@link Result#root} instance.
     *
     * @type {SourceMapGenerator}
     *
     * @example
     * result.map.toJSON() //=> { version: 3, file: 'a.css', … }
     *
     * @example
     * if (result.map) {
     *   fs.writeFileSync(result.opts.to + '.map', result.map.toString())
     * }
     */

    this.map = undefined;
  }
  /**
   * Returns for @{link Result#css} content.
   *
   * @example
   * result + '' === result.css
   *
   * @return {string} String representing of {@link Result#root}.
   */


  var _proto = Result.prototype;

  _proto.toString = function toString() {
    return this.css;
  }
  /**
   * Creates an instance of {@link Warning} and adds it
   * to {@link Result#messages}.
   *
   * @param {string} text        Warning message.
   * @param {Object} [opts]      Warning options.
   * @param {Node}   opts.node   CSS node that caused the warning.
   * @param {string} opts.word   Word in CSS source that caused the warning.
   * @param {number} opts.index  Index in CSS node string that caused
   *                             the warning.
   * @param {string} opts.plugin Name of the plugin that created
   *                             this warning. {@link Result#warn} fills
   *                             this property automatically.
   *
   * @return {Warning} Created warning.
   */
  ;

  _proto.warn = function warn(text, opts) {
    if (opts === void 0) {
      opts = {};
    }

    if (!opts.plugin) {
      if (this.lastPlugin && this.lastPlugin.postcssPlugin) {
        opts.plugin = this.lastPlugin.postcssPlugin;
      }
    }

    var warning = new _warning.default(text, opts);
    this.messages.push(warning);
    return warning;
  }
  /**
     * Returns warnings from plugins. Filters {@link Warning} instances
     * from {@link Result#messages}.
     *
     * @example
     * result.warnings().forEach(warn => {
     *   console.warn(warn.toString())
     * })
     *
     * @return {Warning[]} Warnings from plugins.
     */
  ;

  _proto.warnings = function warnings() {
    return this.messages.filter(function (i) {
      return i.type === 'warning';
    });
  }
  /**
   * An alias for the {@link Result#css} property.
   * Use it with syntaxes that generate non-CSS output.
   *
   * @type {string}
   *
   * @example
   * result.css === result.content
   */
  ;

  _createClass(Result, [{
    key: "content",
    get: function get() {
      return this.css;
    }
  }]);

  return Result;
}();

var _default = Result;
/**
 * @typedef  {object} Message
 * @property {string} type   Message type.
 * @property {string} plugin Source PostCSS plugin name.
 */

exports.default = _default;
module.exports = exports.default;


},{"./warning":59}],52:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _container = _interopRequireDefault(require("./container"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _createForOfIteratorHelperLoose(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; return function () { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } it = o[Symbol.iterator](); return it.next.bind(it); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

/**
 * Represents a CSS file and contains all its parsed nodes.
 *
 * @extends Container
 *
 * @example
 * const root = postcss.parse('a{color:black} b{z-index:2}')
 * root.type         //=> 'root'
 * root.nodes.length //=> 2
 */
var Root = /*#__PURE__*/function (_Container) {
  _inheritsLoose(Root, _Container);

  function Root(defaults) {
    var _this;

    _this = _Container.call(this, defaults) || this;
    _this.type = 'root';
    if (!_this.nodes) _this.nodes = [];
    return _this;
  }

  var _proto = Root.prototype;

  _proto.removeChild = function removeChild(child, ignore) {
    var index = this.index(child);

    if (!ignore && index === 0 && this.nodes.length > 1) {
      this.nodes[1].raws.before = this.nodes[index].raws.before;
    }

    return _Container.prototype.removeChild.call(this, child);
  };

  _proto.normalize = function normalize(child, sample, type) {
    var nodes = _Container.prototype.normalize.call(this, child);

    if (sample) {
      if (type === 'prepend') {
        if (this.nodes.length > 1) {
          sample.raws.before = this.nodes[1].raws.before;
        } else {
          delete sample.raws.before;
        }
      } else if (this.first !== sample) {
        for (var _iterator = _createForOfIteratorHelperLoose(nodes), _step; !(_step = _iterator()).done;) {
          var node = _step.value;
          node.raws.before = sample.raws.before;
        }
      }
    }

    return nodes;
  }
  /**
   * Returns a {@link Result} instance representing the root’s CSS.
   *
   * @param {processOptions} [opts] Options with only `to` and `map` keys.
   *
   * @return {Result} Result with current root’s CSS.
   *
   * @example
   * const root1 = postcss.parse(css1, { from: 'a.css' })
   * const root2 = postcss.parse(css2, { from: 'b.css' })
   * root1.append(root2)
   * const result = root1.toResult({ to: 'all.css', map: true })
   */
  ;

  _proto.toResult = function toResult(opts) {
    if (opts === void 0) {
      opts = {};
    }

    var LazyResult = require('./lazy-result');

    var Processor = require('./processor');

    var lazy = new LazyResult(new Processor(), this, opts);
    return lazy.stringify();
  }
  /**
   * @memberof Root#
   * @member {object} raws Information to generate byte-to-byte equal
   *                       node string as it was in the origin input.
   *
   * Every parser saves its own properties,
   * but the default CSS parser uses:
   *
   * * `after`: the space symbols after the last child to the end of file.
   * * `semicolon`: is the last child has an (optional) semicolon.
   *
   * @example
   * postcss.parse('a {}\n').raws //=> { after: '\n' }
   * postcss.parse('a {}').raws   //=> { after: '' }
   */
  ;

  return Root;
}(_container.default);

var _default = Root;
exports.default = _default;
module.exports = exports.default;


},{"./container":38,"./lazy-result":42,"./processor":50}],53:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _container = _interopRequireDefault(require("./container"));

var _list = _interopRequireDefault(require("./list"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

/**
 * Represents a CSS rule: a selector followed by a declaration block.
 *
 * @extends Container
 *
 * @example
 * const root = postcss.parse('a{}')
 * const rule = root.first
 * rule.type       //=> 'rule'
 * rule.toString() //=> 'a{}'
 */
var Rule = /*#__PURE__*/function (_Container) {
  _inheritsLoose(Rule, _Container);

  function Rule(defaults) {
    var _this;

    _this = _Container.call(this, defaults) || this;
    _this.type = 'rule';
    if (!_this.nodes) _this.nodes = [];
    return _this;
  }
  /**
   * An array containing the rule’s individual selectors.
   * Groups of selectors are split at commas.
   *
   * @type {string[]}
   *
   * @example
   * const root = postcss.parse('a, b { }')
   * const rule = root.first
   *
   * rule.selector  //=> 'a, b'
   * rule.selectors //=> ['a', 'b']
   *
   * rule.selectors = ['a', 'strong']
   * rule.selector //=> 'a, strong'
   */


  _createClass(Rule, [{
    key: "selectors",
    get: function get() {
      return _list.default.comma(this.selector);
    },
    set: function set(values) {
      var match = this.selector ? this.selector.match(/,\s*/) : null;
      var sep = match ? match[0] : ',' + this.raw('between', 'beforeOpen');
      this.selector = values.join(sep);
    }
    /**
     * @memberof Rule#
     * @member {string} selector The rule’s full selector represented
     *                           as a string.
     *
     * @example
     * const root = postcss.parse('a, b { }')
     * const rule = root.first
     * rule.selector //=> 'a, b'
     */

    /**
     * @memberof Rule#
     * @member {object} raws Information to generate byte-to-byte equal
     *                       node string as it was in the origin input.
     *
     * Every parser saves its own properties,
     * but the default CSS parser uses:
     *
     * * `before`: the space symbols before the node. It also stores `*`
     *   and `_` symbols before the declaration (IE hack).
     * * `after`: the space symbols after the last child of the node
     *   to the end of the node.
     * * `between`: the symbols between the property and value
     *   for declarations, selector and `{` for rules, or last parameter
     *   and `{` for at-rules.
     * * `semicolon`: contains `true` if the last child has
     *   an (optional) semicolon.
     * * `ownSemicolon`: contains `true` if there is semicolon after rule.
     *
     * PostCSS cleans selectors from comments and extra spaces,
     * but it stores origin content in raws properties.
     * As such, if you don’t change a declaration’s value,
     * PostCSS will use the raw value with comments.
     *
     * @example
     * const root = postcss.parse('a {\n  color:black\n}')
     * root.first.first.raws //=> { before: '', between: ' ', after: '\n' }
     */

  }]);

  return Rule;
}(_container.default);

var _default = Rule;
exports.default = _default;
module.exports = exports.default;


},{"./container":38,"./list":43}],54:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;
var DEFAULT_RAW = {
  colon: ': ',
  indent: '    ',
  beforeDecl: '\n',
  beforeRule: '\n',
  beforeOpen: ' ',
  beforeClose: '\n',
  beforeComment: '\n',
  after: '\n',
  emptyBody: '',
  commentLeft: ' ',
  commentRight: ' ',
  semicolon: false
};

function capitalize(str) {
  return str[0].toUpperCase() + str.slice(1);
}

var Stringifier = /*#__PURE__*/function () {
  function Stringifier(builder) {
    this.builder = builder;
  }

  var _proto = Stringifier.prototype;

  _proto.stringify = function stringify(node, semicolon) {
    this[node.type](node, semicolon);
  };

  _proto.root = function root(node) {
    this.body(node);
    if (node.raws.after) this.builder(node.raws.after);
  };

  _proto.comment = function comment(node) {
    var left = this.raw(node, 'left', 'commentLeft');
    var right = this.raw(node, 'right', 'commentRight');
    this.builder('/*' + left + node.text + right + '*/', node);
  };

  _proto.decl = function decl(node, semicolon) {
    var between = this.raw(node, 'between', 'colon');
    var string = node.prop + between + this.rawValue(node, 'value');

    if (node.important) {
      string += node.raws.important || ' !important';
    }

    if (semicolon) string += ';';
    this.builder(string, node);
  };

  _proto.rule = function rule(node) {
    this.block(node, this.rawValue(node, 'selector'));

    if (node.raws.ownSemicolon) {
      this.builder(node.raws.ownSemicolon, node, 'end');
    }
  };

  _proto.atrule = function atrule(node, semicolon) {
    var name = '@' + node.name;
    var params = node.params ? this.rawValue(node, 'params') : '';

    if (typeof node.raws.afterName !== 'undefined') {
      name += node.raws.afterName;
    } else if (params) {
      name += ' ';
    }

    if (node.nodes) {
      this.block(node, name + params);
    } else {
      var end = (node.raws.between || '') + (semicolon ? ';' : '');
      this.builder(name + params + end, node);
    }
  };

  _proto.body = function body(node) {
    var last = node.nodes.length - 1;

    while (last > 0) {
      if (node.nodes[last].type !== 'comment') break;
      last -= 1;
    }

    var semicolon = this.raw(node, 'semicolon');

    for (var i = 0; i < node.nodes.length; i++) {
      var child = node.nodes[i];
      var before = this.raw(child, 'before');
      if (before) this.builder(before);
      this.stringify(child, last !== i || semicolon);
    }
  };

  _proto.block = function block(node, start) {
    var between = this.raw(node, 'between', 'beforeOpen');
    this.builder(start + between + '{', node, 'start');
    var after;

    if (node.nodes && node.nodes.length) {
      this.body(node);
      after = this.raw(node, 'after');
    } else {
      after = this.raw(node, 'after', 'emptyBody');
    }

    if (after) this.builder(after);
    this.builder('}', node, 'end');
  };

  _proto.raw = function raw(node, own, detect) {
    var value;
    if (!detect) detect = own; // Already had

    if (own) {
      value = node.raws[own];
      if (typeof value !== 'undefined') return value;
    }

    var parent = node.parent; // Hack for first rule in CSS

    if (detect === 'before') {
      if (!parent || parent.type === 'root' && parent.first === node) {
        return '';
      }
    } // Floating child without parent


    if (!parent) return DEFAULT_RAW[detect]; // Detect style by other nodes

    var root = node.root();
    if (!root.rawCache) root.rawCache = {};

    if (typeof root.rawCache[detect] !== 'undefined') {
      return root.rawCache[detect];
    }

    if (detect === 'before' || detect === 'after') {
      return this.beforeAfter(node, detect);
    } else {
      var method = 'raw' + capitalize(detect);

      if (this[method]) {
        value = this[method](root, node);
      } else {
        root.walk(function (i) {
          value = i.raws[own];
          if (typeof value !== 'undefined') return false;
        });
      }
    }

    if (typeof value === 'undefined') value = DEFAULT_RAW[detect];
    root.rawCache[detect] = value;
    return value;
  };

  _proto.rawSemicolon = function rawSemicolon(root) {
    var value;
    root.walk(function (i) {
      if (i.nodes && i.nodes.length && i.last.type === 'decl') {
        value = i.raws.semicolon;
        if (typeof value !== 'undefined') return false;
      }
    });
    return value;
  };

  _proto.rawEmptyBody = function rawEmptyBody(root) {
    var value;
    root.walk(function (i) {
      if (i.nodes && i.nodes.length === 0) {
        value = i.raws.after;
        if (typeof value !== 'undefined') return false;
      }
    });
    return value;
  };

  _proto.rawIndent = function rawIndent(root) {
    if (root.raws.indent) return root.raws.indent;
    var value;
    root.walk(function (i) {
      var p = i.parent;

      if (p && p !== root && p.parent && p.parent === root) {
        if (typeof i.raws.before !== 'undefined') {
          var parts = i.raws.before.split('\n');
          value = parts[parts.length - 1];
          value = value.replace(/[^\s]/g, '');
          return false;
        }
      }
    });
    return value;
  };

  _proto.rawBeforeComment = function rawBeforeComment(root, node) {
    var value;
    root.walkComments(function (i) {
      if (typeof i.raws.before !== 'undefined') {
        value = i.raws.before;

        if (value.indexOf('\n') !== -1) {
          value = value.replace(/[^\n]+$/, '');
        }

        return false;
      }
    });

    if (typeof value === 'undefined') {
      value = this.raw(node, null, 'beforeDecl');
    } else if (value) {
      value = value.replace(/[^\s]/g, '');
    }

    return value;
  };

  _proto.rawBeforeDecl = function rawBeforeDecl(root, node) {
    var value;
    root.walkDecls(function (i) {
      if (typeof i.raws.before !== 'undefined') {
        value = i.raws.before;

        if (value.indexOf('\n') !== -1) {
          value = value.replace(/[^\n]+$/, '');
        }

        return false;
      }
    });

    if (typeof value === 'undefined') {
      value = this.raw(node, null, 'beforeRule');
    } else if (value) {
      value = value.replace(/[^\s]/g, '');
    }

    return value;
  };

  _proto.rawBeforeRule = function rawBeforeRule(root) {
    var value;
    root.walk(function (i) {
      if (i.nodes && (i.parent !== root || root.first !== i)) {
        if (typeof i.raws.before !== 'undefined') {
          value = i.raws.before;

          if (value.indexOf('\n') !== -1) {
            value = value.replace(/[^\n]+$/, '');
          }

          return false;
        }
      }
    });
    if (value) value = value.replace(/[^\s]/g, '');
    return value;
  };

  _proto.rawBeforeClose = function rawBeforeClose(root) {
    var value;
    root.walk(function (i) {
      if (i.nodes && i.nodes.length > 0) {
        if (typeof i.raws.after !== 'undefined') {
          value = i.raws.after;

          if (value.indexOf('\n') !== -1) {
            value = value.replace(/[^\n]+$/, '');
          }

          return false;
        }
      }
    });
    if (value) value = value.replace(/[^\s]/g, '');
    return value;
  };

  _proto.rawBeforeOpen = function rawBeforeOpen(root) {
    var value;
    root.walk(function (i) {
      if (i.type !== 'decl') {
        value = i.raws.between;
        if (typeof value !== 'undefined') return false;
      }
    });
    return value;
  };

  _proto.rawColon = function rawColon(root) {
    var value;
    root.walkDecls(function (i) {
      if (typeof i.raws.between !== 'undefined') {
        value = i.raws.between.replace(/[^\s:]/g, '');
        return false;
      }
    });
    return value;
  };

  _proto.beforeAfter = function beforeAfter(node, detect) {
    var value;

    if (node.type === 'decl') {
      value = this.raw(node, null, 'beforeDecl');
    } else if (node.type === 'comment') {
      value = this.raw(node, null, 'beforeComment');
    } else if (detect === 'before') {
      value = this.raw(node, null, 'beforeRule');
    } else {
      value = this.raw(node, null, 'beforeClose');
    }

    var buf = node.parent;
    var depth = 0;

    while (buf && buf.type !== 'root') {
      depth += 1;
      buf = buf.parent;
    }

    if (value.indexOf('\n') !== -1) {
      var indent = this.raw(node, null, 'indent');

      if (indent.length) {
        for (var step = 0; step < depth; step++) {
          value += indent;
        }
      }
    }

    return value;
  };

  _proto.rawValue = function rawValue(node, prop) {
    var value = node[prop];
    var raw = node.raws[prop];

    if (raw && raw.value === value) {
      return raw.raw;
    }

    return value;
  };

  return Stringifier;
}();

var _default = Stringifier;
exports.default = _default;
module.exports = exports.default;


},{}],55:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;

var _stringifier = _interopRequireDefault(require("./stringifier"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function stringify(node, builder) {
  var str = new _stringifier.default(builder);
  str.stringify(node);
}

var _default = stringify;
exports.default = _default;
module.exports = exports.default;


},{"./stringifier":54}],56:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = tokenizer;
var SINGLE_QUOTE = '\''.charCodeAt(0);
var DOUBLE_QUOTE = '"'.charCodeAt(0);
var BACKSLASH = '\\'.charCodeAt(0);
var SLASH = '/'.charCodeAt(0);
var NEWLINE = '\n'.charCodeAt(0);
var SPACE = ' '.charCodeAt(0);
var FEED = '\f'.charCodeAt(0);
var TAB = '\t'.charCodeAt(0);
var CR = '\r'.charCodeAt(0);
var OPEN_SQUARE = '['.charCodeAt(0);
var CLOSE_SQUARE = ']'.charCodeAt(0);
var OPEN_PARENTHESES = '('.charCodeAt(0);
var CLOSE_PARENTHESES = ')'.charCodeAt(0);
var OPEN_CURLY = '{'.charCodeAt(0);
var CLOSE_CURLY = '}'.charCodeAt(0);
var SEMICOLON = ';'.charCodeAt(0);
var ASTERISK = '*'.charCodeAt(0);
var COLON = ':'.charCodeAt(0);
var AT = '@'.charCodeAt(0);
var RE_AT_END = /[ \n\t\r\f{}()'"\\;/[\]#]/g;
var RE_WORD_END = /[ \n\t\r\f(){}:;@!'"\\\][#]|\/(?=\*)/g;
var RE_BAD_BRACKET = /.[\\/("'\n]/;
var RE_HEX_ESCAPE = /[a-f0-9]/i;

function tokenizer(input, options) {
  if (options === void 0) {
    options = {};
  }

  var css = input.css.valueOf();
  var ignore = options.ignoreErrors;
  var code, next, quote, lines, last, content, escape;
  var nextLine, nextOffset, escaped, escapePos, prev, n, currentToken;
  var length = css.length;
  var offset = -1;
  var line = 1;
  var pos = 0;
  var buffer = [];
  var returned = [];

  function position() {
    return pos;
  }

  function unclosed(what) {
    throw input.error('Unclosed ' + what, line, pos - offset);
  }

  function endOfFile() {
    return returned.length === 0 && pos >= length;
  }

  function nextToken(opts) {
    if (returned.length) return returned.pop();
    if (pos >= length) return;
    var ignoreUnclosed = opts ? opts.ignoreUnclosed : false;
    code = css.charCodeAt(pos);

    if (code === NEWLINE || code === FEED || code === CR && css.charCodeAt(pos + 1) !== NEWLINE) {
      offset = pos;
      line += 1;
    }

    switch (code) {
      case NEWLINE:
      case SPACE:
      case TAB:
      case CR:
      case FEED:
        next = pos;

        do {
          next += 1;
          code = css.charCodeAt(next);

          if (code === NEWLINE) {
            offset = next;
            line += 1;
          }
        } while (code === SPACE || code === NEWLINE || code === TAB || code === CR || code === FEED);

        currentToken = ['space', css.slice(pos, next)];
        pos = next - 1;
        break;

      case OPEN_SQUARE:
      case CLOSE_SQUARE:
      case OPEN_CURLY:
      case CLOSE_CURLY:
      case COLON:
      case SEMICOLON:
      case CLOSE_PARENTHESES:
        var controlChar = String.fromCharCode(code);
        currentToken = [controlChar, controlChar, line, pos - offset];
        break;

      case OPEN_PARENTHESES:
        prev = buffer.length ? buffer.pop()[1] : '';
        n = css.charCodeAt(pos + 1);

        if (prev === 'url' && n !== SINGLE_QUOTE && n !== DOUBLE_QUOTE && n !== SPACE && n !== NEWLINE && n !== TAB && n !== FEED && n !== CR) {
          next = pos;

          do {
            escaped = false;
            next = css.indexOf(')', next + 1);

            if (next === -1) {
              if (ignore || ignoreUnclosed) {
                next = pos;
                break;
              } else {
                unclosed('bracket');
              }
            }

            escapePos = next;

            while (css.charCodeAt(escapePos - 1) === BACKSLASH) {
              escapePos -= 1;
              escaped = !escaped;
            }
          } while (escaped);

          currentToken = ['brackets', css.slice(pos, next + 1), line, pos - offset, line, next - offset];
          pos = next;
        } else {
          next = css.indexOf(')', pos + 1);
          content = css.slice(pos, next + 1);

          if (next === -1 || RE_BAD_BRACKET.test(content)) {
            currentToken = ['(', '(', line, pos - offset];
          } else {
            currentToken = ['brackets', content, line, pos - offset, line, next - offset];
            pos = next;
          }
        }

        break;

      case SINGLE_QUOTE:
      case DOUBLE_QUOTE:
        quote = code === SINGLE_QUOTE ? '\'' : '"';
        next = pos;

        do {
          escaped = false;
          next = css.indexOf(quote, next + 1);

          if (next === -1) {
            if (ignore || ignoreUnclosed) {
              next = pos + 1;
              break;
            } else {
              unclosed('string');
            }
          }

          escapePos = next;

          while (css.charCodeAt(escapePos - 1) === BACKSLASH) {
            escapePos -= 1;
            escaped = !escaped;
          }
        } while (escaped);

        content = css.slice(pos, next + 1);
        lines = content.split('\n');
        last = lines.length - 1;

        if (last > 0) {
          nextLine = line + last;
          nextOffset = next - lines[last].length;
        } else {
          nextLine = line;
          nextOffset = offset;
        }

        currentToken = ['string', css.slice(pos, next + 1), line, pos - offset, nextLine, next - nextOffset];
        offset = nextOffset;
        line = nextLine;
        pos = next;
        break;

      case AT:
        RE_AT_END.lastIndex = pos + 1;
        RE_AT_END.test(css);

        if (RE_AT_END.lastIndex === 0) {
          next = css.length - 1;
        } else {
          next = RE_AT_END.lastIndex - 2;
        }

        currentToken = ['at-word', css.slice(pos, next + 1), line, pos - offset, line, next - offset];
        pos = next;
        break;

      case BACKSLASH:
        next = pos;
        escape = true;

        while (css.charCodeAt(next + 1) === BACKSLASH) {
          next += 1;
          escape = !escape;
        }

        code = css.charCodeAt(next + 1);

        if (escape && code !== SLASH && code !== SPACE && code !== NEWLINE && code !== TAB && code !== CR && code !== FEED) {
          next += 1;

          if (RE_HEX_ESCAPE.test(css.charAt(next))) {
            while (RE_HEX_ESCAPE.test(css.charAt(next + 1))) {
              next += 1;
            }

            if (css.charCodeAt(next + 1) === SPACE) {
              next += 1;
            }
          }
        }

        currentToken = ['word', css.slice(pos, next + 1), line, pos - offset, line, next - offset];
        pos = next;
        break;

      default:
        if (code === SLASH && css.charCodeAt(pos + 1) === ASTERISK) {
          next = css.indexOf('*/', pos + 2) + 1;

          if (next === 0) {
            if (ignore || ignoreUnclosed) {
              next = css.length;
            } else {
              unclosed('comment');
            }
          }

          content = css.slice(pos, next + 1);
          lines = content.split('\n');
          last = lines.length - 1;

          if (last > 0) {
            nextLine = line + last;
            nextOffset = next - lines[last].length;
          } else {
            nextLine = line;
            nextOffset = offset;
          }

          currentToken = ['comment', content, line, pos - offset, nextLine, next - nextOffset];
          offset = nextOffset;
          line = nextLine;
          pos = next;
        } else {
          RE_WORD_END.lastIndex = pos + 1;
          RE_WORD_END.test(css);

          if (RE_WORD_END.lastIndex === 0) {
            next = css.length - 1;
          } else {
            next = RE_WORD_END.lastIndex - 2;
          }

          currentToken = ['word', css.slice(pos, next + 1), line, pos - offset, line, next - offset];
          buffer.push(currentToken);
          pos = next;
        }

        break;
    }

    pos++;
    return currentToken;
  }

  function back(token) {
    returned.push(token);
  }

  return {
    back: back,
    nextToken: nextToken,
    endOfFile: endOfFile,
    position: position
  };
}

module.exports = exports.default;


},{}],57:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;

/**
 * Contains helpers for working with vendor prefixes.
 *
 * @example
 * const vendor = postcss.vendor
 *
 * @namespace vendor
 */
var vendor = {
  /**
   * Returns the vendor prefix extracted from an input string.
   *
   * @param {string} prop String with or without vendor prefix.
   *
   * @return {string} vendor prefix or empty string
   *
   * @example
   * postcss.vendor.prefix('-moz-tab-size') //=> '-moz-'
   * postcss.vendor.prefix('tab-size')      //=> ''
   */
  prefix: function prefix(prop) {
    var match = prop.match(/^(-\w+-)/);

    if (match) {
      return match[0];
    }

    return '';
  },

  /**
     * Returns the input string stripped of its vendor prefix.
     *
     * @param {string} prop String with or without vendor prefix.
     *
     * @return {string} String name without vendor prefixes.
     *
     * @example
     * postcss.vendor.unprefixed('-moz-tab-size') //=> 'tab-size'
     */
  unprefixed: function unprefixed(prop) {
    return prop.replace(/^-\w+-/, '');
  }
};
var _default = vendor;
exports.default = _default;
module.exports = exports.default;


},{}],58:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = warnOnce;
var printed = {};

function warnOnce(message) {
  if (printed[message]) return;
  printed[message] = true;

  if (typeof console !== 'undefined' && console.warn) {
    console.warn(message);
  }
}

module.exports = exports.default;


},{}],59:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports.default = void 0;

/**
 * Represents a plugin’s warning. It can be created using {@link Node#warn}.
 *
 * @example
 * if (decl.important) {
 *   decl.warn(result, 'Avoid !important', { word: '!important' })
 * }
 */
var Warning = /*#__PURE__*/function () {
  /**
   * @param {string} text        Warning message.
   * @param {Object} [opts]      Warning options.
   * @param {Node}   opts.node   CSS node that caused the warning.
   * @param {string} opts.word   Word in CSS source that caused the warning.
   * @param {number} opts.index  Index in CSS node string that caused
   *                             the warning.
   * @param {string} opts.plugin Name of the plugin that created
   *                             this warning. {@link Result#warn} fills
   *                             this property automatically.
   */
  function Warning(text, opts) {
    if (opts === void 0) {
      opts = {};
    }

    /**
     * Type to filter warnings from {@link Result#messages}.
     * Always equal to `"warning"`.
     *
     * @type {string}
     *
     * @example
     * const nonWarning = result.messages.filter(i => i.type !== 'warning')
     */
    this.type = 'warning';
    /**
     * The warning message.
     *
     * @type {string}
     *
     * @example
     * warning.text //=> 'Try to avoid !important'
     */

    this.text = text;

    if (opts.node && opts.node.source) {
      var pos = opts.node.positionBy(opts);
      /**
       * Line in the input file with this warning’s source.
       * @type {number}
       *
       * @example
       * warning.line //=> 5
       */

      this.line = pos.line;
      /**
       * Column in the input file with this warning’s source.
       *
       * @type {number}
       *
       * @example
       * warning.column //=> 6
       */

      this.column = pos.column;
    }

    for (var opt in opts) {
      this[opt] = opts[opt];
    }
  }
  /**
   * Returns a warning position and message.
   *
   * @example
   * warning.toString() //=> 'postcss-lint:a.css:10:14: Avoid !important'
   *
   * @return {string} Warning position and message.
   */


  var _proto = Warning.prototype;

  _proto.toString = function toString() {
    if (this.node) {
      return this.node.error(this.text, {
        plugin: this.plugin,
        index: this.index,
        word: this.word
      }).message;
    }

    if (this.plugin) {
      return this.plugin + ': ' + this.text;
    }

    return this.text;
  }
  /**
   * @memberof Warning#
   * @member {string} plugin The name of the plugin that created
   *                         it will fill this property automatically.
   *                         this warning. When you call {@link Node#warn}
   *
   * @example
   * warning.plugin //=> 'postcss-important'
   */

  /**
   * @memberof Warning#
   * @member {Node} node Contains the CSS node that caused the warning.
   *
   * @example
   * warning.node.toString() //=> 'color: white !important'
   */
  ;

  return Warning;
}();

var _default = Warning;
exports.default = _default;
module.exports = exports.default;


},{}],60:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

var util = require('./util');
var has = Object.prototype.hasOwnProperty;
var hasNativeMap = typeof Map !== "undefined";

/**
 * A data structure which is a combination of an array and a set. Adding a new
 * member is O(1), testing for membership is O(1), and finding the index of an
 * element is O(1). Removing elements from the set is not supported. Only
 * strings are supported for membership.
 */
function ArraySet() {
  this._array = [];
  this._set = hasNativeMap ? new Map() : Object.create(null);
}

/**
 * Static method for creating ArraySet instances from an existing array.
 */
ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
  var set = new ArraySet();
  for (var i = 0, len = aArray.length; i < len; i++) {
    set.add(aArray[i], aAllowDuplicates);
  }
  return set;
};

/**
 * Return how many unique items are in this ArraySet. If duplicates have been
 * added, than those do not count towards the size.
 *
 * @returns Number
 */
ArraySet.prototype.size = function ArraySet_size() {
  return hasNativeMap ? this._set.size : Object.getOwnPropertyNames(this._set).length;
};

/**
 * Add the given string to this set.
 *
 * @param String aStr
 */
ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
  var sStr = hasNativeMap ? aStr : util.toSetString(aStr);
  var isDuplicate = hasNativeMap ? this.has(aStr) : has.call(this._set, sStr);
  var idx = this._array.length;
  if (!isDuplicate || aAllowDuplicates) {
    this._array.push(aStr);
  }
  if (!isDuplicate) {
    if (hasNativeMap) {
      this._set.set(aStr, idx);
    } else {
      this._set[sStr] = idx;
    }
  }
};

/**
 * Is the given string a member of this set?
 *
 * @param String aStr
 */
ArraySet.prototype.has = function ArraySet_has(aStr) {
  if (hasNativeMap) {
    return this._set.has(aStr);
  } else {
    var sStr = util.toSetString(aStr);
    return has.call(this._set, sStr);
  }
};

/**
 * What is the index of the given string in the array?
 *
 * @param String aStr
 */
ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
  if (hasNativeMap) {
    var idx = this._set.get(aStr);
    if (idx >= 0) {
        return idx;
    }
  } else {
    var sStr = util.toSetString(aStr);
    if (has.call(this._set, sStr)) {
      return this._set[sStr];
    }
  }

  throw new Error('"' + aStr + '" is not in the set.');
};

/**
 * What is the element at the given index?
 *
 * @param Number aIdx
 */
ArraySet.prototype.at = function ArraySet_at(aIdx) {
  if (aIdx >= 0 && aIdx < this._array.length) {
    return this._array[aIdx];
  }
  throw new Error('No element indexed by ' + aIdx);
};

/**
 * Returns the array representation of this set (which has the proper indices
 * indicated by indexOf). Note that this is a copy of the internal array used
 * for storing the members so that no one can mess with internal state.
 */
ArraySet.prototype.toArray = function ArraySet_toArray() {
  return this._array.slice();
};

exports.ArraySet = ArraySet;

},{"./util":69}],61:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 *
 * Based on the Base 64 VLQ implementation in Closure Compiler:
 * https://code.google.com/p/closure-compiler/source/browse/trunk/src/com/google/debugging/sourcemap/Base64VLQ.java
 *
 * Copyright 2011 The Closure Compiler Authors. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *  * Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above
 *    copyright notice, this list of conditions and the following
 *    disclaimer in the documentation and/or other materials provided
 *    with the distribution.
 *  * Neither the name of Google Inc. nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

var base64 = require('./base64');

// A single base 64 digit can contain 6 bits of data. For the base 64 variable
// length quantities we use in the source map spec, the first bit is the sign,
// the next four bits are the actual value, and the 6th bit is the
// continuation bit. The continuation bit tells us whether there are more
// digits in this value following this digit.
//
//   Continuation
//   |    Sign
//   |    |
//   V    V
//   101011

var VLQ_BASE_SHIFT = 5;

// binary: 100000
var VLQ_BASE = 1 << VLQ_BASE_SHIFT;

// binary: 011111
var VLQ_BASE_MASK = VLQ_BASE - 1;

// binary: 100000
var VLQ_CONTINUATION_BIT = VLQ_BASE;

/**
 * Converts from a two-complement value to a value where the sign bit is
 * placed in the least significant bit.  For example, as decimals:
 *   1 becomes 2 (10 binary), -1 becomes 3 (11 binary)
 *   2 becomes 4 (100 binary), -2 becomes 5 (101 binary)
 */
function toVLQSigned(aValue) {
  return aValue < 0
    ? ((-aValue) << 1) + 1
    : (aValue << 1) + 0;
}

/**
 * Converts to a two-complement value from a value where the sign bit is
 * placed in the least significant bit.  For example, as decimals:
 *   2 (10 binary) becomes 1, 3 (11 binary) becomes -1
 *   4 (100 binary) becomes 2, 5 (101 binary) becomes -2
 */
function fromVLQSigned(aValue) {
  var isNegative = (aValue & 1) === 1;
  var shifted = aValue >> 1;
  return isNegative
    ? -shifted
    : shifted;
}

/**
 * Returns the base 64 VLQ encoded value.
 */
exports.encode = function base64VLQ_encode(aValue) {
  var encoded = "";
  var digit;

  var vlq = toVLQSigned(aValue);

  do {
    digit = vlq & VLQ_BASE_MASK;
    vlq >>>= VLQ_BASE_SHIFT;
    if (vlq > 0) {
      // There are still more digits in this value, so we must make sure the
      // continuation bit is marked.
      digit |= VLQ_CONTINUATION_BIT;
    }
    encoded += base64.encode(digit);
  } while (vlq > 0);

  return encoded;
};

/**
 * Decodes the next base 64 VLQ value from the given string and returns the
 * value and the rest of the string via the out parameter.
 */
exports.decode = function base64VLQ_decode(aStr, aIndex, aOutParam) {
  var strLen = aStr.length;
  var result = 0;
  var shift = 0;
  var continuation, digit;

  do {
    if (aIndex >= strLen) {
      throw new Error("Expected more digits in base 64 VLQ value.");
    }

    digit = base64.decode(aStr.charCodeAt(aIndex++));
    if (digit === -1) {
      throw new Error("Invalid base64 digit: " + aStr.charAt(aIndex - 1));
    }

    continuation = !!(digit & VLQ_CONTINUATION_BIT);
    digit &= VLQ_BASE_MASK;
    result = result + (digit << shift);
    shift += VLQ_BASE_SHIFT;
  } while (continuation);

  aOutParam.value = fromVLQSigned(result);
  aOutParam.rest = aIndex;
};

},{"./base64":62}],62:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

var intToCharMap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('');

/**
 * Encode an integer in the range of 0 to 63 to a single base 64 digit.
 */
exports.encode = function (number) {
  if (0 <= number && number < intToCharMap.length) {
    return intToCharMap[number];
  }
  throw new TypeError("Must be between 0 and 63: " + number);
};

/**
 * Decode a single base 64 character code digit to an integer. Returns -1 on
 * failure.
 */
exports.decode = function (charCode) {
  var bigA = 65;     // 'A'
  var bigZ = 90;     // 'Z'

  var littleA = 97;  // 'a'
  var littleZ = 122; // 'z'

  var zero = 48;     // '0'
  var nine = 57;     // '9'

  var plus = 43;     // '+'
  var slash = 47;    // '/'

  var littleOffset = 26;
  var numberOffset = 52;

  // 0 - 25: ABCDEFGHIJKLMNOPQRSTUVWXYZ
  if (bigA <= charCode && charCode <= bigZ) {
    return (charCode - bigA);
  }

  // 26 - 51: abcdefghijklmnopqrstuvwxyz
  if (littleA <= charCode && charCode <= littleZ) {
    return (charCode - littleA + littleOffset);
  }

  // 52 - 61: 0123456789
  if (zero <= charCode && charCode <= nine) {
    return (charCode - zero + numberOffset);
  }

  // 62: +
  if (charCode == plus) {
    return 62;
  }

  // 63: /
  if (charCode == slash) {
    return 63;
  }

  // Invalid base64 digit.
  return -1;
};

},{}],63:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

exports.GREATEST_LOWER_BOUND = 1;
exports.LEAST_UPPER_BOUND = 2;

/**
 * Recursive implementation of binary search.
 *
 * @param aLow Indices here and lower do not contain the needle.
 * @param aHigh Indices here and higher do not contain the needle.
 * @param aNeedle The element being searched for.
 * @param aHaystack The non-empty array being searched.
 * @param aCompare Function which takes two elements and returns -1, 0, or 1.
 * @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
 *     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
 *     closest element that is smaller than or greater than the one we are
 *     searching for, respectively, if the exact element cannot be found.
 */
function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare, aBias) {
  // This function terminates when one of the following is true:
  //
  //   1. We find the exact element we are looking for.
  //
  //   2. We did not find the exact element, but we can return the index of
  //      the next-closest element.
  //
  //   3. We did not find the exact element, and there is no next-closest
  //      element than the one we are searching for, so we return -1.
  var mid = Math.floor((aHigh - aLow) / 2) + aLow;
  var cmp = aCompare(aNeedle, aHaystack[mid], true);
  if (cmp === 0) {
    // Found the element we are looking for.
    return mid;
  }
  else if (cmp > 0) {
    // Our needle is greater than aHaystack[mid].
    if (aHigh - mid > 1) {
      // The element is in the upper half.
      return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare, aBias);
    }

    // The exact needle element was not found in this haystack. Determine if
    // we are in termination case (3) or (2) and return the appropriate thing.
    if (aBias == exports.LEAST_UPPER_BOUND) {
      return aHigh < aHaystack.length ? aHigh : -1;
    } else {
      return mid;
    }
  }
  else {
    // Our needle is less than aHaystack[mid].
    if (mid - aLow > 1) {
      // The element is in the lower half.
      return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare, aBias);
    }

    // we are in termination case (3) or (2) and return the appropriate thing.
    if (aBias == exports.LEAST_UPPER_BOUND) {
      return mid;
    } else {
      return aLow < 0 ? -1 : aLow;
    }
  }
}

/**
 * This is an implementation of binary search which will always try and return
 * the index of the closest element if there is no exact hit. This is because
 * mappings between original and generated line/col pairs are single points,
 * and there is an implicit region between each of them, so a miss just means
 * that you aren't on the very start of a region.
 *
 * @param aNeedle The element you are looking for.
 * @param aHaystack The array that is being searched.
 * @param aCompare A function which takes the needle and an element in the
 *     array and returns -1, 0, or 1 depending on whether the needle is less
 *     than, equal to, or greater than the element, respectively.
 * @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
 *     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
 *     closest element that is smaller than or greater than the one we are
 *     searching for, respectively, if the exact element cannot be found.
 *     Defaults to 'binarySearch.GREATEST_LOWER_BOUND'.
 */
exports.search = function search(aNeedle, aHaystack, aCompare, aBias) {
  if (aHaystack.length === 0) {
    return -1;
  }

  var index = recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack,
                              aCompare, aBias || exports.GREATEST_LOWER_BOUND);
  if (index < 0) {
    return -1;
  }

  // We have found either the exact element, or the next-closest element than
  // the one we are searching for. However, there may be more than one such
  // element. Make sure we always return the smallest of these.
  while (index - 1 >= 0) {
    if (aCompare(aHaystack[index], aHaystack[index - 1], true) !== 0) {
      break;
    }
    --index;
  }

  return index;
};

},{}],64:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2014 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

var util = require('./util');

/**
 * Determine whether mappingB is after mappingA with respect to generated
 * position.
 */
function generatedPositionAfter(mappingA, mappingB) {
  // Optimized for most common case
  var lineA = mappingA.generatedLine;
  var lineB = mappingB.generatedLine;
  var columnA = mappingA.generatedColumn;
  var columnB = mappingB.generatedColumn;
  return lineB > lineA || lineB == lineA && columnB >= columnA ||
         util.compareByGeneratedPositionsInflated(mappingA, mappingB) <= 0;
}

/**
 * A data structure to provide a sorted view of accumulated mappings in a
 * performance conscious manner. It trades a neglibable overhead in general
 * case for a large speedup in case of mappings being added in order.
 */
function MappingList() {
  this._array = [];
  this._sorted = true;
  // Serves as infimum
  this._last = {generatedLine: -1, generatedColumn: 0};
}

/**
 * Iterate through internal items. This method takes the same arguments that
 * `Array.prototype.forEach` takes.
 *
 * NOTE: The order of the mappings is NOT guaranteed.
 */
MappingList.prototype.unsortedForEach =
  function MappingList_forEach(aCallback, aThisArg) {
    this._array.forEach(aCallback, aThisArg);
  };

/**
 * Add the given source mapping.
 *
 * @param Object aMapping
 */
MappingList.prototype.add = function MappingList_add(aMapping) {
  if (generatedPositionAfter(this._last, aMapping)) {
    this._last = aMapping;
    this._array.push(aMapping);
  } else {
    this._sorted = false;
    this._array.push(aMapping);
  }
};

/**
 * Returns the flat, sorted array of mappings. The mappings are sorted by
 * generated position.
 *
 * WARNING: This method returns internal data without copying, for
 * performance. The return value must NOT be mutated, and should be treated as
 * an immutable borrow. If you want to take ownership, you must make your own
 * copy.
 */
MappingList.prototype.toArray = function MappingList_toArray() {
  if (!this._sorted) {
    this._array.sort(util.compareByGeneratedPositionsInflated);
    this._sorted = true;
  }
  return this._array;
};

exports.MappingList = MappingList;

},{"./util":69}],65:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

// It turns out that some (most?) JavaScript engines don't self-host
// `Array.prototype.sort`. This makes sense because C++ will likely remain
// faster than JS when doing raw CPU-intensive sorting. However, when using a
// custom comparator function, calling back and forth between the VM's C++ and
// JIT'd JS is rather slow *and* loses JIT type information, resulting in
// worse generated code for the comparator function than would be optimal. In
// fact, when sorting with a comparator, these costs outweigh the benefits of
// sorting in C++. By using our own JS-implemented Quick Sort (below), we get
// a ~3500ms mean speed-up in `bench/bench.html`.

/**
 * Swap the elements indexed by `x` and `y` in the array `ary`.
 *
 * @param {Array} ary
 *        The array.
 * @param {Number} x
 *        The index of the first item.
 * @param {Number} y
 *        The index of the second item.
 */
function swap(ary, x, y) {
  var temp = ary[x];
  ary[x] = ary[y];
  ary[y] = temp;
}

/**
 * Returns a random integer within the range `low .. high` inclusive.
 *
 * @param {Number} low
 *        The lower bound on the range.
 * @param {Number} high
 *        The upper bound on the range.
 */
function randomIntInRange(low, high) {
  return Math.round(low + (Math.random() * (high - low)));
}

/**
 * The Quick Sort algorithm.
 *
 * @param {Array} ary
 *        An array to sort.
 * @param {function} comparator
 *        Function to use to compare two items.
 * @param {Number} p
 *        Start index of the array
 * @param {Number} r
 *        End index of the array
 */
function doQuickSort(ary, comparator, p, r) {
  // If our lower bound is less than our upper bound, we (1) partition the
  // array into two pieces and (2) recurse on each half. If it is not, this is
  // the empty array and our base case.

  if (p < r) {
    // (1) Partitioning.
    //
    // The partitioning chooses a pivot between `p` and `r` and moves all
    // elements that are less than or equal to the pivot to the before it, and
    // all the elements that are greater than it after it. The effect is that
    // once partition is done, the pivot is in the exact place it will be when
    // the array is put in sorted order, and it will not need to be moved
    // again. This runs in O(n) time.

    // Always choose a random pivot so that an input array which is reverse
    // sorted does not cause O(n^2) running time.
    var pivotIndex = randomIntInRange(p, r);
    var i = p - 1;

    swap(ary, pivotIndex, r);
    var pivot = ary[r];

    // Immediately after `j` is incremented in this loop, the following hold
    // true:
    //
    //   * Every element in `ary[p .. i]` is less than or equal to the pivot.
    //
    //   * Every element in `ary[i+1 .. j-1]` is greater than the pivot.
    for (var j = p; j < r; j++) {
      if (comparator(ary[j], pivot) <= 0) {
        i += 1;
        swap(ary, i, j);
      }
    }

    swap(ary, i + 1, j);
    var q = i + 1;

    // (2) Recurse on each half.

    doQuickSort(ary, comparator, p, q - 1);
    doQuickSort(ary, comparator, q + 1, r);
  }
}

/**
 * Sort the given array in-place with the given comparator function.
 *
 * @param {Array} ary
 *        An array to sort.
 * @param {function} comparator
 *        Function to use to compare two items.
 */
exports.quickSort = function (ary, comparator) {
  doQuickSort(ary, comparator, 0, ary.length - 1);
};

},{}],66:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

var util = require('./util');
var binarySearch = require('./binary-search');
var ArraySet = require('./array-set').ArraySet;
var base64VLQ = require('./base64-vlq');
var quickSort = require('./quick-sort').quickSort;

function SourceMapConsumer(aSourceMap, aSourceMapURL) {
  var sourceMap = aSourceMap;
  if (typeof aSourceMap === 'string') {
    sourceMap = util.parseSourceMapInput(aSourceMap);
  }

  return sourceMap.sections != null
    ? new IndexedSourceMapConsumer(sourceMap, aSourceMapURL)
    : new BasicSourceMapConsumer(sourceMap, aSourceMapURL);
}

SourceMapConsumer.fromSourceMap = function(aSourceMap, aSourceMapURL) {
  return BasicSourceMapConsumer.fromSourceMap(aSourceMap, aSourceMapURL);
}

/**
 * The version of the source mapping spec that we are consuming.
 */
SourceMapConsumer.prototype._version = 3;

// `__generatedMappings` and `__originalMappings` are arrays that hold the
// parsed mapping coordinates from the source map's "mappings" attribute. They
// are lazily instantiated, accessed via the `_generatedMappings` and
// `_originalMappings` getters respectively, and we only parse the mappings
// and create these arrays once queried for a source location. We jump through
// these hoops because there can be many thousands of mappings, and parsing
// them is expensive, so we only want to do it if we must.
//
// Each object in the arrays is of the form:
//
//     {
//       generatedLine: The line number in the generated code,
//       generatedColumn: The column number in the generated code,
//       source: The path to the original source file that generated this
//               chunk of code,
//       originalLine: The line number in the original source that
//                     corresponds to this chunk of generated code,
//       originalColumn: The column number in the original source that
//                       corresponds to this chunk of generated code,
//       name: The name of the original symbol which generated this chunk of
//             code.
//     }
//
// All properties except for `generatedLine` and `generatedColumn` can be
// `null`.
//
// `_generatedMappings` is ordered by the generated positions.
//
// `_originalMappings` is ordered by the original positions.

SourceMapConsumer.prototype.__generatedMappings = null;
Object.defineProperty(SourceMapConsumer.prototype, '_generatedMappings', {
  configurable: true,
  enumerable: true,
  get: function () {
    if (!this.__generatedMappings) {
      this._parseMappings(this._mappings, this.sourceRoot);
    }

    return this.__generatedMappings;
  }
});

SourceMapConsumer.prototype.__originalMappings = null;
Object.defineProperty(SourceMapConsumer.prototype, '_originalMappings', {
  configurable: true,
  enumerable: true,
  get: function () {
    if (!this.__originalMappings) {
      this._parseMappings(this._mappings, this.sourceRoot);
    }

    return this.__originalMappings;
  }
});

SourceMapConsumer.prototype._charIsMappingSeparator =
  function SourceMapConsumer_charIsMappingSeparator(aStr, index) {
    var c = aStr.charAt(index);
    return c === ";" || c === ",";
  };

/**
 * Parse the mappings in a string in to a data structure which we can easily
 * query (the ordered arrays in the `this.__generatedMappings` and
 * `this.__originalMappings` properties).
 */
SourceMapConsumer.prototype._parseMappings =
  function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
    throw new Error("Subclasses must implement _parseMappings");
  };

SourceMapConsumer.GENERATED_ORDER = 1;
SourceMapConsumer.ORIGINAL_ORDER = 2;

SourceMapConsumer.GREATEST_LOWER_BOUND = 1;
SourceMapConsumer.LEAST_UPPER_BOUND = 2;

/**
 * Iterate over each mapping between an original source/line/column and a
 * generated line/column in this source map.
 *
 * @param Function aCallback
 *        The function that is called with each mapping.
 * @param Object aContext
 *        Optional. If specified, this object will be the value of `this` every
 *        time that `aCallback` is called.
 * @param aOrder
 *        Either `SourceMapConsumer.GENERATED_ORDER` or
 *        `SourceMapConsumer.ORIGINAL_ORDER`. Specifies whether you want to
 *        iterate over the mappings sorted by the generated file's line/column
 *        order or the original's source/line/column order, respectively. Defaults to
 *        `SourceMapConsumer.GENERATED_ORDER`.
 */
SourceMapConsumer.prototype.eachMapping =
  function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
    var context = aContext || null;
    var order = aOrder || SourceMapConsumer.GENERATED_ORDER;

    var mappings;
    switch (order) {
    case SourceMapConsumer.GENERATED_ORDER:
      mappings = this._generatedMappings;
      break;
    case SourceMapConsumer.ORIGINAL_ORDER:
      mappings = this._originalMappings;
      break;
    default:
      throw new Error("Unknown order of iteration.");
    }

    var sourceRoot = this.sourceRoot;
    mappings.map(function (mapping) {
      var source = mapping.source === null ? null : this._sources.at(mapping.source);
      source = util.computeSourceURL(sourceRoot, source, this._sourceMapURL);
      return {
        source: source,
        generatedLine: mapping.generatedLine,
        generatedColumn: mapping.generatedColumn,
        originalLine: mapping.originalLine,
        originalColumn: mapping.originalColumn,
        name: mapping.name === null ? null : this._names.at(mapping.name)
      };
    }, this).forEach(aCallback, context);
  };

/**
 * Returns all generated line and column information for the original source,
 * line, and column provided. If no column is provided, returns all mappings
 * corresponding to a either the line we are searching for or the next
 * closest line that has any mappings. Otherwise, returns all mappings
 * corresponding to the given line and either the column we are searching for
 * or the next closest column that has any offsets.
 *
 * The only argument is an object with the following properties:
 *
 *   - source: The filename of the original source.
 *   - line: The line number in the original source.  The line number is 1-based.
 *   - column: Optional. the column number in the original source.
 *    The column number is 0-based.
 *
 * and an array of objects is returned, each with the following properties:
 *
 *   - line: The line number in the generated source, or null.  The
 *    line number is 1-based.
 *   - column: The column number in the generated source, or null.
 *    The column number is 0-based.
 */
SourceMapConsumer.prototype.allGeneratedPositionsFor =
  function SourceMapConsumer_allGeneratedPositionsFor(aArgs) {
    var line = util.getArg(aArgs, 'line');

    // When there is no exact match, BasicSourceMapConsumer.prototype._findMapping
    // returns the index of the closest mapping less than the needle. By
    // setting needle.originalColumn to 0, we thus find the last mapping for
    // the given line, provided such a mapping exists.
    var needle = {
      source: util.getArg(aArgs, 'source'),
      originalLine: line,
      originalColumn: util.getArg(aArgs, 'column', 0)
    };

    needle.source = this._findSourceIndex(needle.source);
    if (needle.source < 0) {
      return [];
    }

    var mappings = [];

    var index = this._findMapping(needle,
                                  this._originalMappings,
                                  "originalLine",
                                  "originalColumn",
                                  util.compareByOriginalPositions,
                                  binarySearch.LEAST_UPPER_BOUND);
    if (index >= 0) {
      var mapping = this._originalMappings[index];

      if (aArgs.column === undefined) {
        var originalLine = mapping.originalLine;

        // Iterate until either we run out of mappings, or we run into
        // a mapping for a different line than the one we found. Since
        // mappings are sorted, this is guaranteed to find all mappings for
        // the line we found.
        while (mapping && mapping.originalLine === originalLine) {
          mappings.push({
            line: util.getArg(mapping, 'generatedLine', null),
            column: util.getArg(mapping, 'generatedColumn', null),
            lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
          });

          mapping = this._originalMappings[++index];
        }
      } else {
        var originalColumn = mapping.originalColumn;

        // Iterate until either we run out of mappings, or we run into
        // a mapping for a different line than the one we were searching for.
        // Since mappings are sorted, this is guaranteed to find all mappings for
        // the line we are searching for.
        while (mapping &&
               mapping.originalLine === line &&
               mapping.originalColumn == originalColumn) {
          mappings.push({
            line: util.getArg(mapping, 'generatedLine', null),
            column: util.getArg(mapping, 'generatedColumn', null),
            lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
          });

          mapping = this._originalMappings[++index];
        }
      }
    }

    return mappings;
  };

exports.SourceMapConsumer = SourceMapConsumer;

/**
 * A BasicSourceMapConsumer instance represents a parsed source map which we can
 * query for information about the original file positions by giving it a file
 * position in the generated source.
 *
 * The first parameter is the raw source map (either as a JSON string, or
 * already parsed to an object). According to the spec, source maps have the
 * following attributes:
 *
 *   - version: Which version of the source map spec this map is following.
 *   - sources: An array of URLs to the original source files.
 *   - names: An array of identifiers which can be referrenced by individual mappings.
 *   - sourceRoot: Optional. The URL root from which all sources are relative.
 *   - sourcesContent: Optional. An array of contents of the original source files.
 *   - mappings: A string of base64 VLQs which contain the actual mappings.
 *   - file: Optional. The generated file this source map is associated with.
 *
 * Here is an example source map, taken from the source map spec[0]:
 *
 *     {
 *       version : 3,
 *       file: "out.js",
 *       sourceRoot : "",
 *       sources: ["foo.js", "bar.js"],
 *       names: ["src", "maps", "are", "fun"],
 *       mappings: "AA,AB;;ABCDE;"
 *     }
 *
 * The second parameter, if given, is a string whose value is the URL
 * at which the source map was found.  This URL is used to compute the
 * sources array.
 *
 * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit?pli=1#
 */
function BasicSourceMapConsumer(aSourceMap, aSourceMapURL) {
  var sourceMap = aSourceMap;
  if (typeof aSourceMap === 'string') {
    sourceMap = util.parseSourceMapInput(aSourceMap);
  }

  var version = util.getArg(sourceMap, 'version');
  var sources = util.getArg(sourceMap, 'sources');
  // Sass 3.3 leaves out the 'names' array, so we deviate from the spec (which
  // requires the array) to play nice here.
  var names = util.getArg(sourceMap, 'names', []);
  var sourceRoot = util.getArg(sourceMap, 'sourceRoot', null);
  var sourcesContent = util.getArg(sourceMap, 'sourcesContent', null);
  var mappings = util.getArg(sourceMap, 'mappings');
  var file = util.getArg(sourceMap, 'file', null);

  // Once again, Sass deviates from the spec and supplies the version as a
  // string rather than a number, so we use loose equality checking here.
  if (version != this._version) {
    throw new Error('Unsupported version: ' + version);
  }

  if (sourceRoot) {
    sourceRoot = util.normalize(sourceRoot);
  }

  sources = sources
    .map(String)
    // Some source maps produce relative source paths like "./foo.js" instead of
    // "foo.js".  Normalize these first so that future comparisons will succeed.
    // See bugzil.la/1090768.
    .map(util.normalize)
    // Always ensure that absolute sources are internally stored relative to
    // the source root, if the source root is absolute. Not doing this would
    // be particularly problematic when the source root is a prefix of the
    // source (valid, but why??). See github issue #199 and bugzil.la/1188982.
    .map(function (source) {
      return sourceRoot && util.isAbsolute(sourceRoot) && util.isAbsolute(source)
        ? util.relative(sourceRoot, source)
        : source;
    });

  // Pass `true` below to allow duplicate names and sources. While source maps
  // are intended to be compressed and deduplicated, the TypeScript compiler
  // sometimes generates source maps with duplicates in them. See Github issue
  // #72 and bugzil.la/889492.
  this._names = ArraySet.fromArray(names.map(String), true);
  this._sources = ArraySet.fromArray(sources, true);

  this._absoluteSources = this._sources.toArray().map(function (s) {
    return util.computeSourceURL(sourceRoot, s, aSourceMapURL);
  });

  this.sourceRoot = sourceRoot;
  this.sourcesContent = sourcesContent;
  this._mappings = mappings;
  this._sourceMapURL = aSourceMapURL;
  this.file = file;
}

BasicSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
BasicSourceMapConsumer.prototype.consumer = SourceMapConsumer;

/**
 * Utility function to find the index of a source.  Returns -1 if not
 * found.
 */
BasicSourceMapConsumer.prototype._findSourceIndex = function(aSource) {
  var relativeSource = aSource;
  if (this.sourceRoot != null) {
    relativeSource = util.relative(this.sourceRoot, relativeSource);
  }

  if (this._sources.has(relativeSource)) {
    return this._sources.indexOf(relativeSource);
  }

  // Maybe aSource is an absolute URL as returned by |sources|.  In
  // this case we can't simply undo the transform.
  var i;
  for (i = 0; i < this._absoluteSources.length; ++i) {
    if (this._absoluteSources[i] == aSource) {
      return i;
    }
  }

  return -1;
};

/**
 * Create a BasicSourceMapConsumer from a SourceMapGenerator.
 *
 * @param SourceMapGenerator aSourceMap
 *        The source map that will be consumed.
 * @param String aSourceMapURL
 *        The URL at which the source map can be found (optional)
 * @returns BasicSourceMapConsumer
 */
BasicSourceMapConsumer.fromSourceMap =
  function SourceMapConsumer_fromSourceMap(aSourceMap, aSourceMapURL) {
    var smc = Object.create(BasicSourceMapConsumer.prototype);

    var names = smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
    var sources = smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
    smc.sourceRoot = aSourceMap._sourceRoot;
    smc.sourcesContent = aSourceMap._generateSourcesContent(smc._sources.toArray(),
                                                            smc.sourceRoot);
    smc.file = aSourceMap._file;
    smc._sourceMapURL = aSourceMapURL;
    smc._absoluteSources = smc._sources.toArray().map(function (s) {
      return util.computeSourceURL(smc.sourceRoot, s, aSourceMapURL);
    });

    // Because we are modifying the entries (by converting string sources and
    // names to indices into the sources and names ArraySets), we have to make
    // a copy of the entry or else bad things happen. Shared mutable state
    // strikes again! See github issue #191.

    var generatedMappings = aSourceMap._mappings.toArray().slice();
    var destGeneratedMappings = smc.__generatedMappings = [];
    var destOriginalMappings = smc.__originalMappings = [];

    for (var i = 0, length = generatedMappings.length; i < length; i++) {
      var srcMapping = generatedMappings[i];
      var destMapping = new Mapping;
      destMapping.generatedLine = srcMapping.generatedLine;
      destMapping.generatedColumn = srcMapping.generatedColumn;

      if (srcMapping.source) {
        destMapping.source = sources.indexOf(srcMapping.source);
        destMapping.originalLine = srcMapping.originalLine;
        destMapping.originalColumn = srcMapping.originalColumn;

        if (srcMapping.name) {
          destMapping.name = names.indexOf(srcMapping.name);
        }

        destOriginalMappings.push(destMapping);
      }

      destGeneratedMappings.push(destMapping);
    }

    quickSort(smc.__originalMappings, util.compareByOriginalPositions);

    return smc;
  };

/**
 * The version of the source mapping spec that we are consuming.
 */
BasicSourceMapConsumer.prototype._version = 3;

/**
 * The list of original sources.
 */
Object.defineProperty(BasicSourceMapConsumer.prototype, 'sources', {
  get: function () {
    return this._absoluteSources.slice();
  }
});

/**
 * Provide the JIT with a nice shape / hidden class.
 */
function Mapping() {
  this.generatedLine = 0;
  this.generatedColumn = 0;
  this.source = null;
  this.originalLine = null;
  this.originalColumn = null;
  this.name = null;
}

/**
 * Parse the mappings in a string in to a data structure which we can easily
 * query (the ordered arrays in the `this.__generatedMappings` and
 * `this.__originalMappings` properties).
 */
BasicSourceMapConsumer.prototype._parseMappings =
  function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
    var generatedLine = 1;
    var previousGeneratedColumn = 0;
    var previousOriginalLine = 0;
    var previousOriginalColumn = 0;
    var previousSource = 0;
    var previousName = 0;
    var length = aStr.length;
    var index = 0;
    var cachedSegments = {};
    var temp = {};
    var originalMappings = [];
    var generatedMappings = [];
    var mapping, str, segment, end, value;

    while (index < length) {
      if (aStr.charAt(index) === ';') {
        generatedLine++;
        index++;
        previousGeneratedColumn = 0;
      }
      else if (aStr.charAt(index) === ',') {
        index++;
      }
      else {
        mapping = new Mapping();
        mapping.generatedLine = generatedLine;

        // Because each offset is encoded relative to the previous one,
        // many segments often have the same encoding. We can exploit this
        // fact by caching the parsed variable length fields of each segment,
        // allowing us to avoid a second parse if we encounter the same
        // segment again.
        for (end = index; end < length; end++) {
          if (this._charIsMappingSeparator(aStr, end)) {
            break;
          }
        }
        str = aStr.slice(index, end);

        segment = cachedSegments[str];
        if (segment) {
          index += str.length;
        } else {
          segment = [];
          while (index < end) {
            base64VLQ.decode(aStr, index, temp);
            value = temp.value;
            index = temp.rest;
            segment.push(value);
          }

          if (segment.length === 2) {
            throw new Error('Found a source, but no line and column');
          }

          if (segment.length === 3) {
            throw new Error('Found a source and line, but no column');
          }

          cachedSegments[str] = segment;
        }

        // Generated column.
        mapping.generatedColumn = previousGeneratedColumn + segment[0];
        previousGeneratedColumn = mapping.generatedColumn;

        if (segment.length > 1) {
          // Original source.
          mapping.source = previousSource + segment[1];
          previousSource += segment[1];

          // Original line.
          mapping.originalLine = previousOriginalLine + segment[2];
          previousOriginalLine = mapping.originalLine;
          // Lines are stored 0-based
          mapping.originalLine += 1;

          // Original column.
          mapping.originalColumn = previousOriginalColumn + segment[3];
          previousOriginalColumn = mapping.originalColumn;

          if (segment.length > 4) {
            // Original name.
            mapping.name = previousName + segment[4];
            previousName += segment[4];
          }
        }

        generatedMappings.push(mapping);
        if (typeof mapping.originalLine === 'number') {
          originalMappings.push(mapping);
        }
      }
    }

    quickSort(generatedMappings, util.compareByGeneratedPositionsDeflated);
    this.__generatedMappings = generatedMappings;

    quickSort(originalMappings, util.compareByOriginalPositions);
    this.__originalMappings = originalMappings;
  };

/**
 * Find the mapping that best matches the hypothetical "needle" mapping that
 * we are searching for in the given "haystack" of mappings.
 */
BasicSourceMapConsumer.prototype._findMapping =
  function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName,
                                         aColumnName, aComparator, aBias) {
    // To return the position we are searching for, we must first find the
    // mapping for the given position and then return the opposite position it
    // points to. Because the mappings are sorted, we can use binary search to
    // find the best mapping.

    if (aNeedle[aLineName] <= 0) {
      throw new TypeError('Line must be greater than or equal to 1, got '
                          + aNeedle[aLineName]);
    }
    if (aNeedle[aColumnName] < 0) {
      throw new TypeError('Column must be greater than or equal to 0, got '
                          + aNeedle[aColumnName]);
    }

    return binarySearch.search(aNeedle, aMappings, aComparator, aBias);
  };

/**
 * Compute the last column for each generated mapping. The last column is
 * inclusive.
 */
BasicSourceMapConsumer.prototype.computeColumnSpans =
  function SourceMapConsumer_computeColumnSpans() {
    for (var index = 0; index < this._generatedMappings.length; ++index) {
      var mapping = this._generatedMappings[index];

      // Mappings do not contain a field for the last generated columnt. We
      // can come up with an optimistic estimate, however, by assuming that
      // mappings are contiguous (i.e. given two consecutive mappings, the
      // first mapping ends where the second one starts).
      if (index + 1 < this._generatedMappings.length) {
        var nextMapping = this._generatedMappings[index + 1];

        if (mapping.generatedLine === nextMapping.generatedLine) {
          mapping.lastGeneratedColumn = nextMapping.generatedColumn - 1;
          continue;
        }
      }

      // The last mapping for each line spans the entire line.
      mapping.lastGeneratedColumn = Infinity;
    }
  };

/**
 * Returns the original source, line, and column information for the generated
 * source's line and column positions provided. The only argument is an object
 * with the following properties:
 *
 *   - line: The line number in the generated source.  The line number
 *     is 1-based.
 *   - column: The column number in the generated source.  The column
 *     number is 0-based.
 *   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
 *     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
 *     closest element that is smaller than or greater than the one we are
 *     searching for, respectively, if the exact element cannot be found.
 *     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
 *
 * and an object is returned with the following properties:
 *
 *   - source: The original source file, or null.
 *   - line: The line number in the original source, or null.  The
 *     line number is 1-based.
 *   - column: The column number in the original source, or null.  The
 *     column number is 0-based.
 *   - name: The original identifier, or null.
 */
BasicSourceMapConsumer.prototype.originalPositionFor =
  function SourceMapConsumer_originalPositionFor(aArgs) {
    var needle = {
      generatedLine: util.getArg(aArgs, 'line'),
      generatedColumn: util.getArg(aArgs, 'column')
    };

    var index = this._findMapping(
      needle,
      this._generatedMappings,
      "generatedLine",
      "generatedColumn",
      util.compareByGeneratedPositionsDeflated,
      util.getArg(aArgs, 'bias', SourceMapConsumer.GREATEST_LOWER_BOUND)
    );

    if (index >= 0) {
      var mapping = this._generatedMappings[index];

      if (mapping.generatedLine === needle.generatedLine) {
        var source = util.getArg(mapping, 'source', null);
        if (source !== null) {
          source = this._sources.at(source);
          source = util.computeSourceURL(this.sourceRoot, source, this._sourceMapURL);
        }
        var name = util.getArg(mapping, 'name', null);
        if (name !== null) {
          name = this._names.at(name);
        }
        return {
          source: source,
          line: util.getArg(mapping, 'originalLine', null),
          column: util.getArg(mapping, 'originalColumn', null),
          name: name
        };
      }
    }

    return {
      source: null,
      line: null,
      column: null,
      name: null
    };
  };

/**
 * Return true if we have the source content for every source in the source
 * map, false otherwise.
 */
BasicSourceMapConsumer.prototype.hasContentsOfAllSources =
  function BasicSourceMapConsumer_hasContentsOfAllSources() {
    if (!this.sourcesContent) {
      return false;
    }
    return this.sourcesContent.length >= this._sources.size() &&
      !this.sourcesContent.some(function (sc) { return sc == null; });
  };

/**
 * Returns the original source content. The only argument is the url of the
 * original source file. Returns null if no original source content is
 * available.
 */
BasicSourceMapConsumer.prototype.sourceContentFor =
  function SourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
    if (!this.sourcesContent) {
      return null;
    }

    var index = this._findSourceIndex(aSource);
    if (index >= 0) {
      return this.sourcesContent[index];
    }

    var relativeSource = aSource;
    if (this.sourceRoot != null) {
      relativeSource = util.relative(this.sourceRoot, relativeSource);
    }

    var url;
    if (this.sourceRoot != null
        && (url = util.urlParse(this.sourceRoot))) {
      // XXX: file:// URIs and absolute paths lead to unexpected behavior for
      // many users. We can help them out when they expect file:// URIs to
      // behave like it would if they were running a local HTTP server. See
      // https://bugzilla.mozilla.org/show_bug.cgi?id=885597.
      var fileUriAbsPath = relativeSource.replace(/^file:\/\//, "");
      if (url.scheme == "file"
          && this._sources.has(fileUriAbsPath)) {
        return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)]
      }

      if ((!url.path || url.path == "/")
          && this._sources.has("/" + relativeSource)) {
        return this.sourcesContent[this._sources.indexOf("/" + relativeSource)];
      }
    }

    // This function is used recursively from
    // IndexedSourceMapConsumer.prototype.sourceContentFor. In that case, we
    // don't want to throw if we can't find the source - we just want to
    // return null, so we provide a flag to exit gracefully.
    if (nullOnMissing) {
      return null;
    }
    else {
      throw new Error('"' + relativeSource + '" is not in the SourceMap.');
    }
  };

/**
 * Returns the generated line and column information for the original source,
 * line, and column positions provided. The only argument is an object with
 * the following properties:
 *
 *   - source: The filename of the original source.
 *   - line: The line number in the original source.  The line number
 *     is 1-based.
 *   - column: The column number in the original source.  The column
 *     number is 0-based.
 *   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
 *     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
 *     closest element that is smaller than or greater than the one we are
 *     searching for, respectively, if the exact element cannot be found.
 *     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
 *
 * and an object is returned with the following properties:
 *
 *   - line: The line number in the generated source, or null.  The
 *     line number is 1-based.
 *   - column: The column number in the generated source, or null.
 *     The column number is 0-based.
 */
BasicSourceMapConsumer.prototype.generatedPositionFor =
  function SourceMapConsumer_generatedPositionFor(aArgs) {
    var source = util.getArg(aArgs, 'source');
    source = this._findSourceIndex(source);
    if (source < 0) {
      return {
        line: null,
        column: null,
        lastColumn: null
      };
    }

    var needle = {
      source: source,
      originalLine: util.getArg(aArgs, 'line'),
      originalColumn: util.getArg(aArgs, 'column')
    };

    var index = this._findMapping(
      needle,
      this._originalMappings,
      "originalLine",
      "originalColumn",
      util.compareByOriginalPositions,
      util.getArg(aArgs, 'bias', SourceMapConsumer.GREATEST_LOWER_BOUND)
    );

    if (index >= 0) {
      var mapping = this._originalMappings[index];

      if (mapping.source === needle.source) {
        return {
          line: util.getArg(mapping, 'generatedLine', null),
          column: util.getArg(mapping, 'generatedColumn', null),
          lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
        };
      }
    }

    return {
      line: null,
      column: null,
      lastColumn: null
    };
  };

exports.BasicSourceMapConsumer = BasicSourceMapConsumer;

/**
 * An IndexedSourceMapConsumer instance represents a parsed source map which
 * we can query for information. It differs from BasicSourceMapConsumer in
 * that it takes "indexed" source maps (i.e. ones with a "sections" field) as
 * input.
 *
 * The first parameter is a raw source map (either as a JSON string, or already
 * parsed to an object). According to the spec for indexed source maps, they
 * have the following attributes:
 *
 *   - version: Which version of the source map spec this map is following.
 *   - file: Optional. The generated file this source map is associated with.
 *   - sections: A list of section definitions.
 *
 * Each value under the "sections" field has two fields:
 *   - offset: The offset into the original specified at which this section
 *       begins to apply, defined as an object with a "line" and "column"
 *       field.
 *   - map: A source map definition. This source map could also be indexed,
 *       but doesn't have to be.
 *
 * Instead of the "map" field, it's also possible to have a "url" field
 * specifying a URL to retrieve a source map from, but that's currently
 * unsupported.
 *
 * Here's an example source map, taken from the source map spec[0], but
 * modified to omit a section which uses the "url" field.
 *
 *  {
 *    version : 3,
 *    file: "app.js",
 *    sections: [{
 *      offset: {line:100, column:10},
 *      map: {
 *        version : 3,
 *        file: "section.js",
 *        sources: ["foo.js", "bar.js"],
 *        names: ["src", "maps", "are", "fun"],
 *        mappings: "AAAA,E;;ABCDE;"
 *      }
 *    }],
 *  }
 *
 * The second parameter, if given, is a string whose value is the URL
 * at which the source map was found.  This URL is used to compute the
 * sources array.
 *
 * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit#heading=h.535es3xeprgt
 */
function IndexedSourceMapConsumer(aSourceMap, aSourceMapURL) {
  var sourceMap = aSourceMap;
  if (typeof aSourceMap === 'string') {
    sourceMap = util.parseSourceMapInput(aSourceMap);
  }

  var version = util.getArg(sourceMap, 'version');
  var sections = util.getArg(sourceMap, 'sections');

  if (version != this._version) {
    throw new Error('Unsupported version: ' + version);
  }

  this._sources = new ArraySet();
  this._names = new ArraySet();

  var lastOffset = {
    line: -1,
    column: 0
  };
  this._sections = sections.map(function (s) {
    if (s.url) {
      // The url field will require support for asynchronicity.
      // See https://github.com/mozilla/source-map/issues/16
      throw new Error('Support for url field in sections not implemented.');
    }
    var offset = util.getArg(s, 'offset');
    var offsetLine = util.getArg(offset, 'line');
    var offsetColumn = util.getArg(offset, 'column');

    if (offsetLine < lastOffset.line ||
        (offsetLine === lastOffset.line && offsetColumn < lastOffset.column)) {
      throw new Error('Section offsets must be ordered and non-overlapping.');
    }
    lastOffset = offset;

    return {
      generatedOffset: {
        // The offset fields are 0-based, but we use 1-based indices when
        // encoding/decoding from VLQ.
        generatedLine: offsetLine + 1,
        generatedColumn: offsetColumn + 1
      },
      consumer: new SourceMapConsumer(util.getArg(s, 'map'), aSourceMapURL)
    }
  });
}

IndexedSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
IndexedSourceMapConsumer.prototype.constructor = SourceMapConsumer;

/**
 * The version of the source mapping spec that we are consuming.
 */
IndexedSourceMapConsumer.prototype._version = 3;

/**
 * The list of original sources.
 */
Object.defineProperty(IndexedSourceMapConsumer.prototype, 'sources', {
  get: function () {
    var sources = [];
    for (var i = 0; i < this._sections.length; i++) {
      for (var j = 0; j < this._sections[i].consumer.sources.length; j++) {
        sources.push(this._sections[i].consumer.sources[j]);
      }
    }
    return sources;
  }
});

/**
 * Returns the original source, line, and column information for the generated
 * source's line and column positions provided. The only argument is an object
 * with the following properties:
 *
 *   - line: The line number in the generated source.  The line number
 *     is 1-based.
 *   - column: The column number in the generated source.  The column
 *     number is 0-based.
 *
 * and an object is returned with the following properties:
 *
 *   - source: The original source file, or null.
 *   - line: The line number in the original source, or null.  The
 *     line number is 1-based.
 *   - column: The column number in the original source, or null.  The
 *     column number is 0-based.
 *   - name: The original identifier, or null.
 */
IndexedSourceMapConsumer.prototype.originalPositionFor =
  function IndexedSourceMapConsumer_originalPositionFor(aArgs) {
    var needle = {
      generatedLine: util.getArg(aArgs, 'line'),
      generatedColumn: util.getArg(aArgs, 'column')
    };

    // Find the section containing the generated position we're trying to map
    // to an original position.
    var sectionIndex = binarySearch.search(needle, this._sections,
      function(needle, section) {
        var cmp = needle.generatedLine - section.generatedOffset.generatedLine;
        if (cmp) {
          return cmp;
        }

        return (needle.generatedColumn -
                section.generatedOffset.generatedColumn);
      });
    var section = this._sections[sectionIndex];

    if (!section) {
      return {
        source: null,
        line: null,
        column: null,
        name: null
      };
    }

    return section.consumer.originalPositionFor({
      line: needle.generatedLine -
        (section.generatedOffset.generatedLine - 1),
      column: needle.generatedColumn -
        (section.generatedOffset.generatedLine === needle.generatedLine
         ? section.generatedOffset.generatedColumn - 1
         : 0),
      bias: aArgs.bias
    });
  };

/**
 * Return true if we have the source content for every source in the source
 * map, false otherwise.
 */
IndexedSourceMapConsumer.prototype.hasContentsOfAllSources =
  function IndexedSourceMapConsumer_hasContentsOfAllSources() {
    return this._sections.every(function (s) {
      return s.consumer.hasContentsOfAllSources();
    });
  };

/**
 * Returns the original source content. The only argument is the url of the
 * original source file. Returns null if no original source content is
 * available.
 */
IndexedSourceMapConsumer.prototype.sourceContentFor =
  function IndexedSourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
    for (var i = 0; i < this._sections.length; i++) {
      var section = this._sections[i];

      var content = section.consumer.sourceContentFor(aSource, true);
      if (content) {
        return content;
      }
    }
    if (nullOnMissing) {
      return null;
    }
    else {
      throw new Error('"' + aSource + '" is not in the SourceMap.');
    }
  };

/**
 * Returns the generated line and column information for the original source,
 * line, and column positions provided. The only argument is an object with
 * the following properties:
 *
 *   - source: The filename of the original source.
 *   - line: The line number in the original source.  The line number
 *     is 1-based.
 *   - column: The column number in the original source.  The column
 *     number is 0-based.
 *
 * and an object is returned with the following properties:
 *
 *   - line: The line number in the generated source, or null.  The
 *     line number is 1-based. 
 *   - column: The column number in the generated source, or null.
 *     The column number is 0-based.
 */
IndexedSourceMapConsumer.prototype.generatedPositionFor =
  function IndexedSourceMapConsumer_generatedPositionFor(aArgs) {
    for (var i = 0; i < this._sections.length; i++) {
      var section = this._sections[i];

      // Only consider this section if the requested source is in the list of
      // sources of the consumer.
      if (section.consumer._findSourceIndex(util.getArg(aArgs, 'source')) === -1) {
        continue;
      }
      var generatedPosition = section.consumer.generatedPositionFor(aArgs);
      if (generatedPosition) {
        var ret = {
          line: generatedPosition.line +
            (section.generatedOffset.generatedLine - 1),
          column: generatedPosition.column +
            (section.generatedOffset.generatedLine === generatedPosition.line
             ? section.generatedOffset.generatedColumn - 1
             : 0)
        };
        return ret;
      }
    }

    return {
      line: null,
      column: null
    };
  };

/**
 * Parse the mappings in a string in to a data structure which we can easily
 * query (the ordered arrays in the `this.__generatedMappings` and
 * `this.__originalMappings` properties).
 */
IndexedSourceMapConsumer.prototype._parseMappings =
  function IndexedSourceMapConsumer_parseMappings(aStr, aSourceRoot) {
    this.__generatedMappings = [];
    this.__originalMappings = [];
    for (var i = 0; i < this._sections.length; i++) {
      var section = this._sections[i];
      var sectionMappings = section.consumer._generatedMappings;
      for (var j = 0; j < sectionMappings.length; j++) {
        var mapping = sectionMappings[j];

        var source = section.consumer._sources.at(mapping.source);
        source = util.computeSourceURL(section.consumer.sourceRoot, source, this._sourceMapURL);
        this._sources.add(source);
        source = this._sources.indexOf(source);

        var name = null;
        if (mapping.name) {
          name = section.consumer._names.at(mapping.name);
          this._names.add(name);
          name = this._names.indexOf(name);
        }

        // The mappings coming from the consumer for the section have
        // generated positions relative to the start of the section, so we
        // need to offset them to be relative to the start of the concatenated
        // generated file.
        var adjustedMapping = {
          source: source,
          generatedLine: mapping.generatedLine +
            (section.generatedOffset.generatedLine - 1),
          generatedColumn: mapping.generatedColumn +
            (section.generatedOffset.generatedLine === mapping.generatedLine
            ? section.generatedOffset.generatedColumn - 1
            : 0),
          originalLine: mapping.originalLine,
          originalColumn: mapping.originalColumn,
          name: name
        };

        this.__generatedMappings.push(adjustedMapping);
        if (typeof adjustedMapping.originalLine === 'number') {
          this.__originalMappings.push(adjustedMapping);
        }
      }
    }

    quickSort(this.__generatedMappings, util.compareByGeneratedPositionsDeflated);
    quickSort(this.__originalMappings, util.compareByOriginalPositions);
  };

exports.IndexedSourceMapConsumer = IndexedSourceMapConsumer;

},{"./array-set":60,"./base64-vlq":61,"./binary-search":63,"./quick-sort":65,"./util":69}],67:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

var base64VLQ = require('./base64-vlq');
var util = require('./util');
var ArraySet = require('./array-set').ArraySet;
var MappingList = require('./mapping-list').MappingList;

/**
 * An instance of the SourceMapGenerator represents a source map which is
 * being built incrementally. You may pass an object with the following
 * properties:
 *
 *   - file: The filename of the generated source.
 *   - sourceRoot: A root for all relative URLs in this source map.
 */
function SourceMapGenerator(aArgs) {
  if (!aArgs) {
    aArgs = {};
  }
  this._file = util.getArg(aArgs, 'file', null);
  this._sourceRoot = util.getArg(aArgs, 'sourceRoot', null);
  this._skipValidation = util.getArg(aArgs, 'skipValidation', false);
  this._sources = new ArraySet();
  this._names = new ArraySet();
  this._mappings = new MappingList();
  this._sourcesContents = null;
}

SourceMapGenerator.prototype._version = 3;

/**
 * Creates a new SourceMapGenerator based on a SourceMapConsumer
 *
 * @param aSourceMapConsumer The SourceMap.
 */
SourceMapGenerator.fromSourceMap =
  function SourceMapGenerator_fromSourceMap(aSourceMapConsumer) {
    var sourceRoot = aSourceMapConsumer.sourceRoot;
    var generator = new SourceMapGenerator({
      file: aSourceMapConsumer.file,
      sourceRoot: sourceRoot
    });
    aSourceMapConsumer.eachMapping(function (mapping) {
      var newMapping = {
        generated: {
          line: mapping.generatedLine,
          column: mapping.generatedColumn
        }
      };

      if (mapping.source != null) {
        newMapping.source = mapping.source;
        if (sourceRoot != null) {
          newMapping.source = util.relative(sourceRoot, newMapping.source);
        }

        newMapping.original = {
          line: mapping.originalLine,
          column: mapping.originalColumn
        };

        if (mapping.name != null) {
          newMapping.name = mapping.name;
        }
      }

      generator.addMapping(newMapping);
    });
    aSourceMapConsumer.sources.forEach(function (sourceFile) {
      var sourceRelative = sourceFile;
      if (sourceRoot !== null) {
        sourceRelative = util.relative(sourceRoot, sourceFile);
      }

      if (!generator._sources.has(sourceRelative)) {
        generator._sources.add(sourceRelative);
      }

      var content = aSourceMapConsumer.sourceContentFor(sourceFile);
      if (content != null) {
        generator.setSourceContent(sourceFile, content);
      }
    });
    return generator;
  };

/**
 * Add a single mapping from original source line and column to the generated
 * source's line and column for this source map being created. The mapping
 * object should have the following properties:
 *
 *   - generated: An object with the generated line and column positions.
 *   - original: An object with the original line and column positions.
 *   - source: The original source file (relative to the sourceRoot).
 *   - name: An optional original token name for this mapping.
 */
SourceMapGenerator.prototype.addMapping =
  function SourceMapGenerator_addMapping(aArgs) {
    var generated = util.getArg(aArgs, 'generated');
    var original = util.getArg(aArgs, 'original', null);
    var source = util.getArg(aArgs, 'source', null);
    var name = util.getArg(aArgs, 'name', null);

    if (!this._skipValidation) {
      this._validateMapping(generated, original, source, name);
    }

    if (source != null) {
      source = String(source);
      if (!this._sources.has(source)) {
        this._sources.add(source);
      }
    }

    if (name != null) {
      name = String(name);
      if (!this._names.has(name)) {
        this._names.add(name);
      }
    }

    this._mappings.add({
      generatedLine: generated.line,
      generatedColumn: generated.column,
      originalLine: original != null && original.line,
      originalColumn: original != null && original.column,
      source: source,
      name: name
    });
  };

/**
 * Set the source content for a source file.
 */
SourceMapGenerator.prototype.setSourceContent =
  function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
    var source = aSourceFile;
    if (this._sourceRoot != null) {
      source = util.relative(this._sourceRoot, source);
    }

    if (aSourceContent != null) {
      // Add the source content to the _sourcesContents map.
      // Create a new _sourcesContents map if the property is null.
      if (!this._sourcesContents) {
        this._sourcesContents = Object.create(null);
      }
      this._sourcesContents[util.toSetString(source)] = aSourceContent;
    } else if (this._sourcesContents) {
      // Remove the source file from the _sourcesContents map.
      // If the _sourcesContents map is empty, set the property to null.
      delete this._sourcesContents[util.toSetString(source)];
      if (Object.keys(this._sourcesContents).length === 0) {
        this._sourcesContents = null;
      }
    }
  };

/**
 * Applies the mappings of a sub-source-map for a specific source file to the
 * source map being generated. Each mapping to the supplied source file is
 * rewritten using the supplied source map. Note: The resolution for the
 * resulting mappings is the minimium of this map and the supplied map.
 *
 * @param aSourceMapConsumer The source map to be applied.
 * @param aSourceFile Optional. The filename of the source file.
 *        If omitted, SourceMapConsumer's file property will be used.
 * @param aSourceMapPath Optional. The dirname of the path to the source map
 *        to be applied. If relative, it is relative to the SourceMapConsumer.
 *        This parameter is needed when the two source maps aren't in the same
 *        directory, and the source map to be applied contains relative source
 *        paths. If so, those relative source paths need to be rewritten
 *        relative to the SourceMapGenerator.
 */
SourceMapGenerator.prototype.applySourceMap =
  function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
    var sourceFile = aSourceFile;
    // If aSourceFile is omitted, we will use the file property of the SourceMap
    if (aSourceFile == null) {
      if (aSourceMapConsumer.file == null) {
        throw new Error(
          'SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, ' +
          'or the source map\'s "file" property. Both were omitted.'
        );
      }
      sourceFile = aSourceMapConsumer.file;
    }
    var sourceRoot = this._sourceRoot;
    // Make "sourceFile" relative if an absolute Url is passed.
    if (sourceRoot != null) {
      sourceFile = util.relative(sourceRoot, sourceFile);
    }
    // Applying the SourceMap can add and remove items from the sources and
    // the names array.
    var newSources = new ArraySet();
    var newNames = new ArraySet();

    // Find mappings for the "sourceFile"
    this._mappings.unsortedForEach(function (mapping) {
      if (mapping.source === sourceFile && mapping.originalLine != null) {
        // Check if it can be mapped by the source map, then update the mapping.
        var original = aSourceMapConsumer.originalPositionFor({
          line: mapping.originalLine,
          column: mapping.originalColumn
        });
        if (original.source != null) {
          // Copy mapping
          mapping.source = original.source;
          if (aSourceMapPath != null) {
            mapping.source = util.join(aSourceMapPath, mapping.source)
          }
          if (sourceRoot != null) {
            mapping.source = util.relative(sourceRoot, mapping.source);
          }
          mapping.originalLine = original.line;
          mapping.originalColumn = original.column;
          if (original.name != null) {
            mapping.name = original.name;
          }
        }
      }

      var source = mapping.source;
      if (source != null && !newSources.has(source)) {
        newSources.add(source);
      }

      var name = mapping.name;
      if (name != null && !newNames.has(name)) {
        newNames.add(name);
      }

    }, this);
    this._sources = newSources;
    this._names = newNames;

    // Copy sourcesContents of applied map.
    aSourceMapConsumer.sources.forEach(function (sourceFile) {
      var content = aSourceMapConsumer.sourceContentFor(sourceFile);
      if (content != null) {
        if (aSourceMapPath != null) {
          sourceFile = util.join(aSourceMapPath, sourceFile);
        }
        if (sourceRoot != null) {
          sourceFile = util.relative(sourceRoot, sourceFile);
        }
        this.setSourceContent(sourceFile, content);
      }
    }, this);
  };

/**
 * A mapping can have one of the three levels of data:
 *
 *   1. Just the generated position.
 *   2. The Generated position, original position, and original source.
 *   3. Generated and original position, original source, as well as a name
 *      token.
 *
 * To maintain consistency, we validate that any new mapping being added falls
 * in to one of these categories.
 */
SourceMapGenerator.prototype._validateMapping =
  function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource,
                                              aName) {
    // When aOriginal is truthy but has empty values for .line and .column,
    // it is most likely a programmer error. In this case we throw a very
    // specific error message to try to guide them the right way.
    // For example: https://github.com/Polymer/polymer-bundler/pull/519
    if (aOriginal && typeof aOriginal.line !== 'number' && typeof aOriginal.column !== 'number') {
        throw new Error(
            'original.line and original.column are not numbers -- you probably meant to omit ' +
            'the original mapping entirely and only map the generated position. If so, pass ' +
            'null for the original mapping instead of an object with empty or null values.'
        );
    }

    if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
        && aGenerated.line > 0 && aGenerated.column >= 0
        && !aOriginal && !aSource && !aName) {
      // Case 1.
      return;
    }
    else if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
             && aOriginal && 'line' in aOriginal && 'column' in aOriginal
             && aGenerated.line > 0 && aGenerated.column >= 0
             && aOriginal.line > 0 && aOriginal.column >= 0
             && aSource) {
      // Cases 2 and 3.
      return;
    }
    else {
      throw new Error('Invalid mapping: ' + JSON.stringify({
        generated: aGenerated,
        source: aSource,
        original: aOriginal,
        name: aName
      }));
    }
  };

/**
 * Serialize the accumulated mappings in to the stream of base 64 VLQs
 * specified by the source map format.
 */
SourceMapGenerator.prototype._serializeMappings =
  function SourceMapGenerator_serializeMappings() {
    var previousGeneratedColumn = 0;
    var previousGeneratedLine = 1;
    var previousOriginalColumn = 0;
    var previousOriginalLine = 0;
    var previousName = 0;
    var previousSource = 0;
    var result = '';
    var next;
    var mapping;
    var nameIdx;
    var sourceIdx;

    var mappings = this._mappings.toArray();
    for (var i = 0, len = mappings.length; i < len; i++) {
      mapping = mappings[i];
      next = ''

      if (mapping.generatedLine !== previousGeneratedLine) {
        previousGeneratedColumn = 0;
        while (mapping.generatedLine !== previousGeneratedLine) {
          next += ';';
          previousGeneratedLine++;
        }
      }
      else {
        if (i > 0) {
          if (!util.compareByGeneratedPositionsInflated(mapping, mappings[i - 1])) {
            continue;
          }
          next += ',';
        }
      }

      next += base64VLQ.encode(mapping.generatedColumn
                                 - previousGeneratedColumn);
      previousGeneratedColumn = mapping.generatedColumn;

      if (mapping.source != null) {
        sourceIdx = this._sources.indexOf(mapping.source);
        next += base64VLQ.encode(sourceIdx - previousSource);
        previousSource = sourceIdx;

        // lines are stored 0-based in SourceMap spec version 3
        next += base64VLQ.encode(mapping.originalLine - 1
                                   - previousOriginalLine);
        previousOriginalLine = mapping.originalLine - 1;

        next += base64VLQ.encode(mapping.originalColumn
                                   - previousOriginalColumn);
        previousOriginalColumn = mapping.originalColumn;

        if (mapping.name != null) {
          nameIdx = this._names.indexOf(mapping.name);
          next += base64VLQ.encode(nameIdx - previousName);
          previousName = nameIdx;
        }
      }

      result += next;
    }

    return result;
  };

SourceMapGenerator.prototype._generateSourcesContent =
  function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
    return aSources.map(function (source) {
      if (!this._sourcesContents) {
        return null;
      }
      if (aSourceRoot != null) {
        source = util.relative(aSourceRoot, source);
      }
      var key = util.toSetString(source);
      return Object.prototype.hasOwnProperty.call(this._sourcesContents, key)
        ? this._sourcesContents[key]
        : null;
    }, this);
  };

/**
 * Externalize the source map.
 */
SourceMapGenerator.prototype.toJSON =
  function SourceMapGenerator_toJSON() {
    var map = {
      version: this._version,
      sources: this._sources.toArray(),
      names: this._names.toArray(),
      mappings: this._serializeMappings()
    };
    if (this._file != null) {
      map.file = this._file;
    }
    if (this._sourceRoot != null) {
      map.sourceRoot = this._sourceRoot;
    }
    if (this._sourcesContents) {
      map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
    }

    return map;
  };

/**
 * Render the source map being generated to a string.
 */
SourceMapGenerator.prototype.toString =
  function SourceMapGenerator_toString() {
    return JSON.stringify(this.toJSON());
  };

exports.SourceMapGenerator = SourceMapGenerator;

},{"./array-set":60,"./base64-vlq":61,"./mapping-list":64,"./util":69}],68:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

var SourceMapGenerator = require('./source-map-generator').SourceMapGenerator;
var util = require('./util');

// Matches a Windows-style `\r\n` newline or a `\n` newline used by all other
// operating systems these days (capturing the result).
var REGEX_NEWLINE = /(\r?\n)/;

// Newline character code for charCodeAt() comparisons
var NEWLINE_CODE = 10;

// Private symbol for identifying `SourceNode`s when multiple versions of
// the source-map library are loaded. This MUST NOT CHANGE across
// versions!
var isSourceNode = "$$$isSourceNode$$$";

/**
 * SourceNodes provide a way to abstract over interpolating/concatenating
 * snippets of generated JavaScript source code while maintaining the line and
 * column information associated with the original source code.
 *
 * @param aLine The original line number.
 * @param aColumn The original column number.
 * @param aSource The original source's filename.
 * @param aChunks Optional. An array of strings which are snippets of
 *        generated JS, or other SourceNodes.
 * @param aName The original identifier.
 */
function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
  this.children = [];
  this.sourceContents = {};
  this.line = aLine == null ? null : aLine;
  this.column = aColumn == null ? null : aColumn;
  this.source = aSource == null ? null : aSource;
  this.name = aName == null ? null : aName;
  this[isSourceNode] = true;
  if (aChunks != null) this.add(aChunks);
}

/**
 * Creates a SourceNode from generated code and a SourceMapConsumer.
 *
 * @param aGeneratedCode The generated code
 * @param aSourceMapConsumer The SourceMap for the generated code
 * @param aRelativePath Optional. The path that relative sources in the
 *        SourceMapConsumer should be relative to.
 */
SourceNode.fromStringWithSourceMap =
  function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer, aRelativePath) {
    // The SourceNode we want to fill with the generated code
    // and the SourceMap
    var node = new SourceNode();

    // All even indices of this array are one line of the generated code,
    // while all odd indices are the newlines between two adjacent lines
    // (since `REGEX_NEWLINE` captures its match).
    // Processed fragments are accessed by calling `shiftNextLine`.
    var remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
    var remainingLinesIndex = 0;
    var shiftNextLine = function() {
      var lineContents = getNextLine();
      // The last line of a file might not have a newline.
      var newLine = getNextLine() || "";
      return lineContents + newLine;

      function getNextLine() {
        return remainingLinesIndex < remainingLines.length ?
            remainingLines[remainingLinesIndex++] : undefined;
      }
    };

    // We need to remember the position of "remainingLines"
    var lastGeneratedLine = 1, lastGeneratedColumn = 0;

    // The generate SourceNodes we need a code range.
    // To extract it current and last mapping is used.
    // Here we store the last mapping.
    var lastMapping = null;

    aSourceMapConsumer.eachMapping(function (mapping) {
      if (lastMapping !== null) {
        // We add the code from "lastMapping" to "mapping":
        // First check if there is a new line in between.
        if (lastGeneratedLine < mapping.generatedLine) {
          // Associate first line with "lastMapping"
          addMappingWithCode(lastMapping, shiftNextLine());
          lastGeneratedLine++;
          lastGeneratedColumn = 0;
          // The remaining code is added without mapping
        } else {
          // There is no new line in between.
          // Associate the code between "lastGeneratedColumn" and
          // "mapping.generatedColumn" with "lastMapping"
          var nextLine = remainingLines[remainingLinesIndex] || '';
          var code = nextLine.substr(0, mapping.generatedColumn -
                                        lastGeneratedColumn);
          remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn -
                                              lastGeneratedColumn);
          lastGeneratedColumn = mapping.generatedColumn;
          addMappingWithCode(lastMapping, code);
          // No more remaining code, continue
          lastMapping = mapping;
          return;
        }
      }
      // We add the generated code until the first mapping
      // to the SourceNode without any mapping.
      // Each line is added as separate string.
      while (lastGeneratedLine < mapping.generatedLine) {
        node.add(shiftNextLine());
        lastGeneratedLine++;
      }
      if (lastGeneratedColumn < mapping.generatedColumn) {
        var nextLine = remainingLines[remainingLinesIndex] || '';
        node.add(nextLine.substr(0, mapping.generatedColumn));
        remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn);
        lastGeneratedColumn = mapping.generatedColumn;
      }
      lastMapping = mapping;
    }, this);
    // We have processed all mappings.
    if (remainingLinesIndex < remainingLines.length) {
      if (lastMapping) {
        // Associate the remaining code in the current line with "lastMapping"
        addMappingWithCode(lastMapping, shiftNextLine());
      }
      // and add the remaining lines without any mapping
      node.add(remainingLines.splice(remainingLinesIndex).join(""));
    }

    // Copy sourcesContent into SourceNode
    aSourceMapConsumer.sources.forEach(function (sourceFile) {
      var content = aSourceMapConsumer.sourceContentFor(sourceFile);
      if (content != null) {
        if (aRelativePath != null) {
          sourceFile = util.join(aRelativePath, sourceFile);
        }
        node.setSourceContent(sourceFile, content);
      }
    });

    return node;

    function addMappingWithCode(mapping, code) {
      if (mapping === null || mapping.source === undefined) {
        node.add(code);
      } else {
        var source = aRelativePath
          ? util.join(aRelativePath, mapping.source)
          : mapping.source;
        node.add(new SourceNode(mapping.originalLine,
                                mapping.originalColumn,
                                source,
                                code,
                                mapping.name));
      }
    }
  };

/**
 * Add a chunk of generated JS to this source node.
 *
 * @param aChunk A string snippet of generated JS code, another instance of
 *        SourceNode, or an array where each member is one of those things.
 */
SourceNode.prototype.add = function SourceNode_add(aChunk) {
  if (Array.isArray(aChunk)) {
    aChunk.forEach(function (chunk) {
      this.add(chunk);
    }, this);
  }
  else if (aChunk[isSourceNode] || typeof aChunk === "string") {
    if (aChunk) {
      this.children.push(aChunk);
    }
  }
  else {
    throw new TypeError(
      "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
    );
  }
  return this;
};

/**
 * Add a chunk of generated JS to the beginning of this source node.
 *
 * @param aChunk A string snippet of generated JS code, another instance of
 *        SourceNode, or an array where each member is one of those things.
 */
SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
  if (Array.isArray(aChunk)) {
    for (var i = aChunk.length-1; i >= 0; i--) {
      this.prepend(aChunk[i]);
    }
  }
  else if (aChunk[isSourceNode] || typeof aChunk === "string") {
    this.children.unshift(aChunk);
  }
  else {
    throw new TypeError(
      "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
    );
  }
  return this;
};

/**
 * Walk over the tree of JS snippets in this node and its children. The
 * walking function is called once for each snippet of JS and is passed that
 * snippet and the its original associated source's line/column location.
 *
 * @param aFn The traversal function.
 */
SourceNode.prototype.walk = function SourceNode_walk(aFn) {
  var chunk;
  for (var i = 0, len = this.children.length; i < len; i++) {
    chunk = this.children[i];
    if (chunk[isSourceNode]) {
      chunk.walk(aFn);
    }
    else {
      if (chunk !== '') {
        aFn(chunk, { source: this.source,
                     line: this.line,
                     column: this.column,
                     name: this.name });
      }
    }
  }
};

/**
 * Like `String.prototype.join` except for SourceNodes. Inserts `aStr` between
 * each of `this.children`.
 *
 * @param aSep The separator.
 */
SourceNode.prototype.join = function SourceNode_join(aSep) {
  var newChildren;
  var i;
  var len = this.children.length;
  if (len > 0) {
    newChildren = [];
    for (i = 0; i < len-1; i++) {
      newChildren.push(this.children[i]);
      newChildren.push(aSep);
    }
    newChildren.push(this.children[i]);
    this.children = newChildren;
  }
  return this;
};

/**
 * Call String.prototype.replace on the very right-most source snippet. Useful
 * for trimming whitespace from the end of a source node, etc.
 *
 * @param aPattern The pattern to replace.
 * @param aReplacement The thing to replace the pattern with.
 */
SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
  var lastChild = this.children[this.children.length - 1];
  if (lastChild[isSourceNode]) {
    lastChild.replaceRight(aPattern, aReplacement);
  }
  else if (typeof lastChild === 'string') {
    this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
  }
  else {
    this.children.push(''.replace(aPattern, aReplacement));
  }
  return this;
};

/**
 * Set the source content for a source file. This will be added to the SourceMapGenerator
 * in the sourcesContent field.
 *
 * @param aSourceFile The filename of the source file
 * @param aSourceContent The content of the source file
 */
SourceNode.prototype.setSourceContent =
  function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
    this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
  };

/**
 * Walk over the tree of SourceNodes. The walking function is called for each
 * source file content and is passed the filename and source content.
 *
 * @param aFn The traversal function.
 */
SourceNode.prototype.walkSourceContents =
  function SourceNode_walkSourceContents(aFn) {
    for (var i = 0, len = this.children.length; i < len; i++) {
      if (this.children[i][isSourceNode]) {
        this.children[i].walkSourceContents(aFn);
      }
    }

    var sources = Object.keys(this.sourceContents);
    for (var i = 0, len = sources.length; i < len; i++) {
      aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
    }
  };

/**
 * Return the string representation of this source node. Walks over the tree
 * and concatenates all the various snippets together to one string.
 */
SourceNode.prototype.toString = function SourceNode_toString() {
  var str = "";
  this.walk(function (chunk) {
    str += chunk;
  });
  return str;
};

/**
 * Returns the string representation of this source node along with a source
 * map.
 */
SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
  var generated = {
    code: "",
    line: 1,
    column: 0
  };
  var map = new SourceMapGenerator(aArgs);
  var sourceMappingActive = false;
  var lastOriginalSource = null;
  var lastOriginalLine = null;
  var lastOriginalColumn = null;
  var lastOriginalName = null;
  this.walk(function (chunk, original) {
    generated.code += chunk;
    if (original.source !== null
        && original.line !== null
        && original.column !== null) {
      if(lastOriginalSource !== original.source
         || lastOriginalLine !== original.line
         || lastOriginalColumn !== original.column
         || lastOriginalName !== original.name) {
        map.addMapping({
          source: original.source,
          original: {
            line: original.line,
            column: original.column
          },
          generated: {
            line: generated.line,
            column: generated.column
          },
          name: original.name
        });
      }
      lastOriginalSource = original.source;
      lastOriginalLine = original.line;
      lastOriginalColumn = original.column;
      lastOriginalName = original.name;
      sourceMappingActive = true;
    } else if (sourceMappingActive) {
      map.addMapping({
        generated: {
          line: generated.line,
          column: generated.column
        }
      });
      lastOriginalSource = null;
      sourceMappingActive = false;
    }
    for (var idx = 0, length = chunk.length; idx < length; idx++) {
      if (chunk.charCodeAt(idx) === NEWLINE_CODE) {
        generated.line++;
        generated.column = 0;
        // Mappings end at eol
        if (idx + 1 === length) {
          lastOriginalSource = null;
          sourceMappingActive = false;
        } else if (sourceMappingActive) {
          map.addMapping({
            source: original.source,
            original: {
              line: original.line,
              column: original.column
            },
            generated: {
              line: generated.line,
              column: generated.column
            },
            name: original.name
          });
        }
      } else {
        generated.column++;
      }
    }
  });
  this.walkSourceContents(function (sourceFile, sourceContent) {
    map.setSourceContent(sourceFile, sourceContent);
  });

  return { code: generated.code, map: map };
};

exports.SourceNode = SourceNode;

},{"./source-map-generator":67,"./util":69}],69:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */

/**
 * This is a helper function for getting values from parameter/options
 * objects.
 *
 * @param args The object we are extracting values from
 * @param name The name of the property we are getting.
 * @param defaultValue An optional value to return if the property is missing
 * from the object. If this is not specified and the property is missing, an
 * error will be thrown.
 */
function getArg(aArgs, aName, aDefaultValue) {
  if (aName in aArgs) {
    return aArgs[aName];
  } else if (arguments.length === 3) {
    return aDefaultValue;
  } else {
    throw new Error('"' + aName + '" is a required argument.');
  }
}
exports.getArg = getArg;

var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.-]*)(?::(\d+))?(.*)$/;
var dataUrlRegexp = /^data:.+\,.+$/;

function urlParse(aUrl) {
  var match = aUrl.match(urlRegexp);
  if (!match) {
    return null;
  }
  return {
    scheme: match[1],
    auth: match[2],
    host: match[3],
    port: match[4],
    path: match[5]
  };
}
exports.urlParse = urlParse;

function urlGenerate(aParsedUrl) {
  var url = '';
  if (aParsedUrl.scheme) {
    url += aParsedUrl.scheme + ':';
  }
  url += '//';
  if (aParsedUrl.auth) {
    url += aParsedUrl.auth + '@';
  }
  if (aParsedUrl.host) {
    url += aParsedUrl.host;
  }
  if (aParsedUrl.port) {
    url += ":" + aParsedUrl.port
  }
  if (aParsedUrl.path) {
    url += aParsedUrl.path;
  }
  return url;
}
exports.urlGenerate = urlGenerate;

/**
 * Normalizes a path, or the path portion of a URL:
 *
 * - Replaces consecutive slashes with one slash.
 * - Removes unnecessary '.' parts.
 * - Removes unnecessary '<dir>/..' parts.
 *
 * Based on code in the Node.js 'path' core module.
 *
 * @param aPath The path or url to normalize.
 */
function normalize(aPath) {
  var path = aPath;
  var url = urlParse(aPath);
  if (url) {
    if (!url.path) {
      return aPath;
    }
    path = url.path;
  }
  var isAbsolute = exports.isAbsolute(path);

  var parts = path.split(/\/+/);
  for (var part, up = 0, i = parts.length - 1; i >= 0; i--) {
    part = parts[i];
    if (part === '.') {
      parts.splice(i, 1);
    } else if (part === '..') {
      up++;
    } else if (up > 0) {
      if (part === '') {
        // The first part is blank if the path is absolute. Trying to go
        // above the root is a no-op. Therefore we can remove all '..' parts
        // directly after the root.
        parts.splice(i + 1, up);
        up = 0;
      } else {
        parts.splice(i, 2);
        up--;
      }
    }
  }
  path = parts.join('/');

  if (path === '') {
    path = isAbsolute ? '/' : '.';
  }

  if (url) {
    url.path = path;
    return urlGenerate(url);
  }
  return path;
}
exports.normalize = normalize;

/**
 * Joins two paths/URLs.
 *
 * @param aRoot The root path or URL.
 * @param aPath The path or URL to be joined with the root.
 *
 * - If aPath is a URL or a data URI, aPath is returned, unless aPath is a
 *   scheme-relative URL: Then the scheme of aRoot, if any, is prepended
 *   first.
 * - Otherwise aPath is a path. If aRoot is a URL, then its path portion
 *   is updated with the result and aRoot is returned. Otherwise the result
 *   is returned.
 *   - If aPath is absolute, the result is aPath.
 *   - Otherwise the two paths are joined with a slash.
 * - Joining for example 'http://' and 'www.example.com' is also supported.
 */
function join(aRoot, aPath) {
  if (aRoot === "") {
    aRoot = ".";
  }
  if (aPath === "") {
    aPath = ".";
  }
  var aPathUrl = urlParse(aPath);
  var aRootUrl = urlParse(aRoot);
  if (aRootUrl) {
    aRoot = aRootUrl.path || '/';
  }

  // `join(foo, '//www.example.org')`
  if (aPathUrl && !aPathUrl.scheme) {
    if (aRootUrl) {
      aPathUrl.scheme = aRootUrl.scheme;
    }
    return urlGenerate(aPathUrl);
  }

  if (aPathUrl || aPath.match(dataUrlRegexp)) {
    return aPath;
  }

  // `join('http://', 'www.example.com')`
  if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
    aRootUrl.host = aPath;
    return urlGenerate(aRootUrl);
  }

  var joined = aPath.charAt(0) === '/'
    ? aPath
    : normalize(aRoot.replace(/\/+$/, '') + '/' + aPath);

  if (aRootUrl) {
    aRootUrl.path = joined;
    return urlGenerate(aRootUrl);
  }
  return joined;
}
exports.join = join;

exports.isAbsolute = function (aPath) {
  return aPath.charAt(0) === '/' || urlRegexp.test(aPath);
};

/**
 * Make a path relative to a URL or another path.
 *
 * @param aRoot The root path or URL.
 * @param aPath The path or URL to be made relative to aRoot.
 */
function relative(aRoot, aPath) {
  if (aRoot === "") {
    aRoot = ".";
  }

  aRoot = aRoot.replace(/\/$/, '');

  // It is possible for the path to be above the root. In this case, simply
  // checking whether the root is a prefix of the path won't work. Instead, we
  // need to remove components from the root one by one, until either we find
  // a prefix that fits, or we run out of components to remove.
  var level = 0;
  while (aPath.indexOf(aRoot + '/') !== 0) {
    var index = aRoot.lastIndexOf("/");
    if (index < 0) {
      return aPath;
    }

    // If the only part of the root that is left is the scheme (i.e. http://,
    // file:///, etc.), one or more slashes (/), or simply nothing at all, we
    // have exhausted all components, so the path is not relative to the root.
    aRoot = aRoot.slice(0, index);
    if (aRoot.match(/^([^\/]+:\/)?\/*$/)) {
      return aPath;
    }

    ++level;
  }

  // Make sure we add a "../" for each component we removed from the root.
  return Array(level + 1).join("../") + aPath.substr(aRoot.length + 1);
}
exports.relative = relative;

var supportsNullProto = (function () {
  var obj = Object.create(null);
  return !('__proto__' in obj);
}());

function identity (s) {
  return s;
}

/**
 * Because behavior goes wacky when you set `__proto__` on objects, we
 * have to prefix all the strings in our set with an arbitrary character.
 *
 * See https://github.com/mozilla/source-map/pull/31 and
 * https://github.com/mozilla/source-map/issues/30
 *
 * @param String aStr
 */
function toSetString(aStr) {
  if (isProtoString(aStr)) {
    return '$' + aStr;
  }

  return aStr;
}
exports.toSetString = supportsNullProto ? identity : toSetString;

function fromSetString(aStr) {
  if (isProtoString(aStr)) {
    return aStr.slice(1);
  }

  return aStr;
}
exports.fromSetString = supportsNullProto ? identity : fromSetString;

function isProtoString(s) {
  if (!s) {
    return false;
  }

  var length = s.length;

  if (length < 9 /* "__proto__".length */) {
    return false;
  }

  if (s.charCodeAt(length - 1) !== 95  /* '_' */ ||
      s.charCodeAt(length - 2) !== 95  /* '_' */ ||
      s.charCodeAt(length - 3) !== 111 /* 'o' */ ||
      s.charCodeAt(length - 4) !== 116 /* 't' */ ||
      s.charCodeAt(length - 5) !== 111 /* 'o' */ ||
      s.charCodeAt(length - 6) !== 114 /* 'r' */ ||
      s.charCodeAt(length - 7) !== 112 /* 'p' */ ||
      s.charCodeAt(length - 8) !== 95  /* '_' */ ||
      s.charCodeAt(length - 9) !== 95  /* '_' */) {
    return false;
  }

  for (var i = length - 10; i >= 0; i--) {
    if (s.charCodeAt(i) !== 36 /* '$' */) {
      return false;
    }
  }

  return true;
}

/**
 * Comparator between two mappings where the original positions are compared.
 *
 * Optionally pass in `true` as `onlyCompareGenerated` to consider two
 * mappings with the same original source/line/column, but different generated
 * line and column the same. Useful when searching for a mapping with a
 * stubbed out mapping.
 */
function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
  var cmp = strcmp(mappingA.source, mappingB.source);
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalLine - mappingB.originalLine;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalColumn - mappingB.originalColumn;
  if (cmp !== 0 || onlyCompareOriginal) {
    return cmp;
  }

  cmp = mappingA.generatedColumn - mappingB.generatedColumn;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.generatedLine - mappingB.generatedLine;
  if (cmp !== 0) {
    return cmp;
  }

  return strcmp(mappingA.name, mappingB.name);
}
exports.compareByOriginalPositions = compareByOriginalPositions;

/**
 * Comparator between two mappings with deflated source and name indices where
 * the generated positions are compared.
 *
 * Optionally pass in `true` as `onlyCompareGenerated` to consider two
 * mappings with the same generated line and column, but different
 * source/name/original line and column the same. Useful when searching for a
 * mapping with a stubbed out mapping.
 */
function compareByGeneratedPositionsDeflated(mappingA, mappingB, onlyCompareGenerated) {
  var cmp = mappingA.generatedLine - mappingB.generatedLine;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.generatedColumn - mappingB.generatedColumn;
  if (cmp !== 0 || onlyCompareGenerated) {
    return cmp;
  }

  cmp = strcmp(mappingA.source, mappingB.source);
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalLine - mappingB.originalLine;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalColumn - mappingB.originalColumn;
  if (cmp !== 0) {
    return cmp;
  }

  return strcmp(mappingA.name, mappingB.name);
}
exports.compareByGeneratedPositionsDeflated = compareByGeneratedPositionsDeflated;

function strcmp(aStr1, aStr2) {
  if (aStr1 === aStr2) {
    return 0;
  }

  if (aStr1 === null) {
    return 1; // aStr2 !== null
  }

  if (aStr2 === null) {
    return -1; // aStr1 !== null
  }

  if (aStr1 > aStr2) {
    return 1;
  }

  return -1;
}

/**
 * Comparator between two mappings with inflated source and name strings where
 * the generated positions are compared.
 */
function compareByGeneratedPositionsInflated(mappingA, mappingB) {
  var cmp = mappingA.generatedLine - mappingB.generatedLine;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.generatedColumn - mappingB.generatedColumn;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = strcmp(mappingA.source, mappingB.source);
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalLine - mappingB.originalLine;
  if (cmp !== 0) {
    return cmp;
  }

  cmp = mappingA.originalColumn - mappingB.originalColumn;
  if (cmp !== 0) {
    return cmp;
  }

  return strcmp(mappingA.name, mappingB.name);
}
exports.compareByGeneratedPositionsInflated = compareByGeneratedPositionsInflated;

/**
 * Strip any JSON XSSI avoidance prefix from the string (as documented
 * in the source maps specification), and then parse the string as
 * JSON.
 */
function parseSourceMapInput(str) {
  return JSON.parse(str.replace(/^\)]}'[^\n]*\n/, ''));
}
exports.parseSourceMapInput = parseSourceMapInput;

/**
 * Compute the URL of a source given the the source root, the source's
 * URL, and the source map's URL.
 */
function computeSourceURL(sourceRoot, sourceURL, sourceMapURL) {
  sourceURL = sourceURL || '';

  if (sourceRoot) {
    // This follows what Chrome does.
    if (sourceRoot[sourceRoot.length - 1] !== '/' && sourceURL[0] !== '/') {
      sourceRoot += '/';
    }
    // The spec says:
    //   Line 4: An optional source root, useful for relocating source
    //   files on a server or removing repeated values in the
    //   “sources” entry.  This value is prepended to the individual
    //   entries in the “source” field.
    sourceURL = sourceRoot + sourceURL;
  }

  // Historically, SourceMapConsumer did not take the sourceMapURL as
  // a parameter.  This mode is still somewhat supported, which is why
  // this code block is conditional.  However, it's preferable to pass
  // the source map URL to SourceMapConsumer, so that this function
  // can implement the source URL resolution algorithm as outlined in
  // the spec.  This block is basically the equivalent of:
  //    new URL(sourceURL, sourceMapURL).toString()
  // ... except it avoids using URL, which wasn't available in the
  // older releases of node still supported by this library.
  //
  // The spec says:
  //   If the sources are not absolute URLs after prepending of the
  //   “sourceRoot”, the sources are resolved relative to the
  //   SourceMap (like resolving script src in a html document).
  if (sourceMapURL) {
    var parsed = urlParse(sourceMapURL);
    if (!parsed) {
      throw new Error("sourceMapURL could not be parsed");
    }
    if (parsed.path) {
      // Strip the last path component, but keep the "/".
      var index = parsed.path.lastIndexOf('/');
      if (index >= 0) {
        parsed.path = parsed.path.substring(0, index + 1);
      }
    }
    sourceURL = join(urlGenerate(parsed), sourceURL);
  }

  return normalize(sourceURL);
}
exports.computeSourceURL = computeSourceURL;

},{}],70:[function(require,module,exports){
/*
 * Copyright 2009-2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE.txt or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
exports.SourceMapGenerator = require('./lib/source-map-generator').SourceMapGenerator;
exports.SourceMapConsumer = require('./lib/source-map-consumer').SourceMapConsumer;
exports.SourceNode = require('./lib/source-node').SourceNode;

},{"./lib/source-map-consumer":66,"./lib/source-map-generator":67,"./lib/source-node":68}],71:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[11])(11)
});
//# sourceMappingURL=postscriptum.js.map
