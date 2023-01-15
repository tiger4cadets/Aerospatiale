var slideshow = {
	fBtnPath : "ide:root/chi:nav.tools",
	fHomePath : "ide:home",
	fTocPath : "ide:tocFrame",
	fTocScrollPath : "ide:tocScroll",
	fIsHome : true,
	fReady : false,
	fObjectives : false,
	fMap : false,
	fTools : false,
	fToc : null,
	fTocSrl : null,
	fTglBtn : null,
	fSldCnt : [],
	fAltBlkCnt : [],
	fTocEntries : {},
	fSldList : [],
	fSldCount : 0,
	fBlkCount : 0,
	fCounterTemplate : '<span class="sld">øcurrentSlideø</span><span class="blk">.øcurrentBlockInSlideø</span>', // Available : øcurrentSlideø, øtotalSlidesø, øcurrentBlockø, øcurrentBlockInSlideø, øtotalBlocksø, øblock%ø, øslide%ø
	fStrings : ["menu","",
		"Cacher le menu (touche M)","Afficher le menu (touche M)",
		"défilement haut","Faire défiler le menu vers le haut",
		"défilement bas","Faire défiler le menu vers le bas"],

	/* === Public ============================================================= */
	init : function() {
		try{
			if (scHPS.fDisabled) return;
			this.fHome = scPaLib.findNode(this.fHomePath);
			this.fToc = scPaLib.findNode(this.fTocPath);
			this.fTocSrl = scPaLib.findNode(this.fTocScrollPath);
			this.fProgressBar = scPaLib.findNode("des:.progressbar");
			this.fProgressBar.className = this.fProgressBar.className + " prog_0";
			scDynUiMgr.addElement("div", this.fProgressBar, "progCount");
			// init toc position
			if(scHPS.fStore.get("tocClose") == "false") this.openToc();
			else this.closeToc();
			// Init all sub tocs
			var vSubs = scPaLib.findNodes("des:ul.tocListOpen",sc$("toc"));
			for (var i=0; i < vSubs.length; i++) {
				vSubs[i].fTglBtn = scPaLib.findNode("psi:button",vSubs[i]);
			}
			var vFirstSubs = scPaLib.findNodes("chi:li/chi:ul.tocListOpen",sc$("toc"));
			for (var i=0; i < vFirstSubs.length; i++) this.toggleMenuItem(vFirstSubs[i].fTglBtn, true);
			var vTocEntries = scPaLib.findNodes("des:a", this.fTocSrl);
			for (var i=0; i < vTocEntries.length; i++){
				var vTocEntry = vTocEntries[i];
				vTocEntry.fIdx = i;
				this.fTocEntries[vTocEntry.hash.substring(1)] = vTocEntry;
			}
			scPresMgr.toggleKeyboardNavigation(false);
			// Register scPresMgr listeners
			scPresMgr.register("onSldShow",this.onHpsSldShow);
			scPresMgr.register("onSldRestart",this.onHpsSldShow);
			scPresMgr.register("onBlkShow",this.onHpsBlkShow);
			scPresMgr.register("onAction",this.onHpsAction);
			scPresMgr.register("onKeyPress",this.onHpsKeyPress);
			scOnLoads[scOnLoads.length] = this;
			// Add SiRule to keep current selected element visible
			this.fKeepVis = new this.EnsureVisibleTask("des:a.selected",this.fTocSrl);
			scSiLib.addRule(this.fHome, this);
			this.resizeHome();

			window.addEventListener("keyup", function(pEvt){slideshow.sOnKeyUp(pEvt)},false);
		} catch(e){
			scCoLib.log("ERROR - slideshow.init : "+e);
		}
	},

	/** slideshow.onLoad */
	onLoad : function() {
		try{
			this.fSldList = scPaLib.findNodes("des:.mainSlide", sc$("slideFrame"));
			for (var i = 0; i < this.fSldList.length; i++) this.fBlkCount += this.fSldList[i].fSldHdr.fBlkCount;
			this.fSldCount = this.fSldList.length;

			// Add menu toggle button
			this.fTglBtn = this.xAddBtn(scPaLib.findNode(this.fBtnPath), "btnMenu", this.xGetStr(0), (this.fOpen ? this.xGetStr(2) : this.xGetStr(3)), scPaLib.findNode(this.fBtnPath+"/chi:div"));
			this.fTglBtn.onclick = this.toggleToc;

			// Add menu scroller
			new this.ScrollTask(this.fTocSrl);

			// Init slideshow navbar slideCount
			var vNavbars = scPaLib.findNodes("des:nav.tools/chi:.navbar", sc$("root"));
			for (var i = 0; i < vNavbars.length; i++){
				var vNavbar = vNavbars[i];
				this.fSldCnt.push(scDynUiMgr.addElement("span", vNavbar, "slideCount", scPaLib.findNode("chl:button", vNavbar)))
			}
			this.updateSlideCounters();

			// Init altSlide navbar blockCount
			var vAltNavbars = scPaLib.findNodes("des:nav.tools/chi:.navbar", sc$("altSlides"));
			for (var i = 0; i < vAltNavbars.length; i++){
				var vAltNavbar = vAltNavbars[i];
				this.fAltBlkCnt.push(scDynUiMgr.addElement("span", vAltNavbar, "blockCount", scPaLib.findNode("chl:button", vAltNavbar)))
			}

			document.body.classList.remove("loading");
			this.fReady = true;
		} catch(e){
			scCoLib.log("ERROR - slideshow.onLoad : "+e);
		}
	},
	loadSortKey : "B",

	start : function(){
		if (!this.fReady) return;
		this.fIsHome = false;
		document.body.classList.add("showSlideshow");
		document.body.classList.remove("showHome");
		window.setTimeout(function(){scPresMgr.toggleKeyboardNavigation(true)}, 10);
	},

	home : function(){
		this.fIsHome = true;
		document.body.classList.add("showHome");
		document.body.classList.remove("showSlideshow");
		scPresMgr.toggleKeyboardNavigation(false);
		scPresMgr.loadSlide(scPresMgr.fFirstLocalIdx);
	},

	/** Called by the toggle button - this == slideshow.fModeHtmlBtn. */
	toggleToc : function(){
		if (scPresMgr.xResetFocus) scPresMgr.xResetFocus();
		if (slideshow.fOpen){
			slideshow.closeToc();
		} else {
			slideshow.openToc();
		}
		return false;
	},

	closeToc : function(){
		scHPS.fStore.set("tocClose","true");
		document.body.classList.add("tocClose");
		this.fOpen = false;
		if (this.fTglBtn) this.fTglBtn.title = this.xGetStr(3);
		scSiLib.fireResizedNode(document.body);
	},

	openToc : function(){
		scHPS.fStore.set("tocClose","false");
		document.body.classList.remove("tocClose");
		this.fOpen = true;
		if (this.fTglBtn) this.fTglBtn.title = this.xGetStr(2);
		if (this.fKeepVis) this.fKeepVis.resetNode();
		scSiLib.fireResizedNode(document.body);
	},

	toggleMenuItem : function(pBtn, pAuto){
		if (!pBtn) return;
		var vStatus = pBtn.className;
		var vUl = scPaLib.findNode("nsi:ul",pBtn);
		if (!vUl) return;
		vUl.fIsAuto = pAuto;
		if(vStatus == "btnToggleClosed") {
			pBtn.className = "btnToggleOpen";
			pBtn.innerHTML = '<span>V</span>';
			vUl.className = vUl.className.replace("tocListClosed", "tocListOpen");
			vUl.style.display = "";
		} else {
			pBtn.className = "btnToggleClosed";
			pBtn.innerHTML = '<span>></span>';
			vUl.className = vUl.className.replace("tocListOpen", "tocListClosed");
			vUl.style.display = "none";
			var vOpendSubMnus = scPaLib.findNodes("des:ul.tocListOpen",vUl);
			for (var i=0; i < vOpendSubMnus.length; i++) this.toggleMenuItem(vOpendSubMnus[i].fTglBtn, true);
		}
	},

	updateProgress : function(){
		if(!this.fBlkCount) return;
		var vBlkCount = 0, vBlkCurrent = 0, vSlideBlkCount = 0;
		for (var i = 0; i < this.fSldList.length; i++){
			var vSlide = this.fSldList[i];
			if (vSlide == this.fCurrentSld){
				vBlkCurrent = vBlkCount + Number(vSlide.fSldHdr.getCurrBlkCounter())+1;
				break;
			}
			vBlkCount += vSlide.fSldHdr.fBlkCount;
		}
		this.fProgressBar.className = this.fProgressBar.className.replace(/prog_[0-9]*/gi,"prog_" + Math.floor(vBlkCurrent / this.fBlkCount * 20)*5);
		this.fProgressBar.title = Math.floor(vBlkCurrent / this.fBlkCount * 100) + "%";
	},

	updateSlideCounters : function(){
		for (var i = 0; i < this.fSldCnt.length; i++){
			var vSldCnt = this.fSldCnt[i];
			var vBlkCount = 0, vBlkCurrent = 0,  vSlideBlkCount = 0, vSlideIndex = 0;
			for (var i = 0; i < this.fSldList.length; i++){
				var vSlide = this.fSldList[i];
				if (vSlide == this.fCurrentSld){
					vSlideIndex = i+1;
					vSlideBlkCount = Number(vSlide.fSldHdr.getCurrBlkCounter())+1;
					vBlkCurrent = vBlkCount + vSlideBlkCount;
					break;
				}
				vBlkCount += vSlide.fSldHdr.fBlkCount;
			}
			vSldCnt.innerHTML = this.fCounterTemplate
				.replace("øcurrentSlideø", vSlideIndex)
				.replace("øtotalSlidesø", this.fSldCount)
				.replace("øcurrentBlockø", vBlkCurrent)
				.replace("øcurrentBlockInSlideø", vSlideBlkCount)
				.replace("øtotalBlocksø", this.fBlkCount)
				.replace("øblock%ø",Math.floor(vBlkCurrent / this.fBlkCount * 100))
				.replace("øslide%ø",Math.floor(vSlideIndex / this.fSldCount * 100));
		}// øblock%ø, øslide%ø
	},

	updateAltSlideBlockCounters : function(){
		var vSldHdr = scPresMgr.fAltSlides.fSldHdr;
		for (var i = 0; i < this.fAltBlkCnt.length; i++){
			var vAltBlkCnt = this.fAltBlkCnt[i];
			if(vSldHdr.getCurrBlkCounter().length!="") vAltBlkCnt.innerHTML =  (Number(vSldHdr.getCurrBlkCounter()) + 1) + "/" + vSldHdr.fBlkCount;
		}
	},

	/** slideshow.onHpsKeyPress : listener : this == function */
	onHpsKeyPress : function(pCharCode) {
		switch(pCharCode){
			case 77://m
				slideshow.toggleToc();break;
		}
	},

	/** slideshow.onHpsBlkShow : listener : this == function */
	onHpsBlkShow : function(pBlk) {
		try{
			if(scPresMgr.fAltSlides.fAct) slideshow.updateAltSlideBlockCounters();
			else {
				slideshow.updateProgress();
				slideshow.updateSlideCounters();
			}
			scPaLib.findNodes("des:div.ssBk")

		}catch(e){scCoLib.log("ERROR - slideshow.onBlkShow : "+e)}
	},

	/** slideshow.onHpsSldShow : listener : this == function */
	onHpsSldShow : function(pSld) {
		try{
			slideshow.fCurrentSld = pSld;
			// Menu management
			if (slideshow.fCurrentEntry) slideshow.fCurrentEntry.classList.remove("selected");
			slideshow.fCurrentEntry = slideshow.fTocEntries[pSld.id];
			if (slideshow.fCurrentEntry) slideshow.fCurrentEntry.classList.add("selected");
			// Make sure this item is visible (open all ancestors)
			var vClosedSubTocs = scPaLib.findNodes("anc:ul.tocListClosed",slideshow.fCurrentEntry);
			for (var i=0; i < vClosedSubTocs.length; i++) slideshow.toggleMenuItem(vClosedSubTocs[i].fTglBtn, true);
			// Close all other auto-opened sub menus
			var iContainedInSub = function(pSub,pNode) {
				var vAncSubs = scPaLib.findNodes("anc:ul.tocList",pNode);
				for (var i=0; i < vAncSubs.length; i++) if (vAncSubs[i] == pSub) return true;
				return false;
			};
			var iHasManuallyOpenedSub = function(pSub) {
				var vSubs = scPaLib.findNodes("des:ul.tocListOpen",pSub);
				for (var i=0; i < vSubs.length; i++) if (!vSubs[i].fIsAuto) return true;
				return false;
			};
			var vOpenedSubs = scPaLib.findNodes("des:ul.tocListOpen",sc$("toc"));
			var vFilterIsOpened = scPaLib.compileFilter("ul.tocListOpen");
			for (var i=0; i < vOpenedSubs.length; i++) {
				var vSub = vOpenedSubs[i];
				// Sub must have been automatically opened, be still opened, not be part of the ancestors of the current link an not contain any manually subs...
				if (vSub.fIsAuto && scPaLib.checkNode(vFilterIsOpened,vSub) && !iContainedInSub(vSub,slideshow.fCurrentEntry) && !iHasManuallyOpenedSub(vSub)) slideshow.toggleMenuItem(vSub.fTglBtn, true);
			}
			// If this item has children, open the sub menu
			var vTocTgler = scPaLib.findNode("nsi:button.btnToggleClosed",slideshow.fCurrentEntry);
			if (vTocTgler) slideshow.toggleMenuItem(vTocTgler, true);
			if (slideshow.fKeepVis) slideshow.fKeepVis.resetNode();
			scSiLib.fireResizedNode(slideshow.fTocSrl);
			slideshow.updateProgress();
			slideshow.updateSlideCounters();
		}catch(e){scCoLib.log("ERROR - slideshow.onSldShow : "+e)}
	},

	/** slideshow.onHpsAction : listener : this == function */
	onHpsAction : function(pAct) {
		try{
			if(pAct=="showAltSlide"){
				if(scPresMgr.fAltSlides.fAct) slideshow.updateAltSlideBlockCounters();
			}
		}catch(e){scCoLib.log("ERROR - slideshow.onAction : "+e)}
	},

	/** slideshow.resizeHome  */
	resizeHome : function() {
		var vBaseFontSize = Math.round(Math.sqrt(this.fHome.offsetHeight / 600 * this.fHome.offsetWidth / 800) * scHPS.fDefaultFontSize);
		this.fHome.style.fontSize = vBaseFontSize+"px";
	},

	/** slideshow.onResizedAnc : Api scSiLib. */
	onResizedAnc : function(pOwnerNode, pEvent){
		if(pEvent.phase==1) this.resizeHome();
	},
	/** slideshow.ruleSortKey : Api scSiLib. */
	ruleSortKey : "AAA",

	/* === Utilities ========================================================== */
	/** slideshow.xAddBtn : Add a HTML button to a parent node. */
	xAddBtn : function(pParent, pClassName, pCapt, pTitle, pNxtSib) {
		var vBtn = pParent.ownerDocument.createElement("button");
		vBtn.className = pClassName;
		vBtn.fName = pClassName;
		if (pTitle) vBtn.setAttribute("title", pTitle);
		vBtn.innerHTML = "<span>" + pCapt + "</span>"
		if (pNxtSib) pParent.insertBefore(vBtn,pNxtSib)
		else pParent.appendChild(vBtn);
		return vBtn;
	},
	/** Reteive a string. */
	xGetStr: function(pStrId) {
		return this.fStrings[pStrId];
	},
	/** Reteive a sOnKeyUp. */
	sOnKeyUp: function(pEvt) {
		var vEvt = pEvt || window.event;
		var vCharCode = vEvt.which || vEvt.keyCode;
		var vBtn;
		switch(vCharCode) {
			case 68://D
			case 72://H
				if (slideshow.fIsHome) return;
				slideshow.home();
				return;
			case 39://->
			case 83://S
			case 67://C
				if (!slideshow.fIsHome) return;
				slideshow.start();
				return;
		}
	}
}
slideshow.ScrollTask = function (pScrollNode) {
	this.fScrollNode = pScrollNode;
	this.fScrollNode.fMgr = this;
	this.fScrollNode.style.overflow="hidden";

	// Add Scroll up button
	this.fSrlUp = scDynUiMgr.addElement("div", pScrollNode.parentNode, "tocSrlUp", pScrollNode);
	this.fSrlUp.fMgr = this;
	this.fSrlUp.onclick = function(){
		this.fMgr.fSpeed -= 2;
	}
	this.fSrlUp.onmouseover = function(){
		if(this.fMgr.fSpeed >= 0) {
			this.fMgr.fSpeed = -2;
			scTiLib.addTaskNow(this.fMgr);
		}
	}
	this.fSrlUp.onmouseout = function(){
		this.fMgr.fSpeed = 0;
	}
	var vSrlUpBtn = slideshow.xAddBtn(this.fSrlUp, "tocSrlUpBtn", slideshow.xGetStr(4), slideshow.xGetStr(5));
	vSrlUpBtn.fMgr = this;
	vSrlUpBtn.onclick = function(){
		this.fMgr.step(-20);
		if (scPresMgr.xResetFocus) scPresMgr.xResetFocus();
		return false;
	}
	// Add Scroll down button
	this.fSrlDwn = scDynUiMgr.addElement("div", pScrollNode.parentNode, "tocSrlDwn");
	this.fSrlDwn.fMgr = this;
	this.fSrlDwn.onclick = function(){
		this.fMgr.fSpeed += 2;
	}
	this.fSrlDwn.onmouseover = function(){
		if(this.fMgr.fSpeed <= 0) {
			this.fMgr.fSpeed = 2;
			scTiLib.addTaskNow(this.fMgr);
		}
	}
	this.fSrlDwn.onmouseout = function(){
		this.fMgr.fSpeed = 0;
	}
	var vSrlDwnBtn = slideshow.xAddBtn(this.fSrlDwn, "tocSrlDwnBtn", slideshow.xGetStr(6), slideshow.xGetStr(7));
	vSrlDwnBtn.fMgr = this;
	vSrlDwnBtn.onclick = function(){
		this.fMgr.step(20);
		if (scPresMgr.xResetFocus) scPresMgr.xResetFocus();
		return false;
	}
	// Init scroll manager
	this.checkBtn();
	scSiLib.addRule(pScrollNode, this);
	pScrollNode.onscroll = function(){this.fMgr.checkBtn()};
	pScrollNode.onmousewheel = function(){this.fMgr.step(Math.round(-event.wheelDelta/(scCoLib.isIE ? 60 : 40)))}; //IE, Safari, Chrome, Opera.
	if(pScrollNode.addEventListener) pScrollNode.addEventListener('DOMMouseScroll', function(pEvent){this.fMgr.step(pEvent.detail)}, false);
}
slideshow.ScrollTask.prototype = {
	fClassOffUp : "btnOff",
	fClassOffDown : "btnOff",
	fSpeed : 0,
	execTask : function(){
		try {
			if(this.fSpeed == 0) return false;
			this.fScrollNode.scrollTop += this.fSpeed;
			return true;
		}catch(e){
			this.fSpeed = 0;
			return false;
		}
	},
	step: function(pPx) {
		try { this.fScrollNode.scrollTop += pPx; }catch(e){}
	},
	checkBtn: function(){
		var vScrollTop = this.fScrollNode.scrollTop;
		var vBtnUpOff = this.fSrlUp.className.indexOf(this.fClassOffUp);
		if(vScrollTop <= 0) {
			if(vBtnUpOff < 0) this.fSrlUp.className+= " "+this.fClassOffUp;
		} else {
			if(vBtnUpOff >= 0) this.fSrlUp.className = this.fSrlUp.className.substring(0, vBtnUpOff);
		}
		var vContentH = scSiLib.getContentHeight(this.fScrollNode);
		var vBtnDownOff = this.fSrlDwn.className.indexOf(this.fClassOffDown);
		if( vContentH - vScrollTop <= this.fScrollNode.offsetHeight){
			if(vBtnDownOff < 0) this.fSrlDwn.className+= " "+this.fClassOffDown;
		} else {
			if(vBtnDownOff >=0) this.fSrlDwn.className = this.fSrlDwn.className.substring(0, vBtnDownOff);
		}
	},
	onResizedAnc:function(pOwnerNode, pEvent){
		if(pEvent.phase==2) this.checkBtn();
	},
	ruleSortKey : "checkBtn"
}

slideshow.EnsureVisibleTask = function (pPathNode, pContainer) {
	//sc size rule that ensures a given node is visible in it's container
	this.fPathNode = pPathNode;
	this.fContainer = pContainer;
	scOnLoads[scOnLoads.length] = this;
}
slideshow.EnsureVisibleTask.prototype = {
	onLoad : function() {
		try {
			this.resetNode();
			scSiLib.addRule(this.fContainer, this);
		} catch(e){scCoLib.logError("ERROR EnsureVisibleTask.onLoad",e);}
	},
	onResizedAnc : function(pOwnerNode, pEvent) {
		if(pEvent.phase==1 || pEvent.resizedNode == pOwnerNode) return;
		this.ensureVis();
	},
	onResizedDes : function(pOwnerNode, pEvent) {
		if(pEvent.phase==1) return;
		this.ensureVis();
	},
	resetNode : function() {
		this.fNode = scPaLib.findNode(this.fPathNode, this.fContainer);
		this.ensureVis();
	},
	initTask : function(pTargetScrollTop) {
		this.fTargetScrollTop = pTargetScrollTop;
		try{
			this.fEndTime = ( Date.now ? Date.now() : new Date().getTime() ) + 100;
			this.fCycles = Math.min(25, Math.max(10, Math.round(Math.abs(this.fContainer.scrollTop - this.fTargetScrollTop)/ 10)));
			scTiLib.addTaskNow(this);
		}catch(e){scCoLib.log("ERROR EnsureVisibleTask.initTask: "+e);}
	},
	execTask : function() {
		try{
			if (!scPresMgr.fEnableEffects) {
				this.precipitateEndTask();
				return false;
			}
			var vNow = Date.now ? Date.now() : new Date().getTime();
			while(this.fEndTime < vNow && this.fCycles >0) {
				//On saute des steps si le processor est trop lent.
				this.fCycles--;
				this.fEndTime += 100;
			}
			this.fCycles--;
			if(this.fCycles <= 0) {
				this.precipitateEndTask();
				return false;
			} else {
				this.fEndTime += 100;

				var vCurrScrollTop = this.fContainer.scrollTop;
				var vNewScrollTop = vCurrScrollTop - (2 * (vCurrScrollTop - this.fTargetScrollTop) / (this.fCycles+1) );
				this.fContainer.scrollTop = vNewScrollTop;
				return true;
			}
		}catch(e){scCoLib.log("ERROR EnsureVisibleTask.execTask: "+e);}
	},
	precipitateEndTask : function() {
		try{
			this.fContainer.scrollTop = this.fTargetScrollTop;
		}catch(e){scCoLib.log("ERROR EnsureVisibleTask.precipitateEndTask: "+e);}
	},
	ensureVis : function() {
		if( !this.fNode) return;
		try{
			var vParent = this.fNode.offsetParent;
			if( !vParent || vParent.tagName.toLowerCase() == "body") return;
			var vOffset = this.fNode.offsetTop;
			while(vParent != this.fContainer) {
				var vNewParent = vParent.offsetParent;
				vOffset += vParent.offsetTop;
				vParent = vNewParent;
			}
			var vOffsetMiddle = vOffset + this.fNode.offsetHeight/2;
			var vMiddle = this.fContainer.clientHeight / 2;
			this.initTask(vOffsetMiddle - vMiddle);
		} catch(e) {scCoLib.log("ERROR EnsureVisibleTask.ensureVis: "+e)}
	},
	loadSortKey : "SiZ",
	ruleSortKey : "Z"
}
