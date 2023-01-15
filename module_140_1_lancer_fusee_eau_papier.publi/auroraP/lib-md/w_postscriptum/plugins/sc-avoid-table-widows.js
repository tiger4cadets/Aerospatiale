"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** Warning: the calculation of the height does not take into account the sub-processes (except on the breakedBox) */
postscriptum.plugin('sc-avoid-table-widows', (processor) => {
    const { css, util } = postscriptum;
    const { logger, walk, ranges } = util;
    const isTable = walk.isConstructedBy(HTMLTableElement);
    processor.on('valid-break-point', function () {
        const pageElem = processor.currentPage.container;
        const flag = pageElem.getAttribute('psp-sc-avoid-table-widows');
        if (flag == "tested" || flag == "reduced")
            return;
        const { breakPoint } = this.layoutContext;
        const breakedNode = ranges.nodeAtPoint(breakPoint);
        const breakedTable = isTable(breakedNode) ? breakedNode : walk.ancestor(breakedNode, isTable);
        if (breakedTable) {
            if (breakedTable.rows.length <= 1)
                return;
            const customTableStyle = css.getCustomStyle(breakedTable);
            const widowsHeight = css.getCustomPluginProp(customTableStyle, 'sc-atw-widows-height');
            if (!widowsHeight)
                return;
            const tables = [breakedTable];
            let table = walk.previous(breakedTable, isTable, this.currentFragment.body);
            while (table) {
                tables.push(table);
                table = walk.previous(table, isTable, this.currentFragment.body);
            }
            if (flag && parseInt(flag) != tables.length) {
                processor.layoutContext.mutations.revert();
                pageElem.setAttribute('psp-sc-avoid-table-widows', 'tested');
                return "detect-overflow";
            }
            const range = document.createRange();
            range.setStart(breakPoint.container, breakPoint.offset);
            range.setEndAfter(breakedTable.lastElementChild);
            const tableEndHeight = range.getBoundingClientRect().height;
            if (tableEndHeight < css.computeLength(widowsHeight, breakedTable.clientHeight)) {
                const newFontSizes = [];
                for (const table of tables) {
                    const fontSize = parseFloat(getComputedStyle(table).fontSize);
                    const minFontSize = css.getCustomPluginProp(customTableStyle, 'sc-atw-min-font-size') || 8;
                    const newFontSize = fontSize - 1;
                    if (newFontSize < minFontSize) {
                        for (const pageTable of tables)
                            pageTable.style.fontSize = '';
                        return;
                    }
                    newFontSizes.push(newFontSize);
                }
                if (newFontSizes.length) {
                    processor.layoutContext.mutations.revert();
                    for (let i = 0; i < tables.length; i++) {
                        tables[i].style.fontSize = newFontSizes[i] + 'px';
                    }
                    processor.layoutContext.mutations.setAttr(pageElem, 'psp-sc-avoid-table-widows', tables.length.toString());
                    return "detect-overflow";
                }
            }
            else if (flag) {
                for (const table of tables)
                    table.style.fontSize = '';
                pageElem.setAttribute('psp-sc-avoid-table-widows', 'tested');
                return "detect-overflow";
            }
        }
        else if (flag) {
            logger.info(`${flag} tables reduced`, 'sc-avoid-table-widows');
            pageElem.setAttribute('psp-sc-avoid-table-widows', 'reduced');
        }
    });
});
