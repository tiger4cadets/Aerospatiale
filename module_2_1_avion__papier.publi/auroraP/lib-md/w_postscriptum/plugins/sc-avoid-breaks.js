"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
postscriptum.plugin('sc-avoid-breaks', (processor, options) => {
    const { logger, walk } = postscriptum.util;
    let afterColonCount = 0;
    let afterStrongParaCount = 0;
    if (options.afterColon || options.afterStrongPara)
        processor.on('prepare', function ({ node }) {
            if (options.afterColon && node.nodeType == Node.TEXT_NODE) {
                // Paragraph ending with a colon
                const trimValue = node.nodeValue.trim();
                if (trimValue[trimValue.length - 1] == ":") {
                    let parent = node;
                    while (!walk.displayAsBlock(parent)) {
                        if (parent != walk.lastChild(parent.parentElement, walk.isStaticNode))
                            return;
                        parent = parent.parentElement;
                    }
                    parent.setAttribute('ps-break-after', 'avoid');
                    afterColonCount++;
                }
            }
            else if (options.afterStrongPara && walk.isElement(node) && node.localName == "strong") {
                // Strong paragraph
                const parent = node.parentElement;
                const blockNotLast = walk.displayAsBlock(parent) && walk.nextSibling(parent, walk.isStaticNode);
                if (blockNotLast && node == walk.firstChild(parent, walk.isStaticNode) && node == walk.lastChild(parent, walk.isStaticNode)) {
                    parent.setAttribute('ps-break-after', 'avoid');
                    afterStrongParaCount++;
                }
            }
        });
    processor.on('pagination-start', () => {
        logger.addScope('sc-avoid-breaks');
        if (afterColonCount)
            logger.info(`${afterColonCount} break(s) avoided after colon.`);
        if (afterStrongParaCount)
            logger.info(`${afterStrongParaCount} break(s) after strong para.`);
        logger.removeScope();
    });
}, {
    afterColon: true,
    afterStrongPara: false,
});
