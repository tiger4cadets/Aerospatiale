"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** Warning: the calculation of the height does not take into account the sub-processes (except on the breakedBox) */
postscriptum.plugin('sc-avoid-table-overflow', (processor, options) => {
    const { util } = postscriptum;
    const { logger, walk, ranges } = util;
    const isTable = walk.isConstructedBy(HTMLTableElement);
    processor.on('valid-break-point', function () {
        if (this.layoutContext.parentCtx)
            return;
        const { breakPoint } = this.layoutContext;
        const startNode = ranges.nodeAtPoint(breakPoint);
        const tables = [];
        let table = startNode;
        while ((table = walk.previous(table, isTable, this.currentPage.body)))
            tables.push(table);
        if (tables.length)
            return testOverflow(this.currentPage, tables);
        else if (this.currentPage.container.hasAttribute('psp-sc-ato-rotate')) {
            this.currentPage.container.style.setProperty('--ps-page-width', '');
            this.currentPage.container.style.setProperty('--ps-page-height', '');
        }
    });
    processor.on('no-overflow', function () {
        if (this.layoutContext.parentCtx)
            return;
        const tables = this.currentPage.body.querySelectorAll('table');
        if (tables.length)
            return testOverflow(this.currentPage, tables);
    });
    function testOverflow(page, tables) {
        if (page.container.style.getPropertyValue('--ps-page-width'))
            return;
        let overflow = false;
        const parentWidths = new Map();
        for (const table of tables) {
            let parentWidth = parentWidths.get(table.parentElement);
            if (!parentWidth) {
                parentWidth = Math.ceil(parseFloat(getComputedStyle(table.parentElement).width));
                parentWidths.set(table.parentElement, parentWidth);
            }
            if (!overflow && (page.container.hasAttribute('psp-sc-ato-rotate') || table.clientWidth > parentWidth))
                overflow = true;
        }
        if (overflow) {
            page.container.setAttribute('psp-sc-ato-rotate', '');
            const containerStyle = getComputedStyle(page.container);
            if (parseFloat(containerStyle.height) > parseFloat(containerStyle.width)) {
                const width = containerStyle.getPropertyValue('--ps-page-width');
                processor.layoutContext.mutations.revert();
                page.container.style.setProperty('--ps-page-width', containerStyle.getPropertyValue('--ps-page-height'));
                page.container.style.setProperty('--ps-page-height', width);
                logger.log(logger.levelFromString(options.logLevel), 'Page rotated.', 'sc-avoid-table-overflow');
                return "detect-overflow";
            }
        }
    }
}, { logLevel: 'info' });
