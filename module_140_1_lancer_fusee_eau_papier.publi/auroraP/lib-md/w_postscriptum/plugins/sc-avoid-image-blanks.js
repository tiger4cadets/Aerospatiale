"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Plugin Scenari that shrinks or expands the images of a page to avoid blank area.
 *  - Requires images to be blocks.
 *  - The shrink algorithm handles the break points avoided inside ancestors,
 *    but does not check the validity of the new break point (the break-before of the next box is not known).
 *  - Should be included last.
 */
postscriptum.plugin('sc-avoid-image-blanks', (processor) => {
    const { css, util, layout } = postscriptum;
    const { logger, rects, ranges, walk } = util;
    function process(shrinkOnly = false) {
        const ctx = this.layoutContext;
        if (ctx.parentCtx)
            return;
        if (!walk.isBlockElement(ranges.nodeAtPoint(ctx.breakPoint)))
            return;
        const { breakedBox, boxes } = ctx;
        const breakedBoxIndex = boxes.indexOf(breakedBox);
        if (breakedBoxIndex < 1 || !breakedBox.mainBlock)
            return;
        const lastBox = boxes[breakedBoxIndex - 1];
        const pageBodyRect = rects.boundingScrollRect(this.currentFragment.body);
        const minBlankHeightProp = css.getCustomPluginProp(this.currentFragment.container, 'sc-aib-min-blank-height');
        if (!minBlankHeightProp)
            return;
        const minBlankHeight = css.computeLength(minBlankHeightProp, pageBodyRect.height);
        const blankHeight = pageBodyRect.bottom - lastBox.bottom;
        if (blankHeight < minBlankHeight)
            return;
        const dimByImg = new Map();
        const shrinkByImg = new Map();
        let shrinkImgsHeight = 0;
        let shrinkImgsMinHeight = 0;
        const expandByImg = new Map();
        let expandImgsHeight = 0;
        let expandImgsMaxHeight = 0;
        // TODO max-width not supported
        // TODO max-height not supported
        for (const box of boxes) {
            if (box.mainBlock) {
                const img = box.mainBlock;
                const shrinkProp = css.getCustomPluginProp(img, 'sc-aib-max-shrink');
                const expandProp = css.getCustomPluginProp(img, 'sc-aib-max-expand');
                if (shrinkProp || expandProp) {
                    const style = getComputedStyle(img);
                    const width = parseFloat(style.width);
                    const height = parseFloat(style.height);
                    dimByImg.set(img, { width, height });
                    const parentStyle = getComputedStyle(img.parentElement);
                    const parentWidth = parseFloat(parentStyle.width);
                    const parentHeight = parseFloat(parentStyle.height);
                    if (shrinkProp) {
                        const minWidth = css.computeMinOrMaxLength(style.minWidth, parentWidth, 0);
                        const minHeight = css.computeMinOrMaxLength(style.minHeight, parentHeight, 0);
                        if (!isNaN(minWidth) && !isNaN(minHeight)) {
                            const shrink = Math.max(minWidth / width, minHeight / height, parseFloat(shrinkProp));
                            if (shrink < 1) {
                                shrinkByImg.set(img, shrink);
                                shrinkImgsHeight += height;
                                shrinkImgsMinHeight += height * shrink;
                            }
                        }
                    }
                    if (!shrinkOnly && expandProp && box != breakedBox) {
                        // TODO Handles the padding on the page body
                        const maxWidth = css.computeMinOrMaxLength(style.maxWidth, parentWidth, pageBodyRect.width);
                        const maxHeight = css.computeMinOrMaxLength(style.maxHeight, parentHeight, pageBodyRect.height);
                        if (!isNaN(maxWidth) && !isNaN(maxHeight)) {
                            const expand = Math.min(maxWidth / width, maxHeight / height, parseFloat(expandProp));
                            if (expand > 1) {
                                expandByImg.set(img, expand);
                                expandImgsMaxHeight += height * expand;
                                expandImgsHeight += height;
                            }
                        }
                    }
                }
                if (box == breakedBox)
                    break;
            }
        }
        if (shrinkByImg.has(breakedBox.mainBlock) && !breakedBox.avoidBreakAfter) {
            let bottom = breakedBox.bottom;
            let breakAvoidedParent = layout.testAvoidBreakInside(breakedBox.mainBlock, ctx, this.avoidBreakTypes, ctx.breakPoint);
            if (breakAvoidedParent) {
                while (!walk.isStatic(breakAvoidedParent.nextElementSibling)) {
                    const parent = breakAvoidedParent.parentElement;
                    if (parent == ctx.root.parentNode)
                        break;
                    breakAvoidedParent = breakAvoidedParent.parentElement;
                }
                if (breakAvoidedParent != this.currentFragment.body)
                    bottom = util.rects.boundingScrollRect(breakAvoidedParent).bottom;
            }
            let overflowHeight = bottom - pageBodyRect.bottom;
            if (overflowHeight > 0 && overflowHeight <= shrinkImgsHeight - shrinkImgsMinHeight) {
                const sortedByShrink = Array.from(shrinkByImg.keys()).sort((img1, img2) => {
                    return shrinkByImg.get(img2) * dimByImg.get(img2).height - shrinkByImg.get(img1) * dimByImg.get(img1).height;
                });
                let targetShrink = (shrinkImgsHeight - overflowHeight) / shrinkImgsHeight;
                let shrinkedCount = 0;
                for (const img of sortedByShrink) {
                    const shrink = Math.max(targetShrink, shrinkByImg.get(img));
                    const { width, height } = dimByImg.get(img);
                    const ratio = width / height;
                    const newHeight = height * shrink;
                    img.style.height = newHeight + 'px';
                    img.style.width = (newHeight * ratio) + 'px';
                    shrinkImgsHeight -= height;
                    overflowHeight -= (height - newHeight);
                    targetShrink = (shrinkImgsHeight - overflowHeight) / shrinkImgsHeight;
                    shrinkedCount++;
                }
                ctx.breakPoint = breakAvoidedParent ? ranges.positionAfter(breakAvoidedParent) : ranges.rangeEnd(breakedBox.range);
                ctx.breakedBox = null;
                logger.info(`${shrinkByImg.size} images shrinked.`, 'sc-avoid-image-blanks');
                return 'break-point-found';
            }
        }
        if (expandByImg.size) {
            let underflowHeight = pageBodyRect.bottom - lastBox.bottom;
            const sortedByExpand = Array.from(expandByImg.keys()).sort((img1, img2) => {
                return expandByImg.get(img2) * dimByImg.get(img2).height - expandByImg.get(img1) * dimByImg.get(img1).height;
            });
            let targetExpand = (expandImgsHeight + underflowHeight) / expandImgsHeight;
            let expandedCount = 0;
            for (const img of sortedByExpand) {
                const expand = Math.min(targetExpand, expandByImg.get(img));
                const { width, height } = dimByImg.get(img);
                const ratio = width / height;
                const newHeight = height * expand;
                img.style.height = newHeight + 'px';
                img.style.width = (newHeight * ratio) + 'px';
                expandImgsHeight -= height;
                underflowHeight -= (newHeight - height);
                targetExpand = (expandImgsHeight + underflowHeight) / expandImgsHeight;
                expandedCount++;
            }
            logger.info(`${expandByImg.size} images expanded.`, 'sc-avoid-image-blanks');
            return 'break-point-found';
        }
    }
    processor.on('valid-break-point', function () {
        return process.call(this);
    });
    processor.on('no-break-point', function () {
        return process.call(this, true);
    });
});
