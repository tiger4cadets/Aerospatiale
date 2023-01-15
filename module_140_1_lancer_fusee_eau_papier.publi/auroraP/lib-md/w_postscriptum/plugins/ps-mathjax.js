"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
postscriptum.plugin('ps-mathjax', (processor, options) => {
    const SCRIPT_URL = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/startup.js";
    const { util } = postscriptum;
    const { io } = util;
    let config = null;
    config = {
        startup: {
            elements: [processor.source],
        },
        loader: {
            load: ["input/tex-full", "input/mml", "output/chtml"]
        },
        chtml: {}
    };
    if (options.config)
        config = merge(config, options.config);
    if (options.elements && options.elements.length)
        config.startup.elements = options.elements;
    if (options.fontsUrl)
        config.chtml.fontURL = options.fontsUrl;
    processor.on('start', async function () {
        if (this.parentFragmentor)
            return;
        window.MathJax = config;
        await io.loadScript(options.scriptUrl || SCRIPT_URL);
        await window.MathJax.startup.promise;
    });
    function merge(a, b) {
        var res = Object.assign({}, a);
        Object.keys(b).forEach(function (e) {
            if (e in res && typeof res[e] == 'object' && typeof res[e] == 'object' && !(Array.isArray(res[e]) || Array.isArray(b[e])))
                res[e] = merge(res[e], b[e]);
            else
                res[e] = b[e];
        });
        return res;
    }
}, { scriptUrl: "", fontsUrl: "", elements: [], config: null });
